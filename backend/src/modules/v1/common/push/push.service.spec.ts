import { Test, TestingModule } from '@nestjs/testing';
import { PushService } from './push.service';
import { PrismaService } from '../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';

const FIREBASE_MESSAGING_TOKEN = 'FIREBASE_MESSAGING';

describe('PushService', () => {
  let service: PushService;

  const mockPrisma = {
    anomalyEvent: { findUnique: jest.fn() },
    pushToken: { findMany: jest.fn(), deleteMany: jest.fn() },
    notificationLog: { create: jest.fn() },
  };

  const mockValkey = { setNxEx: jest.fn() };

  const mockMessaging = {
    sendEachForMulticast: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ValkeyService, useValue: mockValkey },
        { provide: FIREBASE_MESSAGING_TOKEN, useValue: mockMessaging },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
    jest.clearAllMocks();
  });

  const ANOMALY_EVENT = {
    id: 'anomaly-1',
    elderId: 'elder-1',
    metric: 'heart_rate',
    severity: 'CRITICAL',
    observedValue: 165,
    medianValue: 72,
    madValue: 5,
    modifiedZScore: 12.5,
    kind: 'THRESHOLD_BREACH',
    elder: {
      userId: 'elder-1',
      user: { firstName: 'John', lastName: 'Doe' },
      careLinks: [
        { caregiverId: 'cg-1', elderId: 'elder-1' },
        { caregiverId: 'cg-2', elderId: 'elder-1' },
      ],
    },
  };

  const successResponse = (count: number) => ({
    responses: Array.from({ length: count }, () => ({ success: true })),
    successCount: count,
    failureCount: 0,
  });

  it('dispatches multicast to correct caregiver tokens only', async () => {
    mockPrisma.anomalyEvent.findUnique.mockResolvedValue(ANOMALY_EVENT);
    mockValkey.setNxEx.mockResolvedValue(true);
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { token: 'token-cg1', userId: 'cg-1', platform: 'web' },
      { token: 'token-cg2', userId: 'cg-2', platform: 'android' },
    ]);
    mockMessaging.sendEachForMulticast.mockResolvedValue(successResponse(2));
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.notifyCaregiverOfAnomaly('anomaly-1');

    expect(mockMessaging.sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['token-cg1', 'token-cg2'],
      }),
    );
  });

  it('prunes invalid FCM tokens from DB', async () => {
    mockPrisma.anomalyEvent.findUnique.mockResolvedValue(ANOMALY_EVENT);
    mockValkey.setNxEx.mockResolvedValue(true);
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { token: 'valid-token', userId: 'cg-1', platform: 'web' },
      { token: 'dead-token', userId: 'cg-2', platform: 'android' },
    ]);
    mockMessaging.sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true },
        {
          success: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          error: { code: 'messaging/registration-token-not-registered', message: '', toJSON: () => ({}) } as any,
        },
      ],
      successCount: 1,
      failureCount: 1,
    });
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.notifyCaregiverOfAnomaly('anomaly-1');

    expect(mockPrisma.pushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['dead-token'] } },
    });
  });

  it('skips dispatch if push throttle key exists', async () => {
    mockPrisma.anomalyEvent.findUnique.mockResolvedValue(ANOMALY_EVENT);
    mockValkey.setNxEx.mockResolvedValue(false);

    await service.notifyCaregiverOfAnomaly('anomaly-1');

    expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('creates NotificationLog entry on successful dispatch', async () => {
    mockPrisma.anomalyEvent.findUnique.mockResolvedValue(ANOMALY_EVENT);
    mockValkey.setNxEx.mockResolvedValue(true);
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { token: 'token-1', userId: 'cg-1', platform: 'web' },
    ]);
    mockMessaging.sendEachForMulticast.mockResolvedValue(successResponse(1));
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.notifyCaregiverOfAnomaly('anomaly-1');

    expect(mockPrisma.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        anomalyId: 'anomaly-1',
        type: 'anomaly_alert',
        deliveryStatus: 'delivered',
      }),
    });
  });

  it('handles zero push tokens gracefully without calling FCM', async () => {
    mockPrisma.anomalyEvent.findUnique.mockResolvedValue(ANOMALY_EVENT);
    mockValkey.setNxEx.mockResolvedValue(true);
    mockPrisma.pushToken.findMany.mockResolvedValue([]);
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.notifyCaregiverOfAnomaly('anomaly-1');

    expect(mockMessaging.sendEachForMulticast).not.toHaveBeenCalled();
    // Still logs for audit trail
    expect(mockPrisma.notificationLog.create).toHaveBeenCalled();
  });

  it('builds FCM payload matching INTEGRATION.md spec', async () => {
    mockPrisma.anomalyEvent.findUnique.mockResolvedValue(ANOMALY_EVENT);
    mockValkey.setNxEx.mockResolvedValue(true);
    mockPrisma.pushToken.findMany.mockResolvedValue([
      { token: 'token-1', userId: 'cg-1', platform: 'android' },
    ]);
    mockMessaging.sendEachForMulticast.mockResolvedValue(successResponse(1));
    mockPrisma.notificationLog.create.mockResolvedValue({});

    await service.notifyCaregiverOfAnomaly('anomaly-1');

    const payload = mockMessaging.sendEachForMulticast.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({
        notification: expect.objectContaining({
          title: expect.stringContaining('John'),
          body: expect.stringContaining('165'),
        }),
        data: expect.objectContaining({
          anomalyId: 'anomaly-1',
          elderId: 'elder-1',
          metric: 'heart_rate',
          severity: 'CRITICAL',
          deepLink: 'eldercare://alerts/anomaly-1',
        }),
        android: expect.objectContaining({
          priority: 'high',
          notification: expect.objectContaining({ channelId: 'alerts' }),
        }),
      }),
    );
  });
});
