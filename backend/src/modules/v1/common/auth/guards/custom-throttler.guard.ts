import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Per AGENTS.md Rule 8 + Pattern 3: key on JWT `sub` (device id) instead of IP.
// This prevents NAT collisions in assisted-living facilities where many elder
// devices share a single public IP. Unauthenticated endpoints (register, login,
// health) still fall back to IP-based tracking.
//
// @nestjs/throttler 6.x signature: getTracker(req) — receives the raw request,
// not an ExecutionContext.
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: {
    user?: { sub?: string };
    ip: string;
  }): Promise<string> {
    return req.user?.sub ?? req.ip;
  }
}
