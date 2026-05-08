/**
 * Auth utilities for cookie-based JWT authentication.
 * Tokens are stored in httpOnly cookies — never in localStorage (XSS risk).
 */

/** Cookie names matching the Route Handler setters */
export const ACCESS_TOKEN_COOKIE = 'eldercare_access_token';
export const REFRESH_TOKEN_COOKIE = 'eldercare_refresh_token';

/** Decode a JWT payload without verifying signature (client-side expiry check only) */
export function decodeJwtPayload(token: string): { sub: string; role: string; exp: number; purpose: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return decoded as { sub: string; role: string; exp: number; purpose: string };
  } catch {
    return null;
  }
}

/** Check if a JWT is expired (with 30s buffer for clock skew) */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  return payload.exp * 1000 < Date.now() - 30_000;
}

/** Backend API URL for server-side calls */
export function getApiUrl(): string {
  return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}
