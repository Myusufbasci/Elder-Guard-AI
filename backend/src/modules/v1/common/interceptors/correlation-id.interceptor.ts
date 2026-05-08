import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Reads X-Request-Id from the incoming request header or generates a UUID.
// Attaches it to the request object as `correlationId` for downstream consumers
// (LoggingInterceptor, AuditLogInterceptor, AllExceptionsFilter) and sets
// the response header so the client can correlate traces.

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = ctx.switchToHttp();
    const req = httpCtx.getRequest<{ headers: Record<string, string | undefined>; correlationId?: string }>();
    const res = httpCtx.getResponse<{ setHeader: (name: string, value: string) => void }>();

    const correlationId =
      req.headers['x-request-id'] ?? randomUUID();

    // Attach to request so other interceptors / filters can read it.
    req.correlationId = correlationId;

    // Echo back to client.
    res.setHeader('X-Request-Id', correlationId);

    return next.handle().pipe(tap(() => { /* noop — header already set */ }));
  }
}
