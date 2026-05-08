import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CareLinkGuard } from './guards/care-link.guard';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtPairingGuard } from './guards/jwt-pairing.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtPairingStrategy } from './strategies/jwt-pairing.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

// JwtModule.register({}) — per-token sign options are passed inline in
// AuthService.signAsync (separate secret + TTL per purpose). The empty
// global config exists only so JwtService is provided to consumers.
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtPairingStrategy,
    JwtAccessGuard,
    JwtRefreshGuard,
    JwtPairingGuard,
    RolesGuard,
    CareLinkGuard,
  ],
  exports: [
    AuthService,
    JwtAccessGuard,
    JwtRefreshGuard,
    JwtPairingGuard,
    RolesGuard,
    CareLinkGuard,
    JwtModule,
  ],
})
export class AuthModule {}
