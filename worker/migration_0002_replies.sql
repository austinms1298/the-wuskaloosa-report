-- =============================================================================
-- Migration: threaded replies — adds parent_id to comments
-- Run once, BEFORE deploying the updated worker:
--   cd worker && npx wrangler d1 execute wuskaloosa-comments --remote --file=migration_0002_replies.sql
-- Safe to run only once; re-running errors with "duplicate column name",
-- which just means it already applied.
-- =============================================================================

ALTER TABLE comments ADD COLUMN parent_id TEXT;
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
