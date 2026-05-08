import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAccessGuard } from '../../common/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { SkipAuditLog } from '../../common/interceptors/skip-audit-log.decorator';
import type { AuthenticatedUser } from '../../common/auth/interfaces/jwt-payload.interface';
import { IngestTelemetryDto } from './dto/ingest-telemetry.dto';
import type { IngestResultDto } from './dto/ingest-result.dto';
import { TelemetryService } from './telemetry.service';

@Controller('elder/telemetry')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles(UserRole.ELDER)
export class TelemetryController {
  constructor(private readonly service: TelemetryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SkipAuditLog() // High-volume endpoint — skip to avoid doubling write volume (Pattern 14)
  async ingest(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: IngestTelemetryDto,
  ): Promise<IngestResultDto> {
    return this.service.ingest(req.user.sub, dto);
  }
}
