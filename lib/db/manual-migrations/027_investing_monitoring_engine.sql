-- Phase 16 — Institutional Monitoring & Alerts Engine.
--
-- Two brand-new tables, both NOT NULL from creation (no existing rows, no
-- nullable->backfill->enforce migration needed, same precedent as every
-- other brand-new table since platform_audit_log), plus five additive
-- columns on the existing platform_notifications table (Phase 4, Sprint 56).

CREATE TABLE IF NOT EXISTS investing_monitoring_states (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS investing_monitoring_states_entity_idx
  ON investing_monitoring_states(user_id, entity_type, entity_key);

CREATE TABLE IF NOT EXISTS investing_alert_notes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notification_id INTEGER,
  symbol TEXT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_alert_notes_user_id_idx ON investing_alert_notes(user_id);
CREATE INDEX IF NOT EXISTS investing_alert_notes_notification_id_idx ON investing_alert_notes(notification_id);

-- Additive columns on the existing platform_notifications table (Phase 4,
-- Sprint 56). `severity` is NOT NULL DEFAULT 'info' (a safe, honest default
-- for any pre-existing row); the other four stay nullable — a value is
-- supplied only when it's a genuine, non-fabricated fact about that alert.
ALTER TABLE platform_notifications
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS previous_value TEXT,
  ADD COLUMN IF NOT EXISTS current_value TEXT,
  ADD COLUMN IF NOT EXISTS evidence JSONB,
  ADD COLUMN IF NOT EXISTS recommended_action TEXT;

-- Rollback:
-- ALTER TABLE platform_notifications DROP COLUMN IF EXISTS recommended_action;
-- ALTER TABLE platform_notifications DROP COLUMN IF EXISTS evidence;
-- ALTER TABLE platform_notifications DROP COLUMN IF EXISTS current_value;
-- ALTER TABLE platform_notifications DROP COLUMN IF EXISTS previous_value;
-- ALTER TABLE platform_notifications DROP COLUMN IF EXISTS severity;
-- DROP TABLE IF EXISTS investing_alert_notes;
-- DROP TABLE IF EXISTS investing_monitoring_states;
