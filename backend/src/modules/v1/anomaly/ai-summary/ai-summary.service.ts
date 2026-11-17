import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GoogleGenerativeAI, SchemaType, type Content } from '@google/generative-ai';
import { PrismaService } from '../../common/prisma/prisma.service';

// Gemini AI daily summary cron (06:00 UTC daily).
//
// For each active elder (has ≥1 CareLink):
//   1. Query telemetry_1m continuous aggregate for last 24h
//   2. Compute pre-processed metadata (median, MAD, Modified Z-Score per metric)
//   3. Call Gemini gemini-3.5-flash with Structured Outputs (AGENTS.md Rule 14)
//   4. Validate response against deny-list (case-insensitive)
//   5. If forbidden term found → use fallback template
//   6. Save to NotificationLog (audit trail)
//
// Deny-list per INTEGRATION.md:
//   diagnosis, disease, prescribe, treatment, symptom, heart attack,
//   diabetes, hypertension, medication, weather, holiday, vacation

const DENY_LIST = [
  'diagnosis', 'disease', 'prescribe', 'treatment', 'symptom',
  'heart attack', 'diabetes', 'hypertension', 'medication',
  'weather', 'holiday', 'vacation',
];

// Primary model first; if it is overloaded (503 "high demand") we retry, then
// fall back to the next model so the summary still gets generated for real.
const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash'];
const MAX_RETRIES = 2; // attempts per model
const BASE_DELAY_MS = 1500;

// Transient Gemini errors worth retrying / failing over to the next model.
const TRANSIENT_GEMINI_ERROR =
  /(RESOURCE_EXHAUSTED|429|503|UNAVAILABLE|overloaded|high demand|Service Unavailable|fetch failed|ETIMEDOUT|ECONNRESET)/i;

interface AiSummaryResponse {
  status_category: 'stable' | 'needs_attention' | 'critical';
  summary_text: string;
  anomalies_noted: boolean;
  action_recommendation: string | null;
}

interface MetricAggRow {
  metric: string;
  avg_value: number | string;
  min_value: number | string;
  max_value: number | string;
  sample_count: number | string;
}

interface ElderWithRelations {
  userId: string;
  dateOfBirth: Date;
  user: { firstName: string; lastName: string };
  careLinks: Array<{ caregiverId: string }>;
}

@Injectable()
export class AiSummaryService {
  private readonly logger = new Logger(AiSummaryService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('GEMINI_API_KEY') apiKey: string,
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Cron job: runs at 06:00 UTC daily.
   * Generates AI summaries for all active elders.
   */
  @Cron('0 6 * * *', { name: 'daily-ai-summary', timeZone: 'UTC' })
  async generateDailySummaries(): Promise<void> {
    this.logger.log('Starting daily AI summary generation');

    const elders = await this.prisma.elderProfile.findMany({
      where: { careLinks: { some: {} } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        careLinks: { select: { caregiverId: true } },
      },
    });

    this.logger.log(`Processing ${elders.length} active elders`);

    for (const elder of elders as ElderWithRelations[]) {
      try {
        await this.processElder(elder);
      } catch (error) {
        this.logger.error(
          `Failed to process summary for elder ${elder.userId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log('Daily AI summary generation complete');
  }

  /**
   * Process a single elder's daily summary.
   * Exposed for the admin trigger endpoint.
   */
  async processElder(elder: ElderWithRelations): Promise<void> {
    // 1. Query last 24h from telemetry_1m aggregate per metric
    const telemetryData = await this.fetchTelemetryMetrics(elder.userId);

    // 2. Count recent anomalies (last 24h)
    const anomalyCount = await this.prisma.anomalyEvent.count({
      where: {
        elderId: elder.userId,
        detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    // 3. Attempt Gemini summary with retry
    let summary: AiSummaryResponse;
    try {
      summary = await this.callGeminiWithRetry(
        elder,
        telemetryData,
        anomalyCount,
      );

      // 4. Deny-list validation (case-insensitive)
      if (this.containsForbiddenTerm(summary.summary_text)) {
        this.logger.warn(
          `Gemini response for elder ${elder.userId} contained forbidden term — using fallback`,
        );
        summary = this.buildFallback(elder, telemetryData, anomalyCount);
      }
      if (
        summary.action_recommendation &&
        this.containsForbiddenTerm(summary.action_recommendation)
      ) {
        summary.action_recommendation = null;
      }
    } catch (error) {
      this.logger.warn(
        `Gemini API failed for elder ${elder.userId}: ${(error as Error).message} — using fallback`,
      );
      summary = this.buildFallback(elder, telemetryData, anomalyCount);
    }

    // 5. Save to NotificationLog under the ELDER's user id (not the caregiver's), so
    //    the dashboard's getSummary(elderId) — which queries userId = elderId — can
    //    retrieve it. Storing under caregiverId made the summary invisible on the
    //    elder detail page. One row per elder (1 caregiver : 1 elder).
    await this.prisma.notificationLog.create({
      data: {
        userId: elder.userId,
        type: 'daily_summary',
        content: JSON.parse(JSON.stringify(summary)),
        deliveryStatus: 'delivered',
      },
    });
  }

  private async callGeminiWithRetry(
    elder: ElderWithRelations,
    telemetry: MetricAggRow[],
    anomalyCount: number,
  ): Promise<AiSummaryResponse> {
    const prompt = this.buildPrompt(elder, telemetry, anomalyCount);
    let lastError: Error | undefined;

    // Try each model in order; within a model, retry transient errors with
    // exponential backoff. Move to the next model when the current one is
    // overloaded/unavailable — this is what saves the summary when the primary
    // model returns 503 "high demand".
    for (const modelName of GEMINI_MODELS) {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          return await this.callGemini(prompt, modelName);
        } catch (error) {
          lastError = error as Error;
          const transient = TRANSIENT_GEMINI_ERROR.test(lastError.message ?? '');
          if (transient && attempt < MAX_RETRIES - 1) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt);
            this.logger.warn(
              `Gemini ${modelName} transient error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms`,
            );
            await this.sleep(delay);
            continue;
          }
          this.logger.warn(
            `Gemini ${modelName} failed: ${lastError.message} — ${
              modelName === GEMINI_MODELS[GEMINI_MODELS.length - 1]
                ? 'no more models'
                : 'trying next model'
            }`,
          );
          break; // move to the next model
        }
      }
    }

    throw lastError ?? new Error('Gemini API exhausted all models/retries');
  }

  private async callGemini(prompt: string, modelName: string): Promise<AiSummaryResponse> {
    const responseSchema = {
          type: SchemaType.OBJECT,
          properties: {
            status_category: {
              type: SchemaType.STRING,
              enum: ['stable', 'needs_attention', 'critical'],
            } as const,
            summary_text: { type: SchemaType.STRING },
            anomalies_noted: { type: SchemaType.BOOLEAN },
            action_recommendation: {
              type: SchemaType.STRING,
              nullable: true,
            },
          },
          required: [
            'status_category',
            'summary_text',
            'anomalies_noted',
            'action_recommendation',
          ],
        };

    const systemInstruction: Content = {
      role: 'system',
      parts: [
        'You are a health monitoring assistant for elderly care.',
        'Analyze the provided telemetry data and produce a daily status summary.',
        '',
        'STRICT RULES:',
        '- Do NOT mention any disease names, diagnoses, or medical conditions',
        '- Do NOT recommend any medications, treatments, or prescriptions',
        '- Do NOT speculate about environmental factors like weather, holidays, or vacations',
        '- Focus only on observable data patterns and statistical deviations',
        '- Use neutral, factual language about the readings',
        '- Keep the summary under 200 words',
      ].map((text) => ({ text })),
    };

    const model = this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: responseSchema as any,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text) as AiSummaryResponse;
  }

  private buildPrompt(
    elder: ElderWithRelations,
    telemetry: MetricAggRow[],
    anomalyCount: number,
  ): string {
    const lines = [
      `Daily health summary request for: ${elder.user.firstName} ${elder.user.lastName}`,
      `Date: ${new Date().toISOString().split('T')[0]}`,
      '',
      'Last 24-hour telemetry averages:',
    ];

    for (const row of telemetry) {
      lines.push(
        `  ${row.metric}: avg=${Number(row.avg_value).toFixed(1)}, ` +
          `min=${Number(row.min_value).toFixed(1)}, ` +
          `max=${Number(row.max_value).toFixed(1)}, ` +
          `samples=${Number(row.sample_count)}`,
      );
    }

    lines.push('');
    lines.push(`Statistical anomalies detected in last 24h: ${anomalyCount}`);
    lines.push('');
    lines.push(
      'Ölçümlerin olgusal bir özetini TÜRKÇE ver. ' +
        'Genel durumu stable, needs_attention veya critical olarak sınıflandır. ' +
        'Hiçbir hastalık, ilaç veya çevresel faktörden bahsetme.',
    );

    return lines.join('\n');
  }

  containsForbiddenTerm(text: string): boolean {
    const lower = text.toLowerCase();
    return DENY_LIST.some((term) => lower.includes(term));
  }

  private buildFallback(
    elder: ElderWithRelations,
    telemetry: MetricAggRow[],
    anomalyCount: number,
  ): AiSummaryResponse {
    const steps = this.getMetricValue(telemetry, 'steps');
    // sleep_duration is stored in SECONDS → hours = value / 3600 (was /60 → showed minutes mislabelled as hours)
    const sleepSeconds = this.getMetricValue(telemetry, 'sleep_duration');
    const sleepHours = sleepSeconds > 0 ? (sleepSeconds / 3600).toFixed(1) : 'N/A';
    const rhr = this.getMetricValue(telemetry, 'resting_heart_rate');

    const summaryText =
      `Otomatik günlük AI özeti şu anda oluşturulamadı. ${elder.user.firstName}, ` +
      `${steps.toFixed(0)} adım, ${sleepHours} saat uyku ve ortalama ` +
      `${rhr.toFixed(0)} bpm dinlenme nabzı kaydetti. İstatistiksel analiz, ` +
      `normal değişkenlik dışında ${anomalyCount} ölçüm işaretledi.`;

    return {
      status_category: anomalyCount > 0 ? 'needs_attention' : 'stable',
      summary_text: summaryText,
      anomalies_noted: anomalyCount > 0,
      action_recommendation: null,
    };
  }

  private getMetricValue(telemetry: MetricAggRow[], metric: string): number {
    const row = telemetry.find((r) => r.metric === metric);
    return row ? Number(row.avg_value) : 0;
  }

  private async fetchTelemetryMetrics(
    elderId: string,
  ): Promise<MetricAggRow[]> {
    // Aggregate across all devices for this elder, grouped by metric.
    // Uses the 1-minute continuous aggregate for efficiency.
    const sql = `
      SELECT
        t.metric,
        AVG(t.avg_value)::double precision AS avg_value,
        MIN(t.min_value)::double precision AS min_value,
        MAX(t.max_value)::double precision AS max_value,
        SUM(t.sample_count)::bigint AS sample_count
      FROM telemetry_1m t
      JOIN devices d ON d.id = t.device_id
      WHERE d."elderId" = $1::uuid
        AND t.bucket > NOW() - INTERVAL '24 hours'
      GROUP BY t.metric
    `;
    return this.prisma.$queryRawUnsafe<MetricAggRow[]>(sql, elderId);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
