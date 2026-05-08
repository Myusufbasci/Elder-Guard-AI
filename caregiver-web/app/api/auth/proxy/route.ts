import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE, getApiUrl } from '@/lib/auth';

/**
 * Generic proxy Route Handler for authenticated API calls from client components.
 * Client components POST here with { path, method, body } and we forward with the httpOnly cookie.
 */
export async function POST(request: Request) {
  const { path, method = 'POST', body } = await request.json();
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
