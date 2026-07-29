-- v1.5.0, Sprint 7 — AI Workspaces.
--
-- Reusable research projects grouping conversations, saved research, file
-- references, and AI context for the three existing conversational AI
-- Coaches (Trading, Investing, Options) built on top of Sprint 6's
-- conversation memory (ai_coach_conversations / ai_coach_messages).
-- Portfolio remains excluded (no conversational coach exists there).
--
-- Per the approved Sprint 7 scope ("reuse Sprint 6 tables where possible,
-- do not duplicate conversation storage"), conversations themselves are
-- NOT re-stored anywhere new — ai_coach_conversations (Sprint 6) gains two
-- small, nullable, additive columns instead:
--
--   workspace_id — optional membership in a workspace. Nullable so every
--   existing conversation (created before this sprint, or created without
--   ever being assigned to a workspace) keeps working identically —
--   "Existing conversation functionality unchanged" is a hard requirement.
--   ON DELETE SET NULL, deliberately NOT CASCADE: deleting a workspace is
--   organisational cleanup of a grouping, never a reason to destroy a
--   user's own actual conversation history — the conversation and its full
--   message history simply detach back to the top-level, un-grouped list.
--
--   favourite — a plain per-conversation flag, independent of workspace
--   membership (a conversation can be favourited whether or not it belongs
--   to a workspace). Default false, matching every other boolean flag's
--   own established default-safe convention in this codebase.
--
-- Three brand-new tables, all NOT NULL from creation (zero existing rows,
-- same precedent as ai_coach_conversations/ai_coach_messages themselves,
-- Sprint 6):
--
--   ai_workspaces — one row per workspace. coach_id is free text, not a DB
--   enum, restricted at the application layer to the same three coach ids
--   Sprint 6 already established (see routes/aiCoachConversations.ts's own
--   COACH_IDS, reused directly, not redefined) — a workspace belongs to
--   exactly one coach, matching the "Support only the existing
--   conversational coaches" scope.
--
--   ai_workspace_files — file REFERENCES ONLY (a name + an external URL/
--   note) — this codebase has no binary file-upload/storage infrastructure
--   anywhere, and building one is explicitly out of this sprint's scope;
--   never a fabricated upload capability. ON DELETE CASCADE from its
--   workspace: a file reference has no meaning independent of the
--   workspace it was attached to, the same precedent as
--   ai_coach_messages -> ai_coach_conversations (Sprint 6).
--
--   ai_workspace_notes — quick notes, saved AI summaries, saved
--   conclusions, and saved action items are all the same shape (a kind +
--   free text), so this is one table discriminated by `kind`, not four —
--   the smallest schema that satisfies all four "Research Features" bullet
--   points, matching this project's own established free-text-discriminator
--   convention (e.g. investing_filing_analysis.filing_type). ON DELETE
--   CASCADE from its workspace, same reasoning as ai_workspace_files.
--
-- Neither ai_workspace_files nor ai_workspace_notes carries its own
-- user_id — ownership is transitively via workspace_id ->
-- ai_workspaces.user_id, the exact same no-redundant-denormalization
-- pattern ai_coach_messages already established relative to
-- ai_coach_conversations.user_id (Sprint 6).
--
-- ai_workspaces is created FIRST, before ai_coach_conversations' own new
-- workspace_id column is added, since that column's FK target must already
-- exist.

CREATE TABLE IF NOT EXISTS ai_workspaces (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  coach_id text NOT NULL,
  name text NOT NULL,
  description text,
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_workspaces_user_coach_idx
  ON ai_workspaces (user_id, coach_id, updated_at DESC);

ALTER TABLE ai_coach_conversations
  ADD COLUMN IF NOT EXISTS workspace_id integer REFERENCES ai_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS favourite boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ai_coach_conversations_workspace_idx
  ON ai_coach_conversations (workspace_id);

CREATE TABLE IF NOT EXISTS ai_workspace_files (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL REFERENCES ai_workspaces(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_workspace_files_workspace_idx
  ON ai_workspace_files (workspace_id);

CREATE TABLE IF NOT EXISTS ai_workspace_notes (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL REFERENCES ai_workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_workspace_notes_workspace_idx
  ON ai_workspace_notes (workspace_id, created_at DESC);
