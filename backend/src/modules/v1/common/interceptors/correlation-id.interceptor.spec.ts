import { CorrelationIdInterceptor } from './correlation-id.interceptor';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

describe('CorrelationIdInterceptor', () => {
  let interceptor: CorrelationIdInterceptor;

  beforeEach(() => {
    interceptor = new CorrelationIdInterceptor();
  });

  it('should propagate X-Request-Id header from request', (done) => {
    const mockRequest: Record<string, unknown> = {
      headers: { 'x-request-id': 'existing-correlation-id' },
    };
    const mockResponse = { setHeader: jest.fn() };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('test') };

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(mockRequest['correlationId']).toBe('existing-correlation-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        'existing-correlation-id',
      );
      done();
    });
  });

  it('should generate UUID when X-Request-Id is missing', (done) => {
    const mockRequest: Record<string, unknown> = { headers: {} };
    const mockResponse = { setHeader: jest.fn() };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of('test') };

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(mockRequest['correlationId']).toBeDefined();
      expect(typeof mockRequest['correlationId']).toBe('string');
      // UUID v4 format
      expect((mockRequest['correlationId'] as string).length).toBe(36);
      done();
    });
  });
});
