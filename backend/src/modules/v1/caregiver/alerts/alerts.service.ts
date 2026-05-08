import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

// Cursor encodes { detectedAt, id } as base64 JSON for deterministic
// TimescaleDB pagination (offset-based is expensive on large hypertables).

interface AlertItem {
  id: string;
  elderId: string;
  metric: string;
  kind: string;
  severity: string;
  detectedAt: Date;
  modifiedZScore: number;
  observedValue: number;
  medianValue: number;
  madValue: number;
  acknowledged: boolean;
  acknowledgedAt: Date | null;
  elder: { user: { firstName: string; lastName: string } };
}

export interface AlertsResult {
  items: AlertItem[];
  cursor: string | null;
}

interface AlertFilters {
  cursor?: string;
  limit?: number;
  severity?: string;
  metric?: string;
  acknowledged?: boolean;
}

function encodeCursor(detectedAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ detectedAt: detectedAt.toISOString(), id })).toString('base64');
}

function decodeCursor(cursor: string): { detectedAt: Date; id: string } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
    detectedAt: string;
    id: string;
  };
  return { detectedAt: new Date(parsed.detectedAt), id: parsed.id };
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Paginated AnomalyEvent feed for all elders linked to the caregiver. */
  async getAlerts(
    caregiverId: string,
    filters: AlertFilters,
  ): Promise<AlertsResult> {
    const limit = filters.limit ?? 20;

    // Get all linked elder IDs
    const links = await this.prisma.careLink.findMany({
      where: { caregiverId },
      select: { elderId: true },
    });
    const elderIds = links.map((l) => l.elderId);
    if (elderIds.length === 0) return { items: [], cursor: null };

    // Build where clause
    const where: Prisma.AnomalyEventWhereInput = {
      elderId: { in: elderIds },
    };
    if (filters.severity) where.severity = filters.severity as Prisma.EnumSeverityFilter;
    if (filters.metric) where.metric = filters.metric;
    if (filters.acknowledged !== undefined) where.acknowledged = filters.acknowledged;

    // Cursor-based pagination: fetch items after the cursor position
    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      where.OR = [
        { detectedAt: { lt: decoded.detectedAt } },
        { detectedAt: decoded.detectedAt, id: { lt: decoded.id } },
      ];
    }

    const items = await this.prisma.anomalyEvent.findMany({
      where,
      orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, // fetch one extra to determine if there's a next page
      include: {
        elder: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && pageItems.length > 0
      ? encodeCursor(
          pageItems[pageItems.length - 1].detectedAt,
          pageItems[pageItems.length - 1].id,
        )
      : null;

    return {
      items: pageItems as unknown as AlertItem[],
      cursor: nextCursor,
    };
  }

  /** Mark alert as acknowledged. Verifies CareLink ownership (returns 404 on miss). */
  async acknowledgeAlert(
    alertId: string,
    caregiverId: string,
  ): Promise<{ id: string; acknowledged: boolean; acknowledgedAt: Date }> {
    // Load alert to get elderId
    const alert = await this.prisma.anomalyEvent.findUnique({
      where: { id: alertId },
    });
    if (!alert) throw new NotFoundException();

    // Verify CareLink ownership — 404 not 403 per AGENTS.md Rule 15
    const link = await this.prisma.careLink.findUnique({
      where: {
        caregiverId_elderId: { caregiverId, elderId: alert.elderId },
      },
    });
    if (!link) throw new NotFoundException();

    const updated = await this.prisma.anomalyEvent.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      acknowledged: updated.acknowledged,
      acknowledgedAt: updated.acknowledgedAt!,
    };
  }
}
