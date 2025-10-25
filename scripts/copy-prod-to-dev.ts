#!/usr/bin/env tsx
/**
 * Copy all data from PRODUCTION database to DEVELOPMENT database
 * 
 * This script:
 * 1. Reads all data from production (DATABASE_URL)
 * 2. Clears all data in development (DEV_DATABASE_URL)
 * 3. Copies production data to development
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema';

async function copyProductionToDevDatabase() {
  console.log('======================================================================');
  console.log('⚠️  Copying Production Data to Development Database');
  console.log('======================================================================\n');

  const prodUrl = process.env.DATABASE_URL;
  const devUrl = process.env.DEV_DATABASE_URL;

  if (!prodUrl) {
    throw new Error('❌ DATABASE_URL (production) is not set');
  }

  if (!devUrl) {
    throw new Error('❌ DEV_DATABASE_URL (development) is not set');
  }

  console.log('✅ Production URL configured');
  console.log('✅ Development URL configured\n');

  // Connect to both databases
  const prodSql = neon(prodUrl);
  const prodDb = drizzle(prodSql, { schema });
  
  const devSql = neon(devUrl);
  const devDb = drizzle(devSql, { schema });

  try {
    // Step 1: Read all data from production
    console.log('📦 Step 1/3: Reading data from PRODUCTION database...');
    
    const prodData = {
      users: await prodDb.select().from(schema.users),
      products: await prodDb.select().from(schema.products),
      hospitals: await prodDb.select().from(schema.hospitals),
      inventory: await prodDb.select().from(schema.inventory),
      implantProcedures: await prodDb.select().from(schema.implantProcedures),
      procedureMaterials: await prodDb.select().from(schema.procedureMaterials),
      stockCountSessions: await prodDb.select().from(schema.stockCountSessions),
      stockCountItems: await prodDb.select().from(schema.stockCountItems),
      userProductSettings: await prodDb.select().from(schema.userProductSettings),
    };

    console.log(`✅ Read ${prodData.users.length} users`);
    console.log(`✅ Read ${prodData.products.length} products`);
    console.log(`✅ Read ${prodData.hospitals.length} hospitals`);
    console.log(`✅ Read ${prodData.inventory.length} inventory items`);
    console.log(`✅ Read ${prodData.implantProcedures.length} implant procedures`);
    console.log(`✅ Read ${prodData.procedureMaterials.length} procedure materials`);
    console.log(`✅ Read ${prodData.stockCountSessions.length} stock count sessions`);
    console.log(`✅ Read ${prodData.stockCountItems.length} stock count items`);
    console.log(`✅ Read ${prodData.userProductSettings.length} user product settings\n`);

    // Step 2: Clear development database
    console.log('🗑️  Step 2/3: Clearing DEVELOPMENT database...');
    
    // Truncate all tables (CASCADE will handle foreign key constraints)
    await devSql`TRUNCATE TABLE stock_count_items, stock_count_sessions, procedure_materials, implant_procedures, inventory, user_product_settings, hospitals, products, users CASCADE`;

    console.log('✅ Development database cleared\n');

    // Step 3: Insert production data into development
    console.log('📥 Step 3/3: Copying data to DEVELOPMENT database...');

    // Insert in order of dependencies
    if (prodData.users.length > 0) {
      await devDb.insert(schema.users).values(prodData.users);
      console.log(`✅ Copied ${prodData.users.length} users`);
    }

    if (prodData.products.length > 0) {
      await devDb.insert(schema.products).values(prodData.products);
      console.log(`✅ Copied ${prodData.products.length} products`);
    }

    if (prodData.hospitals.length > 0) {
      await devDb.insert(schema.hospitals).values(prodData.hospitals);
      console.log(`✅ Copied ${prodData.hospitals.length} hospitals`);
    }

    if (prodData.userProductSettings.length > 0) {
      await devDb.insert(schema.userProductSettings).values(prodData.userProductSettings);
      console.log(`✅ Copied ${prodData.userProductSettings.length} user product settings`);
    }

    if (prodData.inventory.length > 0) {
      await devDb.insert(schema.inventory).values(prodData.inventory);
      console.log(`✅ Copied ${prodData.inventory.length} inventory items`);
    }

    if (prodData.implantProcedures.length > 0) {
      await devDb.insert(schema.implantProcedures).values(prodData.implantProcedures);
      console.log(`✅ Copied ${prodData.implantProcedures.length} implant procedures`);
    }

    if (prodData.procedureMaterials.length > 0) {
      await devDb.insert(schema.procedureMaterials).values(prodData.procedureMaterials);
      console.log(`✅ Copied ${prodData.procedureMaterials.length} procedure materials`);
    }

    if (prodData.stockCountSessions.length > 0) {
      await devDb.insert(schema.stockCountSessions).values(prodData.stockCountSessions);
      console.log(`✅ Copied ${prodData.stockCountSessions.length} stock count sessions`);
    }

    if (prodData.stockCountItems.length > 0) {
      await devDb.insert(schema.stockCountItems).values(prodData.stockCountItems);
      console.log(`✅ Copied ${prodData.stockCountItems.length} stock count items`);
    }

    console.log('\n======================================================================');
    console.log('✅ SUCCESS: Production data copied to development database!');
    console.log('======================================================================\n');
    console.log('Your development database now contains all data from production.');
    console.log('You can safely test features without affecting production.\n');

  } catch (error) {
    console.error('\n❌ Error during database copy:', error);
    throw error;
  }
}

// Run the script
copyProductionToDevDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
