-- ElderCare migration: optional email + caregiver email verification.
--
-- 1. `users.email` becomes nullable so elder accounts (created via the caregiver
--    pairing flow) no longer require an email. The existing UNIQUE index
--    "users_email_key" keeps working — Postgres treats every NULL as distinct,
--    so multiple email-less elders are allowed.
-- 2. `users.emailVerified` tracks whether a caregiver has confirmed their email
--    via the verification link. Defaults to false for new rows; existing rows
--    are backfilled to false (they predate verification).
--
-- Hand-authored to match what `prisma migrate dev --create-only` would produce
-- (AGENTS.md Rule 4 workflow). Run `prisma migrate deploy` to apply.

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
