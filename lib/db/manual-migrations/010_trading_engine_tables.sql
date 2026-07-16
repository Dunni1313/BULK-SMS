-- Phase 3, Sprint 32 — trading_positions / trading_journal_entries (per the
-- approved Phase 3 plan, Sprint 32: Market Data Foundation).
--
-- Purely additive: two brand-new tables, no ALTER on any existing table. NOT
-- NULL from creation (except the genuinely-optional fields), no
-- nullable -> backfill -> enforce dance needed for tables with zero
-- existing rows, same precedent as platform_audit_log (Sprint 10) and
-- investing_portfolios/investing_holdings (Sprint 28).
--
-- Both tables are Engine 2 (Institutional Trading)'s own, instrument-
-- agnostic position/journal ledger — deliberately NOT a retrofit of
-- `trades` (Engine 3's options-legs-coupled executed-position ledger) or
-- `journal_entries` (Engine 3's own journal, scoped to that table's own
-- trade_id concept) or `investing_holdings` (Engine 1's target-weight
-- allocation, not an executed position) — see Phase 3 plan §0 Corrections
-- 2-3 and §6/§25 Decision 2.
--
-- user_id is mandatory on both tables, ON DELETE RESTRICT: matches every
-- other user-scoped table's convention (deleting a user must never
-- silently delete their data).
--
-- trading_journal_entries.trading_position_id deliberately has NO foreign
-- key constraint — mirrors journal_entries.trade_id's own established
-- precedent (a loose reference, not enforced).
--
-- Advisory/analysis only — Engine 2 has no broker integration in this
-- phase (Phase 3 plan §19); neither table is ever written to by any
-- automated execution path.

CREATE TABLE IF NOT EXISTS trading_positions (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  instrument_type text NOT NULL DEFAULT 'stock',
  side text NOT NULL DEFAULT 'long',
  status text NOT NULL DEFAULT 'open',
  quantity real NOT NULL DEFAULT 0,
  entry_price real NOT NULL DEFAULT 0,
  entry_date timestamptz NOT NULL DEFAULT now(),
  exit_price real,
  exit_date timestamptz,
  stop_price real,
  target_price real,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trading_positions_user_id_idx
  ON trading_positions (user_id);

CREATE TABLE IF NOT EXISTS trading_journal_entries (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trading_position_id integer,
  title text NOT NULL,
  content text NOT NULL,
  mood text NOT NULL DEFAULT 'neutral',
  tags text[] NOT NULL DEFAULT '{}',
  lesson_learned text,
  setup_type text,
  entry_price real,
  exit_price real,
  r_multiple real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trading_journal_entries_user_id_idx
  ON trading_journal_entries (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS trading_journal_entries;
--   DROP TABLE IF EXISTS trading_positions;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- either table.
