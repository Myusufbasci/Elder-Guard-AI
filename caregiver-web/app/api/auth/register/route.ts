import { NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, getApiUrl } from '@/lib/auth';

/**
 * Route Handler: POST /api/auth/register
 * Proxies registration to NestJS backend, stores tokens in httpOnly cookies.
 * This keeps JWTs out of JavaScript — no XSS exposure.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const apiUrl = getApiUrl();

  const res = await fetch(`${apiUrl}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json();
    return NextResponse.json(error, { status: res.status });
  }

  const envelope = await res.json();
  // Backend envelope: { data: { accessToken, refreshToken }, meta: {...} }
  const { accessToken, refreshToken } = envelope.data;

  const response = NextResponse.json({ success: true });

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8h — matches ACCESS JWT TTL
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30d — matches REFRESH JWT TTL
  });

  return response;
}
