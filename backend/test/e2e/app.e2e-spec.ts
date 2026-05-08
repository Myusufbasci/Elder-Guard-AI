import { Test } from '@nestjs/testing';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';

import { PrismaModule } from '../../src/modules/v1/common/prisma/prisma.module';
import { PrismaService } from '../../src/modules/v1/common/prisma/prisma.service';
import { QueueModule } from '../../src/modules/v1/common/queue/queue.module';
import { AuthModule } from '../../src/modules/v1/common/auth/auth.module';
import { PairingModule } from '../../src/modules/v1/elder/pairing/pairing.module';
import { TelemetryModule } from '../../src/modules/v1/elder/telemetry/telemetry.module';
import { AnomalyModule } from '../../src/modules/v1/anomaly/anomaly.module';
import { DashboardModule } from '../../src/modules/v1/caregiver/dashboard/dashboard.module';
import { AlertsModule } from '../../src/modules/v1/caregiver/alerts/alerts.module';
import { HealthModule } from '../../src/modules/v1/common/health/health.module';

import { CustomThrottlerGuard } from '../../src/modules/v1/common/auth/guards/custom-throttler.guard';
import { AllExceptionsFilter } from '../../src/modules/v1/common/filters/all-exceptions.filter';
import { CorrelationIdInterceptor } from '../../src/modules/v1/common/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from '../../src/modules/v1/common/interceptors/logging.interceptor';
import { TransformInterceptor } from '../../src/modules/v1/common/interceptors/transform.interceptor';
import { AuditLogInterceptor } from '../../src/modules/v1/common/interceptors/audit-log.interceptor';

/**
 * E2E smoke test — Full caregiver-elder lifecycle.
 *
 * Prerequisites:
 *   1. Postgres 18 + TimescaleDB running (docker compose up -d)
 *   2. Valkey running (same docker compose stack)
 *   3. Prisma migrations applied (npx prisma migrate deploy)
 *
 * This test covers:
 *   a. Health check (GET /v1/health)
 *   b. Register caregiver
 *   c. Login caregiver
 *   d. Generate pairing code
 *   e. Redeem pairing code (elder)
 *   f. POST telemetry batch
 *   g. Verify telemetry in DB
 *   h. GET /v1/caregiver/elders (list linked elders)
 *   i. GET /v1/caregiver/elders/:id/vitals
 *
 * Firebase/Gemini modules excluded — they require external credentials
 * not suitable for local smoke tests.
 */

// Lenient throttler tiers for tests — avoid 429s during rapid sequential requests.
const TEST_THROTTLER_TIERS = [
  { name: 'burst',  ttl: 1_000,      limit: 200 },
  { name: 'minute', ttl: 60_000,     limit: 3_000 },
  { name: 'hour',   ttl: 3_600_000,  limit: 50_000 },
  { name: 'day',    ttl: 86_400_000, limit: 100_000 },
];

// Ordered table list for truncation (respects FK constraints — children first).
const TRUNCATE_TABLES = [
  'notification_logs',
  'anomaly_events',
  'telemetry',
  'audit_logs',
  'push_tokens',
  'devices',
  'device_pairings',
  'care_links',
  'elder_profiles',
  'caregiver_profiles',
  'users',
];

describe('App E2E — Full Lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Shared state across sequential tests
  let caregiverAccessToken: string;
  let elderId: string;
  let elderAccessToken: string;
  let pairingCode: string;
  let pairingToken: string;
  let deviceId: string;

  beforeAll(async () => {
    // Set test environment variables (fallback to dev defaults if not set)
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL ??=
      'postgresql://eldercare:eldercare_dev_password@localhost:5432/eldercare_dev';
    process.env.REDIS_URL ??= 'redis://localhost:6379';
    process.env.JWT_ACCESS_SECRET ??=
      'e2e-test-access-secret-must-be-at-least-32-characters-long';
    process.env.JWT_REFRESH_SECRET ??=
      'e2e-test-refresh-secret-must-be-at-least-32-characters-long';
    process.env.JWT_PAIRING_SECRET ??=
      'e2e-test-pairing-secret-must-be-at-least-32-characters-long';
    process.env.JWT_ACCESS_TTL ??= '8h';
    process.env.JWT_REFRESH_TTL ??= '30d';
    process.env.JWT_PAIRING_TTL ??= '15m';
    process.env.BCRYPT_ROUNDS ??= '10';
    process.env.LOG_LEVEL ??= 'error';

    // Build test module — excludes PushModule + AiSummaryModule (external deps).
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        QueueModule,
        ThrottlerModule.forRoot({
          throttlers: TEST_THROTTLER_TIERS,
          errorMessage: 'Too many requests. Please try again later.',
        }),
        AuthModule,
        PairingModule,
        TelemetryModule,
        AnomalyModule,
        DashboardModule,
        AlertsModule,
        HealthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: CustomThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
        { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    prisma = app.get(PrismaService);

    await app.init();

    // Truncate all tables to ensure clean state
    await truncateAll(prisma);
  }, 60_000); // 60s timeout for module bootstrap + DB connection

  afterAll(async () => {
    // Clean up DB state
    await truncateAll(prisma).catch(() => {
      /* ignore cleanup errors */
    });
    await app?.close();
  }, 30_000);

  // ─── 1. Health check ──────────────────────────────────────────────
  it('GET /v1/health → 200 with status "ok"', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200);

    // TransformInterceptor wraps in { data, meta }
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('ok');
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.correlationId).toBeDefined();
  });

  // ─── 2. Register caregiver ────────────────────────────────────────
  it('POST /v1/auth/register → 201 with tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: 'caregiver-e2e@test.com',
        password: 'SecureP@ss123!',
        firstName: 'Test',
        lastName: 'Caregiver',
      })
      .expect(201);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    caregiverAccessToken = res.body.data.accessToken;
  });

  // ─── 3. Login caregiver ───────────────────────────────────────────
  it('POST /v1/auth/login → 200 with tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: 'caregiver-e2e@test.com',
        password: 'SecureP@ss123!',
      })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // Use the login token going forward
    caregiverAccessToken = res.body.data.accessToken;
  });

  // ─── 4. Generate pairing code ─────────────────────────────────────
  it('POST /v1/caregiver/elders → 201 with pairing code', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/caregiver/elders')
      .set('Authorization', `Bearer ${caregiverAccessToken}`)
      .send({
        email: 'elder-e2e@test.com',
        firstName: 'Test',
        lastName: 'Elder',
        dateOfBirth: '1945-06-15T00:00:00.000Z',
      })
      .expect(201);

    expect(res.body.data.code).toMatch(/^\d{6}$/);
    expect(res.body.data.pairingToken).toBeDefined();
    expect(res.body.data.elderId).toBeDefined();
    expect(res.body.data.expiresAt).toBeDefined();

    pairingCode = res.body.data.code;
    pairingToken = res.body.data.pairingToken;
    elderId = res.body.data.elderId;
  });

  // ─── 5. Redeem pairing code (elder) ───────────────────────────────
  it('POST /v1/elder/pairing/redeem → 200 with elder tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/elder/pairing/redeem')
      .set('Authorization', `Bearer ${pairingToken}`)
      .send({
        code: pairingCode,
        model: 'Pixel 9',
        osVersion: 'Android 16',
      })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    elderAccessToken = res.body.data.accessToken;

    // Find the Device created during redemption — needed for telemetry
    const device = await prisma.device.findFirst({
      where: { elderId },
      select: { id: true },
    });
    expect(device).not.toBeNull();
    deviceId = device!.id;
  });

  // ─── 6. POST telemetry batch ──────────────────────────────────────
  it('POST /v1/elder/telemetry → 201 with 5 heart_rate samples', async () => {
    const now = Date.now();
    const samples = Array.from({ length: 5 }, (_, i) => ({
      time: new Date(now - i * 60_000).toISOString(), // 1-min intervals
      metric: 'heart_rate',
      value: 72 + i,
      quality: 95,
    }));

    const res = await request(app.getHttpServer())
      .post('/v1/elder/telemetry')
      .set('Authorization', `Bearer ${elderAccessToken}`)
      .send({ deviceId, samples })
      .expect(201);

    expect(res.body.data.inserted).toBe(5);
  });

  // ─── 7. Verify telemetry stored in DB ─────────────────────────────
  it('Telemetry rows exist in database', async () => {
    const count = await prisma.telemetry.count({
      where: { deviceId, metric: 'heart_rate' },
    });
    expect(count).toBe(5);
  });

  // ─── 8. List linked elders ────────────────────────────────────────
  it('GET /v1/caregiver/elders → 200 with linked elder', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/caregiver/elders')
      .set('Authorization', `Bearer ${caregiverAccessToken}`)
      .expect(200);

    const elders = res.body.data;
    expect(Array.isArray(elders)).toBe(true);
    expect(elders.length).toBe(1);
    expect(elders[0].id).toBe(elderId);
    expect(elders[0].firstName).toBe('Test');
    expect(elders[0].lastName).toBe('Elder');
  });

  // ─── 9. Get vitals ───────────────────────────────────────────────
  it('GET /v1/caregiver/elders/:id/vitals → 200', async () => {
    // Vitals reads from telemetry_1h continuous aggregate.
    // On a fresh DB the aggregate may not have refreshed yet,
    // so we only assert the endpoint returns 200 with the correct shape.
    const res = await request(app.getHttpServer())
      .get(`/v1/caregiver/elders/${elderId}/vitals`)
      .set('Authorization', `Bearer ${caregiverAccessToken}`)
      .expect(200);

    // Response is an object keyed by metric (may be empty if aggregate hasn't refreshed)
    expect(typeof res.body.data).toBe('object');
    expect(res.body.meta).toBeDefined();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────

async function truncateAll(prisma: PrismaService): Promise<void> {
  // TRUNCATE CASCADE respects FK constraints
  for (const table of TRUNCATE_TABLES) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE "${table}" CASCADE`,
    ).catch(() => {
      /* table may not exist on first run before migrations */
    });
  }
}
