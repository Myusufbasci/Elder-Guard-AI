/**
 * Shared types and constants used across the Elder-Guard platform.
 */

/** Firestore collection names (camelCase, plural per AGENT.md) */
export const COLLECTIONS = {
    users: "users",
    guardians: "guardians",
    elders: "elders",
    devices: "devices",
    sensorReadings: "sensorReadings",
    anomalyScores: "anomalyScores",
    alerts: "alerts",
} as const;

/** Supported sensor types */
export type SensorType = "accelerometer" | "heart_rate" | "gyroscope" | "step_count";

/** Alert severity levels */
export type AlertSeverity = "low" | "medium" | "high" | "critical";

/** Generic API response wrapper */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}
