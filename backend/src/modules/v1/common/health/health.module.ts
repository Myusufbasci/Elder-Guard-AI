import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { TimescaleHealthIndicator } from './indicators/timescale.health';
import { ValkeyHealthIndicator } from './indicators/valkey.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [TimescaleHealthIndicator, ValkeyHealthIndicator],
})
export class HealthModule {}
