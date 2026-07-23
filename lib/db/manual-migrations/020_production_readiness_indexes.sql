-- Phase 9 — Production Readiness. Three purely additive indexes closing
-- real, evidence-based gaps found during the DB efficiency audit (grepped
-- query patterns against journal_entries/scanner_results/trades). No ALTER
-- of column types/constraints, no data change, no application behavior
-- change — every query these support already returns the exact same rows
-- today, just via a sequential/partial-index scan instead of an index-only
-- lookup. Safe to run against a live database with existing rows.
--
-- Deliberately does NOT touch auto_execution_log — CLAUDE.md rule 3
-- forbids modifying that table "as part of general audit-log work,"
-- regardless of how compelling an indexing case might be.

-- tradeJournal.ts's linkedJournalEntriesFor() filters journal_entries by
-- trade_id for every trade shown on the Trade History/Performance pages;
-- this column previously had no index of its own.
CREATE INDEX IF NOT EXISTS journal_entries_trade_id_idx
  ON journal_entries (trade_id);

-- routes/scanner.ts's GET /scanner (the default scanner view) filters
-- scanner_results on `and(eq(status, 'active'), eq(user_id, ...))` — this
-- composite lets that query be satisfied from the index alone.
CREATE INDEX IF NOT EXISTS scanner_results_user_id_status_idx
  ON scanner_results (user_id, status);

-- `and(eq(status, ...), eq(user_id, ...))` is the single most common query
-- shape against trades (Portfolio, Trades list, the daily report, the
-- automation scheduler's own candidate/position lookups, position sizing,
-- trade adjustment preview, getAccountValue's realized-P&L sum) — this
-- composite covers all of them.
CREATE INDEX IF NOT EXISTS trades_user_id_status_idx
  ON trades (user_id, status);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP INDEX IF EXISTS journal_entries_trade_id_idx;
--   DROP INDEX IF EXISTS scanner_results_user_id_status_idx;
--   DROP INDEX IF EXISTS trades_user_id_status_idx;
-- Safe: purely additive indexes, dropping them only returns query planning
-- to its pre-Phase-9 behavior — no data loss, no application code depends
-- on their existence (Drizzle's own schema-level index() calls are
-- metadata only; nothing throws if the underlying index is absent).
