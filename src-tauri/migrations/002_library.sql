CREATE TABLE IF NOT EXISTS library_state(media_id TEXT PRIMARY KEY REFERENCES media_items(id) ON DELETE CASCADE,favorite INTEGER NOT NULL DEFAULT 0,watchlist INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS playback_progress(media_id TEXT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,episode_id TEXT NOT NULL DEFAULT '',position REAL NOT NULL,duration REAL NOT NULL,updated_at INTEGER NOT NULL DEFAULT(unixepoch()),PRIMARY KEY(media_id,episode_id));
CREATE INDEX IF NOT EXISTS idx_progress_updated ON playback_progress(updated_at DESC);
PRAGMA user_version=2;
