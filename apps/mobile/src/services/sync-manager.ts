import {
  collection,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@elder-guard/firebase-config";
import { COLLECTIONS } from "@elder-guard/core";
import type { SensorReading } from "@elder-guard/core";
import { useSensorStore } from "../store/use-sensor-store";

/**
 * Maximum batch size for Firestore writeBatch (Firestore limit is 500).
 * We use 50 to keep individual batch execution fast.
 */
const BATCH_SIZE = 50;

/**
 * Sync result returned after each sync attempt.
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Sync Manager: reads unsynced sensor readings from the local Zustand store,
 * pushes them in batches to Firestore, and removes successfully synced items.
 *
 * Key design decisions:
 * - Uses Firestore `writeBatch()` for atomic writes (all-or-nothing per batch)
 * - Uses reading `id` as document ID for idempotent writes (prevents duplicates)
 * - Locks with `isSyncing` flag to prevent concurrent sync attempts
 */
export async function syncSensorData(): Promise<SyncResult> {
  const store = useSensorStore.getState();

  // ── Guard: prevent concurrent syncs ──
  if (store.isSyncing) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      error: "Sync already in progress",
    };
  }

  const readings = [...store.readings];

  if (readings.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0 };
  }

  store.setSyncing(true);
  store.setError(null);

  let totalSynced = 0;
  let totalFailed = 0;

  try {
    // ── Process in batches ──
    for (let i = 0; i < readings.length; i += BATCH_SIZE) {
      const batch = readings.slice(i, i + BATCH_SIZE);
      const syncedIds = await writeBatchToFirestore(batch);

      if (syncedIds.length > 0) {
        // Remove only successfully synced items from local buffer
        store.removeSyncedReadings(syncedIds);
        totalSynced += syncedIds.length;
      }

      const failed = batch.length - syncedIds.length;
      totalFailed += failed;
    }

    return {
      success: totalFailed === 0,
      syncedCount: totalSynced,
      failedCount: totalFailed,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    store.setError(message);
    return {
      success: false,
      syncedCount: totalSynced,
      failedCount: readings.length - totalSynced,
      error: message,
    };
  } finally {
    store.setSyncing(false);
  }
}

/**
 * Write a batch of readings to Firestore using atomic `writeBatch()`.
 * Uses reading.id as the document ID for idempotent writes.
 *
 * @returns Array of successfully synced reading IDs
 */
async function writeBatchToFirestore(
  readings: SensorReading[]
): Promise<string[]> {
  try {
    const batch = writeBatch(db);
    const colRef = collection(db, COLLECTIONS.sensorReadings);

    for (const reading of readings) {
      // Use reading.id as doc ID — makes write idempotent
      const docRef = doc(colRef, reading.id);
      batch.set(docRef, {
        ...reading,
        syncedAt: Date.now(),
      });
    }

    await batch.commit();

    console.log(
      `[sync-manager] Batch of ${readings.length} readings synced successfully`
    );

    return readings.map((r) => r.id);
  } catch (error) {
    console.error("[sync-manager] Batch write failed:", error);
    return [];
  }
}

/**
 * Get the current sync status for UI display.
 */
export function getSyncStatus(): {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
} {
  const state = useSensorStore.getState();
  return {
    pendingCount: state.readings.length,
    isSyncing: state.isSyncing,
    lastSyncedAt: state.lastSyncedAt,
  };
}
