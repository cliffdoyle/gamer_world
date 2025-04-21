-- Make user_id nullable
ALTER TABLE tournament_participants ALTER COLUMN user_id DROP NOT NULL;

-- Add participant_name column
ALTER TABLE tournament_participants ADD COLUMN participant_name VARCHAR(255);

-- Add rollback
-- ALTER TABLE tournament_participants ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE tournament_participants DROP COLUMN participant_name; 