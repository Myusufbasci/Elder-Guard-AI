import type { ExecutionContext } from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard';

function makeCtx(
  user: { sub: string } | undefined,
  ip: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, ip }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    // Instantiate without the full DI container — we only test getTracker().
    guard = new (CustomThrottlerGuard as any)() as CustomThrottlerGuard;
  });

  it('returns JWT sub when authenticated user is present', async () => {
    const ctx = makeCtx({ sub: 'device-uuid-123' }, '10.0.0.1');
    const tracker = await (guard as any).getTracker(ctx);
    expect(tracker).toBe('device-uuid-123');
  });

  it('falls back to IP when no authenticated user', async () => {
    const ctx = makeCtx(undefined, '192.168.1.1');
    const tracker = await (guard as any).getTracker(ctx);
    expect(tracker).toBe('192.168.1.1');
  });

  it('falls back to IP when user object has no sub', async () => {
    const ctx = makeCtx({} as any, '172.16.0.5');
    const tracker = await (guard as any).getTracker(ctx);
    expect(tracker).toBe('172.16.0.5');
  });
});
