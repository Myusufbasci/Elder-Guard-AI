import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiSummaryService } from './ai-summary.service';
import { AiSummaryController } from './ai-summary.controller';

// AI daily summary module.
// - ScheduleModule.forRoot() enables @Cron decorators.
// - GEMINI_API_KEY injected from ConfigService for the Gemini API client.
// - PrismaModule, ValkeyModule, QueueModule are @Global — no need to import.

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule],
  providers: [
    {
      provide: 'GEMINI_API_KEY',
      inject: [ConfigService],
      useFactory: (config: ConfigService): string => {
        const key = config.get<string>('GEMINI_API_KEY');
        if (!key) throw new Error('GEMINI_API_KEY not configured');
        return key;
      },
    },
    AiSummaryService,
  ],
  controllers: [AiSummaryController],
  exports: [AiSummaryService],
})
export class AiSummaryModule {}
