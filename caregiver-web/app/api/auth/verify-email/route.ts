import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/auth';

/**
 * Route Handler: POST /api/auth/verify-email
 * Public — the user may be logged out when they click the link in their email.
 * Forwards the token to the NestJS backend; no cookies involved.
 */
export async function POST(request: Request) {
  const { token } = await request.json();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/v1/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
