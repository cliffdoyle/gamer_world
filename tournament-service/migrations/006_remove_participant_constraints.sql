-- Drop the unique constraint on tournament_id and user_id
ALTER TABLE tournament_participants DROP CONSTRAINT IF EXISTS tournament_participants_tournament_id_user_id_key;

-- Add rollback
-- ALTER TABLE tournament_participants ADD CONSTRAINT tournament_participants_tournament_id_user_id_key UNIQUE (tournament_id, user_id); 