-- ElderCare initial migration.
-- Sections:
--   1. TimescaleDB extension
--   2. Enums
--   3. Tables (managed by Prisma — generated CREATE TABLE equivalents)
--   4. Foreign keys & indexes
--   5. TimescaleDB hypertables, compression, retention, continuous aggregates
--      (manual DDL appended per AGENTS.md Rule 4)
--
-- This file is hand-authored to match what `prisma migrate dev --create-only`
-- would produce, with the TimescaleDB section appended afterward. Run
-- `prisma migrate deploy` (or `prisma migrate resolve --applied 20260429000000_init`
-- after manual DB setup) to register the migration.

-- =============================================================================
-- 1. TimescaleDB extension
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =============================================================================
-- 2. Enums
-- =============================================================================
CREATE TYPE "UserRole"     AS ENUM ('CAREGIVER', 'ELDER', 'ADMIN');
CREATE TYPE "JwtPurpose"   AS ENUM ('ACCESS', 'REFRESH', 'DEVICE_PAIRING');
CREATE TYPE "Severity"     AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "AnomalyKind"  AS ENUM ('THRESHOLD_BREACH', 'PERSISTENCE', 'MULTI_METRIC');

-- =============================================================================
-- 3. Tables
-- =============================================================================

-- users
CREATE TABLE "users" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "email"        TEXT         NOT NULL,
  "passwordHash" TEXT,
  "role"         "UserRole"   NOT NULL,
  "firstName"    TEXT         NOT NULL,
  "lastName"     TEXT         NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- caregiver_profiles
CREATE TABLE "caregiver_profiles" (
  "userId"    UUID         NOT NULL,
  "phone"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "caregiver_profiles_pkey" PRIMARY KEY ("userId")
);

-- elder_profiles
CREATE TABLE "elder_profiles" (
  "userId"      UUID         NOT NULL,
  "dateOfBirth" DATE         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "elder_profiles_pkey" PRIMARY KEY ("userId")
);

-- care_links (composite PK enables Prisma's caregiverId_elderId compound filter)
CREATE TABLE "care_links" (
  "caregiverId" UUID         NOT NULL,
  "elderId"     UUID         NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "care_links_pkey" PRIMARY KEY ("caregiverId", "elderId")
);
CREATE INDEX "care_links_elderId_idx" ON "care_links"("elderId");

-- devices
CREATE TABLE "devices" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "elderId"    UUID         NOT NULL,
  "fcmToken"   TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "model"      TEXT,
  "osVersion"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "devices_elderId_idx" ON "devices"("elderId");

-- device_pairings (6-digit numeric code, 15-min TTL, single-use)
CREATE TABLE "device_pairings" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "code"       TEXT         NOT NULL,
  "elderId"    UUID         NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "redeemedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_pairings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "device_pairings_code_key" ON "device_pairings"("code");
CREATE INDEX "device_pairings_elderId_idx" ON "device_pairings"("elderId");
CREATE INDEX "device_pairings_expiresAt_idx" ON "device_pairings"("expiresAt");

-- telemetry (will be converted to a hypertable in section 5)
CREATE TABLE "telemetry" (
  "time"       TIMESTAMPTZ(3)   NOT NULL,
  "deviceId"   UUID             NOT NULL,
  "metric"     TEXT             NOT NULL,
  "value"      DOUBLE PRECISION NOT NULL,
  "quality"    SMALLINT,
  "ingestedAt" TIMESTAMPTZ(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telemetry_pkey" PRIMARY KEY ("time", "deviceId", "metric")
);

-- anomaly_events
CREATE TABLE "anomaly_events" (
  "id"             UUID             NOT NULL DEFAULT gen_random_uuid(),
  "elderId"        UUID             NOT NULL,
  "metric"         TEXT             NOT NULL,
  "kind"           "AnomalyKind"    NOT NULL,
  "severity"       "Severity"       NOT NULL,
  "detectedAt"     TIMESTAMPTZ(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifiedZScore" DOUBLE PRECISION NOT NULL,
  "observedValue"  DOUBLE PRECISION NOT NULL,
  "medianValue"    DOUBLE PRECISION NOT NULL,
  "madValue"       DOUBLE PRECISION NOT NULL,
  "acknowledged"   BOOLEAN          NOT NULL DEFAULT false,
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "anomaly_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "anomaly_events_elderId_detectedAt_idx" ON "anomaly_events"("elderId", "detectedAt" DESC);
CREATE INDEX "anomaly_events_acknowledged_idx" ON "anomaly_events"("acknowledged");

-- push_tokens
CREATE TABLE "push_tokens" (
  "token"     TEXT         NOT NULL,
  "userId"    UUID         NOT NULL,
  "platform"  TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("token")
);
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

-- notification_logs
CREATE TABLE "notification_logs" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"         UUID         NOT NULL,
  "anomalyId"      UUID,
  "type"           TEXT         NOT NULL,
  "content"        JSONB        NOT NULL,
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveryStatus" TEXT         NOT NULL,
  CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_logs_userId_idx" ON "notification_logs"("userId");
CREATE INDEX "notification_logs_anomalyId_idx" ON "notification_logs"("anomalyId");
CREATE INDEX "notification_logs_sentAt_idx" ON "notification_logs"("sentAt");

-- audit_logs (will be converted to a hypertable in section 5)
CREATE TABLE "audit_logs" (
  "id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
  "userId"       UUID,
  "action"        TEXT           NOT NULL,
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  "requestData"   JSONB,
  "responseData"  JSONB,
  "statusCode"    INTEGER,
  "duration"      INTEGER,
  "correlationId" TEXT,
  "createdAt"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id", "createdAt")
);
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_correlationId_idx" ON "audit_logs"("correlationId");

-- =============================================================================
-- 4. Foreign keys
-- =============================================================================
ALTER TABLE "caregiver_profiles"
  ADD CONSTRAINT "caregiver_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "elder_profiles"
  ADD CONSTRAINT "elder_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "care_links"
  ADD CONSTRAINT "care_links_caregiverId_fkey"
  FOREIGN KEY ("caregiverId") REFERENCES "caregiver_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "care_links"
  ADD CONSTRAINT "care_links_elderId_fkey"
  FOREIGN KEY ("elderId") REFERENCES "elder_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_elderId_fkey"
  FOREIGN KEY ("elderId") REFERENCES "elder_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "device_pairings"
  ADD CONSTRAINT "device_pairings_elderId_fkey"
  FOREIGN KEY ("elderId") REFERENCES "elder_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "anomaly_events"
  ADD CONSTRAINT "anomaly_events_elderId_fkey"
  FOREIGN KEY ("elderId") REFERENCES "elder_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_tokens"
  ADD CONSTRAINT "push_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_logs"
  ADD CONSTRAINT "notification_logs_anomalyId_fkey"
  FOREIGN KEY ("anomalyId") REFERENCES "anomaly_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- onDelete: SetNull preserves audit trail when a user is removed (Pattern 16).
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 5. TimescaleDB DDL — manually appended per AGENTS.md Rule 4
-- =============================================================================

-- 5a. Telemetry hypertable (1-day chunks)
SELECT create_hypertable('telemetry', by_range('time', INTERVAL '1 day'));
CREATE INDEX idx_telemetry_device_metric_time ON telemetry("deviceId", metric, "time" DESC);

-- 5b. Compression policy (compress chunks older than 7 days)
ALTER TABLE telemetry SET (
  timescaledb.compress,
  timescaledb.compress_orderby   = '"time" DESC',
  timescaledb.compress_segmentby = '"deviceId", metric'
);
SELECT add_compression_policy('telemetry', INTERVAL '7 days');

-- 5c. Retention policy (drop chunks older than 365 days)
SELECT add_retention_policy('telemetry', INTERVAL '365 days');

-- 5d. 1-minute continuous aggregate — input for the anomaly detector
CREATE MATERIALIZED VIEW telemetry_1m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', "time") AS bucket,
  "deviceId" AS device_id,
  metric,
  AVG(value)  AS avg_value,
  MIN(value)  AS min_value,
  MAX(value)  AS max_value,
  COUNT(*)    AS sample_count
FROM telemetry
GROUP BY bucket, "deviceId", metric
WITH NO DATA;

SELECT add_continuous_aggregate_policy('telemetry_1m',
  start_offset      => INTERVAL '1 hour',
  end_offset        => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');

-- 5e. 1-hour continuous aggregate — for caregiver dashboard charts
CREATE MATERIALIZED VIEW telemetry_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', bucket) AS bucket,
  device_id,
  metric,
  AVG(avg_value) AS avg_value,
  MIN(min_value) AS min_value,
  MAX(max_value) AS max_value,
  SUM(sample_count) AS sample_count
FROM telemetry_1m
GROUP BY 1, device_id, metric
WITH NO DATA;

SELECT add_continuous_aggregate_policy('telemetry_1h',
  start_offset      => INTERVAL '1 day',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '5 minutes');

-- 5f. Audit logs hypertable
SELECT create_hypertable('audit_logs', by_range('createdAt', INTERVAL '1 day'));

-- 5g. Audit retention (90 days per Pattern 14 / task spec)
SELECT add_retention_policy('audit_logs', INTERVAL '90 days');
