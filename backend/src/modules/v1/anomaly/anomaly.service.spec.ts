import { AnomalyService } from './anomaly.service';
import { AnomalyKind, Severity } from '@prisma/client';

// Tests pin the four detection paths from INTEGRATION.md "Anomaly Detection
// Semantics":
//   - normal data           → no event
//   - |Mi| > 5.0 (extreme)  → immediate event, kind=THRESHOLD_BREACH
//   - |Mi| > 3.5 + 3-bucket persistence → event, kind=PERSISTENCE
//   - absolute bounds (HR)  → event, kind=THRESHOLD_BREACH, severity=CRITICAL
//   - MAD = 0               → no event, throttle key released
//   - throttle hit          → no event, no DB read
//
// Baselines vary across {69, 70, 71} so that MAD > 0 and Modified Z-Score
// is well-defined. With median=70 and MAD=1, Mi = 0.6745 * (xi - 70).

const ELDER = '00000000-0000-0000-0000-000000000001';
const DEVICE = '00000000-0000-0000-0000-0000000000aa';

const buckets = (values: number[]) =>
  values.map((v, i) => ({
    bucket: new Date(Date.UTC(2026, 3, 29, 10, i)),
    avg_value: v,
  }));

const variedBaseline = (n: number) =>
  Array.from({ length: n }, (_, i) => 70 + (i % 3) - 1); // 69, 70, 71, 69, ...

const setup = () => {
  const valkey = { setNxEx: jest.fn().mockResolvedValue(true), del: jest.fn() };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    $queryRawUnsafe: jest.fn(),
    anomalyEvent: { create: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
  };
  const service = new AnomalyService(prisma as never, valkey as never, queue as never);
  return { prisma, valkey, queue, service };
};

describe('AnomalyService.detect', () => {
  it('does nothing when 24h window is normal', async () => {
    const { prisma, queue, service } = setup();
    const window = buckets(variedBaseline(50));
    prisma.$queryRawUnsafe.mockResolvedValue(window);

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.anomalyEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('flags an extreme single reading (|Mi| > 5.0) as THRESHOLD_BREACH', async () => {
    const { prisma, queue, service } = setup();
    const series = variedBaseline(50);
    series[series.length - 1] = 95; // Mi = 0.6745*(95-70)/1 ≈ 16.86
    prisma.$queryRawUnsafe.mockResolvedValue(buckets(series));

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.anomalyEvent.create).toHaveBeenCalledTimes(1);
    const arg = prisma.anomalyEvent.create.mock.calls[0][0];
    expect(arg.data.kind).toBe(AnomalyKind.THRESHOLD_BREACH);
    expect(Math.abs(arg.data.modifiedZScore)).toBeGreaterThan(5);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('flags persistence: 3 consecutive buckets with |Mi| > 3.5', async () => {
    const { prisma, queue, service } = setup();
    const series = variedBaseline(50);
    // Mi = 0.6745*(76-70)/1 ≈ 4.05 — over 3.5, under 5.
    series[47] = 76;
    series[48] = 76;
    series[49] = 76;
    prisma.$queryRawUnsafe.mockResolvedValue(buckets(series));

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.anomalyEvent.create).toHaveBeenCalledTimes(1);
    const arg = prisma.anomalyEvent.create.mock.calls[0][0];
    expect(arg.data.kind).toBe(AnomalyKind.PERSISTENCE);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('does NOT flag a single |Mi| > 3.5 reading without persistence', async () => {
    const { prisma, queue, service } = setup();
    const series = variedBaseline(50);
    series[49] = 76; // single elevated reading; previous 2 are baseline
    prisma.$queryRawUnsafe.mockResolvedValue(buckets(series));

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.anomalyEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('flags absolute-bound breach for HR=200 as CRITICAL', async () => {
    const { prisma, queue, service } = setup();
    const series = variedBaseline(50);
    series[49] = 200; // breaches HR upper bound (160)
    prisma.$queryRawUnsafe.mockResolvedValue(buckets(series));

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.anomalyEvent.create).toHaveBeenCalledTimes(1);
    const arg = prisma.anomalyEvent.create.mock.calls[0][0];
    expect(arg.data.kind).toBe(AnomalyKind.THRESHOLD_BREACH);
    expect(arg.data.severity).toBe(Severity.CRITICAL);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('skips detection and releases throttle when MAD = 0 (constant readings)', async () => {
    const { prisma, valkey, service } = setup();
    const flat = Array.from({ length: 50 }, () => 70);
    prisma.$queryRawUnsafe.mockResolvedValue(buckets(flat));

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.anomalyEvent.create).not.toHaveBeenCalled();
    expect(valkey.del).toHaveBeenCalledWith(expect.stringMatching(/^anomaly:/));
  });

  it('returns early when the throttle key is already set', async () => {
    const { prisma, valkey, service } = setup();
    valkey.setNxEx.mockResolvedValueOnce(false);

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.anomalyEvent.create).not.toHaveBeenCalled();
  });

  it('skips when window has fewer than 10 buckets', async () => {
    const { prisma, service } = setup();
    prisma.$queryRawUnsafe.mockResolvedValue(buckets([70, 71, 70]));

    await service.detect({ deviceId: DEVICE, elderId: ELDER, metric: 'heart_rate' });

    expect(prisma.anomalyEvent.create).not.toHaveBeenCalled();
  });
});
