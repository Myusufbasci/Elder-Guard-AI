import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Wraps all successful responses in the standard envelope per INTEGRATION.md:
//   { data: <original response>, meta: { timestamp, correlationId, ...cursor } }
// CorrelationIdInterceptor must run first to populate req.correlationId.

interface ResponseEnvelope {
  data: unknown;
  meta: {
    timestamp: string;
    correlationId: string;
  };
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<ResponseEnvelope> {
    const req = ctx.switchToHttp().getRequest<{ correlationId?: string }>();

    return next.handle().pipe(
      map((data: unknown) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId ?? 'unknown',
        },
      })),
    );
  }
}
