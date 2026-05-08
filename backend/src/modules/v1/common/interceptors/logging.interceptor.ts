import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Pino-backed structured logging interceptor. Logs method, url, statusCode,
// duration (ms), and correlationId on every response. CorrelationIdInterceptor
// must run before this one (it is registered first in main.module.ts providers).

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = ctx.switchToHttp();
    const req = httpCtx.getRequest<{
      method: string;
      url: string;
      correlationId?: string;
    }>();
    const res = httpCtx.getResponse<{ statusCode: number }>();

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            JSON.stringify({
              method: req.method,
              url: req.url,
              statusCode: res.statusCode,
              duration,
              correlationId: req.correlationId ?? 'unknown',
            }),
          );
        },
        error: (err: { status?: number; getStatus?: () => number }) => {
          const duration = Date.now() - start;
          const statusCode = err.getStatus?.() ?? err.status ?? 500;
          this.logger.error(
            JSON.stringify({
              method: req.method,
              url: req.url,
              statusCode,
              duration,
              correlationId: req.correlationId ?? 'unknown',
            }),
          );
        },
      }),
    );
  }
}
