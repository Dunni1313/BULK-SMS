-- Trade History, Performance Analytics & Trading Journal sprint.
--
-- journal_entries gains two new, purely additive, nullable columns:
-- thesis and entry_reasoning. The existing content/lesson_learned/
-- exit_reason columns already cover general notes/lessons/why-a-trade-was-
-- closed; "Thesis" (the case for taking the trade) and "Entry Reasoning"
-- (what specifically triggered entry) are genuinely distinct concepts this
-- schema didn't have a home for. Nullable forever, no backfill/enforce
-- needed — every existing row simply has neither, honestly, and the
-- Trade History page's own journal-editing panel is how a user fills them
-- in going forward.

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS thesis TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS entry_reasoning TEXT;

-- ─── Rollback ────────────────────────────────────────────────────────────
-- Purely additive — safe to drop independently of any code rollback:
--
--   ALTER TABLE journal_entries DROP COLUMN IF EXISTS thesis;
--   ALTER TABLE journal_entries DROP COLUMN IF EXISTS entry_reasoning;
