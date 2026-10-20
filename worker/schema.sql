-- =============================================================================
-- Wuskaloosa Report — Comments D1 Schema
-- Apply with:  wrangler d1 execute wuskaloosa-comments --remote --file=worker/schema.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS comments (
  id                 TEXT PRIMARY KEY,
  post_slug          TEXT NOT NULL,
  name               TEXT NOT NULL,
  body               TEXT NOT NULL,
  created_at         INTEGER NOT NULL,          -- unix ms
  status             TEXT NOT NULL DEFAULT 'approved',  -- approved | rejected
  moderation_reason  TEXT,
  moderation_category TEXT,
  like_count         INTEGER NOT NULL DEFAULT 0,
  ip_hash            TEXT                        -- sha-256 of IP, never the raw IP
);

CREATE INDEX IF NOT EXISTS idx_comments_post_status_created
  ON comments(post_slug, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_post_status_likes
  ON comments(post_slug, status, like_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_ip_created
  ON comments(ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS comment_likes (
  id          TEXT PRIMARY KEY,
  comment_id  TEXT NOT NULL,
  anon_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE(comment_id, anon_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_likes_anon ON comment_likes(anon_id);
