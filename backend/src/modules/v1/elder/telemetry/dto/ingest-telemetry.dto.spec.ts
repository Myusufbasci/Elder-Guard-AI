import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngestTelemetryDto, MAX_SAMPLES_PER_BATCH } from './ingest-telemetry.dto';

// DTO-level invariants. The controller's ValidationPipe runs these checks
// before any service code executes, so a 400 here means the bad request
// never reaches the database.

const baseSample = {
  time: '2026-04-29T10:00:00.000Z',
  metric: 'heart_rate',
  value: 72,
};

const VALID_DEVICE_ID = '550e8400-e29b-41d4-a716-446655440000';

const validBody = (count: number, override?: Partial<typeof baseSample>) => ({
  deviceId: VALID_DEVICE_ID,
  samples: Array.from({ length: count }, () => ({ ...baseSample, ...override })),
});

const validateBody = async (body: unknown) => {
  const dto = plainToInstance(IngestTelemetryDto, body);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
};

describe('IngestTelemetryDto', () => {
  it('accepts 5 valid samples', async () => {
    const errs = await validateBody(validBody(5));
    expect(errs).toHaveLength(0);
  });

  it('rejects a batch over the 200-sample limit', async () => {
    const errs = await validateBody(validBody(MAX_SAMPLES_PER_BATCH + 1));
    expect(errs.length).toBeGreaterThan(0);
    expect(JSON.stringify(errs)).toMatch(/arrayMaxSize/);
  });

  it('rejects an empty samples array', async () => {
    const errs = await validateBody(validBody(0));
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects an unknown metric', async () => {
    const errs = await validateBody(validBody(1, { metric: 'blood_pressure' as never }));
    expect(errs.length).toBeGreaterThan(0);
    expect(JSON.stringify(errs)).toMatch(/isIn/);
  });

  it('rejects a non-ISO time string', async () => {
    const errs = await validateBody(validBody(1, { time: 'yesterday' }));
    expect(errs.length).toBeGreaterThan(0);
    expect(JSON.stringify(errs)).toMatch(/isIso8601/i);
  });

  it('rejects a non-UUID deviceId', async () => {
    const errs = await validateBody({ deviceId: 'not-a-uuid', samples: [baseSample] });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects quality outside 0..100', async () => {
    const errs = await validateBody({
      deviceId: '00000000-0000-0000-0000-000000000001',
      samples: [{ ...baseSample, quality: 150 }],
    });
    expect(errs.length).toBeGreaterThan(0);
  });
});
