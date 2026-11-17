import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, decodeJwtPayload } from './lib/auth';

/**
 * Middleware: protects dashboard routes by checking httpOnly access token cookie.
 * If token is missing or expired, redirects to /login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth pages, the public email-verification page, and API routes through.
  // /verify-email must be reachable while logged out — the user clicks the link
  // in their email, possibly on a device with no session.
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/api/')
  ) {
    // If already logged in and visiting /login or /register, redirect to /elders
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
      if (accessToken && !isExpired(accessToken)) {
        return NextResponse.redirect(new URL('/elders', request.url));
      }
    }
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  // No access token → redirect to login
  if (!accessToken) {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Has refresh but no access → let the page load; apiFetch will handle 401
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check expiry without verifying signature (backend verifies)
  if (isExpired(accessToken)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

function isExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  // 60s buffer for clock skew
  return payload.exp * 1000 < Date.now() - 60_000;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/ routes (handled by Route Handlers)
     * - _next/ (static files)
     * - favicon.ico + App Router metadata icons (icon.png, apple-icon.png) — these
     *   are public assets and must not be redirected to /login.
     */
    '/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.png|apple-icon\\.png).*)',
  ],
};
