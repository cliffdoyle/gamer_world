#!/bin/bash

# Navigate to the user-service directory
cd "$(dirname "$0")" || exit

# Load environment variables from .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env file"
  export $(grep -v '^#' .env | xargs)
else
  echo "Warning: .env file not found"
fi

# Set database environment variables with defaults if not set
export DB_HOST=${DB_HOST:-localhost}
export DB_PORT=${DB_PORT:-5432}
export DB_USER=${DB_USER:-postgres}
export DB_PASSWORD=${DB_PASSWORD:-postgres}
export DB_NAME=${DB_NAME:-users_db}

# Ensure GOOGLE_CLIENT_ID is set (with a placeholder if not provided)
export GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-your-google-client-id-here}

# Print settings
echo "Running migrations with:"
echo "Database host: $DB_HOST"
echo "Database port: $DB_PORT"
echo "Database name: $DB_NAME"
echo "Database user: $DB_USER"

# Build and run the migration
echo "Building migration tool..."
mkdir -p bin
go build -o bin/migrate cmd/migrate/main.go

echo "Running migrations..."
./bin/migrate

echo "Migration complete!" 