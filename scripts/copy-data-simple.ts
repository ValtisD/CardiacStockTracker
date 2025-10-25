#!/usr/bin/env tsx
/**
 * Simple script to copy production data to development
 * Uses direct SQL queries to bypass any ORM issues
 */

import { neon } from '@neondatabase/serverless';

async function copyData() {
  console.log('🔄 Copying production data to development...\n');

  const prodUrl = process.env.DATABASE_URL;
  const devUrl = process.env.DEV_DATABASE_URL;

  if (!prodUrl || !devUrl) {
    throw new Error('Missing DATABASE_URL or DEV_DATABASE_URL');
  }

  const prodSql = neon(prodUrl);
  const devSql = neon(devUrl);

  try {
    // Copy users
    console.log('👥 Copying users...');
    const users = await prodSql`SELECT * FROM users`;
    for (const user of users) {
      await devSql`INSERT INTO users (id, email, name, "createdAt") VALUES (${user.id}, ${user.email}, ${user.name}, ${user.createdAt})`;
    }
    console.log(`✅ Copied ${users.length} users`);

    // Copy products
    console.log('📦 Copying products...');
    const products = await prodSql`SELECT * FROM products`;
    for (const product of products) {
      await devSql`INSERT INTO products (id, gtin, "modelNumber", "productName", "minCarStock", "minTotalStock") 
        VALUES (${product.id}, ${product.gtin}, ${product.modelNumber}, ${product.productName}, ${product.minCarStock}, ${product.minTotalStock})`;
    }
    console.log(`✅ Copied ${products.length} products`);

    // Copy hospitals
    console.log('🏥 Copying hospitals...');
    const hospitals = await prodSql`SELECT * FROM hospitals`;
    for (const hospital of hospitals) {
      await devSql`INSERT INTO hospitals (id, name, address, "contactPerson", phone, email, notes, "isArchived", "createdAt") 
        VALUES (${hospital.id}, ${hospital.name}, ${hospital.address}, ${hospital.contactPerson}, ${hospital.phone}, ${hospital.email}, ${hospital.notes}, ${hospital.isArchived}, ${hospital.createdAt})`;
    }
    console.log(`✅ Copied ${hospitals.length} hospitals`);

    // Copy user product settings
    console.log('⚙️  Copying user product settings...');
    const settings = await prodSql`SELECT * FROM user_product_settings`;
    for (const setting of settings) {
      await devSql`INSERT INTO user_product_settings (id, "userId", "productId", "minCarStock", "minTotalStock") 
        VALUES (${setting.id}, ${setting.userId}, ${setting.productId}, ${setting.minCarStock}, ${setting.minTotalStock})`;
    }
    console.log(`✅ Copied ${settings.length} user product settings`);

    // Copy inventory
    console.log('📋 Copying inventory...');
    const inventory = await prodSql`SELECT * FROM inventory`;
    for (const item of inventory) {
      await devSql`INSERT INTO inventory (id, "userId", "productId", location, "trackingMode", "serialNumber", "lotNumber", "expirationDate", quantity) 
        VALUES (${item.id}, ${item.userId}, ${item.productId}, ${item.location}, ${item.trackingMode}, ${item.serialNumber}, ${item.lotNumber}, ${item.expirationDate}, ${item.quantity})`;
    }
    console.log(`✅ Copied ${inventory.length} inventory items`);

    // Copy implant procedures
    console.log('💉 Copying implant procedures...');
    const procedures = await prodSql`SELECT * FROM implant_procedures`;
    for (const proc of procedures) {
      await devSql`INSERT INTO implant_procedures (id, "userId", "hospitalId", "procedureDate", "patientInitials", "deviceSource", "deviceGtin", "deviceSerialNumber", notes, "createdAt") 
        VALUES (${proc.id}, ${proc.userId}, ${proc.hospitalId}, ${proc.procedureDate}, ${proc.patientInitials}, ${proc.deviceSource}, ${proc.deviceGtin}, ${proc.deviceSerialNumber}, ${proc.notes}, ${proc.createdAt})`;
    }
    console.log(`✅ Copied ${procedures.length} implant procedures`);

    // Copy procedure materials
    console.log('🔧 Copying procedure materials...');
    const materials = await prodSql`SELECT * FROM procedure_materials`;
    for (const material of materials) {
      await devSql`INSERT INTO procedure_materials (id, "procedureId", "productId", "serialNumber", "lotNumber", "expirationDate", quantity) 
        VALUES (${material.id}, ${material.procedureId}, ${material.productId}, ${material.serialNumber}, ${material.lotNumber}, ${material.expirationDate}, ${material.quantity})`;
    }
    console.log(`✅ Copied ${materials.length} procedure materials`);

    // Copy stock count sessions
    console.log('📊 Copying stock count sessions...');
    const sessions = await prodSql`SELECT * FROM stock_count_sessions`;
    for (const session of sessions) {
      await devSql`INSERT INTO stock_count_sessions (id, "userId", "countType", status, "startedAt", "completedAt") 
        VALUES (${session.id}, ${session.userId}, ${session.countType}, ${session.status}, ${session.startedAt}, ${session.completedAt})`;
    }
    console.log(`✅ Copied ${sessions.length} stock count sessions`);

    // Copy stock count items
    console.log('📝 Copying stock count items...');
    const items = await prodSql`SELECT * FROM stock_count_items`;
    for (const item of items) {
      await devSql`INSERT INTO stock_count_items (id, "sessionId", "productId", "scannedLocation", "trackingMode", "serialNumber", "lotNumber", "expirationDate", quantity) 
        VALUES (${item.id}, ${item.sessionId}, ${item.productId}, ${item.scannedLocation}, ${item.trackingMode}, ${item.serialNumber}, ${item.lotNumber}, ${item.expirationDate}, ${item.quantity})`;
    }
    console.log(`✅ Copied ${items.length} stock count items`);

    console.log('\n✅ SUCCESS: All data copied from production to development!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

copyData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
