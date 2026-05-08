import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ValkeyService } from '../../valkey/valkey.service';

@Injectable()
export class ValkeyHealthIndicator extends HealthIndicator {
  constructor(private readonly valkey: ValkeyService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.valkey.raw().ping();
      const isUp = pong === 'PONG';
      if (!isUp) {
        throw new Error(`Unexpected ping response: ${String(pong)}`);
      }
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError(
        'Valkey check failed',
        this.getStatus(key, false, { message: (err as Error).message }),
      );
    }
  }
}
