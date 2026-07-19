-- Phase 14 — Institutional Investment Decision Engine.
-- Two brand-new tables, both NOT NULL from creation (no existing rows, no
-- nullable->backfill->enforce migration needed, same precedent as every
-- other brand-new table since platform_audit_log).

CREATE TABLE IF NOT EXISTS investing_decision_snapshots (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  confidence REAL NOT NULL,
  analysis_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_decision_snapshots_user_id_idx ON investing_decision_snapshots(user_id);
CREATE INDEX IF NOT EXISTS investing_decision_snapshots_user_symbol_idx ON investing_decision_snapshots(user_id, symbol);

CREATE TABLE IF NOT EXISTS investing_decision_notes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_decision_notes_user_id_idx ON investing_decision_notes(user_id);
CREATE INDEX IF NOT EXISTS investing_decision_notes_user_symbol_idx ON investing_decision_notes(user_id, symbol);

-- Rollback:
-- DROP TABLE IF EXISTS investing_decision_notes;
-- DROP TABLE IF EXISTS investing_decision_snapshots;
