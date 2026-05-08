import { NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: {
    careLink: { findMany: jest.Mock; findUnique: jest.Mock };
    anomalyEvent: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      careLink: { findMany: jest.fn(), findUnique: jest.fn() },
      anomalyEvent: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new AlertsService(prisma as unknown as PrismaService);
  });

  describe('getAlerts', () => {
    it('should return paginated results with cursor for linked elders', async () => {
      prisma.careLink.findMany.mockResolvedValue([
        { elderId: 'elder-1' },
        { elderId: 'elder-2' },
      ]);
      const now = new Date();
      const mockAlerts = [
        {
          id: 'alert-1',
          elderId: 'elder-1',
          metric: 'heart_rate',
          severity: 'HIGH',
          detectedAt: now,
          acknowledged: false,
          elder: { user: { firstName: 'Alice', lastName: 'Smith' } },
        },
        {
          id: 'alert-2',
          elderId: 'elder-2',
          metric: 'resting_heart_rate',
          severity: 'CRITICAL',
          detectedAt: new Date(now.getTime() - 60_000),
          acknowledged: false,
          elder: { user: { firstName: 'Bob', lastName: 'Jones' } },
        },
      ];
      prisma.anomalyEvent.findMany.mockResolvedValue(mockAlerts);

      const result = await service.getAlerts('caregiver-1', {});

      expect(prisma.careLink.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { caregiverId: 'caregiver-1' },
          select: { elderId: true },
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result).toHaveProperty('cursor');
    });

    it('should apply severity filter', async () => {
      prisma.careLink.findMany.mockResolvedValue([{ elderId: 'elder-1' }]);
      prisma.anomalyEvent.findMany.mockResolvedValue([]);

      await service.getAlerts('caregiver-1', { severity: 'CRITICAL' });

      const findManyCall = prisma.anomalyEvent.findMany.mock.calls[0][0] as {
        where: { severity?: string };
      };
      expect(findManyCall.where.severity).toBe('CRITICAL');
    });

    it('should decode cursor for pagination', async () => {
      prisma.careLink.findMany.mockResolvedValue([{ elderId: 'elder-1' }]);
      prisma.anomalyEvent.findMany.mockResolvedValue([]);

      const cursor = Buffer.from(
        JSON.stringify({ detectedAt: '2026-04-28T00:00:00Z', id: 'alert-prev' }),
      ).toString('base64');

      await service.getAlerts('caregiver-1', { cursor, limit: 10 });

      expect(prisma.anomalyEvent.findMany).toHaveBeenCalled();
    });
  });

  describe('acknowledgeAlert', () => {
    it('should set acknowledged=true and acknowledgedAt', async () => {
      prisma.anomalyEvent.findUnique.mockResolvedValue({
        id: 'alert-1',
        elderId: 'elder-1',
        acknowledged: false,
      });
      prisma.careLink.findUnique.mockResolvedValue({
        caregiverId: 'caregiver-1',
        elderId: 'elder-1',
      });
      prisma.anomalyEvent.update.mockResolvedValue({
        id: 'alert-1',
        acknowledged: true,
        acknowledgedAt: new Date(),
      });

      const result = await service.acknowledgeAlert('alert-1', 'caregiver-1');

      expect(prisma.anomalyEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alert-1' },
          data: expect.objectContaining({
            acknowledged: true,
            acknowledgedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.acknowledged).toBe(true);
    });

    it('should throw 404 when alert belongs to unlinked elder', async () => {
      prisma.anomalyEvent.findUnique.mockResolvedValue({
        id: 'alert-1',
        elderId: 'elder-1',
      });
      prisma.careLink.findUnique.mockResolvedValue(null);

      await expect(
        service.acknowledgeAlert('alert-1', 'caregiver-no-link'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw 404 when alert does not exist', async () => {
      prisma.anomalyEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.acknowledgeAlert('nonexistent', 'caregiver-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
