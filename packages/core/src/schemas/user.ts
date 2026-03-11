import { z } from "zod";

/** User roles in the Elder-Guard platform */
export const userRoleEnum = z.enum(["guardian", "admin"]);

/**
 * Schema for a User — base entity for all authenticated users.
 */
export const userSchema = z.object({
    uid: z.string().min(1),
    email: z.string().email(),
    role: userRoleEnum,
    displayName: z.string().min(1),
    createdAt: z.number(),
    updatedAt: z.number(),
});

/**
 * Schema for a Guardian — extends User concept, the person monitoring an elder.
 */
export const guardianSchema = z.object({
    uid: z.string().min(1),
    email: z.string().email(),
    role: z.literal("guardian"),
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
    id: z.string().min(1),
    fullName: z.string().min(1),
    age: z.number().int().positive(),
    guardianId: z.string().min(1),
    deviceId: z.string().optional(),
    notes: z.string().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
});

export type UserRole = z.infer<typeof userRoleEnum>;
export type User = z.infer<typeof userSchema>;
export type Guardian = z.infer<typeof guardianSchema>;
export type Elder = z.infer<typeof elderSchema>;
