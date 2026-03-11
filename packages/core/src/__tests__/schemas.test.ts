import { ZodError } from "zod";
import {
    userSchema,
    userRoleEnum,
    guardianSchema,
    elderSchema,
} from "../schemas/user";
import { deviceSchema, devicePlatformEnum } from "../schemas/device";
import {
    sensorReadingSchema,
    sensorBatchSchema,
    accelerometerPayloadSchema,
} from "../schemas/sensor-data";
import { alertSchema } from "../schemas/alert";

// ── Helpers ──

const now = Date.now();

const validUser = {
    uid: "user-001",
    email: "guardian@example.com",
    role: "guardian" as const,
    displayName: "Test Guardian",
    createdAt: now,
    updatedAt: now,
};

const validGuardian = {
    uid: "guardian-001",
    email: "guardian@example.com",
    role: "guardian" as const,
    displayName: "Test Guardian",
    phone: "+905551234567",
    elderIds: ["elder-001"],
    createdAt: now,
    updatedAt: now,
};

const validElder = {
    id: "elder-001",
    fullName: "Ahmet Yılmaz",
    age: 75,
    guardianId: "guardian-001",
    deviceId: "device-001",
    notes: "Lives alone",
    createdAt: now,
    updatedAt: now,
};

const validDevice = {
    id: "device-001",
    elderId: "elder-001",
    platform: "android" as const,
    model: "Samsung Galaxy A54",
    osVersion: "14",
    lastSyncAt: now,
    isActive: true,
    registeredAt: now,
};

const validSensorReading = {
    id: "reading-001",
    elderId: "elder-001",
    timestamp: now,
    type: "accelerometer" as const,
    value: { x: 0.12, y: -9.81, z: 0.03 },
};

const validSensorBatch = {
    elderId: "elder-001",
    deviceId: "device-001",
    readings: [validSensorReading],
    submittedAt: now,
};

const validAlert = {
    id: "alert-001",
    elderId: "elder-001",
    guardianId: "guardian-001",
    type: "fall_detected" as const,
    severity: "critical" as const,
    message: "Possible fall detected based on accelerometer spike",
    anomalyScore: 0.95,
    acknowledged: false,
    createdAt: now,
};

// ── Tests ──

describe("userSchema", () => {
    it("accepts a valid user object", () => {
        expect(() => userSchema.parse(validUser)).not.toThrow();
    });

    it("rejects missing email", () => {
        const { email, ...noEmail } = validUser;
        expect(() => userSchema.parse(noEmail)).toThrow(ZodError);
    });

    it("rejects invalid email format", () => {
        expect(() =>
            userSchema.parse({ ...validUser, email: "not-an-email" })
        ).toThrow(ZodError);
    });

    it("rejects invalid role", () => {
        expect(() =>
            userSchema.parse({ ...validUser, role: "superadmin" })
        ).toThrow(ZodError);
    });

    it("rejects empty uid", () => {
        expect(() => userSchema.parse({ ...validUser, uid: "" })).toThrow(
            ZodError
        );
    });

    it("accepts all valid roles", () => {
        for (const role of ["guardian", "admin"]) {
            expect(() =>
                userSchema.parse({ ...validUser, role })
            ).not.toThrow();
        }
    });
});

describe("userRoleEnum", () => {
    it("accepts guardian and admin", () => {
        expect(userRoleEnum.parse("guardian")).toBe("guardian");
        expect(userRoleEnum.parse("admin")).toBe("admin");
    });

    it("rejects unknown roles", () => {
        expect(() => userRoleEnum.parse("superuser")).toThrow(ZodError);
    });
});

describe("guardianSchema", () => {
    it("accepts a valid guardian object", () => {
        expect(() => guardianSchema.parse(validGuardian)).not.toThrow();
    });

    it("enforces role as guardian literal", () => {
        expect(() =>
            guardianSchema.parse({ ...validGuardian, role: "admin" })
        ).toThrow(ZodError);
    });

    it("accepts optional phone as undefined", () => {
        const { phone, ...noPhone } = validGuardian;
        expect(() => guardianSchema.parse(noPhone)).not.toThrow();
    });

    it("accepts empty elderIds array", () => {
        expect(() =>
            guardianSchema.parse({ ...validGuardian, elderIds: [] })
        ).not.toThrow();
    });

    it("rejects missing displayName", () => {
        const { displayName, ...noName } = validGuardian;
        expect(() => guardianSchema.parse(noName)).toThrow(ZodError);
    });
});

describe("elderSchema", () => {
    it("accepts a valid elder object", () => {
        expect(() => elderSchema.parse(validElder)).not.toThrow();
    });

    it("rejects zero age", () => {
        expect(() =>
            elderSchema.parse({ ...validElder, age: 0 })
        ).toThrow(ZodError);
    });

    it("rejects negative age", () => {
        expect(() =>
            elderSchema.parse({ ...validElder, age: -5 })
        ).toThrow(ZodError);
    });

    it("rejects non-integer age", () => {
        expect(() =>
            elderSchema.parse({ ...validElder, age: 75.5 })
        ).toThrow(ZodError);
    });

    it("accepts optional fields as undefined", () => {
        const { deviceId, notes, ...minimal } = validElder;
        expect(() => elderSchema.parse(minimal)).not.toThrow();
    });
});

describe("deviceSchema", () => {
    it("accepts a valid device object", () => {
        expect(() => deviceSchema.parse(validDevice)).not.toThrow();
    });

    it("rejects invalid platform", () => {
        expect(() =>
            deviceSchema.parse({ ...validDevice, platform: "windows" })
        ).toThrow(ZodError);
    });

    it("accepts both android and ios", () => {
        expect(devicePlatformEnum.parse("android")).toBe("android");
        expect(devicePlatformEnum.parse("ios")).toBe("ios");
    });

    it("rejects empty model string", () => {
        expect(() =>
            deviceSchema.parse({ ...validDevice, model: "" })
        ).toThrow(ZodError);
    });

    it("rejects missing isActive", () => {
        const { isActive, ...noActive } = validDevice;
        expect(() => deviceSchema.parse(noActive)).toThrow(ZodError);
    });
});

describe("accelerometerPayloadSchema", () => {
    it("accepts valid x, y, z values", () => {
        const result = accelerometerPayloadSchema.parse({
            x: 0.12,
            y: -9.81,
            z: 0.03,
        });
        expect(result).toEqual({ x: 0.12, y: -9.81, z: 0.03 });
    });

    it("rejects missing z axis", () => {
        expect(() =>
            accelerometerPayloadSchema.parse({ x: 1, y: 2 })
        ).toThrow(ZodError);
    });

    it("rejects string values", () => {
        expect(() =>
            accelerometerPayloadSchema.parse({ x: "1", y: 2, z: 3 })
        ).toThrow(ZodError);
    });
});

describe("sensorReadingSchema", () => {
    it("accepts a valid sensor reading", () => {
        expect(() =>
            sensorReadingSchema.parse(validSensorReading)
        ).not.toThrow();
    });

    it("rejects invalid sensor type", () => {
        expect(() =>
            sensorReadingSchema.parse({ ...validSensorReading, type: "gps" })
        ).toThrow(ZodError);
    });

    it("rejects empty elderId", () => {
        expect(() =>
            sensorReadingSchema.parse({ ...validSensorReading, elderId: "" })
        ).toThrow(ZodError);
    });
});

describe("sensorBatchSchema", () => {
    it("accepts a valid sensor batch", () => {
        expect(() =>
            sensorBatchSchema.parse(validSensorBatch)
        ).not.toThrow();
    });

    it("rejects empty readings array", () => {
        expect(() =>
            sensorBatchSchema.parse({ ...validSensorBatch, readings: [] })
        ).toThrow(ZodError);
    });

    it("rejects batch with invalid reading", () => {
        expect(() =>
            sensorBatchSchema.parse({
                ...validSensorBatch,
                readings: [{ ...validSensorReading, type: "invalid" }],
            })
        ).toThrow(ZodError);
    });
});

describe("alertSchema", () => {
    it("accepts a valid alert object", () => {
        expect(() => alertSchema.parse(validAlert)).not.toThrow();
    });

    it("rejects anomalyScore > 1", () => {
        expect(() =>
            alertSchema.parse({ ...validAlert, anomalyScore: 1.5 })
        ).toThrow(ZodError);
    });

    it("rejects anomalyScore < 0", () => {
        expect(() =>
            alertSchema.parse({ ...validAlert, anomalyScore: -0.1 })
        ).toThrow(ZodError);
    });

    it("rejects invalid alert type", () => {
        expect(() =>
            alertSchema.parse({ ...validAlert, type: "earthquake" })
        ).toThrow(ZodError);
    });

    it("rejects invalid severity", () => {
        expect(() =>
            alertSchema.parse({ ...validAlert, severity: "extreme" })
        ).toThrow(ZodError);
    });

    it("defaults acknowledged to false", () => {
        const { acknowledged, ...noAck } = validAlert;
        const result = alertSchema.parse(noAck);
        expect(result.acknowledged).toBe(false);
    });
});
