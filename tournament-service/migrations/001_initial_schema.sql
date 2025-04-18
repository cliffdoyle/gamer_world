-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    game VARCHAR(255) NOT NULL,
    format VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    max_participants INTEGER NOT NULL,
    registration_deadline TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rules TEXT,
    prize_pool JSONB,
    custom_fields JSONB
);

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    seed INTEGER,
    status VARCHAR(50) NOT NULL,
    is_waitlisted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tournament_id, user_id)
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    participant1_id UUID REFERENCES participants(id),
    participant2_id UUID REFERENCES participants(id),
    winner_id UUID REFERENCES participants(id),
    loser_id UUID REFERENCES participants(id),
    score_participant1 INTEGER,
    score_participant2 INTEGER,
    status VARCHAR(50) NOT NULL,
    scheduled_time TIMESTAMP,
    completed_time TIMESTAMP,
    next_match_id UUID REFERENCES matches(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    match_notes TEXT,
    match_proofs JSONB
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_participants_tournament ON participants(tournament_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_messages_tournament ON messages(tournament_id);
CREATE INDEX idx_matches_next_match ON matches(next_match_id); 