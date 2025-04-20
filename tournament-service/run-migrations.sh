#!/bin/sh

# Wait for postgres to be ready
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q'; do
  echo "Postgres is unavailable - sleeping"
  sleep 1
done

echo "Setting up migrations tracking..."

# Create migrations table if it doesn't exist
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename varchar(255) PRIMARY KEY,
    applied_at timestamp DEFAULT CURRENT_TIMESTAMP
);
EOF

echo "Running migrations..."

# Run each migration file if not already applied
for file in /migrations/*.sql; do
  filename=$(basename "$file")
  
  # Check if migration was already applied
  migration_count=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';")
  
  if [ "$migration_count" -eq "0" ]; then
    echo "Applying migration: $filename"
    if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$file"; then
      # Record successful migration
      PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO schema_migrations (filename) VALUES ('$filename');"
      echo "Migration $filename applied successfully"
    else
      echo "Error applying migration $filename"
      exit 1
    fi
  else
    echo "Skipping migration $filename - already applied"
  fi
done

echo "Migrations completed" 