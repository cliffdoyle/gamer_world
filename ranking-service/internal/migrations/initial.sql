-- Add this to your ranking database schema (e.g., in a migrations file)
CREATE TABLE IF NOT EXISTS user_tournament_participation (
    user_id UUID NOT NULL,
    game_id VARCHAR(255) NOT NULL,
    tournament_id UUID NOT NULL,
    first_played_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id, tournament_id),
    FOREIGN KEY (user_id, game_id) REFERENCES user_scores(user_id, game_id) ON DELETE CASCADE -- Optional: If user_scores is the primary source
);

-- Optional: Index for querying tournaments_played efficiently if not using FOREIGN KEY constraint above for that purpose
-- CREATE INDEX IF NOT EXISTS idx_utp_user_game ON user_tournament_participation(user_id, game_id);

-- Also, ensure your user_scores table exists (based on your repo code):
CREATE TABLE IF NOT EXISTS user_scores (
    user_id UUID NOT NULL,
    game_id VARCHAR(255) NOT NULL,
    score INT DEFAULT 0,
    matches_played INT DEFAULT 0,
    matches_won INT DEFAULT 0,
    matches_drawn INT DEFAULT 0,
    matches_lost INT DEFAULT 0,
    -- tournaments_played INT DEFAULT 0, -- This can be removed if calculated on-the-fly or from user_tournament_participation
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id)
);