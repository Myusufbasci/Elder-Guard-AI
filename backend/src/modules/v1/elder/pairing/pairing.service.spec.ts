import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PairingService } from './pairing.service';

describe('PairingService', () => {
  let service: PairingService;
  let prisma: any;
  let valkey: { incrWithExpire: jest.Mock; del: jest.Mock };
  let jwt: { signAsync: jest.Mock };
  let config: { getOrThrow: jest.Mock; get: jest.Mock };
  let authService: { issueTokens: jest.Mock };

  beforeEach(() => {
    const txCallable = (cb: any) => cb(prisma);
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      careLink: { create: jest.fn() },
      devicePairing: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      device: { create: jest.fn() },
      $transaction: jest.fn(txCallable),
    };
    valkey = {
      incrWithExpire: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('pairing.jwt.token') };
    config = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
      get: jest.fn().mockReturnValue('15m'),
    };
    authService = { issueTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }) };

    service = new PairingService(
      prisma,
      valkey as any,
      jwt as any,
      config as any,
      authService as any,
    );
  });

  describe('generateCode', () => {
    it('returns a 6-digit numeric code', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      // Make $transaction return the elder synthesized below.
      prisma.$transaction.mockImplementation(async (cb: any) => {
        prisma.user.create.mockResolvedValue({ id: 'elder-uuid', role: UserRole.ELDER });
        return cb(prisma);
      });

      const result = await service.generateCode('caregiver-uuid', {
        email: 'elder@x.com',
        firstName: 'E',
        lastName: 'L',
        dateOfBirth: new Date('1940-01-01'),
      });

      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.pairingToken).toBe('pairing.jwt.token');
      expect(result.elderId).toBe('elder-uuid');
    });

    it('rejects if email already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'someone' });
      await expect(
        service.generateCode('c', {
          email: 'taken@x.com',
          firstName: 'A',
          lastName: 'B',
          dateOfBirth: new Date('1940-01-01'),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('redeemCode', () => {
    const elderId = 'elder-uuid';
    const validPairing = {
      id: 'p1',
      code: '123456',
      elderId,
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
    };

    it('returns ELDER tokens on valid redemption', async () => {
      valkey.incrWithExpire.mockResolvedValue(1);
      prisma.devicePairing.findUnique.mockResolvedValue(validPairing);
      prisma.user.findUnique.mockResolvedValue({ id: elderId, role: UserRole.ELDER });
      const tokens = await service.redeemCode(elderId, { code: '123456' });
      expect(tokens).toEqual({ accessToken: 'a', refreshToken: 'r' });
      expect(authService.issueTokens).toHaveBeenCalledTimes(1);
      expect(valkey.del).toHaveBeenCalled(); // attempt counter cleared on success
    });

    it('returns 410 (GoneException) when code expired', async () => {
      valkey.incrWithExpire.mockResolvedValue(1);
      prisma.devicePairing.findUnique.mockResolvedValue({
        ...validPairing,
        expiresAt: new Date(Date.now() - 1),
      });
      await expect(service.redeemCode(elderId, { code: '123456' })).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('returns 409 when code already redeemed', async () => {
      valkey.incrWithExpire.mockResolvedValue(1);
      prisma.devicePairing.findUnique.mockResolvedValue({
        ...validPairing,
        redeemedAt: new Date(),
      });
      await expect(service.redeemCode(elderId, { code: '123456' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('returns 404 when code does not exist', async () => {
      valkey.incrWithExpire.mockResolvedValue(1);
      prisma.devicePairing.findUnique.mockResolvedValue(null);
      await expect(service.redeemCode(elderId, { code: '999999' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 404 when code belongs to different elder (no enumeration)', async () => {
      valkey.incrWithExpire.mockResolvedValue(1);
      prisma.devicePairing.findUnique.mockResolvedValue({
        ...validPairing,
        elderId: 'other-elder',
      });
      await expect(service.redeemCode(elderId, { code: '123456' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 429 after 5 failed attempts (brute-force throttle)', async () => {
      valkey.incrWithExpire.mockResolvedValue(6);
      try {
        await service.redeemCode(elderId, { code: '000000' });
        fail('expected 429');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });
  });
});
