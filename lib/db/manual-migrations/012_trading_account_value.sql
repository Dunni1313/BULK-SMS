-- Phase 3, Sprint 44 — Risk Management Route + UI, trading account value
-- setting (per the approved Phase 3 plan §15 and this sprint's own kickoff
-- decision).
--
-- computeTradingRisk() (lib/tradingRisk.ts, Sprint 38) needs an account
-- value to size position risk against. Per the explicit owner decision at
-- this sprint's kickoff, this is deliberately NOT a reuse of Engine 3's
-- options-derived getAccountValue() (lib/serverState.ts) — a stock/futures
-- trader's account value is a genuinely different number, and coupling
-- Engine 2's risk sizing to Engine 3's options P&L would violate the
-- established engine-independence discipline (see lib/investingMacro.ts vs
-- lib/marketBriefing.ts, Phase 2 Sprint 26; TRADING_MARKET_UNIVERSE vs
-- INVESTING_UNIVERSE, Phase 3 Sprint 32).
--
-- Purely additive: one new nullable column, no default and no backfill —
-- honestly null until the user sets it via PATCH /settings, so
-- computeTradingRisk() correctly reports "insufficient data" for
-- position-sizing/portfolio-budget scoring rather than fabricating a
-- default account size for every existing settings row.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS trading_account_value REAL;

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Purely additive — safe to drop independently of any code rollback:
--
--   ALTER TABLE settings DROP COLUMN IF EXISTS trading_account_value;
