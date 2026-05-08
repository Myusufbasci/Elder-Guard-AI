import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAccessGuard } from '../../common/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { CareLinkGuard } from '../../common/auth/guards/care-link.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/auth/interfaces/jwt-payload.interface';
import { DashboardService } from './dashboard.service';
import { VitalsQueryDto } from './dto/vitals-query.dto';

@Controller('caregiver/elders')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.CAREGIVER)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /** GET /v1/caregiver/elders — List all elders linked to authenticated caregiver. */
  @Get()
  async listElders(
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.service.listElders(req.user.sub);
  }

  /** GET /v1/caregiver/elders/:elderId/vitals — Continuous-aggregate readings. */
  @Get(':elderId/vitals')
  @UseGuards(CareLinkGuard)
  async getVitals(
    @Param('elderId') elderId: string,
    @Query() query: VitalsQueryDto,
  ) {
    return this.service.getVitals(elderId, query.from, query.to, query.metrics);
  }

  /** GET /v1/caregiver/elders/:elderId/location — Latest location + 24h trail. */
  @Get(':elderId/location')
  @UseGuards(CareLinkGuard)
  async getLocation(@Param('elderId') elderId: string) {
    return this.service.getLocation(elderId);
  }

  /** GET /v1/caregiver/elders/:elderId/summary — Latest AI daily summary. */
  @Get(':elderId/summary')
  @UseGuards(CareLinkGuard)
  async getSummary(@Param('elderId') elderId: string) {
    return this.service.getSummary(elderId);
  }
}
