import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './modules/v1/common/prisma/prisma.module';
import { ValkeyModule } from './modules/v1/common/valkey/valkey.module';
import { QueueModule } from './modules/v1/common/queue/queue.module';
import { AuthModule } from './modules/v1/common/auth/auth.module';
import { PairingModule } from './modules/v1/elder/pairing/pairing.module';
import { TelemetryModule } from './modules/v1/elder/telemetry/telemetry.module';
import { AnomalyModule } from './modules/v1/anomaly/anomaly.module';
import { PushModule } from './modules/v1/common/push/push.module';
import { PushDispatchProcessor } from './modules/v1/common/push/push-dispatch.processor';
import { AiSummaryModule } from './modules/v1/anomaly/ai-summary/ai-summary.module';
import { DashboardModule } from './modules/v1/caregiver/dashboard/dashboard.module';
import { AlertsModule } from './modules/v1/caregiver/alerts/alerts.module';
import { HealthModule } from './modules/v1/common/health/health.module';
import { CustomThrottlerGuard } from './modules/v1/common/auth/guards/custom-throttler.guard';

// Cross-cutting interceptors + filter (Pattern 4, AGENTS.md Rule 2)
import { CorrelationIdInterceptor } from './modules/v1/common/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './modules/v1/common/interceptors/logging.interceptor';
import { TransformInterceptor } from './modules/v1/common/interceptors/transform.interceptor';
import { AuditLogInterceptor } from './modules/v1/common/interceptors/audit-log.interceptor';
import { AllExceptionsFilter } from './modules/v1/common/filters/all-exceptions.filter';

// 4-tier throttler config per Pattern 3 / AGENTS.md Rule 8.
// `name` ttl is in milliseconds (@nestjs/throttler 6.x).
//   burst:  20 RPS, blocked 5 min on overflow
//   minute: 300/min
//   hour:   5,000/h
//   day:    10,000/day, blocked 24h on overflow
const THROTTLER_TIERS = [
  { name: 'burst',  ttl: 1_000,    limit: 20,    blockDuration: 5 * 60 * 1_000 },
  { name: 'minute', ttl: 60_000,   limit: 300 },
  { name: 'hour',   ttl: 3_600_000, limit: 5_000 },
  { name: 'day',    ttl: 86_400_000, limit: 10_000, blockDuration: 24 * 3_600 * 1_000 },
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    ValkeyModule,
    QueueModule,
    ThrottlerModule.forRoot({
      throttlers: THROTTLER_TIERS,
      errorMessage: 'Too many requests. Please try again later.',
    }),
    AuthModule,
    PairingModule,
    TelemetryModule,
    AnomalyModule,
    PushModule.forRootAsync(),
    AiSummaryModule,
    DashboardModule,
    AlertsModule,
    HealthModule,
  ],
  providers: [
    PushDispatchProcessor,
    // Global guard — rate limiting keyed on JWT sub (AGENTS.md Rule 8)
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    // Global exception filter — JSON error envelope (INTEGRATION.md)
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Global interceptors — order matters: CorrelationId first, then Logging,
    // then Transform (wraps response), then AuditLog (writes to DB with final data).
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class MainModule {}
