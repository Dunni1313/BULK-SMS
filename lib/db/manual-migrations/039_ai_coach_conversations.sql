-- v1.5.0, Sprint 6 — AI Coach Memory.
--
-- Persistent conversation memory for the three existing conversational AI
-- Coaches (Trading, Investing, Options). Neither of the two pre-existing
-- message-persistence tables (ai_messages, trading_coach_messages) supports
-- grouping messages into multiple, named, resumable conversations, and
-- trading_coach_messages specifically belongs to the separate, out-of-scope
-- "AI Trading Assistant" feature (v1.3.0) — so per the approved Sprint 6
-- scope, this introduces the smallest new schema needed rather than
-- retrofitting either existing table.
--
-- Two new tables, both brand new (NOT NULL from creation, zero backfill
-- needed):
--
--   ai_coach_conversations — one row per conversation thread. coach_id is
--   free text (not a DB enum), restricted at the application layer to
--   "trading" | "investing" | "options" (matching this codebase's own
--   established free-text-discriminator convention, e.g.
--   investing_filing_analysis.filing_type). Every list/read/write is scoped
--   by (user_id, coach_id) together, which is what guarantees conversation
--   isolation between coaches — a Trading conversation can never be listed,
--   fetched, or resumed from the Investing or Options coach, because every
--   query filters on both columns.
--
--   ai_coach_messages — one row per turn (a user question or an assistant
--   answer), referencing its parent conversation. ON DELETE CASCADE:
--   deleting a conversation is expected to delete its own messages outright
--   (the same precedent as investing_holdings -> investing_portfolios,
--   Phase 13's own portfolio-owns-holdings cascade) — this is a strictly
--   owned child row, not a shared or independently-referenced one.
--
-- Deliberately NOT stored anywhere in either table (per the approved
-- scope): internal system prompts, tool/grounding-context payloads, or any
-- secret value. Only the final, already-narrated user-visible question and
-- answer text is ever written.

CREATE TABLE IF NOT EXISTS ai_coach_conversations (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  coach_id text NOT NULL,
  title text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_coach_conversations_user_coach_idx
  ON ai_coach_conversations (user_id, coach_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_coach_messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES ai_coach_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_coach_messages_conversation_idx
  ON ai_coach_messages (conversation_id, created_at ASC);
