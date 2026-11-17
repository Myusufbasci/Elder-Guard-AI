import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ValkeyService } from '../../common/valkey/valkey.service';
import { AuthService } from '../../common/auth/auth.service';
import type { AuthTokens } from '../../common/auth/dto/auth-tokens.dto';
import type { CreateElderDto } from './dto/create-elder.dto';
import type { PairingCodeResponse } from './dto/pairing-code-response.dto';
import type { RedeemCodeDto } from './dto/redeem-code.dto';

const PAIRING_TTL_SECONDS = 15 * 60;
const ATTEMPT_LIMIT = 5;
const ATTEMPT_KEY_PREFIX = 'pairing:attempts:';
// Pending pairings live ONLY in Valkey (no DB row) until the elder redeems the
// code. They auto-expire via TTL, so an unredeemed code never persists an elder.
const PENDING_KEY_PREFIX = 'pairing:pending:';
// Short-lived success marker so the caregiver web can detect redemption + jump
// to the freshly-created elder.
const PAIRED_KEY_PREFIX = 'pairing:paired:';
const PAIRED_MARKER_TTL = 600;

interface PendingPairing {
  caregiverId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO 8601
}

export type PairingStatus =
  | { status: 'pending'; elderId: null }
  | { status: 'paired'; elderId: string }
  | { status: 'expired'; elderId: null };

@Injectable()
export class PairingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Caregiver-side: stash the pending elder data in Valkey keyed by a fresh
   * 6-digit code. NOTHING is written to the database here — the elder
   * User/Profile/CareLink/Device are created only when the code is redeemed on
   * the elder device (see redeemCode). If the code is never redeemed it simply
   * expires (TTL) and no record is ever created. Elders have no email.
   */
  async generateCode(caregiverId: string, dto: CreateElderDto): Promise<PairingCodeResponse> {
    const pending: PendingPairing = {
      caregiverId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: new Date(dto.dateOfBirth).toISOString(),
    };

    // Allocate a code that is not already an active pending code (NX guards races).
    let code = '';
    for (let i = 0; i < 5; i++) {
      const candidate = this.generateNumericCode6();
      const ok = await this.valkey.setNxEx(
        `${PENDING_KEY_PREFIX}${candidate}`,
        JSON.stringify(pending),
        PAIRING_TTL_SECONDS,
      );
      if (ok) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new HttpException('Could not allocate pairing code', HttpStatus.SERVICE_UNAVAILABLE);

    const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000);
    return { code, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Elder-side (Android): exchange the 6-digit code for ELDER tokens. This is the
   * ONLY place the elder is persisted — atomically create User + ElderProfile +
   * CareLink + Device, then drop the pending code. Protected by 15-min TTL,
   * single-use (key deleted on success), and per-code attempt limiting.
   */
  async redeemCode(dto: RedeemCodeDto): Promise<AuthTokens & { deviceId: string }> {
    const attempts = await this.valkey.incrWithExpire(
      `${ATTEMPT_KEY_PREFIX}${dto.code}`,
      PAIRING_TTL_SECONDS,
    );
    if (attempts > ATTEMPT_LIMIT) {
      throw new HttpException('Too many pairing attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const raw = await this.valkey.get(`${PENDING_KEY_PREFIX}${dto.code}`);
    if (!raw) throw new NotFoundException('Invalid or expired pairing code');
    const pending = JSON.parse(raw) as PendingPairing;

    // Create the elder ONLY now, atomically. Elders have no email/password —
    // they authenticate solely through the paired ELDER tokens.
    const { elder, device } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: null,
          passwordHash: null,
          role: UserRole.ELDER,
          firstName: pending.firstName,
          lastName: pending.lastName,
          elderProfile: { create: { dateOfBirth: new Date(pending.dateOfBirth) } },
        },
      });
      await tx.careLink.create({
        data: { caregiverId: pending.caregiverId, elderId: created.id },
      });
      const dev = await tx.device.create({
        data: {
          elderId: created.id,
          fcmToken: dto.fcmToken ?? null,
          model: dto.model ?? null,
          osVersion: dto.osVersion ?? null,
          lastSeenAt: new Date(),
        },
      });

      // Presentation Default: Insert starting location (Elazığ Fırat Üni.) immediately
      await tx.$executeRawUnsafe(`
        INSERT INTO telemetry (time, "deviceId", metric, value, quality, "ingestedAt") 
        VALUES 
        (NOW(), $1::uuid, 'location_lat', 38.68124, NULL, NOW()),
        (NOW(), $1::uuid, 'location_lng', 39.196348, NULL, NOW())
        ON CONFLICT DO NOTHING
      `, dev.id);

      return { elder: created, device: dev };
    });

    // Consume the pending code + reset the attempt counter.
    await this.valkey.del(`${PENDING_KEY_PREFIX}${dto.code}`);
    await this.valkey.del(`${ATTEMPT_KEY_PREFIX}${dto.code}`);
    // Let the caregiver web see success and route to the new elder.
    await this.valkey.setEx(
      `${PAIRED_KEY_PREFIX}${dto.code}`,
      JSON.stringify({ elderId: elder.id, caregiverId: pending.caregiverId }),
      PAIRED_MARKER_TTL,
    );

    const tokens = await this.authService.issueTokens(elder);
    return { ...tokens, deviceId: device.id };
  }

  /**
   * Caregiver polls this with the code they were shown. `pending` = waiting for the
   * device; `paired` = elder created (returns the new elderId); `expired` = code
   * gone / never belonged to this caregiver.
   */
  async getPairingStatusByCode(caregiverId: string, code: string): Promise<PairingStatus> {
    const pending = await this.valkey.get(`${PENDING_KEY_PREFIX}${code}`);
    if (pending) {
      const p = JSON.parse(pending) as PendingPairing;
      if (p.caregiverId !== caregiverId) return { status: 'expired', elderId: null };
      return { status: 'pending', elderId: null };
    }
    const paired = await this.valkey.get(`${PAIRED_KEY_PREFIX}${code}`);
    if (paired) {
      const pr = JSON.parse(paired) as { elderId: string; caregiverId: string };
      if (pr.caregiverId !== caregiverId) return { status: 'expired', elderId: null };
      return { status: 'paired', elderId: pr.elderId };
    }
    return { status: 'expired', elderId: null };
  }

  // 100000–999999 inclusive — never a leading zero (avoids UI ambiguity).
  private generateNumericCode6(): string {
    return String(randomInt(100000, 1_000_000));
  }
}
