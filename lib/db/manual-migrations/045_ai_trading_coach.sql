-- v1.6.0 Sprint 1 — AI Trading Coach Guided Workflow.
--
-- Two brand-new, purely additive tables. Per the sprint's own mandatory
-- reuse audit (docs/v1.6.0-Sprint-01-AI-Trading-Coach-Guided-Workflow.md
-- §"State and Persistence"), no existing table can be reused as-is:
-- ai_coach_conversations/ai_workspaces/ai_notebooks (migrations 039-041)
-- have no day-scoping or experience-level concept; intelligence_snapshots
-- (018) is the closest (userId, snapshotDate) precedent but its columns
-- are portfolio-health-specific; portfolio_workflow_instances (036) is
-- the closest "workflow state" precedent (userId, workflowKey,
-- completedStepKeys jsonb) but is not day-scoped. Both new tables here
-- follow those two precedents' own conventions directly rather than
-- inventing new ones.
--
-- ai_trading_coach_preferences — ONE row per user, durable across
-- sessions (never resets daily). This is the sprint's own genuinely new
-- persistence requirement: no Settings field, no per-page useState, and
-- no other table anywhere in this codebase persists a user's coaching
-- "experience level" (confirmed by direct audit — CoachLevel/
-- LearningDifficulty are both ephemeral, reset-on-every-page-load
-- component state today). Deliberately a small sibling table, not a
-- new Settings column: every other AI-coach-family table
-- (ai_coach_conversations/ai_workspaces/ai_notebooks/ai_strategies/
-- trade_plans) is kept outside the OpenAPI/orval typed contract and
-- hand-validated, specifically to avoid the exact zod dependency-
-- conflict risk Sprint 6 already found and disclosed when it tried
-- routing through Settings-style OpenAPI codegen; adding this field to
-- `settings` would have broken that established discipline for no
-- benefit.
--
-- ai_trading_coach_daily_state — the actual daily checklist/workflow
-- progress record, one row per (userId, tradingDate), mirroring
-- intelligence_snapshots' own (userId, snapshotDate) unique-upsert
-- pattern exactly. `tradingDate` is a YYYY-MM-DD string computed in the
-- America/New_York timezone (the platform's one existing "trading day"
-- concept, reused from lib/marketCalendar.ts's own ET_TIME_ZONE
-- constant — no new per-user timezone field was introduced, since none
-- exists anywhere in this codebase and inventing one was out of this
-- sprint's own scope). completedStepIds/skippedStepIds are jsonb
-- string arrays of DailyWorkflowStepId values (the 11-step model this
-- sprint's own lib/tradingCoachWorkflow.ts defines) — never store hidden
-- chain-of-thought, internal model reasoning, secrets, or duplicate
-- trading calculations here; every other figure the guided workflow
-- displays (portfolio health, decision score, trade lifecycle stage,
-- market status, etc.) is read live from its own existing, unmodified
-- module and never persisted a second time in this table.
--
-- Both tables NOT NULL from creation except the genuinely-optional
-- noTradeReason, no backfill needed (zero existing rows), same
-- precedent as every other brand-new table in this codebase's history.
-- user_id mandatory + ON DELETE RESTRICT on both, matching every other
-- user-scoped table's convention. Neither table is read or written by
-- the auto-execution/auto-adjustment engines or their kill switch — this
-- is a purely advisory, informational surface.

CREATE TABLE IF NOT EXISTS ai_trading_coach_preferences (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  experience_level text NOT NULL DEFAULT 'beginner',
  beginner_mode_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_trading_coach_preferences_user_id_idx
  ON ai_trading_coach_preferences (user_id);

CREATE TABLE IF NOT EXISTS ai_trading_coach_daily_state (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  trading_date text NOT NULL,
  completed_step_ids jsonb NOT NULL DEFAULT '[]',
  skipped_step_ids jsonb NOT NULL DEFAULT '[]',
  no_trade_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_trading_coach_daily_state_user_id_idx
  ON ai_trading_coach_daily_state (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS ai_trading_coach_daily_state_user_date_idx
  ON ai_trading_coach_daily_state (user_id, trading_date);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS ai_trading_coach_daily_state;
--   DROP TABLE IF EXISTS ai_trading_coach_preferences;
-- Safe: nothing outside this sprint's own new code paths reads or writes
-- either table.
