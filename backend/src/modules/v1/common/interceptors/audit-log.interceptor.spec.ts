import { AuditLogInterceptor } from './audit-log.interceptor';
import { Reflector } from '@nestjs/core';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import type { PrismaService } from '../prisma/prisma.service';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let prisma: { auditLog: { create: jest.Mock } };
  let reflector: Reflector;

  beforeEach(() => {
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    reflector = new Reflector();
    interceptor = new AuditLogInterceptor(
      reflector,
      prisma as unknown as PrismaService,
    );
  });

  it('should write to audit_logs with redacted password fields', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const mockRequest = {
      method: 'POST',
      url: '/v1/auth/login',
      body: { email: 'test@test.com', password: 'secret123' },
      params: {},
      query: {},
      user: { sub: 'user-id' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
      correlationId: 'corr-id',
    };
    const mockResponse = { statusCode: 200 };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ accessToken: 'jwt-value' }) };

    interceptor.intercept(ctx, next).subscribe(() => {
      // Give the async tap a tick to complete
      setTimeout(() => {
        expect(prisma.auditLog.create).toHaveBeenCalled();
        const callArg = prisma.auditLog.create.mock.calls[0][0] as {
          data: { requestData: { body: Record<string, string> }; responseData: Record<string, string> };
        };
        expect(callArg.data.requestData.body.password).toBe('[REDACTED]');
        expect(callArg.data.responseData.accessToken).toBe('[REDACTED]');
        done();
      }, 50);
    });
  });

  it('should skip on @SkipAuditLog() decorator', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const mockRequest = {
      method: 'POST',
      url: '/v1/elder/telemetry',
      headers: {},
    };
    const mockResponse = { statusCode: 201 };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of({ inserted: 5 }) };

    interceptor.intercept(ctx, next).subscribe(() => {
      setTimeout(() => {
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
        done();
      }, 50);
    });
  });

  it('should sanitize authorization header from request data', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const mockRequest = {
      method: 'GET',
      url: '/v1/caregiver/elders',
      body: {},
      params: {},
      query: {},
      headers: { authorization: 'Bearer secret-token', 'user-agent': 'test' },
      user: { sub: 'user-id' },
      ip: '10.0.0.1',
      correlationId: 'cid',
    };
    const mockResponse = { statusCode: 200 };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const next: CallHandler = { handle: () => of([]) };

    interceptor.intercept(ctx, next).subscribe(() => {
      setTimeout(() => {
        expect(prisma.auditLog.create).toHaveBeenCalled();
        const callArg = prisma.auditLog.create.mock.calls[0][0] as {
          data: { requestData: { headers: Record<string, string> } };
        };
        expect(callArg.data.requestData.headers.authorization).toBe('[REDACTED]');
        done();
      }, 50);
    });
  });
});
