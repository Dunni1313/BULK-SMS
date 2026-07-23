-- Phase 10 — Institutional Platform Polish & Control Center.
-- dashboard_workspaces.
--
-- Purely additive: one brand-new table, no ALTER on any existing table.
-- NOT NULL from creation (except nothing — every column here has a
-- sensible default or is genuinely required), no backfill needed (zero
-- existing rows), same precedent as platform_notifications/
-- learning_progress.
--
-- Backs both the Workspace System (named, saved widget layouts —
-- save/rename/duplicate/delete/switch) and the Personal Dashboard
-- (pin/hide/reorder/resize widgets on the Institutional Home page),
-- since a personalized dashboard is simply the currently-active
-- workspace's own widget config.
--
-- user_id is mandatory, ON DELETE RESTRICT: matches every other
-- user-scoped table's convention.
--
-- The partial unique index on (user_id) WHERE is_active guarantees at
-- most one active workspace per user — the same "partial unique index
-- enforces at most one of X" pattern platform_notifications' own
-- dedup_key index already established (014_platform_notifications.sql).
--
-- This table is never read or written by the auto-execution/auto-
-- adjustment engines or their kill switch — purely a UI personalization
-- concern.

CREATE TABLE IF NOT EXISTS dashboard_workspaces (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  widget_config jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_workspaces_user_id_idx
  ON dashboard_workspaces (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_workspaces_user_name_idx
  ON dashboard_workspaces (user_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_workspaces_active_idx
  ON dashboard_workspaces (user_id)
  WHERE is_active = true;

-- ─── Rollback ────────────────────────────────────────────────────────────
--   DROP TABLE IF EXISTS dashboard_workspaces;
-- Safe: nothing outside this phase's own new code paths reads or writes
-- this table.
