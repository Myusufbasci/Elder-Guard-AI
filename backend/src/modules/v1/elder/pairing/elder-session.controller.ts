import { Controller, Delete, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAccessGuard } from '../../common/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * GET /v1/elder/me — lightweight session-validity probe for the Android elder app.
 * JwtAccessStrategy re-checks the user in the DB on every request, so once a
 * caregiver deletes the elder this returns 401 → the app's RefreshAuthenticator
 * fails the refresh and clears tokens → the elder device logs out (caregiver/elder
 * stay in sync). No DB hit needed here beyond the strategy's own re-validation.
 */
@Controller('elder')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.ELDER)
export class ElderSessionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  me(@Req() req: Request & { user: AuthenticatedUser }) {
    return { id: req.user.sub, role: req.user.role };
  }

  /**
   * DELETE /v1/elder/me — elder device taps "reset pairing". Deletes the elder
   * User; FK CASCADE removes ElderProfile, CareLink, Device, DevicePairing,
   * AnomalyEvents — so the caregiver's "Your Elders" list drops it and any open
   * detail page 404s (CareLinkGuard) → web redirects out. Keeps both sides in sync.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unpair(@Req() req: Request & { user: AuthenticatedUser }): Promise<void> {
    await this.prisma.user.delete({ where: { id: req.user.sub } });
  }
}
