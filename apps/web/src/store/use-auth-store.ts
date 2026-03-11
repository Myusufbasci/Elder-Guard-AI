import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
} from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { auth } from "@elder-guard/firebase-config";

interface AuthState {
    /** Firebase user UID */
    uid: string | null;
    /** User email */
    email: string | null;
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** True while Firebase auth state is being resolved on cold start */
    isLoading: boolean;
    /** Last auth error message */
    error: string | null;

    /** Sign in with email and password */
    signIn: (email: string, password: string) => Promise<void>;
    /** Create a new account with email and password */
    signUp: (email: string, password: string) => Promise<void>;
    /** Sign out the current user */
    signOut: () => Promise<void>;
    /** Set user data from Firebase auth state */
    setUser: (user: FirebaseUser | null) => void;
    /** Clear any auth errors */
    clearError: () => void;
}

/**
 * Zustand auth store for the web app.
 * Uses localStorage persistence via zustand/middleware.
 * Subscribes to onAuthStateChanged so Firebase is always the source of truth.
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            uid: null,
            email: null,
            isAuthenticated: false,
            isLoading: true,
            error: null,

            setUser: (user: FirebaseUser | null) => {
                if (user) {
                    set({
                        uid: user.uid,
                        email: user.email,
                        isAuthenticated: true,
                        isLoading: false,
                        error: null,
                    });
                } else {
                    set({
                        uid: null,
                        email: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            signIn: async (email: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const credential = await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );
                    set({
                        uid: credential.user.uid,
                        email: credential.user.email,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : "Sign in failed";
                    set({ isLoading: false, error: message });
                    throw err;
                }
            },

            signUp: async (email: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const credential = await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );
                    set({
                        uid: credential.user.uid,
                        email: credential.user.email,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : "Sign up failed";
                    set({ isLoading: false, error: message });
                    throw err;
                }
            },

            signOut: async () => {
                set({ isLoading: true, error: null });
                try {
                    await firebaseSignOut(auth);
                    set({
                        uid: null,
                        email: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                } catch (err: unknown) {
                    const message =
                        err instanceof Error ? err.message : "Sign out failed";
                    set({ isLoading: false, error: message });
                    throw err;
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: "elder-guard-auth",
            storage: createJSONStorage(() => localStorage),
            /**
             * Only persist user identity fields — not loading/error state.
             * On cold start, persisted values provide optimistic UI while
             * onAuthStateChanged resolves the real auth state.
             */
            partialize: (state) => ({
                uid: state.uid,
                email: state.email,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

/**
 * Subscribe to Firebase auth state changes.
 * This runs once on module load and ensures the store always reflects
 * the real Firebase auth state — fixing any stale persisted data.
 */
if (typeof window !== "undefined") {
    onAuthStateChanged(auth, (user) => {
        useAuthStore.getState().setUser(user);
    });
}
