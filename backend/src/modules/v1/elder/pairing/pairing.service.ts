import {
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPurpose, UserRole } from '@prisma/client';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ValkeyService } from '../../common/valkey/valkey.service';
import { AuthService } from '../../common/auth/auth.service';
import type { AuthTokens } from '../../common/auth/dto/auth-tokens.dto';
import type { JwtPayload } from '../../common/auth/interfaces/jwt-payload.interface';
import type { CreateElderDto } from './dto/create-elder.dto';
import type { PairingCodeResponse } from './dto/pairing-code-response.dto';
import type { RedeemCodeDto } from './dto/redeem-code.dto';

const PAIRING_TTL_SECONDS = 15 * 60;
const ATTEMPT_LIMIT = 5;
const ATTEMPT_KEY_PREFIX = 'pairing:attempts:';

@Injectable()
export class PairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  // Caregiver-side: create the elder User + ElderProfile + CareLink + DevicePairing,
  // and issue a DEVICE_PAIRING JWT carrying sub = elder.userId.
  async generateCode(caregiverId: string, dto: CreateElderDto): Promise<PairingCodeResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const code = this.generateNumericCode6();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000);

    const result = await this.prisma.$transaction(async (tx) => {
      const elder = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: null,
          role: UserRole.ELDER,
          firstName: dto.firstName,
          lastName: dto.lastName,
          elderProfile: { create: { dateOfBirth: dto.dateOfBirth } },
        },
      });
      await tx.careLink.create({
        data: { caregiverId, elderId: elder.id },
      });
      await tx.devicePairing.create({
        data: { code, elderId: elder.id, expiresAt },
      });
      return elder;
    });

    const payload: JwtPayload = {
      sub: result.id,
      purpose: JwtPurpose.DEVICE_PAIRING,
      jti: randomUUID(),
    };
    const pairingToken = await (this.jwt.signAsync as (
      p: unknown,
      o: unknown
    ) => Promise<string>)(payload, {
      secret: this.config.getOrThrow<string>('JWT_PAIRING_SECRET'),
      expiresIn: this.config.get<string>('JWT_PAIRING_TTL', '15m'),
    });

    return {
      code,
      pairingToken,
      expiresAt: expiresAt.toISOString(),
      elderId: result.id,
    };
  }

  // Elder-side (Android): authenticated by DEVICE_PAIRING JWT (sub = elderId).
  // Validates the 6-digit code with brute-force protection, marks pairing
  // redeemed, creates a Device, and returns long-lived ELDER access+refresh tokens.
  async redeemCode(elderId: string, dto: RedeemCodeDto): Promise<AuthTokens> {
    const attempts = await this.valkey.incrWithExpire(
      `${ATTEMPT_KEY_PREFIX}${elderId}`,
      PAIRING_TTL_SECONDS,
    );
    if (attempts > ATTEMPT_LIMIT) {
      throw new HttpException('Too many pairing attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const pairing = await this.prisma.devicePairing.findUnique({ where: { code: dto.code } });
    if (!pairing || pairing.elderId !== elderId) throw new NotFoundException('Invalid pairing code');
    if (pairing.redeemedAt) throw new ConflictException('Pairing code already used');
    if (pairing.expiresAt.getTime() < Date.now()) throw new GoneException('Pairing code expired');

    const elder = await this.prisma.user.findUnique({ where: { id: elderId } });
    if (!elder) throw new NotFoundException();

    await this.prisma.$transaction(async (tx) => {
      await tx.devicePairing.update({
        where: { id: pairing.id },
        data: { redeemedAt: new Date() },
      });
      await tx.device.create({
        data: {
          elderId,
          fcmToken: dto.fcmToken ?? null,
          model: dto.model ?? null,
          osVersion: dto.osVersion ?? null,
          lastSeenAt: new Date(),
        },
      });
    });

    // Reset attempt counter on success.
    await this.valkey.del(`${ATTEMPT_KEY_PREFIX}${elderId}`);

    // Issue ELDER role access+refresh tokens via the same path AuthService uses.
    return this.authService.issueTokens(elder);
  }

  // 100000–999999 inclusive — never has a leading zero (avoids UI ambiguity).
  private generateNumericCode6(): string {
    return String(randomInt(100000, 1_000_000));
  }
}
