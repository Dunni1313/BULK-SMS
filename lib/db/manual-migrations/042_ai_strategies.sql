-- v1.5.0, Sprint 9 — AI Strategy Builder.
--
-- A Strategy is a reusable, structured trading or investing playbook, built
-- on top of Sprint 6's conversation memory, Sprint 7's AI Workspaces, and
-- Sprint 8's AI Research Notebooks, for the same three conversational AI
-- Coaches (Trading, Investing, Options). Portfolio remains excluded (no
-- conversational coach exists there).
--
-- Per the approved scope ("reuse Workspace architecture, introduce only the
-- minimum schema required for Strategies / Strategy versions / Strategy
-- sections, avoid duplicate storage"), exactly three new tables:
--
--   ai_strategies — one row per strategy. workspace_id is NULLABLE with
--   ON DELETE SET NULL, mirroring ai_notebooks.workspace_id's own Sprint 8
--   precedent (not ai_workspace_files/notes' own ON DELETE CASCADE) — a
--   strategy is a substantial, curated playbook; deleting its parent
--   workspace should detach it, never destroy it. strategy_type and
--   asset_class are free text, deliberately NOT a DB enum/CHECK list — the
--   approved scope's own explicit requirement is "the architecture must
--   allow additional templates later without schema changes." The actual
--   17 named starter templates (Trend Following, Mean Reversion, ...,
--   Growth Investing) live purely in application code
--   (lib/strategyTemplates.ts) as an extensible registry — adding an
--   18th template is a one-line array addition, never a migration.
--   folder is similarly free text (nullable — when unset, the UI derives a
--   default folder from coach_id) so "Templates"/"Personal"/the
--   explicitly-future "Shared" folder all fit today with zero schema
--   change when sharing is eventually built. status is free text
--   (application-validated to draft|active|retired, the same
--   validate-in-app-not-in-DB convention as ai_notebook_notes.kind)
--   rather than a DB CHECK, for the same forward-compatibility reason.
--   current_version denormalizes which ai_strategy_versions row is "live"
--   for cheap reads without a join on every list request.
--
--   ai_strategy_sections — the strategy's own structured content, one
--   table discriminated by `kind` rather than 17 separate tables/columns,
--   matching this codebase's own established free-text-discriminator
--   convention (ai_notebook_notes.kind, investing_filing_analysis.filing_type).
--   Covers every approved-scope section: Market Context, Setup, Checklist,
--   Entry, Stop, Targets, Risk, Position Size, Trade Management, Exit
--   Rules, Invalidation, Common Mistakes, Psychology Notes, AI Notes
--   (all free-text `content`, one row per kind per strategy — enforced
--   singleton via the partial unique index below), plus Attachments,
--   Research Links, and Notebook References — modelled as the SAME table
--   rather than a fourth "links" table (the approved scope caps schema at
--   exactly Strategies/Strategy versions/Strategy sections), each row
--   optionally carrying a REAL typed foreign-key reference
--   (ref_notebook_id / ref_conversation_id / ref_file_id — mirroring
--   ai_notebook_links' own real-FK-integrity precedent from Sprint 8,
--   rather than an untyped generic reference) instead of forcing every
--   link into a single content string. Unlike the 14 qualitative kinds, a
--   strategy may have MANY attachments/research-links/notebook-references,
--   so those three kinds are deliberately excluded from the singleton
--   uniqueness constraint. ON DELETE CASCADE from its strategy (a section
--   has no meaning independent of the strategy it belongs to); a
--   reference's OWN target uses ON DELETE SET NULL (deleting a linked
--   notebook/conversation/file leaves an honest, still-visible "reference
--   no longer available" row rather than silently vanishing content the
--   user wrote alongside it).
--
--   ai_strategy_versions — full version history: every edit (top-level
--   field change or any section change) appends an immutable row carrying
--   `version` (monotonic per strategy), `snapshot` (a complete jsonb copy
--   of the strategy's own top-level fields plus every section's content/
--   references at that moment — enabling true restore without depending
--   on ai_strategy_sections' own current, mutable state), `change_summary`
--   (nullable, "Summary of changes"), `author_user_id` ("Author"), and
--   `created_at` ("Timestamp") — satisfying the approved scope's own
--   explicit versioning requirement in full. Restoring a prior version
--   never rewrites history in place — it applies that version's snapshot
--   to the live strategy/sections rows AND appends a brand-new version of
--   its own (an immutable, git-like log, never a mutable pointer).
--
-- Neither ai_strategy_sections nor ai_strategy_versions carries its own
-- user_id — ownership is transitive via strategy_id -> ai_strategies.user_id,
-- the same no-redundant-denormalization pattern ai_notebook_notes/links
-- already established relative to ai_notebooks.user_id (Sprint 8).

CREATE TABLE IF NOT EXISTS ai_strategies (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  workspace_id integer REFERENCES ai_workspaces(id) ON DELETE SET NULL,
  coach_id text NOT NULL,
  title text NOT NULL,
  description text,
  strategy_type text NOT NULL,
  asset_class text,
  folder text,
  status text NOT NULL DEFAULT 'draft',
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_strategies_user_coach_idx
  ON ai_strategies (user_id, coach_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_strategies_workspace_idx
  ON ai_strategies (workspace_id);

CREATE TABLE IF NOT EXISTS ai_strategy_sections (
  id serial PRIMARY KEY,
  strategy_id integer NOT NULL REFERENCES ai_strategies(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content text,
  ref_notebook_id integer REFERENCES ai_notebooks(id) ON DELETE SET NULL,
  ref_conversation_id integer REFERENCES ai_coach_conversations(id) ON DELETE SET NULL,
  ref_file_id integer REFERENCES ai_workspace_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_strategy_sections_strategy_idx
  ON ai_strategy_sections (strategy_id);

-- Singleton enforcement for the 14 qualitative section kinds only —
-- attachment/research_link/notebook_reference rows are deliberately
-- many-per-strategy and excluded here.
CREATE UNIQUE INDEX IF NOT EXISTS ai_strategy_sections_singleton_idx
  ON ai_strategy_sections (strategy_id, kind)
  WHERE kind NOT IN ('attachment', 'research_link', 'notebook_reference');

CREATE TABLE IF NOT EXISTS ai_strategy_versions (
  id serial PRIMARY KEY,
  strategy_id integer NOT NULL REFERENCES ai_strategies(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_summary text,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_strategy_versions_strategy_version_unique UNIQUE (strategy_id, version)
);

CREATE INDEX IF NOT EXISTS ai_strategy_versions_strategy_idx
  ON ai_strategy_versions (strategy_id, version DESC);
