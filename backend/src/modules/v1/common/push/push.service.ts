import { Inject, Injectable, Logger } from '@nestjs/common';
import type { messaging } from 'firebase-admin';
import { PrismaService } from '../prisma/prisma.service';
import { ValkeyService } from '../valkey/valkey.service';
import { FIREBASE_MESSAGING } from './push.constants';

const PUSH_THROTTLE_TTL_SECONDS = 300;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(FIREBASE_MESSAGING) private readonly fcm: messaging.Messaging,
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  /**
   * Dispatches anomaly alert push to all caregivers linked to the elder.
   * Called by PushDispatchProcessor after dequeuing a PUSH_DISPATCH job.
   */
  async notifyCaregiverOfAnomaly(anomalyEventId: string): Promise<void> {
    // 1. Load AnomalyEvent with Elder + User + CareLinks
    const event = await this.prisma.anomalyEvent.findUnique({
      where: { id: anomalyEventId },
      include: {
        elder: {
          include: {
            user: true,
            careLinks: true,
          },
        },
      },
    });

    if (!event) {
      this.logger.warn(`AnomalyEvent ${anomalyEventId} not found — skipping push`);
      return;
    }

    // 2. Push throttle: SETNX push:{elderId}:{metric} 1 EX 300
    const throttleKey = `push:${event.elderId}:${event.metric}`;
    const acquired = await this.valkey.setNxEx(
      throttleKey,
      '1',
      PUSH_THROTTLE_TTL_SECONDS,
    );
    if (!acquired) {
      this.logger.debug(`Push throttled: ${throttleKey}`);
      return;
    }

    // 3. Collect caregiver IDs from CareLinks
    const caregiverIds = event.elder.careLinks.map(
      (cl: { caregiverId: string }) => cl.caregiverId,
    );
    if (caregiverIds.length === 0) {
      this.logger.warn(`No caregivers linked to elder ${event.elderId}`);
      return;
    }

    // 4. Fetch FCM push tokens for those caregivers
    const pushTokens = await this.prisma.pushToken.findMany({
      where: { userId: { in: caregiverIds } },
    });

    if (pushTokens.length === 0) {
      this.logger.warn(
        `No push tokens for caregivers of elder ${event.elderId}`,
      );
      await this.logNotification(
        caregiverIds[0],
        anomalyEventId,
        'anomaly_alert',
        {},
        'no_tokens',
      );
      return;
    }

    // 5. Build MulticastMessage per INTEGRATION.md FCM Push Payload spec
    const elderName = event.elder.user.firstName;
    const metricLabel = event.metric.replace(/_/g, ' ');
    const message: messaging.MulticastMessage = {
      tokens: pushTokens.map((t: { token: string }) => t.token),
      notification: {
        title: `${elderName}: ${metricLabel} alert`,
        body: `${metricLabel} ${event.observedValue.toFixed(0)} — outside normal range`,
      },
      data: {
        anomalyId: event.id,
        elderId: event.elderId,
        metric: event.metric,
        severity: event.severity,
        deepLink: `eldercare://alerts/${event.id}`,
      },
      android: {
        priority: 'high' as const,
        notification: { channelId: 'alerts', sound: 'alert.mp3' },
      },
    };

    // 6. Dispatch via FCM (sendEachForMulticast — sendToDevice is deprecated)
    const resp = await this.fcm.sendEachForMulticast(message);

    // 7. Prune dead tokens (AGENTS.md Rule 10)
    const tokensToDelete: string[] = [];
    resp.responses.forEach((r, i) => {
      if (
        !r.success &&
        (r.error?.code === 'messaging/registration-token-not-registered' ||
          r.error?.code === 'messaging/invalid-argument')
      ) {
        tokensToDelete.push(pushTokens[i].token);
      }
    });

    if (tokensToDelete.length > 0) {
      await this.prisma.pushToken.deleteMany({
        where: { token: { in: tokensToDelete } },
      });
      this.logger.warn(`Pruned ${tokensToDelete.length} dead FCM tokens`);
    }

    // 8. Audit trail — persist to NotificationLog per caregiver
    const deliveryStatus = resp.successCount > 0 ? 'delivered' : 'failed';
    for (const caregiverId of caregiverIds) {
      await this.logNotification(
        caregiverId,
        anomalyEventId,
        'anomaly_alert',
        { ...message.notification! },
        deliveryStatus,
      );
    }

    this.logger.log(
      `Push dispatched for anomaly ${anomalyEventId}: ${resp.successCount} success, ${resp.failureCount} failed`,
    );
  }

  private async logNotification(
    userId: string,
    anomalyId: string | null,
    type: string,
    content: unknown,
    deliveryStatus: string,
  ): Promise<void> {
    await this.prisma.notificationLog.create({
      data: {
        userId,
        anomalyId,
        type,
         
        content: JSON.parse(JSON.stringify(content)),
        deliveryStatus,
      },
    });
  }
}
