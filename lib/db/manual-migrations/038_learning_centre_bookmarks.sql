-- v1.4.0, Sprint L1 — Learning Centre Foundation.
-- Adds bookmark support to the existing learning_progress table (Phase 8
-- Sprint 2), per the approved v1.4.0 architecture blueprint: "one additive
-- nullable bookmarked_at column on the existing table," not a new table
-- and not a new item type. A bookmark is an attribute of an existing
-- (userId, itemType, itemKey) row, set independently of viewedAt/completedAt.
-- Purely additive, nullable, no backfill needed (NULL = never bookmarked).

ALTER TABLE learning_progress
  ADD COLUMN IF NOT EXISTS bookmarked_at timestamptz;
