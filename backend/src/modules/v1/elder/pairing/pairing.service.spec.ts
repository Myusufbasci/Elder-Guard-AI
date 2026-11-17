import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PairingService } from './pairing.service';

describe('PairingService (Valkey-backed deferred creation)', () => {
  let service: PairingService;
  let prisma: any;
  let valkey: {
    incrWithExpire: jest.Mock;
    get: jest.Mock;
    del: jest.Mock;
    setEx: jest.Mock;
    setNxEx: jest.Mock;
  };
  let authService: { issueTokens: jest.Mock };

  beforeEach(() => {
    const txCallable = (cb: any) => cb(prisma);
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      careLink: { create: jest.fn() },
      device: { create: jest.fn() },
      $transaction: jest.fn(txCallable),
    };
    valkey = {
      incrWithExpire: jest.fn().mockResolvedValue(1),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      setEx: jest.fn().mockResolvedValue(undefined),
      setNxEx: jest.fn().mockResolvedValue(true),
    };
    authService = {
      issueTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    };

    service = new PairingService(prisma, valkey as any, authService as any);
  });

  describe('generateCode', () => {
    it('returns a 6-digit code and creates NO database row (elder has no email)', async () => {
      const result = await service.generateCode('caregiver-uuid', {
        firstName: 'E',
        lastName: 'L',
        dateOfBirth: new Date('1940-01-01'),
      });

      expect(result.code).toMatch(/^\d{6}$/);
      expect(typeof result.expiresAt).toBe('string');
      // Pending pairing is stored only in Valkey — no elder persisted yet.
      expect(valkey.setNxEx).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.careLink.create).not.toHaveBeenCalled();
    });
  });

  describe('redeemCode', () => {
    const pending = JSON.stringify({
      caregiverId: 'caregiver-uuid',
      firstName: 'E',
      lastName: 'L',
      dateOfBirth: new Date('1940-01-01').toISOString(),
    });

    it('creates the elder + tokens on valid redemption', async () => {
      valkey.incrWithExpire.mockResolvedValue(1);
      valkey.get.mockResolvedValue(pending);
      prisma.user.create.mockResolvedValue({ id: 'elder-uuid', role: UserRole.ELDER });
      prisma.device.create.mockResolvedValue({ id: 'device-uuid' });

      const result = await service.redeemCode({ code: '123456' });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      expect(prisma.careLink.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ accessToken: 'a', refreshToken: 'r', deviceId: 'device-uuid' });
      expect(valkey.del).toHaveBeenCalled(); // pending + attempts cleared
      expect(authService.issueTokens).toHaveBeenCalledTimes(1);
    });

    it('returns 404 when the code has no pending pairing (invalid/expired)', async () => {
      valkey.incrWithExpire.mockResolvedValue(1);
      valkey.get.mockResolvedValue(null);
      await expect(service.redeemCode({ code: '999999' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('returns 429 after 5 failed attempts (brute-force throttle)', async () => {
      valkey.incrWithExpire.mockResolvedValue(6);
      try {
        await service.redeemCode({ code: '000000' });
        fail('expected 429');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });
});
