-- This SQL script creates a table to log user activities in the tournament service.
CREATE TABLE IF NOT EXISTS user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- e.g., 'TOURNAMENT_JOINED', 'MATCH_WON', 'BADGE_EARNED'
    description TEXT NOT NULL,            -- User-readable string like "Joined 'Epic LAN Party'"
    related_entity_id UUID NULL,        -- Optional: ID of tournament, match, badge, etc.
    related_entity_type VARCHAR(50) NULL, -- Optional: Type like 'TOURNAMENT', 'MATCH', 'BADGE'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    context_url VARCHAR(255) NULL      -- Optional: A URL the frontend can link to, e.g., /tournaments/{id}
);

-- Optional: Indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id_created_at ON user_activities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_activity_type ON user_activities (activity_type);