import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as Joi from 'joi';
import { MainModule } from './main.module';

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  APP_HOST: Joi.string().default('0.0.0.0'),
  APP_PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),

  // Three JWT secrets — one per purpose (AGENTS.md Rule 3)
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_PAIRING_SECRET: Joi.string().min(32).required(),

  // TTLs (zeit/ms-compatible strings consumed by @nestjs/jwt)
  JWT_ACCESS_TTL: Joi.string().default('8h'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),
  JWT_PAIRING_TTL: Joi.string().default('15m'),

  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(15).default(12),

  FIREBASE_CREDENTIALS_PATH: Joi.string().required(),
  GEMINI_API_KEY: Joi.string().required(),

  // Email — optional. Resend (HTTPS, no SMTP port needed) takes priority when set.
  // When neither RESEND_API_KEY nor SMTP creds are set, mailer runs in no-op mode.
  RESEND_API_KEY: Joi.string().allow('').optional(),
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().port().default(465),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').optional(),
  WEB_APP_URL: Joi.string().default('http://localhost:3001'),

  // Demo only: comma-separated elder UUIDs auto-linked to every new caregiver
  // (so shared demo profiles show in every account). Empty/unset → normal flow.
  DEMO_ELDER_IDS: Joi.string().allow('').optional(),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'info', 'debug', 'verbose')
    .default('log'),
}).unknown(true);

async function bootstrap(): Promise<void> {
  const { error, value: envVars } = envSchema.validate(process.env);
  if (error) {
    throw new Error(
      `Environment validation failed: ${error.details
        .map((d) => `${d.context?.key}: ${d.message}`)
        .join(', ')}`,
    );
  }

  const app = await NestFactory.create(MainModule);

  // Global URL prefix — every controller mounts under /v1
  app.setGlobalPrefix('v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? undefined : '*',
    credentials: true,
  });

  const host = envVars.APP_HOST;
  const port = envVars.APP_PORT;

  await app.listen(port, host);
  console.log(`✓ ElderCare API listening on http://${host}:${port}/v1 [${envVars.NODE_ENV}]`);
}

bootstrap().catch((error) => {
  console.error('Fatal bootstrap error:', error);
  process.exit(1);
});
