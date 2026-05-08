import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPurpose } from '@prisma/client';
import { ValkeyService } from '../../valkey/valkey.service';
import type { AuthenticatedUser, JwtPayload } from '../interfaces/jwt-payload.interface';

// Refresh-token store key prefix. The service writes `auth:refresh:{jti} -> userId`
// on issue, and the rotation flow atomically deletes it on use.
export const REFRESH_JTI_PREFIX = 'auth:refresh:';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService, private readonly valkey: ValkeyService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.purpose !== JwtPurpose.REFRESH) {
      throw new UnauthorizedException('Invalid token purpose');
    }
    // Single-use enforcement: the JTI must still be in the Valkey store.
    // (The actual atomic DEL happens in AuthService.refresh.)
    const exists = await this.valkey.get(`${REFRESH_JTI_PREFIX}${payload.jti}`);
    if (!exists) throw new UnauthorizedException('Refresh token revoked or already used');
    return { sub: payload.sub, purpose: payload.purpose, jti: payload.jti };
  }
}
