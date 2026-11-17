import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { AuthTokens } from '../../common/auth/dto/auth-tokens.dto';
import { RedeemCodeDto } from './dto/redeem-code.dto';
import { PairingService } from './pairing.service';

// POST /v1/elder/pairing/redeem — elder Android exchanges 6-digit code for tokens.
// The code itself is the credential: 15-min TTL, single-use, attempt-limited.
@Controller('elder/pairing')
export class ElderPairingController {
  constructor(private readonly pairing: PairingService) {}

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  redeem(@Body() dto: RedeemCodeDto): Promise<AuthTokens & { deviceId: string }> {
    return this.pairing.redeemCode(dto);
  }
}
