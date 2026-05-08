/**
 * Firebase client SDK utilities for web push notifications and Google Auth.
 * Option (B): Client-side only — FCM token logged to console.
 * Backend persistence deferred until POST /v1/caregiver/push-token is implemented.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getMessaging, getToken, onMessage, type Messaging, type Unsubscribe } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

/** Get or initialize Firebase app (singleton guard per AGENTS.md Rule 7) */
export function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApps()[0] as FirebaseApp;
}

/** Check if Firebase config is populated */
export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

/**
 * Sign in with Google via Firebase popup.
 * Returns the Google ID token for backend verification, or null on failure.
 *
 * Guard: prevents concurrent popup calls (React Strict Mode / double-click).
 * Reuses the in-flight promise if signInWithPopup is already open.
 */
let pendingPopup: Promise<string | null> | null = null;

export function signInWithGoogle(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!isFirebaseConfigured()) return Promise.resolve(null);

  // Reuse in-flight popup if one is already open
  if (pendingPopup) return pendingPopup;

  pendingPopup = (async () => {
    try {
      const app = getFirebaseApp();
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return idToken;
    } catch (err: unknown) {
      // cancelled-popup-request / popup-closed-by-user are user-initiated, not errors
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/cancelled-popup-request' || code === 'auth/popup-closed-by-user') {
        return null;
      }
      console.error('[Firebase] Google sign-in failed:', err);
      return null;
    } finally {
      pendingPopup = null;
    }
  })();

  return pendingPopup;
}

/**
 * Sign out from Firebase (cleanup after Google auth flow completes).
 */
export async function signOutFirebase(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    await signOut(auth);
  } catch {
    // Ignore — best-effort cleanup
  }
}

/**
 * Request notification permission and get FCM token.
 * Returns token string on success, null on denial or error.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window)) return null;
  if (!('serviceWorker' in navigator)) return null;
  if (!isFirebaseConfigured()) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '',
      serviceWorkerRegistration: registration,
    });

    return token;
  } catch (err) {
    console.error('[FCM] Failed to get token:', err);
    return null;
  }
}

/**
 * Subscribe to foreground messages.
 * Returns unsubscribe function.
 */
export function onForegroundMessage(
  callback: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void,
): Unsubscribe | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;

  try {
    const app = getFirebaseApp();
    const messaging: Messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch {
    return null;
  }
}

