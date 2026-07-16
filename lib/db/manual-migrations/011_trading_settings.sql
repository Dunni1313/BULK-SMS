-- Phase 3, Sprint 32 — Institutional Trading Engine market-data provider
-- selection settings (per the approved Phase 3 plan, Sprint 32).
--
-- Purely additive: two new NOT NULL columns, each with a DEFAULT, so every
-- existing settings row is valid the instant this runs — no backfill step
-- required. Mirrors Sprint 11's investing_* settings additions and
-- fundamentals_provider/fundamentals_connected's own established shape.
--
--   trading_data_provider  - which market-data source Engine 2 reads from;
--                            only "simulated" is implemented in Sprint 32
--                            (live providers are explicitly deferred, per
--                            Phase 3 plan §10/§25 Decision 7).
--   trading_data_connected - whether a live provider is actually
--                            connected; always false until a live provider
--                            exists — never a stale/aspirational true.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS trading_data_provider TEXT NOT NULL DEFAULT 'simulated';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS trading_data_connected BOOLEAN NOT NULL DEFAULT false;

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Purely additive — safe to drop independently of any code rollback:
--
--   ALTER TABLE settings DROP COLUMN IF EXISTS trading_data_connected;
--   ALTER TABLE settings DROP COLUMN IF EXISTS trading_data_provider;
