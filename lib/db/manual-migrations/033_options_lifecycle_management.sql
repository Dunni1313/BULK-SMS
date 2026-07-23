-- Phase 36 — Institutional Position Lifecycle Manager.
--
-- Three brand-new tables, the minimal persistence this phase's own scope
-- calls for on top of the existing `trades` table:
--
-- options_lifecycle_state: the CURRENT deterministic lifecycle stage for
-- one position (draft/planned/open/monitoring/near_expiration/
-- assignment_risk/closed/archived) plus its assigned review cadence
-- (daily/weekly/monthly/expiration/manual). One row per trade, no
-- automatic transitions — every change is an explicit user action.
--
-- options_lifecycle_events: an append-only event log (stage changes,
-- reviews, adjustment journal entries, assignment-risk notes) — the
-- single table backing Position Timeline, Position History, Adjustment
-- Journal, and Assignment Tracker as filtered views over the same data.
--
-- options_position_checklists: a specific INSTANCE of a strategy's own
-- static institutional checklist template applied to one real position —
-- completion state only, mirroring trading_strategy_checklists' own
-- established shape (Phase 30).
--
-- All three tables' trade_id is a REAL foreign key with ON DELETE CASCADE
-- — a genuine 1:1 (or 1:N for events) sub-resource of its own trade, the
-- same disclosed precedent investing_holdings.portfolio_id ->
-- investing_portfolios.id and trading_strategy_checklists.strategy_id ->
-- trading_strategies.id already established. user_id is mandatory, ON
-- DELETE RESTRICT, matching every other user-scoped table.
--
-- All three tables NOT NULL from creation (except honestly-nullable/
-- defaulted fields), zero existing rows, no backfill needed.
--
-- Never read or written by the auto-execution/auto-adjustment engines or
-- their kill switch. No trading logic, signal generation, automated
-- rolling, automated assignment handling, or broker execution touches
-- these tables.

CREATE TABLE IF NOT EXISTS options_lifecycle_state (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trade_id integer NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'draft',
  review_cadence text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT options_lifecycle_state_trade_id_unique UNIQUE (trade_id)
);

CREATE INDEX IF NOT EXISTS options_lifecycle_state_user_id_idx
  ON options_lifecycle_state (user_id);

CREATE TABLE IF NOT EXISTS options_lifecycle_events (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trade_id integer NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  stage text,
  review_type text,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS options_lifecycle_events_user_id_idx
  ON options_lifecycle_events (user_id);

CREATE INDEX IF NOT EXISTS options_lifecycle_events_trade_id_idx
  ON options_lifecycle_events (trade_id);

CREATE TABLE IF NOT EXISTS options_position_checklists (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trade_id integer NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  strategy_key text NOT NULL,
  items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT options_position_checklists_trade_id_unique UNIQUE (trade_id)
);

CREATE INDEX IF NOT EXISTS options_position_checklists_user_id_idx
  ON options_position_checklists (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS options_position_checklists;
--   DROP TABLE IF EXISTS options_lifecycle_events;
--   DROP TABLE IF EXISTS options_lifecycle_state;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- any of the three tables.
