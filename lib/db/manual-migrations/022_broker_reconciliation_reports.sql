-- Phase 11 — Live Market Operations & Production Validation.
-- broker_reconciliation_reports.
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation (except unavailable_reason, genuinely optional),
-- no backfill needed (zero existing rows), same precedent as
-- dashboard_workspaces/platform_notifications.
--
-- Persists a snapshot of a GET /broker/reconciliation run (local trades
-- vs. Alpaca Paper Trading orders/positions), written only when a user
-- explicitly triggers POST /broker/reconciliation/reports — never on a
-- timer, never automatically.
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention.
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch — purely a read-only
-- observability record.

CREATE TABLE IF NOT EXISTS broker_reconciliation_reports (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  generated_at timestamptz NOT NULL,
  available boolean NOT NULL,
  unavailable_reason text,
  local_orders_considered integer NOT NULL,
  broker_orders_considered integer NOT NULL,
  issue_count integer NOT NULL,
  fully_reconciled boolean NOT NULL,
  detail_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broker_reconciliation_reports_user_id_idx
  ON broker_reconciliation_reports (user_id);

-- Rollback:
-- DROP TABLE IF EXISTS broker_reconciliation_reports;
