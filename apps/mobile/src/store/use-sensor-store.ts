import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SensorReading } from "@elder-guard/core";

/**
 * Maximum number of readings to keep in the offline buffer.
 * Prevents AsyncStorage from exceeding its ~6MB limit on Android.
 */
const MAX_BUFFER_SIZE = 500;

/**
 * AsyncStorage adapter for Zustand persist middleware.
 */
const asyncStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return AsyncStorage.getItem(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await AsyncStorage.removeItem(name);
  },
};

export interface SensorStoreState {
  /** Offline buffer of validated sensor readings */
  readings: SensorReading[];
  /** Total number of readings collected since install */
  totalCollected: number;
  /** Timestamp of the last successful collection */
  lastCollectedAt: number | null;
  /** Whether a collection is currently in progress */
  isCollecting: boolean;
  /** Last error message */
  error: string | null;

  /** Add a validated reading to the buffer (FIFO overflow) */
  addReading: (reading: SensorReading) => void;
  /** Get the last N readings from the buffer */
  getLatestReadings: (count: number) => SensorReading[];
  /** Clear all readings from the buffer */
  clearBuffer: () => void;
  /** Set collecting status */
  setCollecting: (status: boolean) => void;
  /** Set error message */
  setError: (error: string | null) => void;
}

/**
 * Zustand sensor store with AsyncStorage persistence.
 * Acts as an offline buffer for validated sensor readings.
 * Enforces MAX_BUFFER_SIZE to prevent AsyncStorage overflow.
 */
export const useSensorStore = create<SensorStoreState>()(
  persist(
    (set, get) => ({
      readings: [],
      totalCollected: 0,
      lastCollectedAt: null,
      isCollecting: false,
      error: null,

      addReading: (reading: SensorReading) => {
        set((state) => {
          const newReadings = [...state.readings, reading];

          // FIFO: prune oldest readings if buffer exceeds max size
          const trimmed =
            newReadings.length > MAX_BUFFER_SIZE
              ? newReadings.slice(newReadings.length - MAX_BUFFER_SIZE)
              : newReadings;

          return {
            readings: trimmed,
            totalCollected: state.totalCollected + 1,
            lastCollectedAt: reading.timestamp,
            error: null,
          };
        });
      },

      getLatestReadings: (count: number): SensorReading[] => {
        const { readings } = get();
        return readings.slice(-count);
      },

      clearBuffer: () => {
        set({ readings: [], error: null });
      },

      setCollecting: (status: boolean) => {
        set({ isCollecting: status });
      },

      setError: (error: string | null) => {
        set({ error });
      },
    }),
    {
      name: "elder-guard-sensor-buffer",
      storage: createJSONStorage(() => asyncStorageAdapter),
      /**
       * Only persist readings and metadata — not transient UI state.
       */
      partialize: (state) => ({
        readings: state.readings,
        totalCollected: state.totalCollected,
        lastCollectedAt: state.lastCollectedAt,
      }),
    }
  )
);
