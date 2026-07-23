-- Phase 43 — Institutional Watchlists & Opportunity Dashboard.
--
-- The one genuinely new persistence primitive this phase introduces: named,
-- taggable, manually-orderable watchlists. The existing value_watchlist
-- table (Phase 2, Investing Engine) is a single flat per-user list with no
-- multi-list, tag, category, or manual-ordering support — it is left
-- completely untouched by this phase; investing_watchlists/
-- investing_watchlist_items are deliberately separate, parallel tables,
-- never a migration of that data.
--
-- investing_watchlists is the list itself. kind is free text ("personal" |
-- "institutional" by convention, not a DB enum, matching
-- investing_filing_analysis.filing_type's/trading_positions.instrument_type's/
-- compliance_policies.policy_type's own established precedent) — both
-- kinds remain owned by and scoped to the single authenticated user; this
-- platform has no multi-user sharing/permission model, and none is
-- introduced here.
--
-- investing_watchlist_items are the symbols within a list, each carrying
-- its own category/tags/notes/manual sort_order. tags is jsonb (matching
-- trading_strategies' own established jsonb string-array pattern).
--
-- watchlist_id -> investing_watchlists.id is deliberately ON DELETE CASCADE
-- (a deviation from the otherwise-universal ON DELETE RESTRICT convention)
-- — the same precedent investing_holdings -> investing_portfolios (Phase 2
-- Sprint 28) already established: deleting your own watchlist is routine
-- self-service cleanup on your own sub-resource. user_id -> users.id stays
-- RESTRICT on both new tables. item.user_id is a deliberate denormalized
-- duplicate of the parent watchlist's own user_id so tenant-isolation
-- queries can filter directly on user_id without a join.
--
-- A unique (watchlist_id, symbol) constraint prevents the same symbol
-- being added to the same list twice.
--
-- Brand-new tables: NOT NULL from creation, no nullable->backfill->enforce
-- migration needed (same precedent as platform_audit_log/
-- investing_filing_analysis/compliance_policies).

CREATE TABLE IF NOT EXISTS investing_watchlists (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'personal',
  description text NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_watchlists_user_id_idx
  ON investing_watchlists (user_id);

CREATE TABLE IF NOT EXISTS investing_watchlist_items (
  id serial PRIMARY KEY,
  watchlist_id integer NOT NULL REFERENCES investing_watchlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  category text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]',
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investing_watchlist_items_watchlist_symbol_unique UNIQUE (watchlist_id, symbol)
);

CREATE INDEX IF NOT EXISTS investing_watchlist_items_watchlist_id_idx
  ON investing_watchlist_items (watchlist_id);

CREATE INDEX IF NOT EXISTS investing_watchlist_items_user_id_idx
  ON investing_watchlist_items (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS investing_watchlist_items;
--   DROP TABLE IF EXISTS investing_watchlists;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- these tables.
