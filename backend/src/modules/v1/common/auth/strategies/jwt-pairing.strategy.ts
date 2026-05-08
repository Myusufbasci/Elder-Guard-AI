import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPurpose } from '@prisma/client';
import type { AuthenticatedUser, JwtPayload } from '../interfaces/jwt-payload.interface';

// DEVICE_PAIRING tokens are short-lived (15 min) and unmemoized — single-use
// enforcement happens at the database layer via DevicePairing.redeemedAt
// (set atomically when the elder redeems). No Valkey JTI store needed.
//
// payload.sub = ElderProfile.userId (= User.id of the elder).
@Injectable()
export class JwtPairingStrategy extends PassportStrategy(Strategy, 'jwt-pairing') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_PAIRING_SECRET'),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (payload.purpose !== JwtPurpose.DEVICE_PAIRING) {
      throw new UnauthorizedException('Invalid token purpose');
    }
    return { sub: payload.sub, purpose: payload.purpose, jti: payload.jti };
  }
}
