-- v1.5.0, Sprint 21 — Institutional Opportunity Discovery Engine (built as
-- a distinctly-named "Opportunity Pipeline" to avoid colliding with the
-- pre-existing Phase 15 Opportunity Discovery scanner — see
-- docs/v1.5.0-Sprint-21-Opportunity-Discovery-Engine.md §1 for the full
-- disclosed naming-collision reasoning).
--
-- Persists only a user's own CAPTURED opportunities (an explicit "Capture"
-- action) and their pipeline stage/priority/links — never the underlying
-- discovery computation itself, which is always recomputed fresh from
-- already-existing engines (Market Intelligence, Watchlists, Portfolio &
-- Risk Intelligence, Knowledge Graph, Research Notes), the same
-- never-persist-a-derived-figure discipline investing_saved_screens (Phase
-- 15) and investing_risk_snapshots (Phase 2, Sprint 29) already established.
--
-- One brand-new table, NOT NULL from creation (no existing rows, no
-- nullable->backfill->enforce migration needed, same precedent as every
-- other brand-new table since platform_audit_log).

CREATE TABLE IF NOT EXISTS investing_opportunity_pipeline_items (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  origin TEXT NOT NULL,
  evidence_json JSONB NOT NULL,
  related_assets_json JSONB NOT NULL,
  related_sectors_json JSONB NOT NULL,
  priority TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'discovered',
  -- Loose, unenforced reference — mirrors journal_entries.trade_id's and
  -- trading_journal_entries.trading_position_id's own established
  -- precedent exactly. Points at an AI Coach Notebook (ai_coach_notebooks)
  -- created via the existing Research Workspace/Notebooks workflow when
  -- this opportunity is promoted to Research Candidate — never a second
  -- notebook system, never a foreign key into a table this module doesn't
  -- own.
  linked_notebook_id INTEGER,
  -- Loose pointer to an existing investing_research_notes row's own symbol
  -- (not an id — research notes are looked up by symbol, see
  -- routes/stockAnalyst.ts's GET /research-notes/:symbol) — never a
  -- duplicated research artifact.
  related_research_symbol TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS investing_opportunity_pipeline_items_user_id_idx ON investing_opportunity_pipeline_items(user_id);

-- Rollback:
-- DROP TABLE IF EXISTS investing_opportunity_pipeline_items;
