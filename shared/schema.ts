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
  boxGtin: text("box_gtin").unique(), // GTIN for multi-pack boxes (optional)
  boxQuantity: integer("box_quantity"), // Number of individual units per box (optional)
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

// Hospitals/Customers - global (shared across all users)
export const hospitals = pgTable("hospitals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  implantDate: date("implant_date").notNull(),
  procedureType: text("procedure_type").notNull(), // Pacemaker, ICD, CRT
  deviceUsed: varchar("device_used"), // Product ID
  deviceSerialNumber: text("device_serial_number"), // Serial number of the implanted device
  deviceLotNumber: text("device_lot_number"), // Lot number of the implanted device
  deviceSource: text("device_source").notNull().default('car'), // 'car', 'external', 'hospital'
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

// Users table - stores basic user info from Auth0
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(), // Auth0 user ID (sub claim)
  email: text("email").notNull(), // Email from Auth0 token
  language: text("language").notNull().default('de'), // User's preferred language: 'de' (German) or 'en' (English)
  validated: boolean("validated").notNull().default(false), // Whether user completed registration gate
  lastSeen: timestamp("last_seen").default(sql`now()`),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Admin users - stores which users have admin privileges (in addition to the prime admin from env)
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(), // Auth0 user ID
  userEmail: text("user_email").notNull(), // Store email for reference
  grantedAt: timestamp("granted_at").default(sql`now()`),
  grantedBy: text("granted_by").notNull(), // User ID of admin who granted access
});

// Insert schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  updatedAt: true,
});

export const insertHospitalSchema = createInsertSchema(hospitals).omit({
  id: true,
  createdAt: true,
});

export const insertImplantProcedureSchema = createInsertSchema(implantProcedures).omit({
  id: true,
  createdAt: true,
});

export const insertProcedureMaterialSchema = createInsertSchema(procedureMaterials).omit({
  id: true,
  procedureId: true,
});

export const insertUserProductSettingsSchema = createInsertSchema(userProductSettings).omit({
  id: true,
  createdAt: true,
});

// Update schemas (for PATCH endpoints - all fields optional)
export const updateProductSchema = insertProductSchema.partial();
export const updateHospitalSchema = insertHospitalSchema.partial();

// Inventory operation schemas
export const updateInventoryQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

export const transferInventoryItemSchema = z.object({
  toLocation: z.enum(['home', 'car']),
  quantity: z.number().int().min(1).optional(),
});

// Additional validation schemas
export const languageSchema = z.object({
  language: z.enum(['de', 'en']),
});

export const toggleAdminSchema = z.object({
  email: z.string().email(),
  isAdmin: z.boolean(),
});

// Client-side schemas (for forms - userId added server-side)
export const clientInsertInventorySchema = insertInventorySchema.omit({ userId: true });
export const clientInsertHospitalSchema = insertHospitalSchema; // Hospitals are now global - no userId to omit
export const clientInsertImplantProcedureSchema = insertImplantProcedureSchema.omit({ userId: true });
export const clientInsertUserProductSettingsSchema = insertUserProductSettingsSchema.omit({ userId: true });

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

export type UserProductSettings = typeof userProductSettings.$inferSelect;
export type InsertUserProductSettings = z.infer<typeof insertUserProductSettingsSchema>;

export type AdminUser = typeof adminUsers.$inferSelect;