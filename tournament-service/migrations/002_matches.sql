-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    participant1_id UUID REFERENCES tournament_participants(id),
    participant2_id UUID REFERENCES tournament_participants(id),
    winner_id UUID REFERENCES tournament_participants(id),
    loser_id UUID REFERENCES tournament_participants(id),
    score_participant1 INTEGER DEFAULT 0,
    score_participant2 INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    scheduled_time TIMESTAMP,
    completed_time TIMESTAMP,
    next_match_id UUID REFERENCES matches(id),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    match_notes TEXT,
    match_proofs JSONB,
    CONSTRAINT unique_match_number UNIQUE (tournament_id, round, match_number)
);

-- Create indexes
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX idx_matches_participant1_id ON matches(participant1_id);
CREATE INDEX idx_matches_participant2_id ON matches(participant2_id);
CREATE INDEX idx_matches_round ON matches(tournament_id, round);
CREATE INDEX idx_matches_status ON matches(status);

-- Add rollback
-- DROP TABLE IF EXISTS matches; 