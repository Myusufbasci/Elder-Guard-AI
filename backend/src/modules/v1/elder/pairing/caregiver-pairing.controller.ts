import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { JwtAccessGuard } from '../../common/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/auth/interfaces/jwt-payload.interface';
import { CreateElderDto } from './dto/create-elder.dto';
import type { PairingCodeResponse } from './dto/pairing-code-response.dto';
import { PairingService } from './pairing.service';

// POST /v1/caregiver/elders — caregiver creates an elder + pairing code.
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
}
