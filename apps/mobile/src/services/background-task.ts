import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { collectSensorReading } from "./sensor-service";
import { useSensorStore } from "../store/use-sensor-store";

/**
 * Background task name — registered with Expo TaskManager.
 */
export const SENSOR_BACKGROUND_TASK = "elder-guard-sensor-collection";

/**
 * Define the background task.
 * This runs periodically when the OS allows (minimum ~15 min on iOS).
 */
TaskManager.defineTask(SENSOR_BACKGROUND_TASK, async () => {
  try {
    console.log(
      `[background-task] Executing ${SENSOR_BACKGROUND_TASK} at`,
      new Date().toISOString()
    );

    const reading = await collectSensorReading();

    if (reading) {
      useSensorStore.getState().addReading(reading);
      console.log("[background-task] Reading stored:", reading.id);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    console.warn("[background-task] No reading collected");
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("[background-task] Task failed:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background fetch task with the OS.
 * On iOS, the minimum interval is ~15 minutes.
 * On Android, it depends on Doze mode and battery optimization settings.
 */
export async function registerBackgroundTask(): Promise<void> {
  try {
    const status = await BackgroundFetch.getStatusAsync();

    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.warn(
        "[background-task] Background fetch is restricted or denied by the OS"
      );
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      SENSOR_BACKGROUND_TASK
    );

    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(SENSOR_BACKGROUND_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log("[background-task] Registered successfully");
    } else {
      console.log("[background-task] Already registered");
    }
  } catch (error) {
    console.error("[background-task] Registration failed:", error);
  }
}

/**
 * Unregister the background fetch task.
 */
export async function unregisterBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      SENSOR_BACKGROUND_TASK
    );
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(SENSOR_BACKGROUND_TASK);
      console.log("[background-task] Unregistered successfully");
    }
  } catch (error) {
    console.error("[background-task] Unregistration failed:", error);
  }
}
