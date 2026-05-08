import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPurpose, UserRole, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as firebaseAdmin from 'firebase-admin';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import type { AuthTokens } from './dto/auth-tokens.dto';
import type { GoogleLoginDto } from './dto/google-login.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterCaregiverDto } from './dto/register-caregiver.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { REFRESH_JTI_PREFIX } from './strategies/jwt-refresh.strategy';

// Refresh-token TTL in seconds (kept in sync with JWT_REFRESH_TTL).
// Used for the Valkey JTI store EX value.
function ttlStringToSeconds(ttl: string): number {
  // Supports `Ns | Nm | Nh | Nd` — the same dialect zeit/ms accepts for @nestjs/jwt.
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) throw new Error(`Invalid TTL format: ${ttl}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: throw new Error(`Invalid TTL unit: ${ttl}`);
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly valkey: ValkeyService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterCaregiverDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: UserRole.CAREGIVER,
        firstName: dto.firstName,
        lastName: dto.lastName,
        caregiverProfile: { create: {} },
      },
    });

    return this.issueTokens(user);
  }

  // Valid-format bcrypt hash used as a sentinel so missing-user / no-passwordHash
  // paths still pay the bcrypt cost (defeats timing-based email enumeration).
  // The actual cleartext that produced this hash is irrelevant — we throw on
  // any failure path regardless of comparison result.
  private static readonly DUMMY_BCRYPT_HASH =
    '$2b$12$Vx2x.u7K8cQWJ2GgI1.5..oGmRhVUQB9D4O5rJwT7vG/RbPa3GdC.';

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    const hashToCheck = user?.passwordHash ?? AuthService.DUMMY_BCRYPT_HASH;
    const passwordOk = await bcrypt.compare(dto.password, hashToCheck);

    if (!user || !user.passwordHash || !passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  // Single-use refresh: atomic DEL of the old JTI, then issue a fresh pair.
  async refresh(userId: string, oldJti: string): Promise<AuthTokens> {
    const deleted = await this.valkey.del(`${REFRESH_JTI_PREFIX}${oldJti}`);
    if (deleted === 0) {
      // Token reuse race: someone else already consumed this JTI. Reject.
      throw new UnauthorizedException('Refresh token already used');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user);
  }

  /**
   * Google login via Firebase: the web client uses Firebase signInWithPopup,
   * which mints a Firebase ID token (audience = Firebase project ID), NOT a
   * Google OAuth ID token. We verify it through firebase-admin (initialized
   * globally in PushModule) and find-or-create a CAREGIVER user.
   */
  async googleLogin(dto: GoogleLoginDto): Promise<AuthTokens> {
    let decoded: firebaseAdmin.auth.DecodedIdToken;
    try {
      decoded = await firebaseAdmin.auth().verifyIdToken(dto.idToken);
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!decoded.email) {
      throw new UnauthorizedException('Google token missing email');
    }

    let user = await this.prisma.user.findUnique({ where: { email: decoded.email } });

    if (!user) {
      const fullName = decoded.name ?? '';
      const [firstFromName, ...restName] = fullName.split(' ');
      user = await this.prisma.user.create({
        data: {
          email: decoded.email,
          // Google users have no password — passwordHash stays null
          passwordHash: null,
          role: UserRole.CAREGIVER,
          firstName: firstFromName || 'User',
          lastName: restName.join(' '),
          caregiverProfile: { create: {} },
        },
      });
    }

    return this.issueTokens(user);
  }

  // Public: PairingService also uses this to mint ELDER tokens after redemption.
  async issueTokens(user: User): Promise<AuthTokens> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessPayload: JwtPayload = {
      sub: user.id,
      purpose: JwtPurpose.ACCESS,
      role: user.role,
      jti: accessJti,
    };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      purpose: JwtPurpose.REFRESH,
      jti: refreshJti,
    };

    const accessToken = await (this.jwt.signAsync as (
      p: unknown,
      o: unknown
    ) => Promise<string>)(
      accessPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '8h'),
      },
    );
    const refreshToken = await (this.jwt.signAsync as (
      p: unknown,
      o: unknown
    ) => Promise<string>)(
      refreshPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d'),
      },
    );

    const refreshTtl = ttlStringToSeconds(this.config.get<string>('JWT_REFRESH_TTL', '30d'));
    await this.valkey.setEx(`${REFRESH_JTI_PREFIX}${refreshJti}`, user.id, refreshTtl);

    return { accessToken, refreshToken };
  }
}
