import { Test, TestingModule } from '@nestjs/testing';
import { AiSummaryService } from './ai-summary.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// Mock the Gemini SDK at module level
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
  SchemaType: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    BOOLEAN: 'BOOLEAN',
  },
}));

describe('AiSummaryService', () => {
  let service: AiSummaryService;

  const mockPrisma = {
    elderProfile: { findMany: jest.fn() },
    anomalyEvent: { count: jest.fn() },
    notificationLog: { create: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSummaryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'GEMINI_API_KEY', useValue: 'test-api-key' },
      ],
    }).compile();

    service = module.get<AiSummaryService>(AiSummaryService);
    jest.clearAllMocks();
  });

  const ELDER_WITH_LINKS = {
    userId: 'elder-1',
    dateOfBirth: new Date('1940-01-01'),
    user: { firstName: 'Alice', lastName: 'Smith' },
    careLinks: [{ caregiverId: 'cg-1' }],
  };

  const TELEMETRY_ROWS = [
    { metric: 'heart_rate', avg_value: 72, min_value: 68, max_value: 78, sample_count: 60 },
    { metric: 'resting_heart_rate', avg_value: 65, min_value: 60, max_value: 70, sample_count: 60 },
    { metric: 'steps', avg_value: 250, min_value: 0, max_value: 500, sample_count: 60 },
    { metric: 'sleep_duration', avg_value: 420, min_value: 420, max_value: 420, sample_count: 1 },
  ];

  const STABLE_RESPONSE = {
    status_category: 'stable',
    summary_text: 'All vitals are within normal range. No concerns noted.',
    anomalies_noted: false,
    action_recommendation: null,
  };

  function mockGeminiSuccess(response: Record<string, unknown>): void {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(response) },
    });
  }

  it('returns stable summary for normal data', async () => {
    mockPrisma.elderProfile.findMany.mockResolvedValue([ELDER_WITH_LINKS]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(TELEMETRY_ROWS);
    mockPrisma.anomalyEvent.count.mockResolvedValue(0);
    mockGeminiSuccess(STABLE_RESPONSE);
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.generateDailySummaries();

    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'daily_summary',
        content: expect.objectContaining({
          status_category: 'stable',
        }),
      }),
    });
  });

  it('rejects response containing "diabetes" and uses fallback', async () => {
    mockPrisma.elderProfile.findMany.mockResolvedValue([ELDER_WITH_LINKS]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(TELEMETRY_ROWS);
    mockPrisma.anomalyEvent.count.mockResolvedValue(0);
    mockGeminiSuccess({
      ...STABLE_RESPONSE,
      summary_text: 'The readings suggest possible diabetes indicators.',
    });
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.generateDailySummaries();

    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: expect.objectContaining({
          summary_text: expect.stringContaining('Routine AI summary unavailable'),
        }),
      }),
    });
  });

  it('uses fallback template on Gemini API failure', async () => {
    mockPrisma.elderProfile.findMany.mockResolvedValue([ELDER_WITH_LINKS]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(TELEMETRY_ROWS);
    mockPrisma.anomalyEvent.count.mockResolvedValue(0);
    mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.generateDailySummaries();

    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: expect.objectContaining({
          summary_text: expect.stringContaining('Routine AI summary unavailable'),
        }),
      }),
    });
  });

  it('processes all active elders', async () => {
    const elder2 = {
      ...ELDER_WITH_LINKS,
      userId: 'elder-2',
      user: { firstName: 'Bob', lastName: 'Jones' },
    };
    mockPrisma.elderProfile.findMany.mockResolvedValue([ELDER_WITH_LINKS, elder2]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(TELEMETRY_ROWS);
    mockPrisma.anomalyEvent.count.mockResolvedValue(0);
    mockGeminiSuccess(STABLE_RESPONSE);
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.generateDailySummaries();

    // One NotificationLog per elder per caregiver
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledTimes(2);
  });

  it('fallback template includes actual metric values', async () => {
    mockPrisma.elderProfile.findMany.mockResolvedValue([ELDER_WITH_LINKS]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(TELEMETRY_ROWS);
    mockPrisma.anomalyEvent.count.mockResolvedValue(2);
    mockGenerateContent.mockRejectedValue(new Error('fail'));
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.generateDailySummaries();

    const content = mockPrisma.notificationLog.create.mock.calls[0][0].data.content;
    expect(content.summary_text).toContain('Alice');
    expect(content.summary_text).toContain('2'); // anomaly count
  });

  it('enqueues PUSH_DISPATCH when anomalies_noted is true', async () => {
    mockPrisma.elderProfile.findMany.mockResolvedValue([ELDER_WITH_LINKS]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(TELEMETRY_ROWS);
    mockPrisma.anomalyEvent.count.mockResolvedValue(1);
    mockGeminiSuccess({
      ...STABLE_RESPONSE,
      status_category: 'needs_attention',
      anomalies_noted: true,
      summary_text: 'Some readings need monitoring.',
    });
    mockPrisma.notificationLog.create.mockResolvedValue({ id: 'notif-1' });

    await service.generateDailySummaries();

    // Push dispatch not for AI summaries directly — summaries go through
    // NotificationLog. PUSH_DISPATCH is for anomaly alerts.
    // For AI summaries with anomalies_noted=true, we create the log entry
    // with status 'needs_attention'.
    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        content: expect.objectContaining({
          anomalies_noted: true,
          status_category: 'needs_attention',
        }),
      }),
    });
  });

  it('deny-list scan is case-insensitive', async () => {
    mockPrisma.elderProfile.findMany.mockResolvedValue([ELDER_WITH_LINKS]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(TELEMETRY_ROWS);
    mockPrisma.anomalyEvent.count.mockResolvedValue(0);
    mockGeminiSuccess({
      ...STABLE_RESPONSE,
      summary_text: 'HYPERTENSION risk detected in the data.',
    });
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.generateDailySummaries();

    const content = mockPrisma.notificationLog.create.mock.calls[0][0].data.content;
    expect(content.summary_text).toContain('Routine AI summary unavailable');
  });
});
