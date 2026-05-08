import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { SKIP_AUDIT_LOG_KEY } from './skip-audit-log.decorator';

// Pattern 14 from REVERSE_ENGINEERING_DOC: PII-sanitizing audit interceptor.
// Writes to audit_logs hypertable (Pattern 16). Skips on @SkipAuditLog()
// decorator to avoid doubling write volume on telemetry ingest.

const SENSITIVE_FIELDS = [
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'cookie',
  'session',
  'secret',
];

function sanitizeData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const result: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const key of Object.keys(result)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((f) => lower.includes(f))) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeData(result[key]);
    }
  }
  return result;
}

interface AuditRequest {
  method: string;
  url: string;
  body?: unknown;
  params?: unknown;
  query?: unknown;
  headers: Record<string, string | undefined>;
  user?: { sub: string };
  ip?: string;
  correlationId?: string;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_AUDIT_LOG_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (skip) return next.handle();

    const httpCtx = ctx.switchToHttp();
    const req = httpCtx.getRequest<AuditRequest>();
    const res = httpCtx.getResponse<{ statusCode: number }>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          this.writeAuditLog(req, res.statusCode, responseBody, start).catch(
            (err: Error) => this.logger.error(`Audit write failed: ${err.message}`),
          );
        },
        error: (err: { getStatus?: () => number; status?: number; message?: string }) => {
          const statusCode = err.getStatus?.() ?? err.status ?? 500;
          this.writeAuditLog(req, statusCode, undefined, start).catch(
            (e: Error) => this.logger.error(`Audit write failed: ${e.message}`),
          );
        },
      }),
    );
  }

  private async writeAuditLog(
    req: AuditRequest,
    statusCode: number,
    responseBody: unknown,
    start: number,
  ): Promise<void> {
    const duration = Date.now() - start;

    const sanitizedHeaders: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      sanitizedHeaders[k] = SENSITIVE_FIELDS.some((f) => k.toLowerCase().includes(f))
        ? '[REDACTED]'
        : v;
    }

    await this.prisma.auditLog.create({
      data: {
        action: `${req.method} ${req.url}`,
        userId: req.user?.sub ?? null,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        statusCode,
        duration,
        correlationId: req.correlationId ?? null,
        requestData: sanitizeData({
          body: req.body ?? null,
          params: req.params ?? null,
          query: req.query ?? null,
          headers: sanitizedHeaders,
        }) as object,
        responseData: responseBody === undefined ? undefined : (sanitizeData(responseBody) as object),
      },
    });
  }
}
