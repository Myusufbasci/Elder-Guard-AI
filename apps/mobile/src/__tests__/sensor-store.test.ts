import { sensorReadingSchema } from "@elder-guard/core";
import type { SensorReading } from "@elder-guard/core";
import { ZodError } from "zod";

/**
 * Import the store fresh for each test using zustand's vanilla API.
 * We test the store actions and payload formatting logic directly.
 */
import { useSensorStore } from "../store/use-sensor-store";

// ── Helpers ──

function createMockReading(overrides: Partial<SensorReading> = {}): SensorReading {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    elderId: "elder-demo-001",
    timestamp: Date.now(),
    type: "accelerometer",
    value: { x: 0.123, y: -9.81, z: 0.045 },
    ...overrides,
  };
}

function formatPayload(reading: SensorReading): {
  id: string;
  elderId: string;
  timestamp: number;
  type: string;
  value: Record<string, number>;
} {
  return {
    id: reading.id,
    elderId: reading.elderId,
    timestamp: reading.timestamp,
    type: reading.type,
    value: {
      x: Math.round((reading.value["x"] ?? 0) * 1000) / 1000,
      y: Math.round((reading.value["y"] ?? 0) * 1000) / 1000,
      z: Math.round((reading.value["z"] ?? 0) * 1000) / 1000,
    },
  };
}

// ── Tests ──

describe("Sensor Store — addReading", () => {
  beforeEach(() => {
    // Reset store state before each test
    useSensorStore.setState({
      readings: [],
      totalCollected: 0,
      lastCollectedAt: null,
      isCollecting: false,
      error: null,
    });
  });

  it("adds a reading to the buffer", () => {
    const reading = createMockReading();
    useSensorStore.getState().addReading(reading);

    const state = useSensorStore.getState();
    expect(state.readings).toHaveLength(1);
    expect(state.readings[0]).toEqual(reading);
    expect(state.totalCollected).toBe(1);
    expect(state.lastCollectedAt).toBe(reading.timestamp);
  });

  it("maintains insertion order", () => {
    const r1 = createMockReading({ id: "r1", timestamp: 1000 });
    const r2 = createMockReading({ id: "r2", timestamp: 2000 });
    const r3 = createMockReading({ id: "r3", timestamp: 3000 });

    useSensorStore.getState().addReading(r1);
    useSensorStore.getState().addReading(r2);
    useSensorStore.getState().addReading(r3);

    const { readings } = useSensorStore.getState();
    expect(readings).toHaveLength(3);
    expect(readings[0]?.id).toBe("r1");
    expect(readings[2]?.id).toBe("r3");
  });

  it("increments totalCollected correctly", () => {
    for (let i = 0; i < 5; i++) {
      useSensorStore.getState().addReading(createMockReading());
    }
    expect(useSensorStore.getState().totalCollected).toBe(5);
  });

  it("updates lastCollectedAt to latest timestamp", () => {
    const r1 = createMockReading({ timestamp: 1000 });
    const r2 = createMockReading({ timestamp: 5000 });

    useSensorStore.getState().addReading(r1);
    useSensorStore.getState().addReading(r2);

    expect(useSensorStore.getState().lastCollectedAt).toBe(5000);
  });
});

describe("Sensor Store — FIFO buffer overflow", () => {
  beforeEach(() => {
    useSensorStore.setState({
      readings: [],
      totalCollected: 0,
      lastCollectedAt: null,
      isCollecting: false,
      error: null,
    });
  });

  it("trims oldest readings when exceeding max buffer size (500)", () => {
    // Pre-fill with 500 readings
    const readings: SensorReading[] = [];
    for (let i = 0; i < 500; i++) {
      readings.push(createMockReading({ id: `old-${i}` }));
    }
    useSensorStore.setState({ readings, totalCollected: 500 });

    // Add one more — should push out the oldest
    const newReading = createMockReading({ id: "new-overflow" });
    useSensorStore.getState().addReading(newReading);

    const state = useSensorStore.getState();
    expect(state.readings).toHaveLength(500);
    expect(state.readings[0]?.id).toBe("old-1"); // old-0 was pruned
    expect(state.readings[499]?.id).toBe("new-overflow");
    expect(state.totalCollected).toBe(501);
  });
});

describe("Sensor Store — getLatestReadings", () => {
  beforeEach(() => {
    useSensorStore.setState({
      readings: [],
      totalCollected: 0,
      lastCollectedAt: null,
      isCollecting: false,
      error: null,
    });
  });

  it("returns the last N readings", () => {
    for (let i = 0; i < 10; i++) {
      useSensorStore.getState().addReading(createMockReading({ id: `r-${i}` }));
    }

    const latest5 = useSensorStore.getState().getLatestReadings(5);
    expect(latest5).toHaveLength(5);
    expect(latest5[0]?.id).toBe("r-5");
    expect(latest5[4]?.id).toBe("r-9");
  });

  it("returns all readings if less than N exist", () => {
    useSensorStore.getState().addReading(createMockReading({ id: "only-one" }));

    const latest5 = useSensorStore.getState().getLatestReadings(5);
    expect(latest5).toHaveLength(1);
    expect(latest5[0]?.id).toBe("only-one");
  });

  it("returns empty array when buffer is empty", () => {
    const latest = useSensorStore.getState().getLatestReadings(5);
    expect(latest).toHaveLength(0);
  });
});

describe("Sensor Store — clearBuffer", () => {
  it("clears all readings but keeps totalCollected", () => {
    for (let i = 0; i < 3; i++) {
      useSensorStore.getState().addReading(createMockReading());
    }
    expect(useSensorStore.getState().readings).toHaveLength(3);

    useSensorStore.getState().clearBuffer();

    const state = useSensorStore.getState();
    expect(state.readings).toHaveLength(0);
    expect(state.totalCollected).toBe(3); // preserved
  });
});

describe("Sensor Store — setCollecting / setError", () => {
  it("toggles isCollecting state", () => {
    useSensorStore.getState().setCollecting(true);
    expect(useSensorStore.getState().isCollecting).toBe(true);

    useSensorStore.getState().setCollecting(false);
    expect(useSensorStore.getState().isCollecting).toBe(false);
  });

  it("sets and clears error", () => {
    useSensorStore.getState().setError("Something broke");
    expect(useSensorStore.getState().error).toBe("Something broke");

    useSensorStore.getState().setError(null);
    expect(useSensorStore.getState().error).toBeNull();
  });
});

describe("Payload Formatting — Zod validation", () => {
  it("valid accelerometer payload passes schema", () => {
    const reading = createMockReading();
    expect(() => sensorReadingSchema.parse(reading)).not.toThrow();
  });

  it("rejects payload with missing elderId", () => {
    const { elderId, ...broken } = createMockReading();
    expect(() => sensorReadingSchema.parse(broken)).toThrow(ZodError);
  });

  it("rejects payload with invalid sensor type", () => {
    const reading = createMockReading();
    expect(() =>
      sensorReadingSchema.parse({ ...reading, type: "gps" })
    ).toThrow(ZodError);
  });

  it("formats payload with rounded axis values", () => {
    const reading = createMockReading({
      value: { x: 1.23456789, y: -9.81234567, z: 0.00012345 },
    });
    const formatted = formatPayload(reading);

    expect(formatted.value.x).toBe(1.235);
    expect(formatted.value.y).toBe(-9.812);
    expect(formatted.value.z).toBe(0);
  });

  it("handles zero values in payload", () => {
    const reading = createMockReading({
      value: { x: 0, y: 0, z: 0 },
    });
    const formatted = formatPayload(reading);

    expect(formatted.value.x).toBe(0);
    expect(formatted.value.y).toBe(0);
    expect(formatted.value.z).toBe(0);
  });
});
