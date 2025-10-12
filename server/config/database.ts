/**
 * Database URL configuration with automatic dev/prod switching
 * 
 * Development (Replit workspace):
 *   - Uses DEV_DATABASE_URL if set (Neon development branch)
 *   - Falls back to DATABASE_URL if DEV_DATABASE_URL not set
 * 
 * Production (deployed):
 *   - Uses DATABASE_URL only
 */

export function getDatabaseUrl(): string {
  // In Replit workspace, prefer DEV_DATABASE_URL for safe testing
  // REPL_ID is present in all Replit environments (workspace + deployments)
  // We use NODE_ENV to distinguish: development = workspace, production = deployment
  const isDevelopment = process.env.NODE_ENV !== 'production' && process.env.REPL_ID;
  
  if (isDevelopment && process.env.DEV_DATABASE_URL) {
    console.log('🔧 Using DEV_DATABASE_URL (Neon development branch)');
    return process.env.DEV_DATABASE_URL;
  }
  
  if (process.env.DATABASE_URL) {
    if (isDevelopment) {
      console.log('⚠️  DEV_DATABASE_URL not set - using DATABASE_URL (production data!)');
    } else {
      console.log('✅ Using DATABASE_URL (production)');
    }
    return process.env.DATABASE_URL;
  }
  
  throw new Error(
    'No database URL configured. Please set:\n' +
    '  - DEV_DATABASE_URL: Your Neon development branch (for workspace)\n' +
    '  - DATABASE_URL: Your production database (for deployments)'
  );
}

// Export the resolved URL for convenience
export const DATABASE_URL = getDatabaseUrl();
