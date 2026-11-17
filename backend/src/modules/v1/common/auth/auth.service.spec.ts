import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtPurpose, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import type { MailService } from '../mail/mail.service';
import { REFRESH_JTI_PREFIX } from './strategies/jwt-refresh.strategy';

type Mock<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? jest.Mock<R, A> : T[K];
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: Mock<{ findUnique: any; create: any; update: any }> };
  let valkey: Mock<{ setEx: any; del: any; get: any; setNxEx: any }>;
  let jwt: Mock<{ signAsync: any }>;
  let config: { getOrThrow: jest.Mock; get: jest.Mock };
  let mail: Mock<{ sendVerificationEmail: any }>;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } as any };
    valkey = {
      setEx: jest.fn().mockResolvedValue(undefined),
      del: jest.fn(),
      get: jest.fn(),
      setNxEx: jest.fn().mockResolvedValue(true),
    } as any;
    jwt = { signAsync: jest.fn().mockImplementation(async (p: any, _o: any) => `signed:${p.purpose}:${p.jti}`) } as any;
    config = {
      getOrThrow: jest.fn((k: string) => `secret:${k}`),
      get: jest.fn((k: string, d?: unknown) => {
        if (k === 'JWT_ACCESS_TTL') return '8h';
        if (k === 'JWT_REFRESH_TTL') return '30d';
        if (k === 'BCRYPT_ROUNDS') return 4;
        return d;
      }),
    };
    mail = { sendVerificationEmail: jest.fn().mockResolvedValue(true) } as any;

    service = new AuthService(
      prisma as any,
      jwt as unknown as JwtService,
      valkey as any,
      config as unknown as ConfigService,
      mail as unknown as MailService,
    );
  });

  it('register hashes password and returns access+refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'uuid-1',
      email: 'a@b.c',
      role: UserRole.CAREGIVER,
      passwordHash: 'hashed',
      firstName: 'A',
      emailVerified: false,
    });

    const tokens = await service.register({
      email: 'a@b.c',
      password: 'StrongPass1!',
      firstName: 'A',
      lastName: 'B',
    });

    expect(tokens.accessToken).toMatch(/^signed:ACCESS:/);
    expect(tokens.refreshToken).toMatch(/^signed:REFRESH:/);
    // A verification email is sent on registration (soft flow — still logged in).
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith('a@b.c', 'A', expect.any(String));
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'a@b.c',
          role: UserRole.CAREGIVER,
          firstName: 'A',
          lastName: 'B',
        }),
      }),
    );
    // Refresh JTI was registered in Valkey.
    expect(valkey.setEx).toHaveBeenCalledWith(
      expect.stringContaining(REFRESH_JTI_PREFIX),
      'uuid-1',
      30 * 86400,
    );
  });

  it('register throws ConflictException if email exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.register({ email: 'a@b.c', password: 'p', firstName: 'A', lastName: 'B' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login returns 401 on wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1',
      passwordHash: await bcrypt.hash('correct', 4),
      role: UserRole.CAREGIVER,
      email: 'a@b.c',
    });
    await expect(service.login({ email: 'a@b.c', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login returns 401 when user does not exist (constant-time)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'ghost@b.c', password: 'anything' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login returns tokens on correct password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1',
      passwordHash: await bcrypt.hash('correct', 4),
      role: UserRole.CAREGIVER,
      email: 'a@b.c',
    });
    const tokens = await service.login({ email: 'a@b.c', password: 'correct' });
    expect(tokens.accessToken).toMatch(/^signed:ACCESS:/);
  });

  it('refresh deletes old JTI before issuing new pair', async () => {
    valkey.del.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1',
      role: UserRole.CAREGIVER,
      passwordHash: 'h',
      email: 'a@b.c',
    });
    const tokens = await service.refresh('uuid-1', 'old-jti');
    expect(valkey.del).toHaveBeenCalledWith(`${REFRESH_JTI_PREFIX}old-jti`);
    expect(tokens.refreshToken).toMatch(/^signed:REFRESH:/);
  });

  it('refresh throws 401 when old JTI is not in store (reuse race)', async () => {
    valkey.del.mockResolvedValue(0);
    await expect(service.refresh('uuid-1', 'old-jti')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifyEmail consumes the token and flips emailVerified', async () => {
    valkey.get.mockResolvedValue('uuid-9');
    valkey.del.mockResolvedValue(1);
    prisma.user.update.mockResolvedValue({ id: 'uuid-9', emailVerified: true });

    const res = await service.verifyEmail('tok-abc');

    expect(res).toEqual({ verified: true });
    expect(valkey.del).toHaveBeenCalledWith(expect.stringContaining('tok-abc'));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'uuid-9' },
      data: { emailVerified: true },
    });
  });

  it('verifyEmail throws NotFound on unknown/expired token', async () => {
    valkey.get.mockResolvedValue(null);
    await expect(service.verifyEmail('nope')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('resendVerification re-sends when unverified and cooldown is free', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1', email: 'a@b.c', firstName: 'A', emailVerified: false,
    });
    valkey.setNxEx.mockResolvedValue(true);

    const res = await service.resendVerification('uuid-1');

    expect(res).toEqual({ sent: true });
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith('a@b.c', 'A', expect.any(String));
  });

  it('resendVerification is a no-op when already verified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1', email: 'a@b.c', firstName: 'A', emailVerified: true,
    });
    const res = await service.resendVerification('uuid-1');
    expect(res).toEqual({ sent: false });
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('resendVerification throws Conflict while on cooldown', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1', email: 'a@b.c', firstName: 'A', emailVerified: false,
    });
    valkey.setNxEx.mockResolvedValue(false); // cooldown still active
    await expect(service.resendVerification('uuid-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('getMe returns the account snapshot incl. emailVerified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'uuid-1', email: 'a@b.c', firstName: 'A', lastName: 'B',
      role: UserRole.CAREGIVER, emailVerified: false,
    });
    const me = await service.getMe('uuid-1');
    expect(me).toEqual({
      id: 'uuid-1', email: 'a@b.c', firstName: 'A', lastName: 'B',
      role: UserRole.CAREGIVER, emailVerified: false,
    });
  });

  it('issueTokens stamps role on ACCESS payload', async () => {
    await service.issueTokens({
      id: 'u',
      role: UserRole.ELDER,
      email: 'e@e.e',
    } as any);
    const accessCall = jwt.signAsync.mock.calls.find((c: any[]) => c[0].purpose === JwtPurpose.ACCESS);
    expect(accessCall).toBeDefined();
    expect(accessCall![0].role).toBe(UserRole.ELDER);
    const refreshCall = jwt.signAsync.mock.calls.find((c: any[]) => c[0].purpose === JwtPurpose.REFRESH);
    expect(refreshCall![0].role).toBeUndefined();
  });
});
