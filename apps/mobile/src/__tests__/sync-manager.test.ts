import type { SensorReading } from "@elder-guard/core";
import { useSensorStore } from "../store/use-sensor-store";

/**
 * Tests for the Sync Manager queue logic.
 *
 * Since the sync manager depends on Firestore (firebase/firestore),
 * we test the underlying store actions that power the sync:
 * - removeSyncedReadings: removes only specified IDs
 * - isSyncing: prevents concurrent syncs
 * - Buffer integrity: remaining items are untouched
 */

// ── Helpers ──

function createReading(id: string, timestamp?: number): SensorReading {
  return {
    id,
    elderId: "elder-demo-001",
    timestamp: timestamp ?? Date.now(),
    type: "accelerometer",
    value: { x: 0.1, y: -9.81, z: 0.05 },
  };
}

function resetStore(): void {
  useSensorStore.setState({
    readings: [],
    totalCollected: 0,
    lastCollectedAt: null,
    isCollecting: false,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  });
}

// ── Tests ──

describe("Sync Manager — removeSyncedReadings", () => {
  beforeEach(resetStore);

  it("removes only the synced reading IDs from the buffer", () => {
    const r1 = createReading("r1");
    const r2 = createReading("r2");
    const r3 = createReading("r3");
    const r4 = createReading("r4");

    // Add all four
    useSensorStore.getState().addReading(r1);
    useSensorStore.getState().addReading(r2);
    useSensorStore.getState().addReading(r3);
    useSensorStore.getState().addReading(r4);

    expect(useSensorStore.getState().readings).toHaveLength(4);

    // Sync r1 and r3 (simulate batch 1 success)
    useSensorStore.getState().removeSyncedReadings(["r1", "r3"]);

    const remaining = useSensorStore.getState().readings;
    expect(remaining).toHaveLength(2);
    expect(remaining.map((r) => r.id)).toEqual(["r2", "r4"]);
  });

  it("sets lastSyncedAt after removing synced readings", () => {
    const r1 = createReading("r1");
    useSensorStore.getState().addReading(r1);

    expect(useSensorStore.getState().lastSyncedAt).toBeNull();

    useSensorStore.getState().removeSyncedReadings(["r1"]);

    expect(useSensorStore.getState().lastSyncedAt).not.toBeNull();
    expect(typeof useSensorStore.getState().lastSyncedAt).toBe("number");
  });

  it("does nothing when synced IDs don't match any readings", () => {
    const r1 = createReading("r1");
    const r2 = createReading("r2");
    useSensorStore.getState().addReading(r1);
    useSensorStore.getState().addReading(r2);

    useSensorStore.getState().removeSyncedReadings(["nonexistent-1", "nonexistent-2"]);

    expect(useSensorStore.getState().readings).toHaveLength(2);
  });

  it("handles removing all readings at once", () => {
    const r1 = createReading("r1");
    const r2 = createReading("r2");
    const r3 = createReading("r3");
    useSensorStore.getState().addReading(r1);
    useSensorStore.getState().addReading(r2);
    useSensorStore.getState().addReading(r3);

    useSensorStore.getState().removeSyncedReadings(["r1", "r2", "r3"]);

    expect(useSensorStore.getState().readings).toHaveLength(0);
  });

  it("handles empty IDs array gracefully", () => {
    const r1 = createReading("r1");
    useSensorStore.getState().addReading(r1);

    useSensorStore.getState().removeSyncedReadings([]);

    expect(useSensorStore.getState().readings).toHaveLength(1);
  });

  it("preserves totalCollected count after removing synced items", () => {
    const r1 = createReading("r1");
    const r2 = createReading("r2");
    useSensorStore.getState().addReading(r1);
    useSensorStore.getState().addReading(r2);

    expect(useSensorStore.getState().totalCollected).toBe(2);

    useSensorStore.getState().removeSyncedReadings(["r1"]);

    // totalCollected should not decrease — it tracks lifetime count
    expect(useSensorStore.getState().totalCollected).toBe(2);
    expect(useSensorStore.getState().readings).toHaveLength(1);
  });
});

describe("Sync Manager — isSyncing lock", () => {
  beforeEach(resetStore);

  it("defaults to isSyncing: false", () => {
    expect(useSensorStore.getState().isSyncing).toBe(false);
  });

  it("sets isSyncing flag", () => {
    useSensorStore.getState().setSyncing(true);
    expect(useSensorStore.getState().isSyncing).toBe(true);

    useSensorStore.getState().setSyncing(false);
    expect(useSensorStore.getState().isSyncing).toBe(false);
  });
});

describe("Sync Manager — batch simulation", () => {
  beforeEach(resetStore);

  it("simulates multi-batch sync: batch 1 succeeds, batch 2 partially", () => {
    // Seed 7 readings
    for (let i = 1; i <= 7; i++) {
      useSensorStore.getState().addReading(createReading(`r${i}`));
    }

    expect(useSensorStore.getState().readings).toHaveLength(7);

    // Batch 1: r1-r5 sync successfully
    useSensorStore.getState().removeSyncedReadings(["r1", "r2", "r3", "r4", "r5"]);
    expect(useSensorStore.getState().readings).toHaveLength(2);

    // Batch 2: only r6 syncs (r7 fails)
    useSensorStore.getState().removeSyncedReadings(["r6"]);
    expect(useSensorStore.getState().readings).toHaveLength(1);
    expect(useSensorStore.getState().readings[0]?.id).toBe("r7");
  });

  it("new readings added during sync are not affected", () => {
    const r1 = createReading("r1");
    const r2 = createReading("r2");
    useSensorStore.getState().addReading(r1);
    useSensorStore.getState().addReading(r2);

    // Simulate: sync starts with [r1, r2], but r3 arrives during sync
    useSensorStore.getState().addReading(createReading("r3"));

    // Only remove the original batch items
    useSensorStore.getState().removeSyncedReadings(["r1", "r2"]);

    const remaining = useSensorStore.getState().readings;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("r3");
  });
});
