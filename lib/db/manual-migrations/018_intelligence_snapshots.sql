-- Institutional Intelligence Engine sprint — Phase 8, Sprint 1 (AI Coach
-- Foundation). intelligence_snapshots.
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation, no backfill needed (zero existing rows), same
-- precedent as trading_backtest_results/investing_risk_snapshots/
-- platform_notifications.
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention.
--
-- Why this table exists at all: the Timeline Engine's own "new /
-- resolved / persistent observations" diffing and the Observation
-- Engine's own trend observations ("Buying Power increasing", "Theta
-- income improving", "Portfolio Health improved") both genuinely
-- require comparing today's already-computed figures against a PRIOR
-- day's already-computed figures. No other table in this codebase
-- persists a rolling history of these headline figures. Every column
-- here is a snapshot of an already-computed value from an existing,
-- unmodified module (Portfolio Dashboard's own healthScore/
-- overallRiskRating/buyingPower/healthFactors, and Theta Income's own
-- monthly projection) — never a new calculation, never new market
-- data, and never a statistical forecast: comparing two already-known
-- past values (today vs. the most recently recorded snapshot) is
-- history-keeping, not prediction.
--
-- At most one row per (user_id, snapshot_date), enforced by the unique
-- index below. Written via a real DB-level upsert
-- (INSERT ... ON CONFLICT DO NOTHING), not a check-then-insert race —
-- a stricter, safer pattern than the sequential-await workaround the
-- Portfolio Risk Dashboard sprint's own getSettingsRow() concurrency
-- fix used, since this table has a real unique constraint to lean on.
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch — it is a purely
-- informational, advisory surface, and it is never written more than
-- once per user per calendar day (no automatic polling, matching this
-- whole project's established discipline).

CREATE TABLE IF NOT EXISTS intelligence_snapshots (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  snapshot_date text NOT NULL,
  health_score integer NOT NULL,
  overall_risk_rating_code text NOT NULL,
  buying_power real NOT NULL,
  total_risk_pct real NOT NULL,
  concentration_score integer NOT NULL,
  diversification_score integer NOT NULL,
  event_risk_score integer NOT NULL,
  directional_exposure_score integer NOT NULL,
  greeks_exposure_score integer NOT NULL,
  theta_monthly real NOT NULL,
  net_delta real NOT NULL,
  observation_codes jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intelligence_snapshots_user_id_idx
  ON intelligence_snapshots (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS intelligence_snapshots_user_date_idx
  ON intelligence_snapshots (user_id, snapshot_date);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS intelligence_snapshots;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- this table.
