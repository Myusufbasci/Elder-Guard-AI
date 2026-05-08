import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { CareLinkGuard } from './care-link.guard';

function makeCtx(user: { sub: string } | undefined, params: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
}

describe('CareLinkGuard', () => {
  let prisma: { careLink: { findUnique: jest.Mock } };
  let valkey: { get: jest.Mock; setEx: jest.Mock };
  let guard: CareLinkGuard;

  beforeEach(() => {
    prisma = { careLink: { findUnique: jest.fn() } };
    valkey = { get: jest.fn(), setEx: jest.fn().mockResolvedValue(undefined) };
    guard = new CareLinkGuard(prisma as any, valkey as any);
  });

  it('returns 404 (NotFoundException) when caregiver is not linked to elder', async () => {
    valkey.get.mockResolvedValue(null);
    prisma.careLink.findUnique.mockResolvedValue(null);
    const ctx = makeCtx({ sub: 'c1' }, { elderId: 'e1' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes when CareLink exists, then caches result', async () => {
    valkey.get.mockResolvedValue(null);
    prisma.careLink.findUnique.mockResolvedValue({ caregiverId: 'c1', elderId: 'e1' });
    const ctx = makeCtx({ sub: 'c1' }, { elderId: 'e1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(valkey.setEx).toHaveBeenCalledWith(
      'auth:carelink:c1:e1',
      '1',
      60,
    );
  });

  it('hits Valkey cache and skips DB lookup', async () => {
    valkey.get.mockResolvedValue('1');
    const ctx = makeCtx({ sub: 'c1' }, { elderId: 'e1' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.careLink.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when no authenticated user', async () => {
    const ctx = makeCtx(undefined, { elderId: 'e1' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses Prisma compound `caregiverId_elderId` filter', async () => {
    valkey.get.mockResolvedValue(null);
    prisma.careLink.findUnique.mockResolvedValue({ caregiverId: 'c1', elderId: 'e1' });
    const ctx = makeCtx({ sub: 'c1' }, { elderId: 'e1' });
    await guard.canActivate(ctx);
    expect(prisma.careLink.findUnique).toHaveBeenCalledWith({
      where: { caregiverId_elderId: { caregiverId: 'c1', elderId: 'e1' } },
    });
  });
});
