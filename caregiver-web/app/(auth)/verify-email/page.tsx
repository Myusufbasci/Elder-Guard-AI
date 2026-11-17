'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Status = 'verifying' | 'success' | 'error';

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard React StrictMode double-invoke
    ran.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Doğrulama bağlantısı geçersiz (token yok).');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          setStatus('success');
          setMessage('E-posta adresin başarıyla doğrulandı.');
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setMessage(
            data?.message ||
              'Bağlantı geçersiz veya süresi dolmuş. Panelden yeni bir doğrulama e-postası isteyebilirsin.',
          );
        }
      } catch {
        setStatus('error');
        setMessage('Ağ hatası. Lütfen tekrar dene.');
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">ElderCare</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">E-posta doğrulama</p>
        </div>

        <div className="rounded-2xl p-8 shadow-2xl bg-card/80 backdrop-blur-xl border border-border/50 text-center">
          {status === 'verifying' && (
            <>
              <svg className="animate-spin h-8 w-8 mx-auto text-primary mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-foreground font-medium">Doğrulanıyor…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 text-green-500 mb-4 text-3xl">✓</div>
              <p className="text-foreground font-semibold mb-1">Doğrulandı!</p>
              <p className="text-muted-foreground text-sm mb-6">{message}</p>
              <Link
                href="/elders"
                className="inline-block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold hover:from-primary/90 hover:to-primary/70 transition-all"
              >
                Panele git
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/10 text-destructive mb-4 text-3xl">!</div>
              <p className="text-foreground font-semibold mb-1">Doğrulanamadı</p>
              <p className="text-muted-foreground text-sm mb-6">{message}</p>
              <Link
                href="/elders"
                className="inline-block w-full py-3 px-4 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-muted/50 transition-all"
              >
                Panele dön
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
