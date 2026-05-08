import type { JwtPurpose, UserRole } from '@prisma/client';

// Shape of every JWT in the system. Each strategy validates `purpose`
// against its expected value and rejects mismatches.
//
// `sub`: User UUID for ACCESS / REFRESH; ElderProfile.userId for DEVICE_PAIRING.
// `role`: optional — present on ACCESS only (used by RolesGuard).
// `jti`: per-token UUID for refresh-rotation tracking in Valkey.
export interface JwtPayload {
  sub: string;
  purpose: JwtPurpose;
  role?: UserRole;
  jti: string;
  iat?: number;
  exp?: number;
}

// What req.user looks like after a strategy returns. Strategies may
// enrich beyond the wire payload (e.g. include email after DB lookup).
export interface AuthenticatedUser {
  sub: string;
  purpose: JwtPurpose;
  role?: UserRole;
  jti: string;
  email?: string;
}
