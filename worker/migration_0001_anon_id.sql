-- =============================================================================
-- Migration: add anon_id to comments (needed for self-service delete)
-- Your comments table was already created without this column — run this once:
--   wrangler d1 execute wuskaloosa-comments --remote --file=migration_0001_anon_id.sql
-- Safe to run only once; re-running will error with "duplicate column name",
-- which just means it already applied.
-- =============================================================================

ALTER TABLE comments ADD COLUMN anon_id TEXT;
CREATE INDEX IF NOT EXISTS idx_comments_anon ON comments(anon_id);
