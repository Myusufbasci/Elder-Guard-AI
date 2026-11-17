import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiSummaryService } from '../../anomaly/ai-summary/ai-summary.service';

// Default vitals metrics — excludes location_lat/location_lng (separate endpoint).
const DEFAULT_VITALS_METRICS = [
  'heart_rate',
  'resting_heart_rate',
  'steps',
  'sleep_duration',
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ElderStatus = 'stable' | 'needs_attention' | 'critical' | 'unknown';

export interface ElderSummary {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  linkedAt: Date;
  status: ElderStatus;
}

export interface VitalsBucket {
  bucket: Date;
  device_id: string;
  metric: string;
  avg_value: number;
  min_value: number;
  max_value: number;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  time: Date;
}

export interface LatestVital {
  metric: string;
  value: number;
  time: Date;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiSummary: AiSummaryService,
  ) {}

  /** List all elders linked to the authenticated caregiver via CareLink. */
  async listElders(caregiverId: string): Promise<ElderSummary[]> {
    const links = await this.prisma.careLink.findMany({
      where: { caregiverId },
      include: {
        elder: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    // Attach the latest AI-summary status so the list card badge reflects reality
    // instead of a hardcoded "unknown". (1 caregiver : 1 elder → N is small.)
    return Promise.all(
      links.map(async (link) => {
        const summary = await this.prisma.notificationLog.findFirst({
          where: { userId: link.elderId, type: 'daily_summary' },
          orderBy: { sentAt: 'desc' },
          select: { content: true },
        });
        return {
          id: link.elderId,
          firstName: link.elder.user.firstName,
          lastName: link.elder.user.lastName,
          dateOfBirth: link.elder.dateOfBirth,
          linkedAt: link.createdAt,
          status: this.statusFromContent(summary?.content),
        };
      }),
    );
  }

  /** Pull status_category out of a stored AI-summary JSON blob, else 'unknown'. */
  private statusFromContent(content: unknown): ElderStatus {
    const cat = (content as { status_category?: string } | null | undefined)
      ?.status_category;
    return cat === 'stable' || cat === 'needs_attention' || cat === 'critical'
      ? cat
      : 'unknown';
  }

  /**
   * Query telemetry_1h continuous aggregate for vitals data.
   * Reads from the hourly rollup (NOT raw telemetry table) per AGENTS.md Rule 4.
   */
  async getVitals(
    elderId: string,
    from?: string,
    to?: string,
    metrics?: string[],
  ): Promise<Record<string, VitalsBucket[]>> {
    const fromDate = from ? new Date(from) : new Date(Date.now() - SEVEN_DAYS_MS);
    const toDate = to ? new Date(to) : new Date();
    const metricFilter = metrics?.length ? metrics : DEFAULT_VITALS_METRICS;

    // Get deviceIds for this elder
    const devices = await this.prisma.device.findMany({
      where: { elderId },
      select: { id: true },
    });
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return {};

    // Query telemetry_1h continuous aggregate via parameterized raw SQL.
    const rows = await this.prisma.$queryRawUnsafe<VitalsBucket[]>(
      `SELECT bucket, device_id, metric, avg_value, min_value, max_value
       FROM telemetry_1h
       WHERE device_id = ANY($1::uuid[])
         AND metric = ANY($2::text[])
         AND bucket >= $3::timestamptz
         AND bucket <= $4::timestamptz
       ORDER BY metric, bucket`,
      deviceIds,
      metricFilter,
      fromDate,
      toDate,
    );

    // Group by metric for structured response
    const grouped: Record<string, VitalsBucket[]> = {};
    for (const row of rows) {
      if (!grouped[row.metric]) grouped[row.metric] = [];
      grouped[row.metric].push(row);
    }
    return grouped;
  }

  /**
   * Latest value per metric straight from the raw telemetry hypertable — used for
   * the elder-detail snapshot cards so a freshly-synced reading shows IMMEDIATELY
   * (the continuous aggregates can lag by up to their refresh interval). Charts keep
   * using telemetry_1h via getVitals(). DISTINCT ON picks the newest row per metric.
   */
  async getLatestVitals(elderId: string): Promise<LatestVital[]> {
    const devices = await this.prisma.device.findMany({
      where: { elderId },
      select: { id: true },
    });
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return [];

    return this.prisma.$queryRawUnsafe<LatestVital[]>(
      `SELECT DISTINCT ON (metric) metric, value, time
       FROM telemetry
       WHERE "deviceId" = ANY($1::uuid[])
         AND metric = ANY($2::text[])
       ORDER BY metric, time DESC`,
      deviceIds,
      DEFAULT_VITALS_METRICS,
    );
  }

  /** Latest location + 24h trail from raw telemetry (location changes infrequently). */
  async getLocation(
    elderId: string,
  ): Promise<{ latest: LocationPoint | null; trail: LocationPoint[] }> {
    const devices = await this.prisma.device.findMany({
      where: { elderId },
      select: { id: true },
    });
    const deviceIds = devices.map((d) => d.id);
    if (deviceIds.length === 0) return { latest: null, trail: [] };

    // Latest location — join lat and lng by same time + device
    const latestRows = await this.prisma.$queryRawUnsafe<LocationPoint[]>(
      `SELECT t1.value AS lat, t2.value AS lng, t1.time
       FROM telemetry t1
       JOIN telemetry t2
         ON t1."deviceId" = t2."deviceId" AND t1.time = t2.time
       WHERE t1."deviceId" = ANY($1::uuid[])
         AND t1.metric = 'location_lat'
         AND t2.metric = 'location_lng'
       ORDER BY t1.time DESC
       LIMIT 1`,
      deviceIds,
    );

    // 24h trail
    const trailRows = await this.prisma.$queryRawUnsafe<LocationPoint[]>(
      `SELECT t1.value AS lat, t2.value AS lng, t1.time
       FROM telemetry t1
       JOIN telemetry t2
         ON t1."deviceId" = t2."deviceId" AND t1.time = t2.time
       WHERE t1."deviceId" = ANY($1::uuid[])
         AND t1.metric = 'location_lat'
         AND t2.metric = 'location_lng'
         AND t1.time > NOW() - INTERVAL '24 hours'
       ORDER BY t1.time DESC`,
      deviceIds,
    );

    return {
      latest: latestRows[0] ?? null,
      trail: trailRows,
    };
  }

  /** Delete the elder User; FK CASCADE removes ElderProfile, CareLink, Device, etc. */
  async deleteElder(elderId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: elderId } });
  }

  /**
   * Pairing status for live web polling. A Device row is created only when the
   * elder redeems the 6-digit code, so its existence = the device is paired.
   */
  async getPairingStatus(elderId: string): Promise<{ paired: boolean }> {
    const device = await this.prisma.device.findFirst({
      where: { elderId },
      select: { id: true },
    });
    return { paired: device !== null };
  }

  /** Latest AI daily summary from NotificationLog. */
  async getSummary(
    elderId: string,
  ): Promise<{ id: string; content: unknown; sentAt: Date } | null> {
    // Find the elder's user ID and look up summary notifications
    const elder = await this.prisma.elderProfile.findUnique({
      where: { userId: elderId },
      select: { userId: true },
    });
    if (!elder) return null;

    return this.prisma.notificationLog.findFirst({
      where: {
        userId: elder.userId,
        type: 'daily_summary',
      },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        content: true,
        sentAt: true,
      },
    });
  }

  /**
   * On-demand AI summary generation for a single elder (caregiver "generate now"
   * button). Mirrors one iteration of the daily @Cron: queries 24h telemetry,
   * calls Gemini, validates against the deny-list, writes the result to
   * NotificationLog so a subsequent getSummary() returns it. CareLinkGuard on the
   * route already enforces that the caregiver owns this elder.
   */
  async triggerSummary(elderId: string): Promise<void> {
    const elder = await this.prisma.elderProfile.findUnique({
      where: { userId: elderId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        careLinks: { select: { caregiverId: true } },
      },
    });
    if (!elder) throw new NotFoundException('Elder not found');

    await this.aiSummary.processElder(elder);
  }
}
