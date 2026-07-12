-- Phase 1, Sprint 6 — Better-Auth tables (per Owner Decision #1 and the
-- approved Phase 1 Foundation plan §9 Sprint 6).
--
-- Adds two columns Better-Auth's `user` model requires (email_verified,
-- image) to the existing users table, plus three new tables: sessions,
-- accounts, verifications. users.id stays the FK target for all of them —
-- it is not replaced or duplicated.
--
-- authProvider/externalId/passwordHash on users are NOT touched here: they
-- predate this sprint's provider decision and are left in place, unused
-- (Better-Auth stores credentials on `accounts.password` instead — see
-- lib/db/src/schema/users.ts's comment).
--
-- Run this against a full pg_dump backup taken immediately beforehand
-- (§2.6's "full safety net").

-- ─── users: two new columns for Better-Auth's `user` model ─────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS image text;

-- display_name becomes NOT NULL: Better-Auth's `name` field is required
-- (confirmed against @better-auth/cli generate's own output, independent of
-- this hand-written script). The only existing row (the Sprint 4 legacy
-- owner) already has one, so no backfill is needed before enforcing this.
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

-- ─── sessions: one row per active login ────────────────────────────────────
-- ON DELETE CASCADE (not RESTRICT): auth-plumbing, not business/financial
-- data — see lib/db/src/schema/session.ts's comment for why §2.4's
-- RESTRICT convention doesn't apply here.
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- ─── accounts: one row per linked auth method (email/password today) ───────
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts (user_id);

-- ─── verifications: short-lived tokens (email verification, password reset) ─
-- No user_id FK — keyed by identifier (typically an email), which can exist
-- before the user row it applies to is fully resolved.
CREATE TABLE IF NOT EXISTS verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON verifications (identifier);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS verifications;
--   DROP TABLE IF EXISTS accounts;
--   DROP TABLE IF EXISTS sessions;
--   ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL;
--   ALTER TABLE users DROP COLUMN IF EXISTS image;
--   ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
-- Safe: nothing outside Better-Auth's own code paths reads these yet.
