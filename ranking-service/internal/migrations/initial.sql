-- Migration script for user_scores table
CREATE TABLE IF NOT EXISTS user_scores (
    user_id UUID NOT NULL,
    game_id VARCHAR(100) NOT NULL DEFAULT 'global', -- Default for overall ranking, or specify game IDs
    score INTEGER NOT NULL DEFAULT 1000, -- Example starting score
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id)
    -- Potentially references users(id) in your User Service DB if in same DB cluster and allowed.
    -- Otherwise, user_id is just an identifier.
);

CREATE INDEX IF NOT EXISTS idx_user_scores_game_id_score ON user_scores (game_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_scores_updated_at ON user_scores (updated_at DESC);