#!/bin/bash
# Push database schema changes to PRODUCTION database
# This uses DATABASE_URL (production database)

echo "⚠️  WARNING: This will push schema changes to PRODUCTION database!"
echo "Make sure you've tested on DEV first using: bash scripts/db-push-dev.sh"
echo ""
echo "Continue? (yes/N)"
read -r response
if [[ "$response" != "yes" ]]; then
  echo "Aborted. (Type 'yes' to confirm)"
  exit 1
fi

echo "🚀 Pushing schema to PRODUCTION database..."
npm run db:push
