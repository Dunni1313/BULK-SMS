-- Phase 1, Sprint 3 — adds a nullable user_id column to all 13 user-scoped
-- tables (per the approved Phase 1 Foundation plan, §2.1, §2.5 step 3).
--
-- Nullable, no default, no foreign key, no index yet. Existing rows get NULL.
-- Nothing in the application reads or writes user_id yet, so applying this
-- migration has zero effect on any current route or behavior — it is purely
-- schema preparation for the backfill (Sprint 4) and enforcement (Sprint 4/5)
-- steps that follow.
--
-- Excluded: auto_execution_log (explicitly out of scope for all of Phase 1,
-- per the plan's §6 and §2.1).
--
-- Mirrors the userId field added to each corresponding file in
-- lib/db/src/schema/ — keep both in sync by hand, per this project's
-- convention (see 000_create_users_table.sql).
--
-- Run this against a full pg_dump backup taken immediately beforehand, per
-- the plan's §2.6 "Full safety net" — non-negotiable for a change touching
-- every table, even though this step itself is additive and non-breaking.

ALTER TABLE scanner_results        ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE trades                 ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE backtest_results       ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE journal_entries        ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE ai_messages            ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE settings               ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE ai_lessons             ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE trade_explanations     ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE greeks_quiz_results    ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE daily_reports          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE stock_analysis_history ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE value_watchlist        ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE value_quiz_results      ADD COLUMN IF NOT EXISTS user_id uuid;

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Safe at this stage: no row's user_id is read or depended on yet, so
-- dropping the column loses nothing (per the plan's §2.6, "after step 3").
--
--   ALTER TABLE scanner_results        DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE trades                 DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE backtest_results       DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE journal_entries        DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE ai_messages            DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE settings               DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE ai_lessons             DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE trade_explanations     DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE greeks_quiz_results    DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE daily_reports          DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE stock_analysis_history DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE value_watchlist        DROP COLUMN IF EXISTS user_id;
--   ALTER TABLE value_quiz_results     DROP COLUMN IF EXISTS user_id;
