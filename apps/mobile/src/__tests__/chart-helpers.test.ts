import {
  formatScoresToChartData,
  calculateComplianceScore,
  hasEnoughDataForChart,
  sortAlerts,
  getSeverityColor,
} from "../utils/chart-helpers";
import type { AnomalyScoreDoc, AlertDoc } from "../utils/chart-helpers";

// ── Helpers ──

function createScore(overrides: Partial<AnomalyScoreDoc> = {}): AnomalyScoreDoc {
  return {
    sensorReadingId: "sr-001",
    elderId: "elder-001",
    score: 25,
    normalizedScore: 0.25,
    timestamp: Date.now(),
    computedAt: Date.now(),
    ...overrides,
  };
}

function createAlert(overrides: Partial<AlertDoc> = {}): AlertDoc {
  return {
    id: "alert-001",
    elderId: "elder-001",
    guardianId: "guardian-001",
    type: "fall_detected",
    severity: "high",
    message: "Anomaly detected",
    anomalyScore: 0.85,
    acknowledged: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── formatScoresToChartData ──

describe("formatScoresToChartData", () => {
  it("returns a sentinel point when input is empty", () => {
    const result = formatScoresToChartData([]);

    expect(result).toHaveLength(1);
    expect(result[0]!.y).toBe(0);
  });

  it("filters scores older than the specified hours", () => {
    const now = Date.now();
    const oldScore = createScore({ timestamp: now - 25 * 60 * 60 * 1000 }); // 25h ago
    const recentScore = createScore({ timestamp: now - 1 * 60 * 60 * 1000 }); // 1h ago

    const result = formatScoresToChartData([oldScore, recentScore], 24);

    expect(result).toHaveLength(1);
    expect(result[0]!.y).toBe(recentScore.score);
  });

  it("sorts data points by timestamp ascending", () => {
    const now = Date.now();
    const s1 = createScore({ timestamp: now - 3 * 60 * 60 * 1000, score: 10 });
    const s2 = createScore({ timestamp: now - 1 * 60 * 60 * 1000, score: 30 });
    const s3 = createScore({ timestamp: now - 2 * 60 * 60 * 1000, score: 20 });

    const result = formatScoresToChartData([s2, s3, s1]);

    expect(result[0]!.y).toBe(10);
    expect(result[1]!.y).toBe(20);
    expect(result[2]!.y).toBe(30);
  });

  it("maps score values to y-axis correctly", () => {
    const result = formatScoresToChartData([createScore({ score: 75 })]);
    expect(result[0]!.y).toBe(75);
  });
});

// ── calculateComplianceScore ──

describe("calculateComplianceScore", () => {
  it("returns 100 when there are no anomaly scores", () => {
    expect(calculateComplianceScore([])).toBe(100);
  });

  it("returns 100 when all scores are old (outside time window)", () => {
    const old = createScore({
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
      score: 90,
    });
    expect(calculateComplianceScore([old], 24)).toBe(100);
  });

  it("calculates inverse of average score", () => {
    const now = Date.now();
    const scores = [
      createScore({ timestamp: now, score: 20 }),
      createScore({ timestamp: now, score: 40 }),
    ];
    // Average = 30, compliance = 100 - 30 = 70
    expect(calculateComplianceScore(scores)).toBe(70);
  });

  it("clamps compliance to minimum 0", () => {
    const now = Date.now();
    const extreme = createScore({ timestamp: now, score: 100 });
    // 100 - 100 = 0
    expect(calculateComplianceScore([extreme])).toBe(0);
  });

  it("rounds to 1 decimal place", () => {
    const now = Date.now();
    const scores = [
      createScore({ timestamp: now, score: 33 }),
      createScore({ timestamp: now, score: 33 }),
      createScore({ timestamp: now, score: 34 }),
    ];
    // Average = 33.333..., compliance = 66.667 → 66.7
    expect(calculateComplianceScore(scores)).toBe(66.7);
  });
});

// ── hasEnoughDataForChart ──

describe("hasEnoughDataForChart", () => {
  it("returns false when no scores exist", () => {
    expect(hasEnoughDataForChart([])).toBe(false);
  });

  it("returns false with only 1 recent score (default min 2)", () => {
    const score = createScore({ timestamp: Date.now() });
    expect(hasEnoughDataForChart([score])).toBe(false);
  });

  it("returns true with 2+ recent scores", () => {
    const now = Date.now();
    const scores = [
      createScore({ timestamp: now }),
      createScore({ timestamp: now }),
    ];
    expect(hasEnoughDataForChart(scores)).toBe(true);
  });

  it("respects custom minPoints parameter", () => {
    const now = Date.now();
    const scores = [
      createScore({ timestamp: now }),
      createScore({ timestamp: now }),
    ];
    expect(hasEnoughDataForChart(scores, 5)).toBe(false);
  });
});

// ── sortAlerts ──

describe("sortAlerts", () => {
  it("places unacknowledged alerts before acknowledged", () => {
    const ack = createAlert({ id: "a1", acknowledged: true, severity: "critical" });
    const unack = createAlert({ id: "a2", acknowledged: false, severity: "low" });

    const sorted = sortAlerts([ack, unack]);

    expect(sorted[0]!.id).toBe("a2");
    expect(sorted[1]!.id).toBe("a1");
  });

  it("sorts by severity: critical > high > medium > low", () => {
    const low = createAlert({ id: "a1", severity: "low" });
    const med = createAlert({ id: "a2", severity: "medium" });
    const high = createAlert({ id: "a3", severity: "high" });
    const crit = createAlert({ id: "a4", severity: "critical" });

    const sorted = sortAlerts([low, med, high, crit]);

    expect(sorted.map((a) => a.severity)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
  });

  it("sorts by date (newest first) when same severity", () => {
    const now = Date.now();
    const older = createAlert({ id: "a1", createdAt: now - 1000 });
    const newer = createAlert({ id: "a2", createdAt: now });

    const sorted = sortAlerts([older, newer]);

    expect(sorted[0]!.id).toBe("a2");
  });

  it("handles empty array without errors", () => {
    expect(sortAlerts([])).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const alerts = [
      createAlert({ id: "a1", severity: "low" }),
      createAlert({ id: "a2", severity: "critical" }),
    ];
    const originalFirst = alerts[0]!.id;

    sortAlerts(alerts);

    expect(alerts[0]!.id).toBe(originalFirst);
  });
});

// ── getSeverityColor ──

describe("getSeverityColor", () => {
  it("returns red for critical", () => {
    expect(getSeverityColor("critical")).toBe("#ef4444");
  });

  it("returns orange for high", () => {
    expect(getSeverityColor("high")).toBe("#f97316");
  });

  it("returns yellow for medium", () => {
    expect(getSeverityColor("medium")).toBe("#eab308");
  });

  it("returns green for low", () => {
    expect(getSeverityColor("low")).toBe("#22c55e");
  });

  it("returns gray for unknown severity", () => {
    expect(getSeverityColor("unknown")).toBe("#94a3b8");
  });
});
