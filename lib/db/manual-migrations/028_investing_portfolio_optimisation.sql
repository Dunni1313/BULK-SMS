-- Phase 18 — Institutional Portfolio Optimisation Engine.
--
-- investing_optimisation_reviews: a user-saved, point-in-time record of an
-- optimisation decision (upgrade/trim/exit/replace/note) for one symbol
-- within one portfolio, plus the evidence shown at the moment it was saved.
-- Mirrors investing_decision_snapshots' (Phase 14) own headline-columns-
-- plus-jsonb-blob pattern, scoped to a portfolio + symbol pair instead of a
-- bare symbol. Deliberately a separate table from investing_portfolio_notes
-- (Phase 13) — that table is generic free text with no symbol or action
-- linkage, a different concern than a structured, evidence-attached review.
--
-- Brand-new table: NOT NULL from creation except the genuinely-nullable
-- symbol (a portfolio-level review has no single candidate) and
-- evidence_json (a portfolio-level review may carry no per-symbol evidence
-- snapshot). user_id is mandatory + ON DELETE RESTRICT (universal
-- convention). portfolio_id uses ON DELETE CASCADE, matching
-- investing_holdings'/investing_portfolio_notes' own precedent — a review
-- attached to a deleted portfolio goes with it.

CREATE TABLE IF NOT EXISTS investing_optimisation_reviews (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  portfolio_id integer NOT NULL REFERENCES investing_portfolios(id) ON DELETE CASCADE,
  symbol text,
  action text NOT NULL,
  note text NOT NULL,
  evidence_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investing_optimisation_reviews_user_id_idx
  ON investing_optimisation_reviews (user_id);
CREATE INDEX IF NOT EXISTS investing_optimisation_reviews_portfolio_id_idx
  ON investing_optimisation_reviews (portfolio_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS investing_optimisation_reviews;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- this table.
