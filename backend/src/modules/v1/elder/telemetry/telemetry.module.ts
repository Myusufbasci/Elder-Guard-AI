import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

// QueueModule is @Global so we don't import it here; @InjectQueue picks up
// the registered ANOMALY_DETECT queue token automatically.

@Module({
  imports: [AuthModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
