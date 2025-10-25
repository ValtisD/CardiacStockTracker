#!/bin/bash
# Copy all data from PRODUCTION database to DEVELOPMENT database
# This script safely dumps production data and restores it to the dev database

set -e  # Exit on any error

echo "======================================================================"
echo "⚠️  WARNING: Copy Production Data to Development Database"
echo "======================================================================"
echo ""
echo "This will:"
echo "  1. Dump all data from PRODUCTION database (DATABASE_URL)"
echo "  2. Clear all data in DEVELOPMENT database (DEV_DATABASE_URL)"
echo "  3. Restore production data to development database"
echo ""
echo "⚠️  This will OVERWRITE all data in your development database!"
echo ""
echo "Continue? (yes/N)"
read -r response
if [[ "$response" != "yes" ]]; then
  echo "Aborted. (Type 'yes' to confirm)"
  exit 1
fi

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL (production) is not set"
  exit 1
fi

if [ -z "$DEV_DATABASE_URL" ]; then
  echo "❌ Error: DEV_DATABASE_URL (development) is not set"
  exit 1
fi

echo ""
echo "📦 Step 1/3: Dumping data from PRODUCTION database..."
pg_dump "$DATABASE_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  > /tmp/production-data-dump.sql

if [ ! -s /tmp/production-data-dump.sql ]; then
  echo "❌ Error: Production dump file is empty"
  exit 1
fi

echo "✅ Production data dumped successfully"
echo ""
echo "🗑️  Step 2/3: Clearing DEVELOPMENT database..."

# Get list of all tables and truncate them
psql "$DEV_DATABASE_URL" -t -c "
  SELECT 'TRUNCATE TABLE \"' || tablename || '\" CASCADE;' 
  FROM pg_tables 
  WHERE schemaname = 'public'
" | psql "$DEV_DATABASE_URL"

echo "✅ Development database cleared"
echo ""
echo "📥 Step 3/3: Restoring production data to DEVELOPMENT database..."

# Restore the data
psql "$DEV_DATABASE_URL" < /tmp/production-data-dump.sql

echo "✅ Data restored successfully"
echo ""
echo "🧹 Cleaning up temporary files..."
rm /tmp/production-data-dump.sql

echo ""
echo "======================================================================"
echo "✅ SUCCESS: Production data copied to development database!"
echo "======================================================================"
echo ""
echo "Your development database now contains all data from production."
echo "You can safely test schema changes and features without affecting production."
