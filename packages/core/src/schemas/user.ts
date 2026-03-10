import { z } from "zod";

/**
 * Schema for a Guardian user — the person monitoring an elder.
 */
export const guardianSchema = z.object({
    uid: z.string(),
    email: z.string().email(),
    displayName: z.string().min(1),
    phone: z.string().optional(),
    elderIds: z.array(z.string()),
    createdAt: z.number(),
    updatedAt: z.number(),
});

/**
 * Schema for an Elder — the person being monitored.
 */
export const elderSchema = z.object({
    id: z.string(),
    fullName: z.string().min(1),
    age: z.number().int().positive(),
    guardianId: z.string(),
    deviceId: z.string().optional(),
    notes: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
});

export type Guardian = z.infer<typeof guardianSchema>;
export type Elder = z.infer<typeof elderSchema>;
