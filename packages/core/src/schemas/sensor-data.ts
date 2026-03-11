import { z } from "zod";

/**
 * Schema for an accelerometer payload — typed x, y, z axes.
 */
export const accelerometerPayloadSchema = z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
});

/**
 * Schema for individual sensor readings from the mobile device.
 */
export const sensorReadingSchema = z.object({
    id: z.string().min(1),
    elderId: z.string().min(1),
    timestamp: z.number(),
    type: z.enum(["accelerometer", "heart_rate", "gyroscope", "step_count"]),
    value: z.record(z.string(), z.number()),
});

/**
 * Schema for a batch of sensor data submitted from mobile.
 */
export const sensorBatchSchema = z.object({
    elderId: z.string().min(1),
    deviceId: z.string().min(1),
    readings: z.array(sensorReadingSchema).min(1),
    submittedAt: z.number(),
});

export type AccelerometerPayload = z.infer<typeof accelerometerPayloadSchema>;
export type SensorReading = z.infer<typeof sensorReadingSchema>;
export type SensorBatch = z.infer<typeof sensorBatchSchema>;
