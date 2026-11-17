'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Polls the caregiver's elder list. When this elder disappears (e.g. the device
 * tapped "reset pairing" → DELETE /v1/elder/me cascades the CareLink), we leave
 * the now-dead detail page and surface a notice on the list. The list query reads
 * care_links directly (no CareLinkGuard cache) so detection is immediate.
 */
export default function ElderPresenceWatcher({ elderId }: { elderId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/auth/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/v1/caregiver/elders', method: 'GET' }),
        });
        if (!res.ok) return; // 401/5xx — ignore, keep polling
        const data = await res.json();
        const elders: Array<{ id: string }> = Array.isArray(data?.data) ? data.data : [];
        const stillLinked = elders.some((e) => e.id === elderId);
        if (!stillLinked && !cancelled) {
          clearInterval(poll);
          router.push('/elders?unpaired=1');
        }
      } catch {
        /* transient — keep polling */
      }
    };

    const poll = setInterval(check, 6000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [elderId, router]);

  return null;
}
