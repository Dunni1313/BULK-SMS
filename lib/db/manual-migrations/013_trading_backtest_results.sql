-- Phase 3, Sprint 49 — trading_backtest_results (per the approved Phase 3
-- plan §18: Backtesting Architecture).
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation except the honestly-nullable KPI fields (a
-- strategy that never triggers a signal has no win rate to report), no
-- nullable -> backfill -> enforce dance needed for a table with zero
-- existing rows, same precedent as trading_positions/trading_journal_
-- entries (Sprint 32).
--
-- Reuses backtest_results' own persisted-results SHAPE (promoted
-- headline columns + jsonb detail), not that table itself and not its
-- options-specific simulation logic — Engine 2's own KPI vocabulary
-- (win_rate/avg_r/max_drawdown_pct/total_return_pct/sharpe_ratio) is
-- deliberately different from backtest_results' own (avg_win/avg_loss/
-- ev_*/sortino_ratio), and this table's trade_log is a REAL trade-by-
-- trade log from a genuine walk-forward simulation, not a fabricated
-- equity curve. backtest_results itself is not modified.
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention.
--
-- Advisory/analysis only — this table is never written to by any
-- automated execution path; it only ever replays already-resolved
-- historical (SIMULATED or LIVE) candles.

CREATE TABLE IF NOT EXISTS trading_backtest_results (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  strategy text NOT NULL,
  interval text NOT NULL,
  data_source text NOT NULL DEFAULT 'SIMULATED',
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

CREATE INDEX IF NOT EXISTS trading_backtest_results_user_id_idx
  ON trading_backtest_results (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS trading_backtest_results;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- this table.
