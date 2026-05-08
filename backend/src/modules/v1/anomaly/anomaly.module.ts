import { Module } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';
import { AnomalyDetectorProcessor } from './anomaly-detector.processor';

// QueueModule is @Global; PrismaModule and ValkeyModule are @Global. So this
// module needs no imports — it provides the worker + service only.

@Module({
  providers: [AnomalyService, AnomalyDetectorProcessor],
  exports: [AnomalyService],
})
export class AnomalyModule {}
