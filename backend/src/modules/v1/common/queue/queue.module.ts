import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from './queue-names.enum';

// Global queue infrastructure (Pattern 15).
// - forRootAsync wires the Valkey connection from REDIS_URL.
//   maxRetriesPerRequest: null is required by BullMQ for blocking commands
//   (XREAD/BLPOP-style waits).
// - registerQueue declares both queues. Consumers (Processors) and producers
//   (`@InjectQueue(QueueName.X)`) are exported so feature modules can use them
//   without re-importing BullModule.
// - Default job options match REVERSE_ENGINEERING_DOC.md Pattern 15:
//     attempts 5, exponential backoff 1s base,
//     removeOnComplete 100, removeOnFail 100.

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: 100,
};

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) throw new Error('REDIS_URL not configured for BullMQ');
        return {
          connection: {
            // ioredis accepts a URL via the `path`/`url` option in BullMQ;
            // we pass host/port parts via the URL string so password and db
            // segments are honored. The literal URL works with bullmq>=5.
            url,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QueueName.ANOMALY_DETECT, defaultJobOptions: DEFAULT_JOB_OPTIONS },
      { name: QueueName.PUSH_DISPATCH, defaultJobOptions: DEFAULT_JOB_OPTIONS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
