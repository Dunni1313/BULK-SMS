-- Phase 25 — Institutional Trade Workspace.
--
-- trading_trade_plans: real persistence for the TradePlan domain concept
-- introduced (in-memory only) in Phase 24. Phase 24's own roadmap
-- explicitly named this exact scenario ("Trade Plan persistence...
-- deferred until a real UI consumer needs it") — the Trade Workspace's
-- own Trade Plan Panel, and its "Save Workspace" workflow step, is that
-- consumer.
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation except the two honestly-nullable derived fields
-- (position_size/risk_reward_ratio, which computeRiskParameters() itself
-- already treats as nullable — a stop distance of zero, or no stated
-- account value, means these can't be computed), no backfill needed (zero
-- existing rows), same precedent as every other new table in this project
-- (platform_audit_log, investing_research_notes, trading_positions, etc.).
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention. Deliberately NOT foreign-keyed to
-- trading_positions — a Trade Plan is a pre-trade planning artifact and
-- may never become an actual position (if the plan is cancelled), and a
-- position may exist without ever having had a formal plan (mirrors
-- trading_journal_entries.trading_position_id's own established loose,
-- unenforced-reference precedent for the same reason).
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch — purely advisory/planning
-- state, deterministic, user-authored.

CREATE TABLE IF NOT EXISTS trading_trade_plans (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  direction text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  thesis text NOT NULL,
  account_risk_pct real NOT NULL,
  entry_price real NOT NULL,
  stop_price real NOT NULL,
  target_price real NOT NULL,
  position_size real,
  risk_reward_ratio real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trading_trade_plans_user_id_idx
  ON trading_trade_plans (user_id);

CREATE INDEX IF NOT EXISTS trading_trade_plans_user_symbol_idx
  ON trading_trade_plans (user_id, symbol);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS trading_trade_plans;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- this table.
