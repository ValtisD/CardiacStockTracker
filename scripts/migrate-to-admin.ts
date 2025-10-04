#!/usr/bin/env tsx

/**
 * Migration script to assign existing data without userId to the admin user.
 * Run this script once after enabling multi-user authentication to ensure
 * all existing data is properly assigned to the admin account.
 * 
 * Usage: npm run migrate-to-admin
 */

import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql, eq, or, isNull } from "drizzle-orm";
import * as schema from "../shared/schema";

// WebSocket polyfill for local development
import ws from "ws";
neonConfig.webSocketConstructor = ws as any;

const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_USER_ID = process.env.AUTH0_ADMIN_USER_ID;

if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL environment variable is not set");
  process.exit(1);
}

if (!ADMIN_USER_ID) {
  console.error("Error: AUTH0_ADMIN_USER_ID environment variable is not set");
  console.error("Please set this to your admin user's Auth0 sub claim (e.g., auth0|xxxxx)");
  console.error("\nTo find your Auth0 user ID:");
  console.error("1. Log in to your application");
  console.error("2. Check the JWT token payload (available in browser dev tools)");
  console.error("3. Look for the 'sub' claim - this is your user ID");
  process.exit(1);
}

async function migrate() {
  console.log("Starting migration to assign orphaned data to admin user...");
  console.log(`Admin User ID: ${ADMIN_USER_ID}`);
  console.log("\nNote: This script will update ALL records with NULL or empty user_id");
  console.log("Press Ctrl+C within 5 seconds to cancel...\n");
  
  // Wait 5 seconds for user to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    console.log("Checking for orphaned records...\n");
    
    // Count orphaned records first (outside transaction)
    const inventoryCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM inventory WHERE user_id = '' OR user_id IS NULL`
    );
    const hospitalsCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM hospitals WHERE user_id = '' OR user_id IS NULL`
    );
    const proceduresCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM implant_procedures WHERE user_id = '' OR user_id IS NULL`
    );
    
    let transfersCount;
    try {
      transfersCount = await db.execute(
        sql`SELECT COUNT(*) as count FROM stock_transfers WHERE user_id = '' OR user_id IS NULL`
      );
    } catch (error) {
      transfersCount = { rows: [{ count: 0 }] };
    }
    
    const invCount = Number(inventoryCount.rows[0]?.count || 0);
    const hospCount = Number(hospitalsCount.rows[0]?.count || 0);
    const procCount = Number(proceduresCount.rows[0]?.count || 0);
    const transCount = Number(transfersCount.rows[0]?.count || 0);
    
    console.log(`Found orphaned records:`);
    console.log(`  - Inventory: ${invCount}`);
    console.log(`  - Hospitals: ${hospCount}`);
    console.log(`  - Implant Procedures: ${procCount}`);
    console.log(`  - Stock Transfers: ${transCount}\n`);
    
    if (invCount === 0 && hospCount === 0 && procCount === 0 && transCount === 0) {
      console.log("✅ No orphaned records found. Database is already clean!");
      await pool.end();
      return;
    }
    
    console.log("Updating records in transaction...\n");
    
    // Run all updates in a proper Drizzle transaction
    await db.transaction(async (tx) => {
      // Update inventory records
      const inventoryResult = await tx.execute(
        sql`UPDATE inventory SET user_id = ${ADMIN_USER_ID} WHERE user_id = '' OR user_id IS NULL`
      );
      console.log(`✓ Updated ${inventoryResult.rowCount || 0} inventory records`);

      // Update hospital records
      const hospitalsResult = await tx.execute(
        sql`UPDATE hospitals SET user_id = ${ADMIN_USER_ID} WHERE user_id = '' OR user_id IS NULL`
      );
      console.log(`✓ Updated ${hospitalsResult.rowCount || 0} hospital records`);

      // Update implant procedure records
      const proceduresResult = await tx.execute(
        sql`UPDATE implant_procedures SET user_id = ${ADMIN_USER_ID} WHERE user_id = '' OR user_id IS NULL`
      );
      console.log(`✓ Updated ${proceduresResult.rowCount || 0} implant procedure records`);

      // Update stock transfer records (if they exist)
      try {
        const transfersResult = await tx.execute(
          sql`UPDATE stock_transfers SET user_id = ${ADMIN_USER_ID} WHERE user_id = '' OR user_id IS NULL`
        );
        console.log(`✓ Updated ${transfersResult.rowCount || 0} stock transfer records`);
      } catch (error) {
        console.log("⚠ Stock transfers table not found or has no user_id column (skipping)");
      }
    });

    console.log("\n✅ Migration completed successfully!");
    console.log("All orphaned data has been assigned to the admin user.");
    
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.log("Transaction automatically rolled back.");
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
