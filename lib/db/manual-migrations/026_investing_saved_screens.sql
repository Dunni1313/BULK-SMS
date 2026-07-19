-- Phase 15 — Institutional Opportunity Discovery Engine.
-- One brand-new table, NOT NULL from creation (no existing rows, no
-- nullable->backfill->enforce migration needed, same precedent as every
-- other brand-new table since platform_audit_log).

CREATE TABLE IF NOT EXISTS investing_saved_screens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  filters_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_saved_screens_user_id_idx ON investing_saved_screens(user_id);

-- Rollback:
-- DROP TABLE IF EXISTS investing_saved_screens;
