import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { AiSummaryModule } from '../../anomaly/ai-summary/ai-summary.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [AuthModule, AiSummaryModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
