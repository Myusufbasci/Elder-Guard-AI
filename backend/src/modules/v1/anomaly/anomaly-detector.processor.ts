import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QueueName } from '../common/queue/queue-names.enum';
import type { AnomalyDetectJobData } from '../common/queue/jobs/anomaly-detect.job';
import { AnomalyService } from './anomaly.service';

// BullMQ worker for ANOMALY_DETECT.
// Failure semantics: any throw causes BullMQ to retry per the queue's
// defaultJobOptions (5 attempts, exponential backoff starting 1s — set in
// QueueModule). Logs include the job id and attempt count for tracing.

@Processor(QueueName.ANOMALY_DETECT)
export class AnomalyDetectorProcessor extends WorkerHost {
  private readonly logger = new Logger(AnomalyDetectorProcessor.name);

  constructor(private readonly service: AnomalyService) {
    super();
  }

  async process(job: Job<AnomalyDetectJobData>): Promise<void> {
    this.logger.debug(
      `ANOMALY_DETECT job=${job.id} attempt=${job.attemptsMade + 1} ` +
        `device=${job.data.deviceId} metric=${job.data.metric}`,
    );
    await this.service.detect(job.data);
  }
}
