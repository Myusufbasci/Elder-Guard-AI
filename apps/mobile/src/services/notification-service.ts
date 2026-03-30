import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@elder-guard/firebase-config";
import { COLLECTIONS } from "@elder-guard/core";

/**
 * Configure notification behavior when app is in the foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications:
 * 1. Check if running on a physical device (required for push)
 * 2. Request permissions
 * 3. Get the Expo push token
 * 4. Save the token to the user's Firestore document
 *
 * @param userId - The authenticated user's UID
 * @returns The Expo push token string or null if registration failed
 */
export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn(
      "[notification-service] Push notifications require a physical device"
    );
    return null;
  }

  try {
    // ── Check existing permissions ──
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // ── Request permissions if not already granted ──
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn(
        "[notification-service] Notification permissions denied by user"
      );
      // Save null token so Cloud Functions know notifications are disabled
      await saveTokenToFirestore(userId, null);
      return null;
    }

    // ── Get the Expo push token ──
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "elder-guard-mobile",
    });
    const token = tokenData.data;

    console.log("[notification-service] Expo push token:", token);

    // ── Save token to user's Firestore document ──
    await saveTokenToFirestore(userId, token);

    // ── Android: set notification channel ──
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("elder-guard-alerts", {
        name: "Elder Guard Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0ea5e9",
        sound: "default",
      });
    }

    return token;
  } catch (error) {
    console.error(
      "[notification-service] Failed to register for push notifications:",
      error
    );
    return null;
  }
}

/**
 * Save the Expo push token to the user's document in Firestore.
 * Uses `setDoc` with merge to avoid overwriting existing user data.
 */
async function saveTokenToFirestore(
  userId: string,
  token: string | null
): Promise<void> {
  try {
    const userRef = doc(db, COLLECTIONS.users, userId);
    await setDoc(
      userRef,
      {
        expoPushToken: token,
        pushTokenUpdatedAt: Date.now(),
      },
      { merge: true }
    );
    console.log(
      `[notification-service] Token saved for user ${userId}: ${token ? "set" : "null"}`
    );
  } catch (error) {
    console.error(
      "[notification-service] Failed to save push token:",
      error
    );
  }
}

/**
 * Add a listener for incoming notifications while the app is in the foreground.
 */
export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add a listener for when the user taps a notification.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
