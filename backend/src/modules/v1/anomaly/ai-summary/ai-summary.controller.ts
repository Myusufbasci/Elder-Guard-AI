import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AiSummaryService } from './ai-summary.service';
import { JwtAccessGuard } from '../../common/auth/guards/jwt-access.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

// Admin-only endpoint for manually triggering an AI summary.
// Intended for testing and debugging; production flow is the @Cron job.

@Controller('caregiver/elders/:id/summary')
@UseGuards(JwtAccessGuard, RolesGuard)
export class AiSummaryController {
  constructor(
    private readonly aiSummaryService: AiSummaryService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('trigger')
  @Roles('ADMIN')
  async triggerSummary(@Param('id') elderId: string): Promise<{ message: string }> {
    const elder = await this.prisma.elderProfile.findUnique({
      where: { userId: elderId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        careLinks: { select: { caregiverId: true } },
      },
    });

    if (!elder) {
      return { message: `Elder ${elderId} not found` };
    }

    await this.aiSummaryService.processElder(
      elder,
    );
    return { message: `Summary generated for elder ${elderId}` };
  }
}
