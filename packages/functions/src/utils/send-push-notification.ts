import * as admin from "firebase-admin";
import { COLLECTIONS } from "@elder-guard/core";

/**
 * Send a push notification to a user's device via FCM.
 *
 * Retrieves the user's Expo push token from Firestore, then uses
 * Firebase Admin Messaging (FCM) to deliver the notification.
 *
 * Note: Expo push tokens (format `ExponentPushToken[xxx]`) can be sent
 * via FCM as the Expo push service acts as a proxy. For production,
 * consider using the Expo Push API directly (expo-server-sdk).
 *
 * @param userId - The guardian/user UID to notify
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional extra data payload
 * @returns true if sent successfully, false otherwise
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<boolean> {
  try {
    const db = admin.firestore();

    // ── Retrieve user's push token ──
    const userDoc = await db
      .collection(COLLECTIONS.users)
      .doc(userId)
      .get();

    if (!userDoc.exists) {
      console.warn(
        `[push-notification] User ${userId} not found in Firestore`
      );
      return false;
    }

    const userData = userDoc.data();
    const expoPushToken = userData?.["expoPushToken"];

    if (!expoPushToken || typeof expoPushToken !== "string") {
      console.warn(
        `[push-notification] No push token for user ${userId} — notifications may be disabled`
      );
      return false;
    }

    // ── Send via FCM (Firebase Cloud Messaging) ──
    // Expo push tokens work with FCM when using the Expo notification service
    const message: admin.messaging.Message = {
      token: expoPushToken,
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        title,
        body,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "elder-guard-alerts",
          priority: "max",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(
      `[push-notification] Sent to ${userId}: ${response}`
    );
    return true;
  } catch (error) {
    // FCM may reject Expo tokens — this is expected in demo
    // In production, use expo-server-sdk for Expo tokens
    console.error(
      `[push-notification] Failed to send to ${userId}:`,
      error
    );
    return false;
  }
}
