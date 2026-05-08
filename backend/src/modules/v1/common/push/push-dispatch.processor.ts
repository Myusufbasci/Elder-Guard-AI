import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QueueName } from '../queue/queue-names.enum';
import type { PushDispatchJobData } from '../queue/jobs/push-dispatch.job';
import { PushService } from './push.service';

// BullMQ processor for the PUSH_DISPATCH queue.
// Producer: AnomalyService (after persisting an AnomalyEvent).
// Job payload: { anomalyEventId: string }.

@Processor(QueueName.PUSH_DISPATCH)
export class PushDispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(PushDispatchProcessor.name);

  constructor(private readonly pushService: PushService) {
    super();
  }

  async process(job: Job<PushDispatchJobData>): Promise<void> {
    this.logger.log(
      `Processing push dispatch job ${job.id} for anomaly ${job.data.anomalyEventId}`,
    );
    await this.pushService.notifyCaregiverOfAnomaly(job.data.anomalyEventId);
  }
}
