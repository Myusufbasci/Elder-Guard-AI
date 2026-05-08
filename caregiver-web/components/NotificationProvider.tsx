'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  requestNotificationPermission,
  onForegroundMessage,
  isFirebaseConfigured,
} from '@/lib/firebase-client';

interface ToastData {
  id: string;
  title: string;
  body: string;
}

/**
 * NotificationProvider — wraps dashboard layout.
 * Requests push permission, registers FCM token, shows foreground toast notifications.
 * Only activates when Firebase config env vars are present.
 */
export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    // Request permission and get FCM token
    requestNotificationPermission().then((token) => {
      if (token) {
        // Option (B): Log token for now — backend persistence deferred
        console.info('[FCM] Browser push token:', token);
        // TODO: POST token to /v1/caregiver/push-token when endpoint exists
      }
    });

    // Subscribe to foreground messages
    const unsubscribe = onForegroundMessage((payload) => {
      const id = crypto.randomUUID();
      const title = payload.notification?.title ?? 'ElderCare Alert';
      const body = payload.notification?.body ?? 'New health alert detected';

      setToasts((prev) => [...prev, { id, title, body }]);

      // Auto-dismiss after 6 seconds
      setTimeout(() => dismissToast(id), 6000);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [dismissToast]);

  return (
    <>
      {children}

      {/* Toast container — fixed top-right */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm" id="toast-container">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="glass rounded-xl px-4 py-3 shadow-2xl animate-slide-in border border-accent-500/20"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <svg
                    className="w-4 h-4 text-accent-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-100">{toast.title}</p>
                  <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{toast.body}</p>
                </div>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-surface-500 hover:text-surface-300 transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
