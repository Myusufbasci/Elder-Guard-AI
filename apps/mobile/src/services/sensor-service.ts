import { Accelerometer } from "expo-sensors";
import type { AccelerometerMeasurement } from "expo-sensors";
import { v4 as uuidv4 } from "uuid";
import { sensorReadingSchema } from "@elder-guard/core";
import type { SensorReading } from "@elder-guard/core";

/**
 * Configuration for sensor collection.
 */
const ACCELEROMETER_READ_DURATION_MS = 500;
const ACCELEROMETER_UPDATE_INTERVAL_MS = 100;

/**
 * Mock screen lock status.
 * Native screen state requires ejecting from Expo managed workflow.
 * In production, this would use a native module or AppState.
 */
export function getScreenLockStatus(): { isLocked: boolean; source: string } {
  const isLocked = Math.random() > 0.5;
  return { isLocked, source: "mock" };
}

/**
 * Read a single accelerometer sample. Returns after ACCELEROMETER_READ_DURATION_MS
 * or falls back to zeroed values if the sensor is unavailable/denied.
 */
function readAccelerometerOnce(): Promise<AccelerometerMeasurement> {
  return new Promise((resolve) => {
    let resolved = false;

    Accelerometer.setUpdateInterval(ACCELEROMETER_UPDATE_INTERVAL_MS);

    const subscription = Accelerometer.addListener((data) => {
      if (!resolved) {
        resolved = true;
        subscription.remove();
        resolve(data);
      }
    });

    // Timeout fallback: if sensor doesn't report in time
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        subscription.remove();
        console.warn(
          "[sensor-service] Accelerometer timeout — using fallback values"
        );
        resolve({ x: 0, y: 0, z: 0 });
      }
    }, ACCELEROMETER_READ_DURATION_MS);
  });
}

/**
 * Collect a validated sensor reading.
 * Reads accelerometer data, validates against Zod schema, and returns.
 *
 * @param elderId - The elder this reading belongs to (placeholder for now)
 * @returns A validated SensorReading or null if validation fails
 */
export async function collectSensorReading(
  elderId: string = "elder-demo-001"
): Promise<SensorReading | null> {
  try {
    // Check sensor availability
    const isAvailable = await Accelerometer.isAvailableAsync();

    let accelData: AccelerometerMeasurement;

    if (isAvailable) {
      accelData = await readAccelerometerOnce();
    } else {
      console.warn(
        "[sensor-service] Accelerometer not available — using fallback"
      );
      accelData = { x: 0, y: 0, z: 0 };
    }

    const rawReading = {
      id: uuidv4(),
      elderId,
      timestamp: Date.now(),
      type: "accelerometer" as const,
      value: {
        x: Math.round(accelData.x * 1000) / 1000,
        y: Math.round(accelData.y * 1000) / 1000,
        z: Math.round(accelData.z * 1000) / 1000,
      },
    };

    // Validate against Zod schema from @elder-guard/core
    const validated = sensorReadingSchema.parse(rawReading);
    return validated;
  } catch (error) {
    console.error("[sensor-service] Failed to collect sensor reading:", error);
    return null;
  }
}

/**
 * Format a sensor reading for display in the UI.
 */
export function formatReadingForDisplay(reading: SensorReading): string {
  const time = new Date(reading.timestamp).toLocaleTimeString();
  const x = reading.value["x"]?.toFixed(3) ?? "N/A";
  const y = reading.value["y"]?.toFixed(3) ?? "N/A";
  const z = reading.value["z"]?.toFixed(3) ?? "N/A";
  return `[${time}] X:${x} Y:${y} Z:${z}`;
}
