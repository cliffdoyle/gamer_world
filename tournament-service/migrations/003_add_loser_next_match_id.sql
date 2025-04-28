-- Add loser_next_match_id column to matches table
ALTER TABLE matches ADD COLUMN loser_next_match_id UUID REFERENCES matches(id);

-- Create index for performance
CREATE INDEX idx_matches_loser_next_match_id ON matches(loser_next_match_id);

-- Rollback
-- ALTER TABLE matches DROP COLUMN loser_next_match_id;
-- DROP INDEX idx_matches_loser_next_match_id; 