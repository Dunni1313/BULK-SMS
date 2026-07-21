-- Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
--
-- compliance_policies: the one genuinely new persistence primitive this
-- phase introduces — a user-defined, editable POLICY (a named limit
-- against an already-computed figure from an existing engine). Every
-- prior phase's own thresholds (Phase 40's Executive Alerts, Phase 2
-- Sprint 29's/Phase 3's own named concentration/risk caps) are hardcoded
-- constants; no existing table lets a user set and persist their OWN
-- limit. This table never stores a computed value itself — current
-- values are always resolved fresh from lib/riskExposureEngine.ts/
-- lib/decisionSupportEngine.ts/lib/portfolioDashboard.ts/
-- lib/optionsIncomeAnalytics.ts on every read (see lib/complianceEngine.ts).
--
-- policy_type is free text, not a DB enum (matching
-- investing_filing_analysis.filing_type's/trading_positions.instrument_type's
-- own established precedent) — see lib/compliancePolicies.ts's own
-- POLICY_TYPE_META for the fixed, documented set this phase implements.
--
-- target_key is genuinely nullable: for policy types scoped to a specific
-- named entity (a sector, a symbol, a strategy), it holds that entity's
-- key; null means "apply this policy to whichever entity of this type
-- currently has the highest/most-extreme value" (a blanket rule).
--
-- direction is "max" (current value must not exceed limit_value) or "min"
-- (current value must not fall below limit_value).
--
-- Brand-new table: NOT NULL from creation except the genuinely-nullable
-- target_key, no nullable->backfill->enforce migration needed (same
-- precedent as platform_audit_log/investing_filing_analysis). user_id is
-- mandatory + ON DELETE RESTRICT (universal convention).

CREATE TABLE IF NOT EXISTS compliance_policies (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  policy_type text NOT NULL,
  label text NOT NULL,
  target_key text,
  direction text NOT NULL DEFAULT 'max',
  limit_value real NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS compliance_policies_user_id_idx
  ON compliance_policies (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS compliance_policies;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- this table.
