-- Phase 2, Sprint 29 — investing_risk_snapshots (per the approved Phase 2
-- plan, Sprint 29: Portfolio Risk Analysis).
--
-- Purely additive: one brand-new table, no ALTER on any existing table. NOT
-- NULL from creation (except overall_score, honestly nullable when risk
-- couldn't be scored) — no nullable -> backfill -> enforce dance needed for
-- a table with zero existing rows, same precedent as platform_audit_log
-- (Sprint 10) and investing_filing_analysis (Sprint 22).
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other user-scoped
-- table's convention (deleting a user must never silently delete their
-- data).
--
-- portfolio_id -> investing_portfolios(id) is ON DELETE CASCADE, matching
-- investing_holdings' own Sprint 28 precedent: a risk snapshot of a deleted
-- portfolio is meaningless and should be deleted along with it.
--
-- Rows here are written ONLY via an explicit "Save Snapshot" user action —
-- risk is always computed fresh/live on read (never automatically
-- persisted), the same never-persist-unless-asked discipline Sprint 27's
-- watchlist target-checking and Sprint 28's portfolio allocation already
-- established.

CREATE TABLE IF NOT EXISTS investing_risk_snapshots (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  portfolio_id integer NOT NULL REFERENCES investing_portfolios(id) ON DELETE CASCADE,
  overall_score real,
  analysis_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_risk_snapshots_user_id_idx
  ON investing_risk_snapshots (user_id);
CREATE INDEX IF NOT EXISTS investing_risk_snapshots_portfolio_id_idx
  ON investing_risk_snapshots (portfolio_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS investing_risk_snapshots;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- this table.
