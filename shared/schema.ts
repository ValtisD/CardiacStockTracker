import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, date, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Products table - shared catalog (admin-only management)
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gtin: text("gtin").notNull().unique(), // Global Trade Item Number from GS1 barcodes - now required and unique
  modelNumber: text("model_number").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// User-specific product settings (per-user stock thresholds)
export const userProductSettings = pgTable("user_product_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Auth0 user ID
  productId: varchar("product_id").notNull().references(() => products.id),
  minCarStock: integer("min_car_stock").notNull().default(0), // User's car stock threshold
  minTotalStock: integer("min_total_stock").notNull().default(0), // User's total stock threshold
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  // Ensure one settings record per user per product
  uniqueUserProduct: unique().on(table.userId, table.productId),
}));

// Inventory locations (Home, Car) - user-specific
// Each row represents a unique inventory item (individual serial or lot batch)
export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Auth0 user ID
  productId: varchar("product_id").notNull().references(() => products.id),
  location: text("location").notNull(), // 'home' or 'car'
  quantity: integer("quantity").notNull().default(1), // Always 1 for serial-tracked, can be >1 for lot-tracked
  trackingMode: text("tracking_mode"), // 'serial' or 'lot' - determines if this item is tracked by serial number or lot number
  serialNumber: text("serial_number").unique(), // Unique identifier for serial-tracked items (must be unique across all inventory)
  lotNumber: text("lot_number"), // Batch identifier for lot-tracked items
  expirationDate: date("expiration_date"), // Expiration date for this specific inventory item
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Hospitals/Customers - user-specific
export const hospitals = pgTable("hospitals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Auth0 user ID
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  zipCode: text("zip_code").notNull(),
  primaryPhysician: text("primary_physician"),
  contactPhone: text("contact_phone"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Implant procedures - user-specific
export const implantProcedures = pgTable("implant_procedures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Auth0 user ID
  hospitalId: varchar("hospital_id").notNull().references(() => hospitals.id),
  patientId: text("patient_id"), // Optional patient identifier
  implantDate: date("implant_date").notNull(),
  procedureType: text("procedure_type").notNull(), // Pacemaker, ICD, CRT
  deviceUsed: varchar("device_used"), // Product ID
  deviceSerialNumber: text("device_serial_number"), // Serial number of the implanted device
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Materials used in procedures
export const procedureMaterials = pgTable("procedure_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  procedureId: varchar("procedure_id").notNull().references(() => implantProcedures.id),
  productId: varchar("product_id"), // Null if external material
  materialName: text("material_name").notNull(), // For external materials
  quantity: integer("quantity").notNull().default(1),
  source: text("source").notNull().default('car'), // 'car', 'external', 'hospital'
  serialNumber: text("serial_number"), // Serial number from GS1 scan
  lotNumber: text("lot_number"), // Lot number from GS1 scan
});

// Stock transfers - user-specific
export const stockTransfers = pgTable("stock_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Auth0 user ID
  productId: varchar("product_id").notNull().references(() => products.id),
  fromLocation: text("from_location").notNull(),
  toLocation: text("to_location").notNull(),
  quantity: integer("quantity").notNull(),
  transferDate: timestamp("transfer_date").default(sql`now()`),
  notes: text("notes"),
});

// Insert schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(),
});

export const insertHospitalSchema = createInsertSchema(hospitals).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().optional(),
});

export const insertImplantProcedureSchema = createInsertSchema(implantProcedures).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().optional(),
});

export const insertProcedureMaterialSchema = createInsertSchema(procedureMaterials).omit({
  id: true,
  procedureId: true,
});

export const insertStockTransferSchema = createInsertSchema(stockTransfers).omit({
  id: true,
  transferDate: true,
}).extend({
  userId: z.string().optional(),
});

export const insertUserProductSettingsSchema = createInsertSchema(userProductSettings).omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().optional(),
});

// Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;

export type Hospital = typeof hospitals.$inferSelect;
export type InsertHospital = z.infer<typeof insertHospitalSchema>;

export type ImplantProcedure = typeof implantProcedures.$inferSelect;
export type InsertImplantProcedure = z.infer<typeof insertImplantProcedureSchema>;

export type ProcedureMaterial = typeof procedureMaterials.$inferSelect;
export type InsertProcedureMaterial = z.infer<typeof insertProcedureMaterialSchema>;

export type StockTransfer = typeof stockTransfers.$inferSelect;
export type InsertStockTransfer = z.infer<typeof insertStockTransferSchema>;

export type UserProductSettings = typeof userProductSettings.$inferSelect;
export type InsertUserProductSettings = z.infer<typeof insertUserProductSettingsSchema>;