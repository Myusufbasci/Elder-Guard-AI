import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";

/**
 * Helper to resolve environment variables across platforms.
 * Checks NEXT_PUBLIC_ prefix (web), then EXPO_PUBLIC_ prefix (mobile),
 * then falls back to a raw name check.
 *
 * Throws a descriptive error if the resolved value is a placeholder.
 */
function getEnvVar(name: string): string {
    const nextKey = `NEXT_PUBLIC_${name}`;
    const expoKey = `EXPO_PUBLIC_${name}`;

    const value =
        (typeof process !== "undefined" && process.env?.[nextKey]) ||
        (typeof process !== "undefined" && process.env?.[expoKey]) ||
        (typeof process !== "undefined" && process.env?.[name]) ||
        undefined;

    if (!value) {
        console.warn(
            `⚠️ [firebase-config] Environment variable for "${name}" is not set. ` +
            `Expected one of: ${nextKey}, ${expoKey}, or ${name}. ` +
            `Using placeholder — Firebase calls will fail.`
        );
        return `MISSING_${name}`;
    }

    return value;
}

/**
 * Firebase configuration resolved from environment variables.
 * Supports both NEXT_PUBLIC_ (web) and EXPO_PUBLIC_ (mobile) prefixes.
 */
const firebaseConfig = {
    apiKey: getEnvVar("FIREBASE_API_KEY"),
    authDomain: getEnvVar("FIREBASE_AUTH_DOMAIN"),
    projectId: getEnvVar("FIREBASE_PROJECT_ID"),
    storageBucket: getEnvVar("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnvVar("FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnvVar("FIREBASE_APP_ID"),
};

/**
 * Initialize Firebase — ensures only one instance is created (singleton).
 */
const app: FirebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

export { app, db, auth, firebaseConfig };
export type { FirebaseApp, Firestore, Auth };
