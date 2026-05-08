/**
 * Server-side API client for fetching data from the NestJS backend.
 * Used by Server Components and Route Handlers.
 * Forwards the httpOnly access token cookie as a Bearer header.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_TOKEN_COOKIE, getApiUrl } from './auth';

/** Response envelope from NestJS TransformInterceptor */
interface ApiEnvelope<T> {
  data: T;
  meta: {
    timestamp: string;
    correlationId: string;
  };
}

/** Error envelope from NestJS AllExceptionsFilter */
interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  correlationId: string;
}

/**
 * Fetch from NestJS backend with cookie-based auth.
 * Automatically includes the access token from httpOnly cookies.
 * Redirects to /login on 401.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    redirect('/login');
  }

  const apiUrl = getApiUrl();
  const url = `${apiUrl}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
    cache: 'no-store',
  });

  if (res.status === 401) {
    redirect('/login');
  }

  if (!res.ok) {
    const error = (await res.json()) as ApiError;
    throw new Error(error.message || `API error: ${res.status}`);
  }

  const envelope = (await res.json()) as ApiEnvelope<T>;
  return envelope.data;
}

/**
 * POST to NestJS backend with cookie-based auth.
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
