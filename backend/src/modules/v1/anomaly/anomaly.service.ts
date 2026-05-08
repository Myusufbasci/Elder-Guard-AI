import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AnomalyKind, Severity } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ValkeyService } from '../common/valkey/valkey.service';
import {
  PUSH_DISPATCH_JOB,
  type PushDispatchJobData,
} from '../common/queue/jobs/push-dispatch.job';
import { QueueName } from '../common/queue/queue-names.enum';
import type { AnomalyDetectJobData } from '../common/queue/jobs/anomaly-detect.job';

// Anomaly detection over a 24h rolling window of 1-minute bucket averages.
// Algorithm: Modified Z-Score (Mi = 0.6745 * (xi - median) / MAD).
//
// Decision tree (in order; first match wins):
//   1. Absolute bound breach on latest bucket  → THRESHOLD_BREACH / CRITICAL
//   2. |Mi| > 5.0 (extreme single)             → THRESHOLD_BREACH / CRITICAL
//   3. |Mi| > 3.5 across 3 consecutive buckets → PERSISTENCE      / HIGH
//   4. otherwise no event
//
// Throttle (per INTEGRATION.md): SETNX anomaly:{elderId}:{metric} 1 EX 300.
// Used as a gate: if the key already exists, a recent event covers this run.
// On a no-event path the key is released so the next batch can detect freely.

const WINDOW_HOURS = 24;
const MIN_WINDOW_BUCKETS = 10;
const Z_THRESHOLD = 3.5;
const Z_EXTREME = 5.0;
const PERSISTENCE_LENGTH = 3; // latest + 2 previous
const THROTTLE_TTL_SECONDS = 300;
const MAD_CONSTANT = 0.6745;

const ABSOLUTE_BOUNDS: Readonly<Record<string, readonly [number, number]>> = {
  heart_rate: [40, 160],
  resting_heart_rate: [35, 110],
};

interface BucketRow {
  bucket: Date;
  avg_value: number | string; // pg DOUBLE PRECISION may arrive as string
}

@Injectable()
export class AnomalyService {
  private readonly logger = new Logger(AnomalyService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ValkeyService) private readonly valkey: ValkeyService,
    @InjectQueue(QueueName.PUSH_DISPATCH)
    private readonly pushQueue: Queue<PushDispatchJobData>,
  ) {}

  async detect(job: AnomalyDetectJobData): Promise<void> {
    const { elderId, deviceId, metric } = job;
    const throttleKey = `anomaly:${elderId}:${metric}`;

    // Throttle gate: a recent event for the same (elder, metric) blocks
    // re-evaluation entirely. Lock TTL doubles as the rate-limit window.
    const acquired = await this.valkey.setNxEx(throttleKey, '1', THROTTLE_TTL_SECONDS);
    if (!acquired) {
      this.logger.debug(`Throttled: ${throttleKey}`);
      return;
    }

    const rows = await this.fetchWindow(deviceId, metric);
    if (rows.length < MIN_WINDOW_BUCKETS) {
      this.logger.debug(
        `Insufficient window for ${metric} on ${deviceId}: ${rows.length} buckets`,
      );
      await this.valkey.del(throttleKey);
      return;
    }

    const values = rows.map((r) => Number(r.avg_value));
    const latest = values[values.length - 1];
    const median = AnomalyService.median(values);
    const mad = AnomalyService.median(values.map((v) => Math.abs(v - median)));

    // 1. Absolute bound — independent of statistics; catches catastrophic
    // readings even on a constant baseline (MAD=0).
    const bounds = ABSOLUTE_BOUNDS[metric];
    if (bounds && (latest < bounds[0] || latest > bounds[1])) {
      // Compute Mi if MAD > 0; else 0 (statistics undefined but the bound
      // breach is still actionable).
      const mi = mad > 0 ? (MAD_CONSTANT * (latest - median)) / mad : 0;
      this.logger.warn(
        `Absolute bound breach: ${metric}=${latest} for elder=${elderId} (median=${median}, MAD=${mad}, Mi=${mi})`,
      );
      await this.flag({
        elderId,
        metric,
        kind: AnomalyKind.THRESHOLD_BREACH,
        severity: Severity.CRITICAL,
        modifiedZScore: mi,
        observedValue: latest,
        medianValue: median,
        madValue: mad,
      });
      return;
    }

    if (mad === 0) {
      this.logger.warn(
        `MAD=0 for ${metric} on ${deviceId} — constant readings; skipping Z-score detection`,
      );
      await this.valkey.del(throttleKey);
      return;
    }

    const mi = (MAD_CONSTANT * (latest - median)) / mad;

    // 2. Extreme single reading.
    if (Math.abs(mi) > Z_EXTREME) {
      this.logger.warn(
        `Extreme |Mi|=${mi.toFixed(2)} for ${metric} on ${deviceId} (latest=${latest}, median=${median}, MAD=${mad})`,
      );
      await this.flag({
        elderId,
        metric,
        kind: AnomalyKind.THRESHOLD_BREACH,
        severity: Severity.CRITICAL,
        modifiedZScore: mi,
        observedValue: latest,
        medianValue: median,
        madValue: mad,
      });
      return;
    }

    // 3. Persistence: |Mi| > 3.5 across the latest N consecutive buckets.
    if (Math.abs(mi) > Z_THRESHOLD && values.length >= PERSISTENCE_LENGTH) {
      const tail = values.slice(-PERSISTENCE_LENGTH);
      const persistent = tail.every(
        (v) => Math.abs((MAD_CONSTANT * (v - median)) / mad) > Z_THRESHOLD,
      );
      if (persistent) {
        this.logger.warn(
          `Persistence breach: ${metric} |Mi|>${Z_THRESHOLD} for ${PERSISTENCE_LENGTH} consecutive buckets on ${deviceId} (latest=${latest})`,
        );
        await this.flag({
          elderId,
          metric,
          kind: AnomalyKind.PERSISTENCE,
          severity: Severity.HIGH,
          modifiedZScore: mi,
          observedValue: latest,
          medianValue: median,
          madValue: mad,
        });
        return;
      }
    }

    // 4. No event — release throttle so the next run isn't suppressed.
    this.logger.debug(
      `No anomaly: ${metric} on ${deviceId} (latest=${latest}, median=${median}, MAD=${mad}, Mi=${mi.toFixed(2)})`,
    );
    await this.valkey.del(throttleKey);
  }

  private async fetchWindow(deviceId: string, metric: string): Promise<BucketRow[]> {
    // Reads the 1-minute continuous aggregate over the last 24h.
    // Parameterized — no string interpolation of caller values.
    const sql = `
      SELECT bucket, avg_value
      FROM telemetry_1m
      WHERE device_id = $1::uuid
        AND metric = $2
        AND bucket > NOW() - INTERVAL '${WINDOW_HOURS} hours'
      ORDER BY bucket ASC
    `;
    return this.prisma.$queryRawUnsafe<BucketRow[]>(sql, deviceId, metric);
  }

  private async flag(input: {
    elderId: string;
    metric: string;
    kind: AnomalyKind;
    severity: Severity;
    modifiedZScore: number;
    observedValue: number;
    medianValue: number;
    madValue: number;
  }): Promise<void> {
    const event = await this.prisma.anomalyEvent.create({
      data: {
        elderId: input.elderId,
        metric: input.metric,
        kind: input.kind,
        severity: input.severity,
        modifiedZScore: input.modifiedZScore,
        observedValue: input.observedValue,
        medianValue: input.medianValue,
        madValue: input.madValue,
      },
    });
    await this.pushQueue.add(PUSH_DISPATCH_JOB, { anomalyEventId: event.id });
  }

  // O(n log n) median on a copy. Adequate for a 1440-element 24h window.
  static median(input: number[]): number {
    if (input.length === 0) return 0;
    const sorted = [...input].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
}
