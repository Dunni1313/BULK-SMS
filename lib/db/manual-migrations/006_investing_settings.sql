-- Phase 2, Sprint 11 — Institutional Investing Engine settings (per the
-- approved Phase 2 plan, Sprint 11).
--
-- Purely additive: three new NOT NULL columns, each with a DEFAULT, so every
-- existing settings row is valid the instant this runs — no backfill step, no
-- coordinated code+schema deploy required (unlike 003_settings_user_scoped.sql).
--
--   investing_risk_free_rate      - matches optionsMath.ts's existing RISK_FREE
--                                    constant (0.045), so the Investing Engine's
--                                    DCF/valuation work starts from the same
--                                    baseline assumption already used elsewhere.
--   investing_default_discount_rate - starting discount-rate assumption for the
--                                    Investing Engine's DCF/Buffett valuation
--                                    models (Sprints 13-14).
--   investing_filings_provider    - which filings source Annual Report Analysis
--                                    (Sprint 19) reads from; only "edgar" is wired
--                                    today.

ALTER TABLE settings ADD COLUMN IF NOT EXISTS investing_risk_free_rate REAL NOT NULL DEFAULT 0.045;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS investing_default_discount_rate REAL NOT NULL DEFAULT 0.09;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS investing_filings_provider TEXT NOT NULL DEFAULT 'edgar';

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Purely additive — safe to drop independently of any code rollback:
--
--   ALTER TABLE settings DROP COLUMN IF EXISTS investing_filings_provider;
--   ALTER TABLE settings DROP COLUMN IF EXISTS investing_default_discount_rate;
--   ALTER TABLE settings DROP COLUMN IF EXISTS investing_risk_free_rate;
