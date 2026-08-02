-- v1.5.0, Sprint 8 — AI Research Notebooks.
--
-- A Notebook is a structured knowledge space, built on top of Sprint 7's AI
-- Workspaces and Sprint 6's conversation memory, for the same three
-- conversational AI Coaches (Trading, Investing, Options). Portfolio
-- remains excluded (no conversational coach exists there).
--
-- Per the approved scope ("reuse Workspace storage where possible,
-- introduce only the minimum schema required for Notebooks / Notebook
-- notes / Notebook links, do not duplicate conversation storage"),
-- conversations and workspace file references are never re-stored here —
-- a notebook only LINKS to them via ai_notebook_links.
--
-- Exactly three new tables, matching the approved scope's own literal
-- naming:
--
--   ai_notebooks — one row per notebook. workspace_id is NULLABLE with
--   ON DELETE SET NULL, deliberately mirroring ai_coach_conversations.
--   workspace_id's own Sprint 7 precedent (not ai_workspace_files/notes'
--   own ON DELETE CASCADE): a notebook is a substantial, curated research
--   artifact — deleting its parent workspace should detach it back to a
--   top-level "All notebooks" view, never destroy accumulated research.
--   coach_id is free text, restricted at the application layer to the
--   same three coach ids Sprint 6/7 already established (a notebook not
--   yet assigned to any workspace still needs its own coach_id for
--   per-coach isolation, the same reasoning ai_workspaces.coach_id
--   already established). "Version history (basic)" is a monotonic
--   `version` integer bumped on every title/description edit, plus
--   `updated_at` — a lightweight, honestly-basic mechanism, not a full
--   diffable snapshot history (a genuinely bigger feature, out of this
--   sprint's "minimum schema required" scope).
--
--   ai_notebook_notes — one table discriminated by `kind`
--   ("note" | "summary" | "finding" | "action_item" | "reference" |
--   "saved_response") rather than five/six separate tables, matching this
--   codebase's own established free-text-discriminator convention (e.g.
--   investing_filing_analysis.filing_type, ai_workspace_notes.kind).
--   Covers "Rich-text notes" (kind=note; see coachConversationsApi.ts's
--   own frontend disclosure that "rich-text" is implemented as
--   kind-tagged plain text, since no rich-text editor library exists in
--   this codebase), "AI-generated summaries" (kind=summary), "Key
--   findings" (kind=finding), "Action items" (kind=action_item),
--   "References" (kind=reference), and "Save an AI response into a
--   notebook" (kind=saved_response). ON DELETE CASCADE from its
--   notebook — a note has no meaning independent of the notebook it
--   belongs to.
--
--   ai_notebook_links — "Linked conversations" and "Linked uploaded files
--   (references only)" in ONE table (matching the approved scope's own
--   literal "Notebook links" naming), discriminated by `link_type`
--   ("conversation" | "file") with two nullable target-id columns
--   (exactly one populated per row, matching link_type) rather than a
--   single untyped/unenforced generic reference — this preserves real
--   foreign-key integrity to both ai_coach_conversations and
--   ai_workspace_files. ON DELETE CASCADE from its notebook (a link has
--   no meaning without its notebook) AND ON DELETE CASCADE from whichever
--   target it points to (a link to a since-deleted conversation or file
--   reference is meaningless and should not dangle).
--
-- Neither ai_notebook_notes nor ai_notebook_links carries its own
-- user_id — ownership is transitive via notebook_id -> ai_notebooks.user_id,
-- the same no-redundant-denormalization pattern ai_workspace_files/notes
-- already established relative to ai_workspaces.user_id (Sprint 7).

CREATE TABLE IF NOT EXISTS ai_notebooks (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  workspace_id integer REFERENCES ai_workspaces(id) ON DELETE SET NULL,
  coach_id text NOT NULL,
  title text NOT NULL,
  description text,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_notebooks_user_coach_idx
  ON ai_notebooks (user_id, coach_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ai_notebooks_workspace_idx
  ON ai_notebooks (workspace_id);

CREATE TABLE IF NOT EXISTS ai_notebook_notes (
  id serial PRIMARY KEY,
  notebook_id integer NOT NULL REFERENCES ai_notebooks(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_notebook_notes_notebook_idx
  ON ai_notebook_notes (notebook_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_notebook_links (
  id serial PRIMARY KEY,
  notebook_id integer NOT NULL REFERENCES ai_notebooks(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  conversation_id integer REFERENCES ai_coach_conversations(id) ON DELETE CASCADE,
  file_id integer REFERENCES ai_workspace_files(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_notebook_links_target_check CHECK (
    (link_type = 'conversation' AND conversation_id IS NOT NULL AND file_id IS NULL) OR
    (link_type = 'file' AND file_id IS NOT NULL AND conversation_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS ai_notebook_links_notebook_idx
  ON ai_notebook_links (notebook_id);
