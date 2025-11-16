#!/bin/bash
# Script to push Prisma schema to Neon database
# Usage: ./scripts/push-schema-to-neon.sh

echo "Pushing Prisma schema to Neon database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  echo "Please set it to your Neon PostgreSQL connection string"
  exit 1
fi

# Generate Prisma Client
echo "Generating Prisma Client..."
npx prisma generate

# Push schema to database
echo "Pushing schema to database..."
npx prisma db push --accept-data-loss

echo "Schema push complete!"

