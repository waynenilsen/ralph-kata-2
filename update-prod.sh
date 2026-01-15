#!/bin/bash

set -e

WORKING_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$WORKING_DIR"

DB_PATH="${WORKING_DIR}/data/prod.db"

echo "=== Updating ralph-kata-2 production ==="

# Fetch and check for changes
echo "Fetching from remote..."
git fetch

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "Already up to date. No changes to apply."
    exit 0
fi

echo "Pulling main branch..."
git pull origin main

# Check if migration is needed and create one if so
echo "Checking for schema changes..."
if ! DATABASE_URL="file:${DB_PATH}" bun x prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code > /dev/null 2>&1; then
    echo "Schema changes detected, creating migration..."
    MIGRATION_NAME="auto_migration_$(date +%Y%m%d_%H%M%S)"
    DATABASE_URL="file:${DB_PATH}" bun x prisma migrate dev --name "$MIGRATION_NAME" --skip-seed

    # Commit and push the new migration
    echo "Committing migration..."
    git add prisma/migrations/
    git commit -m "chore(db): add migration ${MIGRATION_NAME}"

    echo "Pushing to remote..."
    git push origin main
else
    echo "No schema changes detected, skipping migration."
    # Still run migrate deploy to apply any pending migrations
    echo "Applying any pending migrations..."
    DATABASE_URL="file:${DB_PATH}" bun x prisma migrate deploy
fi

# Rebuild production
echo "Rebuilding production..."
./rebuild-prod.sh

# Reboot the server
echo "Rebooting server..."
./reboot-prod.sh

echo "=== Production update complete ==="
