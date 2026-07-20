-- Phase 30 — Institutional Strategy Framework.
--
-- Two brand-new tables, the minimal persistence this phase's own scope
-- explicitly calls for: "Create only the minimal persistence required
-- for: Strategy metadata, Strategy checklists. Reuse all existing
-- persistence where possible."
--
-- trading_strategies: user-authored Strategy Metadata ONLY — name,
-- description, category, timeframes, markets, required evidence, a
-- checklist item TEMPLATE, educational notes, references, version. No
-- entry/exit logic, no signal field, no trading-rule column of any kind.
-- Starts empty for every user (no named methodology is seeded) — the
-- same "never seed a placeholder" precedent lib/trading/strategyService.ts
-- already established for its own empty STRATEGY_REGISTRY (Phase 24).
--
-- trading_strategy_checklists: a specific INSTANCE of a strategy's own
-- checklist template applied to one real use — completion state,
-- per-item notes, and evidence links. strategy_id is a REAL foreign key
-- with ON DELETE CASCADE, the same disclosed exception
-- investing_holdings.portfolio_id -> investing_portfolios.id already
-- established (Phase 2 Sprint 28) for a genuine parent/sub-resource
-- relationship — a checklist instance without its own strategy is
-- meaningless.
--
-- Both tables NOT NULL from creation (except honestly-nullable/defaulted
-- fields), zero existing rows, no backfill needed. user_id is mandatory,
-- ON DELETE RESTRICT, matching every other user-scoped table.
--
-- Never read or written by the auto-execution/auto-adjustment engines
-- or their kill switch. No trading logic, signal generation, or broker
-- execution touches these tables.

CREATE TABLE IF NOT EXISTS trading_strategies (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  timeframes jsonb NOT NULL,
  markets jsonb NOT NULL,
  required_evidence jsonb NOT NULL,
  checklist jsonb NOT NULL,
  educational_notes text NOT NULL DEFAULT '',
  "references" jsonb NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trading_strategies_user_id_idx
  ON trading_strategies (user_id);

CREATE TABLE IF NOT EXISTS trading_strategy_checklists (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  strategy_id integer NOT NULL REFERENCES trading_strategies(id) ON DELETE CASCADE,
  symbol text,
  status text NOT NULL DEFAULT 'in_progress',
  items jsonb NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trading_strategy_checklists_user_id_idx
  ON trading_strategy_checklists (user_id);

CREATE INDEX IF NOT EXISTS trading_strategy_checklists_strategy_id_idx
  ON trading_strategy_checklists (strategy_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS trading_strategy_checklists;
--   DROP TABLE IF EXISTS trading_strategies;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- either table.
