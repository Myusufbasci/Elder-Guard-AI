import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_LOG_KEY = 'skipAuditLog';
export const SkipAuditLog = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_AUDIT_LOG_KEY, true);
