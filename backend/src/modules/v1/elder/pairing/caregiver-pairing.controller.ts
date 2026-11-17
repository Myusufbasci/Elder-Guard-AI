import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '../../common/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/auth/interfaces/jwt-payload.interface';
import { CreateElderDto } from './dto/create-elder.dto';
import type { PairingCodeResponse } from './dto/pairing-code-response.dto';
import { PairingService, type PairingStatus } from './pairing.service';

// POST /v1/caregiver/elders — caregiver creates a *pending* pairing code (no DB
// write). GET .../pairing-status?code= — poll whether the device redeemed it yet.
@Controller('caregiver/elders')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.CAREGIVER)
export class CaregiverPairingController {
  constructor(private readonly pairing: PairingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateElderDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<PairingCodeResponse> {
    return this.pairing.generateCode(req.user.sub, dto);
  }

  // GET /v1/caregiver/elders/pairing-status?code=123456
  @Get('pairing-status')
  pairingStatus(
    @Query('code') code: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ): Promise<PairingStatus> {
    return this.pairing.getPairingStatusByCode(req.user.sub, code ?? '');
  }
}
