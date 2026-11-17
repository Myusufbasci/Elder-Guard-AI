import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPurpose, UserRole, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as firebaseAdmin from 'firebase-admin';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import { MailService } from '../mail/mail.service';
import type { AuthTokens } from './dto/auth-tokens.dto';
import type { GoogleLoginDto } from './dto/google-login.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterCaregiverDto } from './dto/register-caregiver.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { REFRESH_JTI_PREFIX } from './strategies/jwt-refresh.strategy';

// Email-verification token store (Valkey): emailverify:<token> -> userId.
// Mirrors the pairing-code pattern — token lives only in Valkey, auto-expires.
const EMAIL_VERIFY_PREFIX = 'emailverify:';
const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60; // 24h
// Per-user resend cooldown so the "resend" button can't be spammed.
const EMAIL_VERIFY_COOLDOWN_PREFIX = 'emailverify:cooldown:';
const EMAIL_VERIFY_COOLDOWN_SECONDS = 60;

// Shape returned by GET /v1/auth/me — what a client needs to render the
// account state (including whether to show the "verify your email" banner).
export interface MeResponse {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
}

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
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterCaregiverDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    // ConfigService returns env vars as strings; bcrypt.hash treats a string
    // second arg as a salt (not a cost factor), producing "Invalid salt".
    // Coerce to a number so a generated salt with the right cost is used.
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));
    const saltRounds = Number.isInteger(rounds) && rounds >= 4 && rounds <= 31 ? rounds : 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: UserRole.CAREGIVER,
        // emailVerified defaults to false — caregiver must confirm via the link.
        firstName: dto.firstName,
        lastName: dto.lastName,
        caregiverProfile: { create: {} },
      },
    });

    // Soft verification: fire off the email but still log the user in. Mail is
    // sent fire-and-forget so a slow/blocked SMTP server never delays (or fails)
    // the registration response. Errors are logged inside MailService.
    void this.sendVerificationFor(user).catch(() => undefined);

    // Demo: link shared demo elders so they appear in this new caregiver account.
    await this.linkDemoElders(user.id).catch(() => undefined);

    return this.issueTokens(user);
  }

  // Demo-only: optionally link a fresh caregiver to a fixed set of shared "demo"
  // elder profiles so they show up in every account during presentations. Driven
  // by DEMO_ELDER_IDS (comma-separated UUIDs); empty/unset → no-op (normal flow).
  private async linkDemoElders(caregiverId: string): Promise<void> {
    const raw = this.config.get<string>('DEMO_ELDER_IDS', '');
    const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return;
    // Only link ids that really exist as ELDER users (defensive against typos).
    const elders = await this.prisma.user.findMany({
      where: { id: { in: ids }, role: UserRole.ELDER },
      select: { id: true },
    });
    if (elders.length === 0) return;
    await this.prisma.careLink.createMany({
      data: elders.map((e) => ({ caregiverId, elderId: e.id })),
      skipDuplicates: true,
    });
  }

  /**
   * Generate a one-time verification token, stash it in Valkey, and email the
   * link. No-op-safe: if the user has no email (shouldn't happen for caregivers)
   * or is already verified, returns without sending. Never throws.
   */
  private async sendVerificationFor(user: User): Promise<void> {
    if (!user.email || user.emailVerified) return;
    const token = randomUUID();
    await this.valkey.setEx(`${EMAIL_VERIFY_PREFIX}${token}`, user.id, EMAIL_VERIFY_TTL_SECONDS);
    await this.mail.sendVerificationEmail(user.email, user.firstName, token);
  }

  /** Public endpoint: consume a verification token and flip emailVerified. */
  async verifyEmail(token: string): Promise<{ verified: true }> {
    const key = `${EMAIL_VERIFY_PREFIX}${token}`;
    const userId = await this.valkey.get(key);
    if (!userId) throw new NotFoundException('Invalid or expired verification token');
    // Single-use: delete first so a replayed link can't re-trigger anything.
    await this.valkey.del(key);
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    return { verified: true };
  }

  /** Authenticated: re-send the verification email (with a short cooldown). */
  async resendVerification(userId: string): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified || !user.email) return { sent: false };

    const fresh = await this.valkey.setNxEx(
      `${EMAIL_VERIFY_COOLDOWN_PREFIX}${userId}`,
      '1',
      EMAIL_VERIFY_COOLDOWN_SECONDS,
    );
    if (!fresh) {
      throw new ConflictException('Please wait before requesting another verification email');
    }

    await this.sendVerificationFor(user);
    return { sent: true };
  }

  /** Authenticated: current account snapshot for the client (banner state). */
  async getMe(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
    };
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
   * Google login for BOTH clients:
   *  - Web caregiver: Firebase signInWithPopup → Firebase ID token (aud = Firebase
   *    project id) → verified via firebase-admin.
   *  - Android caregiver: Credential Manager GetGoogleIdOption(serverClientId) →
   *    Google OAuth ID token (iss = accounts.google.com, aud = GOOGLE_CLIENT_ID) →
   *    verified via google-auth-library.
   * Try the Google OAuth path first (when GOOGLE_CLIENT_ID is configured), then fall
   * back to Firebase. find-or-create a CAREGIVER user from the verified email.
   */
  async googleLogin(dto: GoogleLoginDto): Promise<AuthTokens> {
    let email: string | undefined;
    let name: string | undefined;

    // 1) Google OAuth ID token (Android Credential Manager)
    const googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (googleClientId) {
      try {
        const client = new OAuth2Client(googleClientId);
        const ticket = await client.verifyIdToken({
          idToken: dto.idToken,
          audience: googleClientId,
        });
        const payload = ticket.getPayload();
        email = payload?.email;
        name = payload?.name;
      } catch {
        /* not a Google OAuth token — try Firebase below */
      }
    }

    // 2) Firebase ID token (web caregiver)
    if (!email) {
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(dto.idToken);
        email = decoded.email;
        name = decoded.name;
      } catch {
        throw new UnauthorizedException('Invalid Google ID token');
      }
    }

    if (!email) {
      throw new UnauthorizedException('Google token missing email');
    }

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      const fullName = name ?? '';
      const [firstFromName, ...restName] = fullName.split(' ');
      user = await this.prisma.user.create({
        data: {
          email,
          // Google users have no password — passwordHash stays null
          passwordHash: null,
          // Google already verified ownership of this email — skip our flow.
          emailVerified: true,
          role: UserRole.CAREGIVER,
          firstName: firstFromName || 'User',
          lastName: restName.join(' '),
          caregiverProfile: { create: {} },
        },
      });
      // New Google caregiver — link the shared demo elders too (see register()).
      await this.linkDemoElders(user.id).catch(() => undefined);
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
