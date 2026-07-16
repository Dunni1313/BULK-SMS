-- Phase 4, Sprint 58 — Options Engine-Native Backtesting (Route + UI)
-- (approved Phase 4 plan, Sprint 58, conditional on Sprint 57's own Core
-- output proving valuable — confirmed via a real 180-day SPY run producing
-- 10 real trades, 90% win rate, deterministic across repeated calls).
--
-- Reuses trading_backtest_results' own persisted-results SHAPE (promoted
-- headline columns + jsonb detail), not that table itself and not its
-- Engine-2 KPI vocabulary — a brand-new table, since this one's trade_log
-- carries options-specific fields (entry_credit/exit_debit/max_loss, not
-- Engine 2's entry_price/exit_price/pnl_pct) and, uniquely among every
-- backtest table in this codebase, TWO separate data-source columns
-- (underlying_data_source / options_data_source) rather than one, since
-- lib/optionsBacktest.ts genuinely composes two distinct data sources —
-- Engine 2's underlying price path and optionsMath.ts's own always-
-- SIMULATED IV model — and this sprint's own as-built note is explicit
-- that the two must never be conflated into a single field.
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation except the honestly-nullable KPI fields (a
-- strategy whose every candidate entry is rejected has no win rate to
-- report), no backfill needed (zero existing rows, same precedent as
-- trading_backtest_results/platform_notifications).
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention.
--
-- Advisory/analysis only — this table is never written to by any
-- automated execution path; it only ever replays already-resolved
-- historical (SIMULATED) options pricing over an already-resolved
-- historical (SIMULATED or LIVE) underlying candle series. The legacy
-- options-side backtest_results table (routes/backtest.ts's own fabricated-
-- statistics generator) is not modified or read by this table.

CREATE TABLE IF NOT EXISTS options_backtest_results (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  strategy text NOT NULL,
  underlying_data_source text NOT NULL DEFAULT 'SIMULATED',
  options_data_source text NOT NULL DEFAULT 'SIMULATED',
  candle_count integer NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  unavailable_reason text,
  total_trades integer NOT NULL DEFAULT 0,
  win_rate real,
  avg_r real,
  total_return_pct real,
  max_drawdown_pct real,
  sharpe_ratio real,
  equity_curve jsonb NOT NULL DEFAULT '[]',
  trade_log jsonb NOT NULL DEFAULT '[]',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS options_backtest_results_user_id_idx
  ON options_backtest_results (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS options_backtest_results;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- this table.
