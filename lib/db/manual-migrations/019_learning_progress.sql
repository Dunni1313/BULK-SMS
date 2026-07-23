-- AI Teacher & Learning Centre sprint — learning_progress.
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation (except the honestly-nullable completed_at),
-- no backfill needed (zero existing rows), same precedent as
-- intelligence_snapshots/platform_notifications.
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention.
--
-- This is the ONLY new user-state mutation the AI Teacher & Learning
-- Centre sprint introduces, per that sprint's own explicit instruction.
-- Quiz scores are deliberately NOT duplicated here — they already have
-- their own dedicated tables (greeks_quiz_results, value_quiz_results),
-- read directly by lib/learningProgress.ts rather than re-stored.
--
-- One row per (user_id, item_type, item_key), enforced by the unique
-- index below, upserted on view/complete via
-- INSERT ... ON CONFLICT DO UPDATE — never a growing event log, since
-- this feature only needs "has this been viewed/completed and when,"
-- not a full history of every individual view.
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch — purely educational,
-- advisory state.

CREATE TABLE IF NOT EXISTS learning_progress (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  item_type text NOT NULL,
  item_key text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_progress_user_id_idx
  ON learning_progress (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS learning_progress_user_item_idx
  ON learning_progress (user_id, item_type, item_key);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS learning_progress;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- this table.
