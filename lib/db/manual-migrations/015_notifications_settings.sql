-- Phase 4, Sprint 56 — the "a user can enable/disable alerts" acceptance
-- criterion. One global toggle covering both trigger sources (watchlist
-- target-crossing and risk hard-cap breach) — the plan's own effort sizing
-- for this sprint didn't call for per-trigger-source toggles, and a single
-- switch is the simplest honest implementation of "enable/disable alerts."
--
-- NOT NULL with a default so every existing settings row keeps working
-- without a manual backfill, matching every other settings-column addition
-- in this codebase (fundamentalsConnected, tradingDataConnected, etc.).
-- Defaults to true so the new capability is opt-out, not opt-in — a user
-- who never visits Settings still gets the benefit of alerts firing, which
-- can be turned off there.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS alerts_enabled boolean NOT NULL DEFAULT true;

-- ─── Rollback ────────────────────────────────────────────────────────────
--   ALTER TABLE settings DROP COLUMN IF EXISTS alerts_enabled;
-- Safe: no other column or code path outside this sprint's own reads this
-- column.
