-- Add profile fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS gaming_handle_psn VARCHAR(255),
ADD COLUMN IF NOT EXISTS gaming_handle_xbox VARCHAR(255),
ADD COLUMN IF NOT EXISTS gaming_handle_origin_pc VARCHAR(255),
ADD COLUMN IF NOT EXISTS preferred_fifa_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS favorite_real_world_club VARCHAR(100),
ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255);

-- Create index on provider_id for faster OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider_id);

-- Create index on email for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add deleted_at for soft deletes
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for soft deletes
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at); 