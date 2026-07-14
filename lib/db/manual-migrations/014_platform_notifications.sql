-- Phase 4, Sprint 56 — platform_notifications (approved Phase 4 plan,
-- Sprint 56: Alerts & Notifications). The project owner's own kickoff
-- decision selected an in-app notification center as the delivery channel
-- (email and push both need real credentials/infrastructure this session
-- doesn't have and can't verify end-to-end).
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation, no backfill needed (zero existing rows), same
-- precedent as trading_backtest_results/investing_risk_snapshots.
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention.
--
-- data_source is NOT NULL with no default (unlike most tables' "SIMULATED"
-- default) — deliberately forces every alert-generating call site to state
-- its data source explicitly, satisfying the sprint's own acceptance
-- criterion that "no alert is ever sent for SIMULATED data without being
-- labeled as such."
--
-- dedup_key + the partial unique index below prevent alert spam: for a
-- given user, at most one UNREAD notification can exist per dedup_key at a
-- time. Once the user marks it read, the same still-true condition can
-- generate a fresh alert on the next evaluation — a deliberate, disclosed
-- simplification (level-triggered-respecting-read-state, not a full
-- edge-triggered state machine), avoiding the added complexity of a
-- separate "last known condition state" table for a first-of-its-kind
-- capability in this codebase.
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch — it is a purely informational,
-- advisory surface.

CREATE TABLE IF NOT EXISTS platform_notifications (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data_source text NOT NULL,
  related_symbol text,
  dedup_key text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_notifications_user_id_idx
  ON platform_notifications (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS platform_notifications_active_dedup_idx
  ON platform_notifications (user_id, dedup_key)
  WHERE is_read = false;

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS platform_notifications;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- this table.
