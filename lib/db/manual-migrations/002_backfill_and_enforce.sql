-- Phase 1, Sprint 4 — backfill legacy data to a single "legacy owner" user,
-- then enforce NOT NULL + FK + index on user_id for the 12 non-settings
-- user-scoped tables (per the approved Phase 1 Foundation plan, §2.5 steps
-- 4-5). `settings` is deliberately excluded — its backfill/enforce ships
-- together with the getOrCreateSettings(userId) code change in Sprint 5,
-- per §2.3. `auto_execution_log` remains out of scope for all of Phase 1.
--
-- Owner Decision #4 (plan §11) is resolved: dunnikarp@gmail.com owns all
-- pre-existing single-tenant data as "user #1".
--
-- Run this against a full pg_dump backup taken immediately beforehand, per
-- the plan's §2.6 "Full safety net" — non-negotiable before this touches
-- anything beyond a dev database.

-- ─── Step 1: create the legacy owner user (idempotent) ────────────────────
INSERT INTO users (email, display_name, role)
VALUES ('dunnikarp@gmail.com', 'Legacy Owner', 'user')
ON CONFLICT (email) DO NOTHING;

-- ─── Step 2: backfill every existing row to the legacy owner ──────────────
UPDATE scanner_results        SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE trades                 SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE backtest_results       SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE journal_entries        SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE ai_messages            SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE ai_lessons             SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE trade_explanations     SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE greeks_quiz_results    SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE daily_reports          SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE stock_analysis_history SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE value_watchlist        SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;
UPDATE value_quiz_results     SET user_id = (SELECT id FROM users WHERE email = 'dunnikarp@gmail.com') WHERE user_id IS NULL;

-- ─── Step 3: verification gate ─────────────────────────────────────────────
-- Run this SELECT and confirm every count is 0 BEFORE running Step 4 below.
-- This is the plan's explicit gate (§2.5 step 5): enforcement only proceeds
-- once zero rows remain with a NULL user_id.
SELECT 'scanner_results' AS table_name, COUNT(*) FROM scanner_results WHERE user_id IS NULL
UNION ALL SELECT 'trades', COUNT(*) FROM trades WHERE user_id IS NULL
UNION ALL SELECT 'backtest_results', COUNT(*) FROM backtest_results WHERE user_id IS NULL
UNION ALL SELECT 'journal_entries', COUNT(*) FROM journal_entries WHERE user_id IS NULL
UNION ALL SELECT 'ai_messages', COUNT(*) FROM ai_messages WHERE user_id IS NULL
UNION ALL SELECT 'ai_lessons', COUNT(*) FROM ai_lessons WHERE user_id IS NULL
UNION ALL SELECT 'trade_explanations', COUNT(*) FROM trade_explanations WHERE user_id IS NULL
UNION ALL SELECT 'greeks_quiz_results', COUNT(*) FROM greeks_quiz_results WHERE user_id IS NULL
UNION ALL SELECT 'daily_reports', COUNT(*) FROM daily_reports WHERE user_id IS NULL
UNION ALL SELECT 'stock_analysis_history', COUNT(*) FROM stock_analysis_history WHERE user_id IS NULL
UNION ALL SELECT 'value_watchlist', COUNT(*) FROM value_watchlist WHERE user_id IS NULL
UNION ALL SELECT 'value_quiz_results', COUNT(*) FROM value_quiz_results WHERE user_id IS NULL;

-- ─── Step 4: enforce NOT NULL, add FK (ON DELETE RESTRICT), add index ──────
-- Per §2.4: RESTRICT, not CASCADE — deleting a user must never silently
-- delete their trade/journal/report history.

ALTER TABLE scanner_results ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE scanner_results ADD CONSTRAINT scanner_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS scanner_results_user_id_idx ON scanner_results (user_id);

ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trades ADD CONSTRAINT trades_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS trades_user_id_idx ON trades (user_id);

ALTER TABLE backtest_results ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE backtest_results ADD CONSTRAINT backtest_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS backtest_results_user_id_idx ON backtest_results (user_id);

ALTER TABLE journal_entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS journal_entries_user_id_idx ON journal_entries (user_id);

ALTER TABLE ai_messages ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_messages ADD CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ai_messages_user_id_idx ON ai_messages (user_id);

ALTER TABLE ai_lessons ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_lessons ADD CONSTRAINT ai_lessons_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ai_lessons_user_id_idx ON ai_lessons (user_id);

ALTER TABLE trade_explanations ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trade_explanations ADD CONSTRAINT trade_explanations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS trade_explanations_user_id_idx ON trade_explanations (user_id);

ALTER TABLE greeks_quiz_results ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE greeks_quiz_results ADD CONSTRAINT greeks_quiz_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS greeks_quiz_results_user_id_idx ON greeks_quiz_results (user_id);

ALTER TABLE daily_reports ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS daily_reports_user_id_idx ON daily_reports (user_id);

ALTER TABLE stock_analysis_history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE stock_analysis_history ADD CONSTRAINT stock_analysis_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS stock_analysis_history_user_id_idx ON stock_analysis_history (user_id);

ALTER TABLE value_watchlist ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE value_watchlist ADD CONSTRAINT value_watchlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS value_watchlist_user_id_idx ON value_watchlist (user_id);

ALTER TABLE value_quiz_results ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE value_quiz_results ADD CONSTRAINT value_quiz_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS value_quiz_results_user_id_idx ON value_quiz_results (user_id);

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Per §2.6 "after step 5": drop the FK and NOT NULL constraints before
-- dropping the column. Zero application-data loss — user_id values are
-- discarded, not the rows themselves.
--
--   ALTER TABLE scanner_results        DROP CONSTRAINT IF EXISTS scanner_results_user_id_fkey;
--   ALTER TABLE trades                 DROP CONSTRAINT IF EXISTS trades_user_id_fkey;
--   ALTER TABLE backtest_results       DROP CONSTRAINT IF EXISTS backtest_results_user_id_fkey;
--   ALTER TABLE journal_entries        DROP CONSTRAINT IF EXISTS journal_entries_user_id_fkey;
--   ALTER TABLE ai_messages            DROP CONSTRAINT IF EXISTS ai_messages_user_id_fkey;
--   ALTER TABLE ai_lessons             DROP CONSTRAINT IF EXISTS ai_lessons_user_id_fkey;
--   ALTER TABLE trade_explanations     DROP CONSTRAINT IF EXISTS trade_explanations_user_id_fkey;
--   ALTER TABLE greeks_quiz_results    DROP CONSTRAINT IF EXISTS greeks_quiz_results_user_id_fkey;
--   ALTER TABLE daily_reports          DROP CONSTRAINT IF EXISTS daily_reports_user_id_fkey;
--   ALTER TABLE stock_analysis_history DROP CONSTRAINT IF EXISTS stock_analysis_history_user_id_fkey;
--   ALTER TABLE value_watchlist        DROP CONSTRAINT IF EXISTS value_watchlist_user_id_fkey;
--   ALTER TABLE value_quiz_results     DROP CONSTRAINT IF EXISTS value_quiz_results_user_id_fkey;
--
--   -- Then, per table: ALTER TABLE <table> ALTER COLUMN user_id DROP NOT NULL;
--   -- Then, per table: ALTER TABLE <table> DROP COLUMN user_id;
--   -- (indexes are dropped automatically when the column is dropped)
