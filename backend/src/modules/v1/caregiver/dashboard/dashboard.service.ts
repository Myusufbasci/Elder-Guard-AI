import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// Default vitals metrics — excludes location_lat/location_lng (separate endpoint).
const DEFAULT_VITALS_METRICS = [
  'heart_rate',
  'resting_heart_rate',
  'steps',
  'sleep_duration',
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface ElderSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: Date;
  linkedAt: Date;
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

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** List all elders linked to the authenticated caregiver via CareLink. */
  async listElders(caregiverId: string): Promise<ElderSummary[]> {
    const links = await this.prisma.careLink.findMany({
      where: { caregiverId },
      include: {
        elder: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    return links.map((link) => ({
      id: link.elderId,
      firstName: link.elder.user.firstName,
      lastName: link.elder.user.lastName,
      email: link.elder.user.email,
      dateOfBirth: link.elder.dateOfBirth,
      linkedAt: link.createdAt,
    }));
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
         ON t1.device_id = t2.device_id AND t1.time = t2.time
       WHERE t1.device_id = ANY($1::uuid[])
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
         ON t1.device_id = t2.device_id AND t1.time = t2.time
       WHERE t1.device_id = ANY($1::uuid[])
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
}
