--Enum types for statuses and formats
CREATE TYPE tournament_format AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION','ROUND_ROBIN','SWISS');
CREATE TYPE tournament_status AS ENUM ('DRAFT', 'REGISTRATION','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE match_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED','DISPUTED');
CREATE TYPE participant_status AS ENUM ('REGISTERED', 'WAITLISTED', 'CHECKED_IN', 'ELIMINATED');

--Tournaments table
CREATE TABLE IF NOT EXISTS tournaments(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    game VARCHAR(100) NOT NULL,
    format tournament_format NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    status tournament_status NOT NULL DEFAULT 'DRAFT',
    max_participants INT,
    registration_deadline TIMESTAMP WITH TIME ZONE,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    rules TEXT,
    prize_pool JSONB,
    custom_fields JSONB
    );

--Tournament participants
CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    team_name VARCHAR(100),
    seed INT,
    status participant_status NOT NULL DEFAULT 'REGISTERED',
    is_waitlisted BOOLEAN DEFAULT FALSE,
    check_in_time TIMESTAMP WITH TIME ZONE,
    is_checked_in BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
);

-- Tournament matches
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INT NOT NULL,
    match_number INT NOT NULL,
    participant1_id UUID REFERENCES tournament_participants(id),
    participant2_id UUID REFERENCES tournament_participants(id),
    winner_id UUID REFERENCES tournament_participants(id),
    loser_id UUID REFERENCES tournament_participants(id),
    score_participant1 INT,
    score_participant2 INT,
    status match_status NOT NULL DEFAULT 'PENDING',
    scheduled_time TIMESTAMP WITH TIME ZONE,
    completed_time TIMESTAMP WITH TIME ZONE,
    next_match_id UUID REFERENCES matches(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    match_notes TEXT,
    match_proofs JSONB
);

-- Tournament chat/messages
CREATE TABLE IF NOT EXISTS tournament_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_messages_tournament ON tournament_messages(tournament_id); 