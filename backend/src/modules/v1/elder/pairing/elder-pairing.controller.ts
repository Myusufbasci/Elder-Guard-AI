import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthTokens } from '../../common/auth/dto/auth-tokens.dto';
import { JwtPairingGuard } from '../../common/auth/guards/jwt-pairing.guard';
import type { AuthenticatedUser } from '../../common/auth/interfaces/jwt-payload.interface';
import { RedeemCodeDto } from './dto/redeem-code.dto';
import { PairingService } from './pairing.service';

// POST /v1/elder/pairing/redeem — elder Android exchanges code for tokens.
// Authenticated by DEVICE_PAIRING JWT (sub = elderId, set by caregiver flow).
@Controller('elder/pairing')
@UseGuards(JwtPairingGuard)
export class ElderPairingController {
  constructor(private readonly pairing: PairingService) {}

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  redeem(
    @Body() dto: RedeemCodeDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<AuthTokens> {
    return this.pairing.redeemCode(req.user.sub, dto);
  }
}
