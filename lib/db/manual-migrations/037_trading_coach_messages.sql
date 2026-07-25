-- v1.3.0, Sprint 1 — AI Trading Coach, Backend Foundation
-- (see docs/v1.3.0-AI-Trading-Coach-Design.md).
--
-- trading_coach_messages persists the free-form AI Trading Coach's
-- conversation history, mirroring ai_messages' own established shape
-- (id/user_id/role/message/created_at + a user_id index) exactly — a
-- deliberate, disclosed choice (design doc §11) to use a NEW, dedicated
-- table rather than retrofit ai_messages itself: ai_messages is the
-- Options Coach's (Assistant.tsx) own single, undifferentiated
-- conversation thread with no engine/source discriminator column, and
-- reusing those same rows for a second, unrelated coach would mix two
-- distinct conversations in one stream. Brand-new table, NOT NULL from
-- creation, no backfill needed (same precedent as platform_audit_log /
-- investing_filing_analysis / compliance_policies / investing_watchlists
-- / portfolio_workspace).
--
-- user_id -> users.id stays the universal ON DELETE RESTRICT convention.

CREATE TABLE IF NOT EXISTS trading_coach_messages (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trading_coach_messages_user_id_idx
  ON trading_coach_messages (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS trading_coach_messages;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- this table.
