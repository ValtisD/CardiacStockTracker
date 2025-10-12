#!/bin/bash
# Push database schema changes to DEVELOPMENT database
# This uses DEV_DATABASE_URL if set, otherwise falls back to DATABASE_URL

if [ -z "$DEV_DATABASE_URL" ]; then
  echo "⚠️  DEV_DATABASE_URL not set - will use DATABASE_URL (production!)"
  echo "Are you sure you want to continue? (y/N)"
  read -r response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
  npm run db:push
else
  echo "🔧 Pushing schema to DEVELOPMENT database..."
  DATABASE_URL="$DEV_DATABASE_URL" npm run db:push
fi
