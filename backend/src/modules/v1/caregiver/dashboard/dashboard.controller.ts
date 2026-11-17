import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  /** GET /v1/caregiver/elders/:elderId/vitals/latest — Latest value per metric (raw, instant). */
  @Get(':elderId/vitals/latest')
  @UseGuards(CareLinkGuard)
  async getLatestVitals(@Param('elderId') elderId: string) {
    return this.service.getLatestVitals(elderId);
  }

  /** GET /v1/caregiver/elders/:elderId/pairing-status — Has the elder device redeemed the code yet? */
  @Get(':elderId/pairing-status')
  @UseGuards(CareLinkGuard)
  async getPairingStatus(@Param('elderId') elderId: string) {
    return this.service.getPairingStatus(elderId);
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

  /**
   * POST /v1/caregiver/elders/:elderId/summary/regenerate — On-demand AI summary.
   * Lets the caregiver generate a fresh summary without waiting for the 06:00 cron.
   * CareLinkGuard ensures the caregiver owns this elder.
   */
  @Post(':elderId/summary/regenerate')
  @UseGuards(CareLinkGuard)
  async regenerateSummary(@Param('elderId') elderId: string) {
    await this.service.triggerSummary(elderId);
    return { message: 'Summary generated' };
  }

  /**
   * DELETE /v1/caregiver/elders/:elderId — Remove an elder linked to the caregiver.
   * Cascades: ElderProfile, CareLink, Device, DevicePairing, AnomalyEvents (FK CASCADE).
   * AuditLog rows survive with userId set to NULL (FK SetNull).
   */
  @Delete(':elderId')
  @UseGuards(CareLinkGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteElder(@Param('elderId') elderId: string): Promise<void> {
    await this.service.deleteElder(elderId);
  }
}
