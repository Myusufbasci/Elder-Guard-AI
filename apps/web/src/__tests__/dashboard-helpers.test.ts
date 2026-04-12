import {
  classifyRiskLevel,
  getRiskColor,
  aggregateElderRisks,
  sortByRisk,
  filterByRiskLevel,
  formatRiskMatrixCsv,
  escapeCsvField,
  formatScoresToChartPoints,
} from "@/lib/dashboard-helpers";
import type { AnomalyScoreRecord, ElderRiskRow } from "@/lib/dashboard-helpers";

// ── Helpers ──

function createScore(
  overrides: Partial<AnomalyScoreRecord> = {}
): AnomalyScoreRecord {
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

function createRow(overrides: Partial<ElderRiskRow> = {}): ElderRiskRow {
  return {
    elderId: "elder-001",
    elderName: "Test Elder",
    latestScore: 25,
    normalizedScore: 0.25,
    readingCount: 1,
    lastActivityAt: Date.now(),
    riskLevel: "safe",
    ...overrides,
  };
}

// ── classifyRiskLevel ──

describe("classifyRiskLevel", () => {
  it("returns 'critical' for scores > 80", () => {
    expect(classifyRiskLevel(81)).toBe("critical");
    expect(classifyRiskLevel(100)).toBe("critical");
    expect(classifyRiskLevel(95)).toBe("critical");
  });

  it("returns 'warning' for scores 50-80", () => {
    expect(classifyRiskLevel(50)).toBe("warning");
    expect(classifyRiskLevel(80)).toBe("warning");
    expect(classifyRiskLevel(65)).toBe("warning");
  });

  it("returns 'safe' for scores < 50", () => {
    expect(classifyRiskLevel(0)).toBe("safe");
    expect(classifyRiskLevel(49)).toBe("safe");
    expect(classifyRiskLevel(25)).toBe("safe");
  });
});

// ── getRiskColor ──

describe("getRiskColor", () => {
  it("returns red for critical", () => {
    expect(getRiskColor("critical")).toBe("#ef4444");
  });

  it("returns yellow for warning", () => {
    expect(getRiskColor("warning")).toBe("#eab308");
  });

  it("returns green for safe", () => {
    expect(getRiskColor("safe")).toBe("#22c55e");
  });
});

// ── sortByRisk ──

describe("sortByRisk", () => {
  it("sorts rows by latestScore descending", () => {
    const rows = [
      createRow({ elderId: "a", latestScore: 20 }),
      createRow({ elderId: "b", latestScore: 90 }),
      createRow({ elderId: "c", latestScore: 55 }),
    ];

    const sorted = sortByRisk(rows);

    expect(sorted[0]!.elderId).toBe("b");
    expect(sorted[1]!.elderId).toBe("c");
    expect(sorted[2]!.elderId).toBe("a");
  });

  it("does not mutate the original array", () => {
    const rows = [
      createRow({ elderId: "a", latestScore: 10 }),
      createRow({ elderId: "b", latestScore: 90 }),
    ];
    const original = rows[0]!.elderId;

    sortByRisk(rows);

    expect(rows[0]!.elderId).toBe(original);
  });

  it("handles empty array", () => {
    expect(sortByRisk([])).toEqual([]);
  });

  it("handles single item", () => {
    const rows = [createRow({ elderId: "a", latestScore: 50 })];
    expect(sortByRisk(rows)).toHaveLength(1);
  });
});

// ── filterByRiskLevel ──

describe("filterByRiskLevel", () => {
  const rows = [
    createRow({ elderId: "a", riskLevel: "critical", latestScore: 90 }),
    createRow({ elderId: "b", riskLevel: "warning", latestScore: 60 }),
    createRow({ elderId: "c", riskLevel: "safe", latestScore: 20 }),
    createRow({ elderId: "d", riskLevel: "critical", latestScore: 85 }),
  ];

  it("returns all rows when filter is 'all'", () => {
    expect(filterByRiskLevel(rows, "all")).toHaveLength(4);
  });

  it("filters critical only", () => {
    const result = filterByRiskLevel(rows, "critical");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.riskLevel === "critical")).toBe(true);
  });

  it("filters warning only", () => {
    const result = filterByRiskLevel(rows, "warning");
    expect(result).toHaveLength(1);
    expect(result[0]!.riskLevel).toBe("warning");
  });

  it("filters safe only", () => {
    const result = filterByRiskLevel(rows, "safe");
    expect(result).toHaveLength(1);
    expect(result[0]!.riskLevel).toBe("safe");
  });
});

// ── aggregateElderRisks ──

describe("aggregateElderRisks", () => {
  it("groups scores by elder and returns latest score", () => {
    const now = Date.now();
    const scores = [
      createScore({ elderId: "e1", score: 30, timestamp: now - 1000 }),
      createScore({ elderId: "e1", score: 85, timestamp: now }), // latest
      createScore({ elderId: "e2", score: 45, timestamp: now }),
    ];

    const rows = aggregateElderRisks(scores, { e1: "Alice", e2: "Bob" });

    expect(rows).toHaveLength(2);
    // Sorted by risk descending, so e1 (85) first
    expect(rows[0]!.elderId).toBe("e1");
    expect(rows[0]!.latestScore).toBe(85);
    expect(rows[0]!.elderName).toBe("Alice");
    expect(rows[0]!.readingCount).toBe(2);
    expect(rows[1]!.elderId).toBe("e2");
    expect(rows[1]!.latestScore).toBe(45);
  });

  it("generates fallback name for unknown elders", () => {
    const scores = [createScore({ elderId: "unknown-elder-123" })];
    const rows = aggregateElderRisks(scores, {});

    expect(rows[0]!.elderName).toContain("Elder");
  });

  it("handles empty scores array", () => {
    expect(aggregateElderRisks([], {})).toEqual([]);
  });
});

// ── escapeCsvField ──

describe("escapeCsvField", () => {
  it("returns plain values unchanged", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("wraps values with commas in quotes", () => {
    expect(escapeCsvField("hello,world")).toBe('"hello,world"');
  });

  it("escapes internal double quotes", () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps values with newlines in quotes", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

// ── formatRiskMatrixCsv ──

describe("formatRiskMatrixCsv", () => {
  it("generates CSV with headers and data rows", () => {
    const rows = [
      createRow({
        elderId: "e1",
        elderName: "Alice",
        latestScore: 85,
        riskLevel: "critical",
        readingCount: 10,
        lastActivityAt: 1711900800000,
      }),
    ];

    const csv = formatRiskMatrixCsv(rows);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "Elder ID,Name,Risk Score,Risk Level,Reading Count,Last Activity"
    );
    expect(lines[1]).toContain("e1");
    expect(lines[1]).toContain("Alice");
    expect(lines[1]).toContain("85");
    expect(lines[1]).toContain("CRITICAL");
  });

  it("handles empty rows", () => {
    const csv = formatRiskMatrixCsv([]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1); // Headers only
  });

  it("escapes names containing commas", () => {
    const rows = [
      createRow({ elderName: "Smith, John" }),
    ];

    const csv = formatRiskMatrixCsv(rows);
    expect(csv).toContain('"Smith, John"');
  });
});

// ── formatScoresToChartPoints ──

describe("formatScoresToChartPoints", () => {
  it("filters out scores older than daysBack", () => {
    const now = Date.now();
    const scores = [
      createScore({ timestamp: now - 8 * 24 * 60 * 60 * 1000, score: 50 }), // 8d ago
      createScore({ timestamp: now - 1 * 24 * 60 * 60 * 1000, score: 30 }), // 1d ago
    ];

    const points = formatScoresToChartPoints(scores, 7);

    expect(points).toHaveLength(1);
    expect(points[0]!.score).toBe(30);
  });

  it("returns empty array for no data in range", () => {
    const old = createScore({
      timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
    });
    expect(formatScoresToChartPoints([old], 7)).toHaveLength(0);
  });

  it("sorts points chronologically by timestamp", () => {
    const now = Date.now();
    const day1 = now - 3 * 24 * 60 * 60 * 1000;
    const day2 = now - 1 * 24 * 60 * 60 * 1000;

    const scores = [
      createScore({ timestamp: day2, score: 40 }),
      createScore({ timestamp: day1, score: 20 }),
    ];

    const points = formatScoresToChartPoints(scores, 7);
    expect(points[0]!.timestamp).toBeLessThan(points[1]!.timestamp);
  });
});
