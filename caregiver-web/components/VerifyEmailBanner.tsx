'use client';

import { useEffect, useState } from 'react';

/**
 * Soft email-verification reminder. Polls /v1/auth/me once on mount; if the
 * caregiver's email is not yet verified, shows a dismissible banner with a
 * "resend" action. Never blocks the dashboard — purely a nudge.
 */
export default function VerifyEmailBanner() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'error' | 'cooldown'>('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '/v1/auth/me', method: 'GET' }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const me = data?.data;
        if (!cancelled && me && me.emailVerified === false && me.email) {
          setEmail(me.email);
          setShow(true);
        }
      } catch {
        /* silent — banner is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleResend() {
    setResend('sending');
    try {
      const res = await fetch('/api/auth/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/v1/auth/resend-verification', method: 'POST' }),
      });
      if (res.ok) {
        setResend('sent');
      } else if (res.status === 409) {
        setResend('cooldown');
      } else {
        setResend('error');
      }
    } catch {
      setResend('error');
    }
  }

  if (!show) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <svg className="w-5 h-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-amber-200 flex-1 min-w-[200px]">
        E-posta adresini doğrula{email ? <> (<span className="font-medium">{email}</span>)</> : null}. Gelen kutunu kontrol et.
      </p>

      {resend === 'sent' ? (
        <span className="text-sm text-green-400 font-medium">Gönderildi ✓</span>
      ) : resend === 'cooldown' ? (
        <span className="text-sm text-amber-300">Biraz bekle, az önce gönderildi.</span>
      ) : (
        <button
          onClick={handleResend}
          disabled={resend === 'sending'}
          className="text-sm font-medium text-amber-100 underline underline-offset-2 hover:text-white disabled:opacity-50"
        >
          {resend === 'sending' ? 'Gönderiliyor…' : resend === 'error' ? 'Tekrar dene' : 'Tekrar gönder'}
        </button>
      )}

      <button
        onClick={() => setShow(false)}
        aria-label="Kapat"
        className="text-amber-300/70 hover:text-amber-100 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}
