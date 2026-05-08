import { TransformInterceptor } from './transform.interceptor';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should wrap response in { data, meta } envelope', (done) => {
    const mockRequest = { correlationId: 'test-id' };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ foo: 'bar' }) };

    interceptor.intercept(ctx, next).subscribe(
      (result: unknown) => {
        const r = result as Record<string, unknown>;
        expect(r).toHaveProperty('data', { foo: 'bar' });
        expect(r).toHaveProperty('meta');
        const meta = r['meta'] as Record<string, unknown>;
        expect(meta).toHaveProperty('timestamp');
        expect(meta).toHaveProperty('correlationId', 'test-id');
        done();
      },
    );
  });

  it('should handle array data correctly', (done) => {
    const mockRequest = { correlationId: 'arr-id' };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of([1, 2, 3]) };

    interceptor.intercept(ctx, next).subscribe(
      (result: unknown) => {
        const r = result as Record<string, unknown>;
        expect(r).toHaveProperty('data', [1, 2, 3]);
        done();
      },
    );
  });
});
