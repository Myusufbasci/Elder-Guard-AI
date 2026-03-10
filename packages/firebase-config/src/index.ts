import { initializeApp, getApps, getApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";

/**
 * Firebase configuration — replace with your actual project credentials.
 * In production, these should come from environment variables.
 */
const firebaseConfig = {
    apiKey: process.env["NEXT_PUBLIC_FIREBASE_API_KEY"] ?? "YOUR_API_KEY",
    authDomain:
        process.env["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] ?? "YOUR_PROJECT.firebaseapp.com",
    projectId: process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] ?? "YOUR_PROJECT_ID",
    storageBucket:
        process.env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] ?? "YOUR_PROJECT.appspot.com",
    messagingSenderId:
        process.env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] ?? "YOUR_SENDER_ID",
    appId: process.env["NEXT_PUBLIC_FIREBASE_APP_ID"] ?? "YOUR_APP_ID",
};

/**
 * Initialize Firebase — ensures only one instance is created (singleton).
 */
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

export { app, db, auth };
export type { FirebaseApp, Firestore, Auth };
