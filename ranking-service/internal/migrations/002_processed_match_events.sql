CREATE TABLE IF NOT EXISTS processed_match_events (
    match_id UUID PRIMARY KEY,
    tournament_id UUID NOT NULL,
    game_id VARCHAR(255) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processed_match_events_tournament_game ON processed_match_events(tournament_id, game_id);