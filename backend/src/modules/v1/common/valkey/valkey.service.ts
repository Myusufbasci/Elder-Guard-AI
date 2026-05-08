import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { type Redis } from 'ioredis';

// Thin Valkey wrapper. Used for:
//   - refresh-token JTI store (single-use rotation)
//   - CareLinkGuard 60s positive cache
//   - pairing-code brute-force counter (`pairing:attempts:{code}`, INCR + EX)
//   - anomaly throttle (`anomaly:{elderId}:{metric}`, SETNX + EX) — Step 3
//
// `maxRetriesPerRequest: null` is required for BullMQ blocking commands (Step 3).
// We set it here so the same client instance can be reused or shared with BullMQ
// connection options, avoiding parallel client lifecycles.

@Injectable()
export class ValkeyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ValkeyService.name);
  private client!: Redis;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) throw new Error('REDIS_URL not configured');
    this.client = new IORedis(url, { maxRetriesPerRequest: null });
    this.client.on('error', (err) => this.logger.error(`Valkey error: ${err.message}`));
    this.client.on('connect', () => this.logger.log('Valkey connected'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }

  raw(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async setEx(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  // SET NX EX — returns true if the key was newly created (not throttled).
  async setNxEx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  // INCR with first-write TTL — counter for brute-force protection.
  async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSeconds);
    return count;
  }
}
