-- Add bracket_type column to matches table
ALTER TABLE matches ADD COLUMN bracket_type VARCHAR(50);

-- Update existing matches to have a default bracket_type
UPDATE matches SET bracket_type = 'WINNERS' WHERE bracket_type IS NULL;
