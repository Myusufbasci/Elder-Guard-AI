import * as admin from "firebase-admin";

/**
 * Initialize Firebase Admin SDK.
 * Uses default credentials when deployed to Firebase.
 */
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ── Export all Cloud Functions ──
export { onSensorDataCreated } from "./triggers/on-sensor-data-created";
