import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAccessGuard } from '../../common/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/auth/interfaces/jwt-payload.interface';
import { AlertsService } from './alerts.service';
import { AlertsQueryDto } from './dto/alerts-query.dto';

@Controller('caregiver/alerts')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.CAREGIVER)
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  /** GET /v1/caregiver/alerts — Paginated AnomalyEvent feed (cursor-based). */
  @Get()
  async getAlerts(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query() query: AlertsQueryDto,
  ) {
    return this.service.getAlerts(req.user.sub, {
      cursor: query.cursor,
      limit: query.limit,
      severity: query.severity,
      metric: query.metric,
      acknowledged: query.acknowledged,
    });
  }

  /** POST /v1/caregiver/alerts/:id/ack — Mark alert as acknowledged. */
  @Post(':id/ack')
  async acknowledgeAlert(
    @Param('id') alertId: string,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.service.acknowledgeAlert(alertId, req.user.sub);
  }
}
