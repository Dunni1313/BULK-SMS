-- Phase 12 — Institutional Investing Engine Consolidation & Integration.
--
-- investing_research_notes: the one genuinely-missing piece of durable
-- user state this phase's repository audit identified with no existing
-- equivalent anywhere in the codebase (confirmed by grep before this
-- migration was written — zero prior matches for "research note" in
-- lib/ or routes/).
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation, no backfill needed (zero existing rows), same
-- precedent as intelligence_snapshots/platform_notifications/
-- learning_progress.
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention. Deliberately NOT foreign-keyed to
-- value_watchlist — a note can exist for a symbol the user never added
-- to their watchlist, or continue to exist after they remove it, since
-- it is the user's own durable record, independent of watchlist
-- membership (mirrors journal_entries.trade_id's own established loose,
-- unenforced-reference precedent).
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch — purely educational/
-- research advisory state, deterministic, user-authored free text.

CREATE TABLE IF NOT EXISTS investing_research_notes (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_research_notes_user_id_idx
  ON investing_research_notes (user_id);

CREATE INDEX IF NOT EXISTS investing_research_notes_user_symbol_idx
  ON investing_research_notes (user_id, symbol);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS investing_research_notes;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- this table.
