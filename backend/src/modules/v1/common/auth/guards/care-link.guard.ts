import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ValkeyService } from '../../valkey/valkey.service';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

// Per AGENTS.md Rule 15 + Pattern 17: runs after JwtAccessGuard on caregiver
// routes with `:elderId` param. Returns 404 (NOT 403) on miss to prevent
// existence enumeration. Caches the positive answer in Valkey 60s.
const CACHE_PREFIX = 'auth:carelink:';
const CACHE_TTL_SECONDS = 60;

@Injectable()
export class CareLinkGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params: Record<string, string>;
    }>();
    const caregiverId = req.user?.sub;
    const elderId = req.params.elderId;
    if (!caregiverId || !elderId) throw new NotFoundException();

    const cacheKey = `${CACHE_PREFIX}${caregiverId}:${elderId}`;
    if (await this.valkey.get(cacheKey)) return true;

    const link = await this.prisma.careLink.findUnique({
      where: { caregiverId_elderId: { caregiverId, elderId } },
    });
    if (!link) throw new NotFoundException();

    await this.valkey.setEx(cacheKey, '1', CACHE_TTL_SECONDS);
    return true;
  }
}
