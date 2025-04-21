-- Add name column to tournament_participants
ALTER TABLE tournament_participants
ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '';

-- Update existing rows to use user_id as name (temporary)
UPDATE tournament_participants
SET name = user_id::text
WHERE name = '';

-- Add rollback
-- ALTER TABLE tournament_participants DROP COLUMN name; 