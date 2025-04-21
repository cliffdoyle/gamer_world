-- Create participant_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE participant_status AS ENUM ('REGISTERED', 'WAITLISTED', 'CHECKED_IN', 'ELIMINATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add status and is_waitlisted columns to tournament_participants
ALTER TABLE tournament_participants
ADD COLUMN status participant_status NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN is_waitlisted BOOLEAN NOT NULL DEFAULT FALSE;

-- Remove old columns that are no longer used
ALTER TABLE tournament_participants
DROP COLUMN IF EXISTS team_name,
DROP COLUMN IF EXISTS is_checked_in,
DROP COLUMN IF EXISTS check_in_time;

-- Add rollback
-- DROP TYPE IF EXISTS participant_status;
-- ALTER TABLE tournament_participants DROP COLUMN status;
-- ALTER TABLE tournament_participants DROP COLUMN is_waitlisted;
-- ALTER TABLE tournament_participants ADD COLUMN team_name VARCHAR(100);
-- ALTER TABLE tournament_participants ADD COLUMN is_checked_in BOOLEAN DEFAULT FALSE;
-- ALTER TABLE tournament_participants ADD COLUMN check_in_time TIMESTAMP WITH TIME ZONE; 