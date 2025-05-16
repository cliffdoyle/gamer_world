-- 1. For user scores and basic stats
CREATE TABLE IF NOT EXISTS user_scores (
    user_id UUID NOT NULL,
    game_id VARCHAR(255) NOT NULL,
    score INT DEFAULT 0,
    matches_played INT DEFAULT 0,
    matches_won INT DEFAULT 0,
    matches_drawn INT DEFAULT 0,
    matches_lost INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id)
);

-- 2. For idempotency of processing match events
CREATE TABLE IF NOT EXISTS processed_match_events (
    match_id UUID PRIMARY KEY,
    tournament_id UUID NOT NULL, -- Store tournament_id for context if needed
    game_id VARCHAR(255) NOT NULL, -- Store game_id for context
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
-- Optional index if you query this table often by other fields:
CREATE INDEX IF NOT EXISTS idx_pme_tournament_game ON processed_match_events(tournament_id, game_id);


-- 3. For tracking unique tournament participations by user (THIS IS THE MISSING ONE)
CREATE TABLE IF NOT EXISTS user_tournament_participation (
    user_id UUID NOT NULL,
    game_id VARCHAR(255) NOT NULL,          -- Game for which this participation counts
    tournament_id UUID NOT NULL,            -- The ID of the tournament they participated in
    first_played_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, -- When this participation was first recorded
    PRIMARY KEY (user_id, game_id, tournament_id)
    -- Optional FOREIGN KEY if user_scores is the main table and participation should cascade.
    -- FOREIGN KEY (user_id, game_id) REFERENCES user_scores(user_id, game_id) ON DELETE CASCADE
);
-- Optional: Index for querying tournaments_played efficiently by user_id and game_id
CREATE INDEX IF NOT EXISTS idx_utp_user_game ON user_tournament_participation(user_id, game_id);