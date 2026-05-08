import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ANOMALY_DETECT_JOB,
  type AnomalyDetectJobData,
} from '../../common/queue/jobs/anomaly-detect.job';
import { QueueName } from '../../common/queue/queue-names.enum';
import { ALLOWED_METRICS } from './dto/telemetry-sample.dto';
import type { IngestTelemetryDto } from './dto/ingest-telemetry.dto';
import type { IngestResultDto } from './dto/ingest-result.dto';

// Telemetry ingest service.
//
// Two responsibilities, in order:
//   1. Bulk-insert samples to the TimescaleDB hypertable via a single
//      parameterized INSERT (Prisma's ORM API has no native bulk path for
//      composite-PK upsert, hence raw SQL).
//   2. Enqueue one ANOMALY_DETECT job per distinct metric in the batch.
//      Dedupe by metric so a 200-sample batch of HR readings produces
//      exactly one detector run.
//
// Security:
//   - Caller's `elderId` (JWT sub) must match `Device.elderId`. On mismatch
//     we throw 404 (not 403) to avoid existence enumeration — same pattern
//     as CareLinkGuard.

@Injectable()
export class TelemetryService {
  private static readonly METRIC_SET = new Set(ALLOWED_METRICS);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @InjectQueue(QueueName.ANOMALY_DETECT)
    private readonly anomalyQueue: Queue<AnomalyDetectJobData>,
  ) {}

  async ingest(elderId: string, dto: IngestTelemetryDto): Promise<IngestResultDto> {
    // Re-check the metric set defensively. The DTO already enforces this via
    // class-validator @IsIn, but services should never trust their callers.
    for (const s of dto.samples) {
      if (!TelemetryService.METRIC_SET.has(s.metric)) {
        throw new ForbiddenException('Invalid metric');
      }
    }

    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
      select: { id: true, elderId: true },
    });
    if (!device || device.elderId !== elderId) {
      throw new NotFoundException('Device not found');
    }

    const inserted = await this.bulkInsert(dto);

    // Enqueue one detector job per distinct metric in this batch.
    const metrics = new Set(dto.samples.map((s) => s.metric));
    await Promise.all(
      [...metrics].map((metric) =>
        this.anomalyQueue.add(ANOMALY_DETECT_JOB, {
          deviceId: dto.deviceId,
          elderId,
          metric,
        }),
      ),
    );

    return { inserted };
  }

  // Build a single parameterized INSERT and execute via $executeRawUnsafe.
  // Placeholder safety:
  //   - Only the placeholder template ($1, $2, ...) is concatenated into the
  //     SQL string. Every value travels as a separate argument.
  //   - The column list is hard-coded; no dynamic identifiers.
  private async bulkInsert(dto: IngestTelemetryDto): Promise<number> {
    const COLS_PER_ROW = 5;
    const params: unknown[] = [];
    const valueClauses: string[] = [];

    for (let i = 0; i < dto.samples.length; i++) {
      const s = dto.samples[i];
      const base = i * COLS_PER_ROW;
      // (time, device_id, metric, value, quality, ingested_at=NOW())
      valueClauses.push(
        `($${base + 1}::timestamptz, $${base + 2}::uuid, $${base + 3}, $${base + 4}::double precision, $${base + 5}::smallint, NOW())`,
      );
      params.push(
        s.time,
        dto.deviceId,
        s.metric,
        s.value,
        s.quality === undefined ? null : s.quality,
      );
    }

    const sql =
      'INSERT INTO telemetry (time, device_id, metric, value, quality, ingested_at) VALUES ' +
      valueClauses.join(', ') +
      ' ON CONFLICT (time, device_id, metric) DO NOTHING';

    const affected = await this.prisma.$executeRawUnsafe(sql, ...params);
    return typeof affected === 'number' ? affected : dto.samples.length;
  }
}
