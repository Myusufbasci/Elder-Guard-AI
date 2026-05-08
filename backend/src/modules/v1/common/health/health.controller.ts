import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { TimescaleHealthIndicator } from './indicators/timescale.health';
import { ValkeyHealthIndicator } from './indicators/valkey.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly timescale: TimescaleHealthIndicator,
    private readonly valkey: ValkeyHealthIndicator,
  ) {}

  /** GET /v1/health — Quick liveness check. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.timescale.isHealthy('timescaledb'),
    ]);
  }

  /** GET /v1/health/ready — Detailed readiness check (DB + Valkey). */
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.timescale.isHealthy('timescaledb'),
      () => this.valkey.isHealthy('valkey'),
    ]);
  }
}
