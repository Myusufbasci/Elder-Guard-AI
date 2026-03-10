import { create } from "zustand";

interface AuthState {
    uid: string | null;
    email: string | null;
    isAuthenticated: boolean;
    setUser: (uid: string, email: string) => void;
    clearUser: () => void;
}

/**
 * Zustand auth store — shared state for Firebase auth across the web app.
 */
export const useAuthStore = create<AuthState>((set) => ({
    uid: null,
    email: null,
    isAuthenticated: false,
    setUser: (uid: string, email: string) =>
        set({ uid, email, isAuthenticated: true }),
    clearUser: () =>
        set({ uid: null, email: null, isAuthenticated: false }),
}));
