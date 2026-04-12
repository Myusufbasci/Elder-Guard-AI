/**
 * Utility functions for chart data formatting and alert sorting.
 * Used by the Dashboard and Alerts screens.
 */

// ── Types ──

export interface ChartDataPoint {
  x: number; // timestamp
  y: number; // value (score, compliance %)
}

export interface AnomalyScoreDoc {
  sensorReadingId: string;
  elderId: string;
  score: number;
  normalizedScore: number;
  timestamp: number;
  computedAt: number;
}

export interface AlertDoc {
  id: string;
  elderId: string;
  guardianId: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  anomalyScore: number;
  acknowledged: boolean;
  createdAt: number;
}

// ── Chart helpers ──

/**
 * Convert anomaly score docs into chart-ready data points.
 * Filters to the last 24 hours. Returns at least one sentinel point if empty.
 */
export function formatScoresToChartData(
  scores: AnomalyScoreDoc[],
  hoursBack: number = 24
): ChartDataPoint[] {
  const now = Date.now();
  const cutoff = now - hoursBack * 60 * 60 * 1000;

  const filtered = scores
    .filter((s) => s.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => ({
      x: s.timestamp,
      y: s.score,
    }));

  // Prevent chart crash with empty arrays — return sentinel point
  if (filtered.length === 0) {
    return [{ x: now, y: 0 }];
  }

  return filtered;
}

/**
 * Calculate the Routine Compliance Score.
 * Compliance = inverse of anomaly score (100 - avgScore).
 * High anomaly → low compliance. Range: 0-100.
 */
export function calculateComplianceScore(
  scores: AnomalyScoreDoc[],
  hoursBack: number = 24
): number {
  const now = Date.now();
  const cutoff = now - hoursBack * 60 * 60 * 1000;

  const recent = scores.filter((s) => s.timestamp >= cutoff);

  if (recent.length === 0) {
    return 100; // No anomalies = perfect compliance
  }

  const avgScore =
    recent.reduce((sum, s) => sum + s.score, 0) / recent.length;

  // Invert: high anomaly score → low compliance
  const compliance = Math.max(0, Math.min(100, 100 - avgScore));
  return Math.round(compliance * 10) / 10;
}

/**
 * Check if there are enough real data points to render a meaningful chart.
 */
export function hasEnoughDataForChart(
  scores: AnomalyScoreDoc[],
  minPoints: number = 2,
  hoursBack: number = 24
): boolean {
  const now = Date.now();
  const cutoff = now - hoursBack * 60 * 60 * 1000;
  const recent = scores.filter((s) => s.timestamp >= cutoff);
  return recent.length >= minPoints;
}

// ── Alert helpers ──

/** Severity priority for sorting (higher = more urgent) */
const SEVERITY_PRIORITY: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Sort alerts by severity (critical first) then by date (newest first).
 * Unacknowledged alerts always come before acknowledged ones.
 */
export function sortAlerts(alerts: AlertDoc[]): AlertDoc[] {
  return [...alerts].sort((a, b) => {
    // 1. Unacknowledged first
    if (a.acknowledged !== b.acknowledged) {
      return a.acknowledged ? 1 : -1;
    }

    // 2. Higher severity first
    const aPriority = SEVERITY_PRIORITY[a.severity] ?? 0;
    const bPriority = SEVERITY_PRIORITY[b.severity] ?? 0;
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }

    // 3. Newest first
    return b.createdAt - a.createdAt;
  });
}

/**
 * Get severity display color.
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "#ef4444";
    case "high":
      return "#f97316";
    case "medium":
      return "#eab308";
    case "low":
      return "#22c55e";
    default:
      return "#94a3b8";
  }
}

/**
 * Format a timestamp for display (e.g., "14:35" or "Mar 30, 14:35").
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) {
    return time;
  }

  const monthDay = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  return `${monthDay}, ${time}`;
}
