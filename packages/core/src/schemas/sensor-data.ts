import { z } from "zod";

/**
 * Schema for individual sensor readings from the mobile device.
 */
export const sensorReadingSchema = z.object({
    id: z.string(),
    elderId: z.string(),
    timestamp: z.number(),
    type: z.enum(["accelerometer", "heart_rate", "gyroscope", "step_count"]),
    value: z.record(z.string(), z.number()),
});

/**
 * Schema for a batch of sensor data submitted from mobile.
 */
export const sensorBatchSchema = z.object({
    elderId: z.string(),
    deviceId: z.string(),
    readings: z.array(sensorReadingSchema),
    submittedAt: z.number(),
});

export type SensorReading = z.infer<typeof sensorReadingSchema>;
export type SensorBatch = z.infer<typeof sensorBatchSchema>;
