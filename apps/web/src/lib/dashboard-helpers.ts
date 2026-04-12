/**
 * Dashboard helper utilities for the Enterprise Web Dashboard.
 * Pure functions for risk sorting, CSV export, and chart formatting.
 */

// ── Types ──

export interface ElderRiskRow {
  elderId: string;
  elderName: string;
  latestScore: number;
  normalizedScore: number;
  readingCount: number;
  lastActivityAt: number;
  riskLevel: "critical" | "warning" | "safe";
}

export interface AnomalyScoreRecord {
  sensorReadingId: string;
  elderId: string;
  score: number;
  normalizedScore: number;
  timestamp: number;
  computedAt: number;
}

export interface ChartPoint {
  date: string;
  score: number;
  timestamp: number;
}

// ── Risk Level Classification ──

/**
 * Classify a risk level based on the anomaly score.
 * Critical: >80, Warning: 50-80, Safe: <50
 */
export function classifyRiskLevel(
  score: number
): "critical" | "warning" | "safe" {
  if (score > 80) return "critical";
  if (score >= 50) return "warning";
  return "safe";
}

/**
 * Get a CSS-compatible color for a risk level.
 */
export function getRiskColor(level: "critical" | "warning" | "safe"): string {
  switch (level) {
    case "critical":
      return "#ef4444";
    case "warning":
      return "#eab308";
    case "safe":
      return "#22c55e";
  }
}

// ── Aggregation ──

/**
 * Aggregate raw anomaly score records into per-elder risk rows.
 * Each elder gets their latest score, reading count, and risk level.
 * Sorted by latest score descending (highest risk first).
 */
export function aggregateElderRisks(
  scores: AnomalyScoreRecord[],
  elderNames: Record<string, string>
): ElderRiskRow[] {
  const byElder = new Map<string, AnomalyScoreRecord[]>();

  for (const score of scores) {
    const existing = byElder.get(score.elderId) ?? [];
    existing.push(score);
    byElder.set(score.elderId, existing);
  }

  const rows: ElderRiskRow[] = [];

  for (const [elderId, elderScores] of byElder) {
    // Sort by timestamp descending to find latest
    const sorted = elderScores.sort((a, b) => b.timestamp - a.timestamp);
    const latest = sorted[0];
    if (!latest) continue;

    rows.push({
      elderId,
      elderName: elderNames[elderId] ?? `Elder ${elderId.slice(0, 8)}`,
      latestScore: latest.score,
      normalizedScore: latest.normalizedScore,
      readingCount: elderScores.length,
      lastActivityAt: latest.timestamp,
      riskLevel: classifyRiskLevel(latest.score),
    });
  }

  return sortByRisk(rows);
}

// ── Sorting ──

/**
 * Sort elder risk rows by score descending (highest risk first).
 * Does NOT mutate the original array.
 */
export function sortByRisk(rows: ElderRiskRow[]): ElderRiskRow[] {
  return [...rows].sort((a, b) => b.latestScore - a.latestScore);
}

/**
 * Filter elder rows by risk level.
 */
export function filterByRiskLevel(
  rows: ElderRiskRow[],
  level: "all" | "critical" | "warning" | "safe"
): ElderRiskRow[] {
  if (level === "all") return rows;
  return rows.filter((r) => r.riskLevel === level);
}

// ── CSV Export ──

/**
 * Format elder risk rows as CSV string for enterprise reporting.
 * Headers: Elder ID, Name, Risk Score, Risk Level, Reading Count, Last Activity
 */
export function formatRiskMatrixCsv(rows: ElderRiskRow[]): string {
  const headers = [
    "Elder ID",
    "Name",
    "Risk Score",
    "Risk Level",
    "Reading Count",
    "Last Activity",
  ];

  const csvRows = rows.map((row) => [
    escapeCsvField(row.elderId),
    escapeCsvField(row.elderName),
    row.latestScore.toString(),
    row.riskLevel.toUpperCase(),
    row.readingCount.toString(),
    new Date(row.lastActivityAt).toISOString(),
  ]);

  return [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
}

/**
 * Escape a CSV field value.
 * Wraps in quotes if it contains commas, quotes, or newlines.
 */
export function escapeCsvField(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Chart Formatting ──

/**
 * Format anomaly score records into recharts-compatible data points.
 * Groups by day and returns average score per day for the last N days.
 */
export function formatScoresToChartPoints(
  scores: AnomalyScoreRecord[],
  daysBack: number = 7
): ChartPoint[] {
  const now = Date.now();
  const cutoff = now - daysBack * 24 * 60 * 60 * 1000;

  const filtered = scores.filter((s) => s.timestamp >= cutoff);

  // Group by date string
  const byDay = new Map<string, number[]>();
  for (const s of filtered) {
    const dateKey = new Date(s.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const existing = byDay.get(dateKey) ?? [];
    existing.push(s.score);
    byDay.set(dateKey, existing);
  }

  // Convert to chart points
  const points: ChartPoint[] = [];
  for (const [date, dayScores] of byDay) {
    const avg = dayScores.reduce((sum, v) => sum + v, 0) / dayScores.length;
    points.push({
      date,
      score: Math.round(avg * 10) / 10,
      timestamp: filtered.find(
        (s) =>
          new Date(s.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }) === date
      )?.timestamp ?? 0,
    });
  }

  // Sort chronologically
  return points.sort((a, b) => a.timestamp - b.timestamp);
}
