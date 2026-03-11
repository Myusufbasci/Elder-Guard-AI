import { z } from "zod";

/** Supported device platforms */
export const devicePlatformEnum = z.enum(["android", "ios"]);

/**
 * Schema for a Device — the mobile device attached to an Elder.
 */
export const deviceSchema = z.object({
    id: z.string().min(1),
    elderId: z.string().min(1),
    platform: devicePlatformEnum,
    model: z.string().min(1),
    osVersion: z.string().min(1),
    lastSyncAt: z.number(),
    isActive: z.boolean(),
    registeredAt: z.number(),
});

export type DevicePlatform = z.infer<typeof devicePlatformEnum>;
export type Device = z.infer<typeof deviceSchema>;
