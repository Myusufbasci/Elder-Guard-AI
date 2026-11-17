'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Keeps "Your Elders" in sync with the elder devices:
 *  - Shows a notice when redirected here after a device unpaired (?unpaired=1).
 *  - Periodically refreshes the server component so a removed elder disappears
 *    without a manual reload.
 */
export default function EldersListSync() {
  const router = useRouter();
  const params = useSearchParams();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (params.get('unpaired')) {
      setShowBanner(true);
      const t = setTimeout(() => {
        setShowBanner(false);
        router.replace('/elders');
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [params, router]);

  useEffect(() => {
    const i = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(i);
  }, [router]);

  if (!showBanner) return null;
  return (
    <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-4 text-amber-300 flex items-center gap-3">
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Bir yaşlı, cihazından bağlantıyı kaldırdı ve listeden çıkarıldı.</span>
    </div>
  );
}
