-- Phase 13 — Institutional Portfolio Manager.
--
-- 1) investing_holdings gains one nullable column, avg_cost_basis, mirroring
--    the existing `shares` column's own honestly-nullable precedent — a
--    holding may have no entered cost basis, in which case Performance
--    Analytics reports that holding's P&L as unavailable rather than
--    fabricating or approximating one. Purely additive, no backfill needed.
--
-- 2) investing_portfolio_snapshots: a user-saved, explicit-trigger-only
--    composite snapshot (Quality/Risk/Diversification scores + headline
--    allocation figures) — deliberately separate from the existing
--    investing_risk_snapshots table (Phase 2, Sprint 29), which stays
--    scoped to risk only and is untouched by this migration.
--
-- 3) investing_portfolio_notes: free-text, per-user, per-portfolio notes —
--    mirrors investing_research_notes (Phase 12) exactly, scoped to a
--    portfolio instead of a symbol.
--
-- Both new tables are brand-new: NOT NULL from creation (except the
-- genuinely-nullable score/value columns), no backfill needed. user_id is
-- mandatory + ON DELETE RESTRICT; portfolio_id uses ON DELETE CASCADE,
-- matching investing_holdings'/investing_risk_snapshots' own precedent.

ALTER TABLE investing_holdings ADD COLUMN IF NOT EXISTS avg_cost_basis real;

CREATE TABLE IF NOT EXISTS investing_portfolio_snapshots (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  portfolio_id integer NOT NULL REFERENCES investing_portfolios(id) ON DELETE CASCADE,
  quality_score real,
  risk_score real,
  diversification_score real,
  total_market_value real,
  holdings_count integer NOT NULL DEFAULT 0,
  analysis_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_portfolio_snapshots_user_id_idx
  ON investing_portfolio_snapshots (user_id);
CREATE INDEX IF NOT EXISTS investing_portfolio_snapshots_portfolio_id_idx
  ON investing_portfolio_snapshots (portfolio_id);

CREATE TABLE IF NOT EXISTS investing_portfolio_notes (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  portfolio_id integer NOT NULL REFERENCES investing_portfolios(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_portfolio_notes_user_id_idx
  ON investing_portfolio_notes (user_id);
CREATE INDEX IF NOT EXISTS investing_portfolio_notes_portfolio_id_idx
  ON investing_portfolio_notes (portfolio_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS investing_portfolio_notes;
--   DROP TABLE IF EXISTS investing_portfolio_snapshots;
--   ALTER TABLE investing_holdings DROP COLUMN IF EXISTS avg_cost_basis;
-- Safe: avg_cost_basis is read only by this phase's own new code; nothing
-- outside this phase's own new code paths reads or writes either new table.
