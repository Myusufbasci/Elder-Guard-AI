import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { sensorReadingSchema, COLLECTIONS } from "@elder-guard/core";
import { calculateAnomalyScore } from "../utils/calculate-anomaly-score";

/** Critical alert threshold (0-100 scale) */
const ALERT_THRESHOLD = 80;

/**
 * Firestore trigger: fires when a new document is created in sensorData/{docId}.
 *
 * 1. Validates the incoming document against the Zod schema.
 * 2. Computes an anomaly score using the weighted mock formula.
 * 3. Writes the score to the `anomalyScores` collection.
 * 4. If score > 80, writes a critical alert to the `alerts` collection.
 *
 * IMPORTANT: This function writes ONLY to `anomalyScores` and `alerts` —
 * never to `sensorData` – preventing infinite trigger loops.
 */
export const onSensorDataCreated = onDocumentCreated(
  `${COLLECTIONS.sensorReadings}/{docId}`,
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.warn("[onSensorDataCreated] No data in event");
      return;
    }

    const rawData = snapshot.data();
    const docId = event.params.docId;

    // ── Step 1: Validate against Zod schema ──
    const parseResult = sensorReadingSchema.safeParse(rawData);

    if (!parseResult.success) {
      console.error(
        `[onSensorDataCreated] Invalid sensor data in ${docId}:`,
        parseResult.error.issues
      );
      return;
    }

    const reading = parseResult.data;

    // ── Step 2: Compute anomaly score ──
    // Screen lock status would come from additional metadata in production
    const isScreenLocked = rawData["isScreenLocked"] === true;
    const screenLockMinutes =
      typeof rawData["screenLockMinutes"] === "number"
        ? rawData["screenLockMinutes"]
        : 0;

    const result = calculateAnomalyScore(
      reading,
      isScreenLocked,
      screenLockMinutes
    );

    if (!result.isValid) {
      console.error(
        `[onSensorDataCreated] Score calculation returned invalid for ${docId}`
      );
      return;
    }

    const db = admin.firestore();
    const now = Date.now();

    // ── Step 3: Write score to anomalyScores collection ──
    const scoreDoc = {
      sensorReadingId: docId,
      elderId: reading.elderId,
      score: result.score,
      normalizedScore: result.normalizedScore,
      breakdown: result.breakdown,
      timestamp: reading.timestamp,
      computedAt: now,
    };

    await db.collection(COLLECTIONS.anomalyScores).add(scoreDoc);

    console.log(
      `[onSensorDataCreated] Score ${result.score} written for reading ${docId}`
    );

    // ── Step 4: Generate alert if score exceeds threshold ──
    if (result.score > ALERT_THRESHOLD) {
      const severity = result.score > 90 ? "critical" : "high";
      const alertType =
        result.breakdown.magnitudeDeviation > 5
          ? "fall_detected"
          : "inactivity";

      const alertDoc = {
        elderId: reading.elderId,
        guardianId: "pending", // Resolved by a separate function or client lookup
        type: alertType,
        severity,
        message: `Anomaly detected: score ${result.score}/100. ${
          alertType === "fall_detected"
            ? "Possible fall based on accelerometer spike."
            : "Prolonged inactivity with locked screen."
        }`,
        anomalyScore: result.normalizedScore,
        sensorReadingId: docId,
        acknowledged: false,
        createdAt: now,
      };

      await db.collection(COLLECTIONS.alerts).add(alertDoc);

      console.warn(
        `[onSensorDataCreated] 🚨 ALERT generated (${severity}): score ${result.score} for elder ${reading.elderId}`
      );
    }
  }
);
