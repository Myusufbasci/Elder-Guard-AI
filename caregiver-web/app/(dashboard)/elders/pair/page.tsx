'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Pairing code display page — Client component.
 * POST to /v1/caregiver/elders → display 6-digit code with 15-min countdown.
 */

interface PairingData {
  code: string;
  expiresAt: string;
}

export default function PairElderPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pairingData, setPairingData] = useState<PairingData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [paired, setPaired] = useState(false);

  // Form fields for creating elder profile (elders have no email)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Countdown timer
  useEffect(() => {
    if (!pairingData) return;
    const expiresAt = new Date(pairingData.expiresAt).getTime();

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    // Set initial value
    setTimeLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

    return () => clearInterval(interval);
  }, [pairingData]);

  // Poll pairing status by CODE. The elder is created only when the device redeems
  // the code, so we watch for status === 'paired' and then jump to the new elder.
  useEffect(() => {
    if (!pairingData || paired) return;
    const code = pairingData.code;
    let cancelled = false;

    const poll = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `/v1/caregiver/elders/pairing-status?code=${encodeURIComponent(code)}`,
            method: 'GET',
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.data?.status === 'paired') {
          setPaired(true);
          clearInterval(poll);
          const elderId = data.data.elderId as string | undefined;
          // Brief success flash, then jump to the freshly-created elder (or the list).
          setTimeout(() => router.push(elderId ? `/elders/${elderId}` : '/elders'), 1600);
        }
      } catch {
        /* transient network error — keep polling */
      }
    }, 3000);

    return () => { cancelled = true; clearInterval(poll); };
  }, [pairingData, paired, router]);

  const generateCode = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/v1/caregiver/elders',
          method: 'POST',
          body: { firstName, lastName, dateOfBirth },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || 'Failed to generate pairing code');
        return;
      }

      const data = await res.json();
      setPairingData(data.data);
      setStep('code');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, dateOfBirth]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (step === 'code' && pairingData) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-surface-50">Pairing Code</h1>
          <p className="text-surface-400 mt-1">Enter this code on the elder&apos;s device</p>
        </div>

        <div className="rounded-2xl bg-surface-900 border border-surface-800 p-8 text-center">
          {/* Paired success banner */}
          {paired && (
            <div className="mb-6 rounded-xl bg-green-500/10 border border-green-500/30 px-5 py-4">
              <p className="text-green-400 font-semibold text-lg">✓ Cihaz eşleşti!</p>
              <p className="text-surface-400 text-sm mt-1">Panele yönlendiriliyorsunuz…</p>
            </div>
          )}

          {/* Code display */}
          <div className="mb-6">
            <p className="text-xs text-surface-500 uppercase tracking-wider mb-3">6-digit pairing code</p>
            <div className="flex justify-center gap-3">
              {pairingData.code.split('').map((digit, i) => (
                <div
                  key={i}
                  className={`w-14 h-16 rounded-xl border flex items-center justify-center text-3xl font-bold font-mono transition-colors ${paired ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-surface-800 border-surface-700 text-accent-400'}`}
                >
                  {digit}
                </div>
              ))}
            </div>
          </div>

          {/* Live pairing status hint */}
          {!paired && timeLeft > 0 && (
            <div className="mb-4 flex items-center justify-center gap-2 text-sm text-surface-400">
              <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
              Cihazın bağlanması bekleniyor…
            </div>
          )}

          {/* Countdown */}
          <div className={`mb-6 ${timeLeft < 60 ? 'text-danger-400' : timeLeft < 300 ? 'text-warning-400' : 'text-surface-400'}`}>
            {timeLeft > 0 ? (
              <>
                <p className="text-sm">Expires in</p>
                <p className="text-2xl font-mono font-bold">{formatTime(timeLeft)}</p>
              </>
            ) : (
              <div>
                <p className="text-sm text-danger-400 mb-3">Code expired</p>
                <button
                  onClick={() => { setStep('form'); setPairingData(null); }}
                  className="px-5 py-2.5 rounded-xl bg-accent-500/15 text-accent-400 font-medium hover:bg-accent-500/25 transition-all"
                >
                  Generate New Code
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-surface-800/50 rounded-xl p-4 text-left">
            <p className="text-xs font-medium text-surface-300 uppercase tracking-wider mb-2">Instructions</p>
            <ol className="text-sm text-surface-400 space-y-1.5 list-decimal list-inside">
              <li>Open ElderCare app on the elder&apos;s Android device</li>
              <li>Enter the 6-digit code above</li>
              <li>Tap &quot;Connect&quot; to pair the device</li>
              <li>Grant Health Connect permissions when prompted</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-surface-50">Add New Elder</h1>
        <p className="text-surface-400 mt-1">Create an elder profile to generate a pairing code</p>
      </div>

      <div className="rounded-2xl bg-surface-900 border border-surface-800 p-6">
        <form onSubmit={(e) => { e.preventDefault(); generateCode(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="pair-firstname" className="block text-sm font-medium text-surface-300 mb-1.5">First name</label>
              <input id="pair-firstname" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-surface-800/80 border border-surface-700 text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition-all disabled:opacity-50" />
            </div>
            <div>
              <label htmlFor="pair-lastname" className="block text-sm font-medium text-surface-300 mb-1.5">Last name</label>
              <input id="pair-lastname" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-surface-800/80 border border-surface-700 text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition-all disabled:opacity-50" />
            </div>
          </div>
          <div>
            <label htmlFor="pair-dob" className="block text-sm font-medium text-surface-300 mb-1.5">Date of birth</label>
            <input id="pair-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-surface-800/80 border border-surface-700 text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition-all disabled:opacity-50" />
          </div>

          {error && (
            <div className="text-sm text-danger-400 bg-danger-500/10 px-4 py-3 rounded-xl border border-danger-500/20">{error}</div>
          )}

          <button id="generate-code-button" type="submit" disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 text-white font-semibold hover:from-accent-400 hover:to-accent-500 transition-all disabled:opacity-50 shadow-lg shadow-accent-500/20">
            {loading ? 'Generating…' : 'Generate Pairing Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
