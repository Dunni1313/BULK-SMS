-- Phase 1, Sprint 1 — creates the users table only.
-- No other table is touched. Nothing in the existing application reads or
-- writes this table yet, so applying this migration has zero effect on any
-- current route or behavior.
--
-- Mirrors lib/db/src/schema/users.ts exactly — keep both in sync by hand,
-- since this project's workflow (drizzle-kit push) does not generate
-- versioned migration files on its own. This file exists specifically so
-- a change touching multi-tenancy has a reviewable, revertible artifact,
-- per the approved Phase 1 Foundation plan (Database Migration Plan, §2.5).
--
-- Assumption (flagged, not verified against a live database from this
-- environment): gen_random_uuid() is available natively on Postgres 16
-- (per .replit's postgresql-16 module) without requiring the pgcrypto
-- extension. If the actual deployment target is an older Postgres version,
-- run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` before this script.

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  auth_provider text NOT NULL DEFAULT 'password',
  external_id text,
  password_hash text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Safe at this stage: nothing references this table yet, so dropping it
-- loses nothing.
--
--   DROP TABLE IF EXISTS users;
