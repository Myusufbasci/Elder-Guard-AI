'use client';

import { useState, useEffect } from 'react';
import { isFirebaseConfigured, requestNotificationPermission } from '@/lib/firebase-client';

/**
 * Settings page — Push notification configuration.
 */
export default function SettingsPage() {
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'Notification' in window && isFirebaseConfigured();
    setPushSupported(supported);
    if (supported) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handleEnablePush = async () => {
    setPushLoading(true);
    const token = await requestNotificationPermission();
    if (token) {
      setPushEnabled(true);
      setFcmToken(token);
    }
    setPushLoading(false);
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile card */}
        <div className="rounded-2xl bg-surface-900 border border-surface-800 p-6">
          <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">Profil</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-surface-800">
              <span className="text-sm text-surface-400">Hesap türü</span>
              <span className="text-sm text-surface-200 font-medium">Bakıcı</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-surface-800">
              <span className="text-sm text-surface-400">Oturum</span>
              <span className="text-sm text-success-400">Aktif</span>
            </div>
          </div>
        </div>

        {/* Push Notifications card */}
        <div className="rounded-2xl bg-surface-900 border border-surface-800 p-6">
          <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider mb-4">
            Bildirimler
          </h3>

          {!pushSupported ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">
                Bildirimler için Firebase yapılandırması gerekir. Etkinleştirmek için <code className="text-xs bg-surface-800 px-1.5 py-0.5 rounded">NEXT_PUBLIC_FIREBASE_*</code> ortam değişkenlerini ayarlayın.
              </p>
            </div>
          ) : pushEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-success-400/15 flex items-center justify-center">
                  <svg className="w-4 h-4 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-200">Bildirimler etkin</p>
                  <p className="text-xs text-surface-500">Anomali olaylarında uyarı alacaksınız</p>
                </div>
              </div>
              {fcmToken && (
                <div className="mt-3">
                  <p className="text-xs text-surface-500 mb-1">FCM Token (for debugging):</p>
                  <code className="text-[10px] text-surface-600 bg-surface-800 rounded p-2 block overflow-x-auto max-w-full">
                    {fcmToken.slice(0, 40)}…
                  </code>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-surface-400">
                Yaşlının sağlık verilerinde anomali tespit edildiğinde anlık uyarı almak için bildirimleri etkinleştirin.
              </p>
              <button
                id="enable-push-button"
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500 text-white hover:bg-accent-400 transition-all text-sm font-medium disabled:opacity-50"
              >
                {pushLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    İsteniyor…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    Bildirimleri Etkinleştir
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
