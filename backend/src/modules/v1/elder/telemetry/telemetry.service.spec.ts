import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

// Tests document the security-critical contract:
//   - Raw SQL is parameterized ($1, $2, ...) — never string-interpolated.
//   - A device may only accept samples from its owning elder (404, not 403,
//     to avoid existence enumeration — mirrors CareLinkGuard pattern).
//   - Anomaly jobs are deduped per (deviceId, metric) within a batch.

describe('TelemetryService', () => {
  const ELDER_ID = '00000000-0000-0000-0000-000000000001';
  const DEVICE_ID = '00000000-0000-0000-0000-0000000000aa';

  const samples: { time: string; metric: 'heart_rate' | 'steps'; value: number }[] = [
    { time: '2026-04-29T10:00:00.000Z', metric: 'heart_rate', value: 72 },
    { time: '2026-04-29T10:01:00.000Z', metric: 'heart_rate', value: 73 },
    { time: '2026-04-29T10:02:00.000Z', metric: 'steps', value: 12 },
  ];

  let prisma: { device: { findUnique: jest.Mock }; $executeRawUnsafe: jest.Mock };
  let queue: { add: jest.Mock };
  let service: TelemetryService;

  beforeEach(() => {
    prisma = {
      device: { findUnique: jest.fn().mockResolvedValue({ id: DEVICE_ID, elderId: ELDER_ID }) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(3),
    };
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    service = new TelemetryService(prisma as never, queue as never);
  });

  it('returns count of inserted samples for a valid batch', async () => {
    const result = await service.ingest(ELDER_ID, { deviceId: DEVICE_ID, samples });
    expect(result.inserted).toBe(3);
  });

  it('uses parameterized $executeRawUnsafe (no string interpolation of values)', async () => {
    await service.ingest(ELDER_ID, { deviceId: DEVICE_ID, samples });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = prisma.$executeRawUnsafe.mock.calls[0];

    // SQL must contain placeholders for every value column except the
    // server-side NOW() for ingested_at: 5 cols × 3 samples = 15 placeholders.
    expect(sql).toMatch(/INSERT INTO telemetry/i);
    expect(sql).toMatch(/\$1/);
    expect(sql).toMatch(/\$15/);

    // No raw value should appear in the SQL string itself.
    expect(sql).not.toContain(DEVICE_ID);
    expect(sql).not.toContain('72');
    expect(sql).not.toContain('heart_rate');

    // Param count = 5 cols × 3 samples = 15
    expect(params).toHaveLength(15);
    // Spot-check ordering: row1 = (time, deviceId, metric, value, quality)
    expect(params[1]).toBe(DEVICE_ID);
    expect(params[2]).toBe('heart_rate');
    expect(params[3]).toBe(72);
    expect(params[4]).toBeNull();
  });

  it('enqueues one anomaly-detect job per distinct metric in the batch', async () => {
    await service.ingest(ELDER_ID, { deviceId: DEVICE_ID, samples });
    expect(queue.add).toHaveBeenCalledTimes(2); // heart_rate, steps
    const metrics = queue.add.mock.calls.map(([, payload]) => payload.metric).sort();
    expect(metrics).toEqual(['heart_rate', 'steps']);
    for (const [, payload] of queue.add.mock.calls) {
      expect(payload.deviceId).toBe(DEVICE_ID);
      expect(payload.elderId).toBe(ELDER_ID);
    }
  });

  it('returns 404 when the device does not exist (avoids existence enumeration)', async () => {
    prisma.device.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.ingest(ELDER_ID, { deviceId: DEVICE_ID, samples }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('returns 404 (not 403) when device belongs to a different elder', async () => {
    prisma.device.findUnique.mockResolvedValueOnce({ id: DEVICE_ID, elderId: 'other' });
    await expect(
      service.ingest(ELDER_ID, { deviceId: DEVICE_ID, samples }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('forwards `quality` when provided', async () => {
    await service.ingest(ELDER_ID, {
      deviceId: DEVICE_ID,
      samples: [{ time: '2026-04-29T10:00:00.000Z', metric: 'heart_rate', value: 72, quality: 95 } as never],
    });
    const params = prisma.$executeRawUnsafe.mock.calls[0].slice(1);
    expect(params[4]).toBe(95);
  });

  // Belt-and-suspenders: even though Joi/class-validator catch invalid metrics
  // at the controller, the service rejects them too in case a future caller
  // bypasses validation.
  it('throws on a metric value outside the allowed set', async () => {
    await expect(
      service.ingest(ELDER_ID, {
        deviceId: DEVICE_ID,
        samples: [{ time: '2026-04-29T10:00:00.000Z', metric: 'unknown' as never, value: 1 }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
