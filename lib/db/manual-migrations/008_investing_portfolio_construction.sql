-- Phase 2, Sprint 28 — investing_portfolios / investing_holdings (per the
-- approved Phase 2 plan, Sprint 28: Portfolio Construction).
--
-- Purely additive: two brand-new tables, no ALTER on any existing table. NOT
-- NULL from creation (no nullable -> backfill -> enforce dance needed for
-- tables with zero existing rows — same precedent as platform_audit_log,
-- Sprint 10, and investing_filing_analysis, Sprint 22).
--
-- user_id is mandatory on BOTH tables, ON DELETE RESTRICT: matches every
-- other user-scoped table's convention (deleting a user must never silently
-- delete their data). Kept directly on investing_holdings too (not just
-- reachable via a join through portfolio_id) so every fetch-by-id query can
-- scope ownership in the query itself, per Sprint 7's established discipline.
--
-- portfolio_id -> investing_portfolios(id) is the one disclosed exception to
-- this app's otherwise-universal RESTRICT convention: it's ON DELETE CASCADE,
-- since deleting your own portfolio is a normal, expected, self-service
-- cleanup action on your own sub-resource, not a whole-user deletion RESTRICT
-- is meant to guard against.
--
-- Advisory/education only, same discipline as value_watchlist — this schema
-- never touches a real brokerage account and constructing a portfolio here
-- never places, schedules, or submits any order. Current market price/value
-- is deliberately not stored on investing_holdings — it's always resolved
-- fresh from the live/simulated Fundamentals provider on read (same
-- never-persist-a-price discipline Sprint 27's Watchlist target-checking
-- established).

CREATE TABLE IF NOT EXISTS investing_portfolios (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_portfolios_user_id_idx
  ON investing_portfolios (user_id);

CREATE TABLE IF NOT EXISTS investing_holdings (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  portfolio_id integer NOT NULL REFERENCES investing_portfolios(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  target_weight_pct real NOT NULL DEFAULT 0,
  shares real,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_holdings_user_id_idx
  ON investing_holdings (user_id);
CREATE INDEX IF NOT EXISTS investing_holdings_portfolio_id_idx
  ON investing_holdings (portfolio_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS investing_holdings;
--   DROP TABLE IF EXISTS investing_portfolios;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- either table. Drop investing_holdings first (its FK references
-- investing_portfolios).
