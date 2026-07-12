-- Phase 1, Sprint 10 — platform_audit_log (per the approved Phase 1 Foundation
-- plan §6.2, §9 Sprint 10).
--
-- Purely additive: a brand-new table, no ALTER on any existing table.
-- Deliberately separate from auto_execution_log (Phase 6's kill-switch audit
-- trail), which this migration does NOT touch, modify, or merge into — see
-- CLAUDE.md rule 3 and the plan's §6.1/§6.3.
--
-- user_id is nullable from day one (not a nullable->backfill->enforce
-- migration like the 13 business tables) — specifically for system-level
-- events with no acting user. ON DELETE SET NULL, not RESTRICT: an audit
-- trail should survive the deletion of the user it's auditing, not block it
-- or vanish with it.

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  engine text NOT NULL,
  event_type text NOT NULL,
  action text NOT NULL,
  result text NOT NULL,
  resource_type text,
  resource_id text,
  reason text,
  run_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_log_user_id_created_at_idx
  ON platform_audit_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS platform_audit_log_engine_event_type_created_at_idx
  ON platform_audit_log (engine, event_type, created_at);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS platform_audit_log;
-- Safe: nothing outside this sprint's own new code paths reads or writes it.
