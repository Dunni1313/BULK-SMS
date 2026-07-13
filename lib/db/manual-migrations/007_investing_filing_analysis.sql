-- Phase 2, Sprint 22 — investing_filing_analysis (per the approved Phase 2
-- plan, Sprint 22: Document Intelligence Engine / Annual Report Analysis).
--
-- Purely additive: a brand-new table, no ALTER on any existing table. NOT
-- NULL from creation (no nullable -> backfill -> enforce dance needed for a
-- table with zero existing rows — same precedent as platform_audit_log,
-- Sprint 10).
--
-- user_id is mandatory, ON DELETE RESTRICT: matches stock_analysis_history's
-- established per-user-history convention (deleting a user must never
-- silently delete their research history). filing_type is free text (not a
-- DB enum) so future document types (10-Q, earnings-transcript, investor-
-- presentation, sustainability-report, management-commentary) reuse this same
-- table without a schema change.

CREATE TABLE IF NOT EXISTS investing_filing_analysis (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  symbol text NOT NULL,
  filing_type text NOT NULL,
  filing_date text,
  source_url text,
  sections_json jsonb NOT NULL,
  summary_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_filing_analysis_user_id_idx
  ON investing_filing_analysis (user_id);
CREATE INDEX IF NOT EXISTS investing_filing_analysis_symbol_filing_type_idx
  ON investing_filing_analysis (symbol, filing_type);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS investing_filing_analysis;
-- Safe: nothing outside this sprint's own new code paths reads or writes it.
