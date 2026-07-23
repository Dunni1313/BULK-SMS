-- Phase 22 — Institutional Reporting & Client Presentation Engine.
--
-- institutional_reports: a user-saved, point-in-time snapshot of a
-- generated InstitutionalReport (lib/institutionalReporting.ts). Mirrors
-- daily_reports' own headline-columns-plus-jsonb-payload pattern exactly —
-- `payload` holds the FULL structured report, the scalar columns exist only
-- so a history/list view can query cheaply without deserialising `payload`.
--
-- Brand-new table: NOT NULL from creation except the genuinely-nullable
-- symbol/portfolio_id (a report type may be scoped to neither, e.g. the
-- Watchlist Report or the AI Coach Learning Summary). user_id is mandatory
-- + ON DELETE RESTRICT (universal convention, same as every other
-- user-owned history table since Sprint 4). No foreign key on portfolio_id
-- — a loose, unenforced reference (mirrors journal_entries.trade_id's and
-- trading_journal_entries.trading_position_id's own established precedent)
-- so a saved report survives even if the portfolio it was generated from is
-- later deleted or renamed.

CREATE TABLE IF NOT EXISTS institutional_reports (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  report_type text NOT NULL,
  title text NOT NULL,
  symbol text,
  portfolio_id integer,
  data_source text NOT NULL DEFAULT 'MIXED',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_reports_user_id_idx
  ON institutional_reports (user_id);
CREATE INDEX IF NOT EXISTS institutional_reports_report_type_idx
  ON institutional_reports (report_type);

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS institutional_reports;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- this table.
