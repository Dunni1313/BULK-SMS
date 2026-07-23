-- Phase 25 — Institutional Trade Workspace.
--
-- trading_workspace_notes: a plain, free-text, per-user, per-symbol note,
-- the Engine 2 counterpart to investing_research_notes (Phase 12).
-- Deliberately distinct from trading_journal_entries (a deeper, structured
-- post-trade review record with setup/entry/exit/R-multiple fields) —
-- this is a lightweight, in-the-moment annotation captured while working
-- a symbol in the Trade Workspace, not tied to any specific trade or
-- position.
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation, no backfill needed (zero existing rows).
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention. Deliberately NOT foreign-keyed to
-- trading_positions or trading_trade_plans — a note can exist for a
-- symbol independent of whether the user has an open position or a saved
-- plan for it (mirrors investing_research_notes' own established
-- independent-of-watchlist-membership precedent).
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch.

CREATE TABLE IF NOT EXISTS trading_workspace_notes (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trading_workspace_notes_user_id_idx
  ON trading_workspace_notes (user_id);

CREATE INDEX IF NOT EXISTS trading_workspace_notes_user_symbol_idx
  ON trading_workspace_notes (user_id, symbol);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS trading_workspace_notes;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- this table.
