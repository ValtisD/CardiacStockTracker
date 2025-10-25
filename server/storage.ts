import { eq, and, sql, desc, isNull, gt, ilike, or, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  products,
  inventory,
  hospitals,
  implantProcedures,
  procedureMaterials,
  userProductSettings,
  users,
  adminUsers,
  stockCountSessions,
  stockCountItems,
  type Product,
  type InsertProduct,
  type Inventory,
  type InsertInventory,
  type Hospital,
  type InsertHospital,
  type ImplantProcedure,
  type InsertImplantProcedure,
  type ProcedureMaterial,
  type InsertProcedureMaterial,
  type UserProductSettings,
  type InsertUserProductSettings,
  type StockCountSession,
  type InsertStockCountSession,
  type StockCountItem,
  type InsertStockCountItem,
} from "@shared/schema";

export interface IStorage {
  // Products (shared - no userId)
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductByGtin(gtin: string): Promise<Product | undefined>;
  searchProducts(query: string): Promise<Product[]>;
  searchProductsByMultipleFields(userId: string, query: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // User Product Settings
  getUserProductSettings(userId: string, productId?: string): Promise<UserProductSettings[]>;
  upsertUserProductSettings(userId: string, productId: string, settings: { minCarStock: number, minTotalStock: number }): Promise<UserProductSettings>;

  // Inventory (user-specific)
  getInventory(userId: string, location?: string): Promise<(Inventory & { product: Product })[]>;
  getInventoryItem(userId: string, productId: string, location: string): Promise<Inventory | undefined>;
  getInventorySummary(userId: string, location?: string): Promise<{ product: Product; totalQuantity: number; location?: string }[]>;
  getStockOverview(userId: string): Promise<{ gtin: string; modelNumber: string; productName: string; homeQty: number; carQty: number; totalQty: number; items: Inventory[] }[]>;
  getLowStockItems(userId: string, location?: string): Promise<(Inventory & { product: Product; userSettings?: UserProductSettings })[]>;
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryQuantity(userId: string, productId: string, location: string, quantity: number): Promise<Inventory | undefined>;
  deleteInventoryItem(userId: string, productId: string, location: string): Promise<boolean>;

  // Hospitals (global - shared across all users)
  getHospitals(): Promise<Hospital[]>;
  getHospital(id: string): Promise<Hospital | undefined>;
  createHospital(hospital: InsertHospital): Promise<Hospital>;
  updateHospital(id: string, hospital: Partial<InsertHospital>): Promise<Hospital | undefined>;
  deleteHospital(id: string): Promise<boolean>;

  // Implant Procedures (user-specific)
  getImplantProcedures(userId: string): Promise<(ImplantProcedure & { hospital: Hospital; deviceProduct?: Product | null })[]>;
  getImplantProcedure(userId: string, id: string): Promise<ImplantProcedure | undefined>;
  createImplantProcedure(procedure: InsertImplantProcedure, materials: InsertProcedureMaterial[]): Promise<ImplantProcedure>;
  updateImplantProcedure(userId: string, id: string, procedureData: Partial<InsertImplantProcedure>): Promise<ImplantProcedure | null>;
  deleteImplantProcedure(userId: string, id: string): Promise<boolean>;
  getProcedureMaterials(procedureId: string): Promise<ProcedureMaterial[]>;
  
  // Individual inventory item methods (for serial-tracked items)
  updateInventoryQuantityById(userId: string, id: string, quantity: number): Promise<Inventory | undefined>;
  deleteInventoryItemById(userId: string, id: string): Promise<boolean>;
  transferInventoryItem(userId: string, id: string, toLocation: string, transferQuantity?: number): Promise<Inventory | undefined>;
  
  // User Management (admin-only)
  getAllUsers(): Promise<{ userId: string; email: string; isAdmin: boolean; isPrimeAdmin: boolean; inventoryCount: number; recentProcedureCount: number }[]>;
  grantAdminAccess(userId: string, userEmail: string, grantedBy: string): Promise<void>;
  revokeAdminAccess(userId: string): Promise<void>;
  
  // Quick Search
  quickSearchBySerialOrLot(userId: string, query: string): Promise<{
    inventoryItems: (Inventory & { product: Product })[];
    procedures: (ImplantProcedure & { hospital: Hospital; deviceProduct?: Product | null })[];
  }>;
  
  // User Preferences
  getUserLanguage(userId: string): Promise<string>;
  updateUserLanguage(userId: string, language: string): Promise<void>;
  
  // Stock Count
  createStockCountSession(session: InsertStockCountSession): Promise<StockCountSession>;
  getActiveStockCountSession(userId: string): Promise<StockCountSession | undefined>;
  getStockCountSession(userId: string, sessionId: string): Promise<StockCountSession | undefined>;
  addStockCountItem(item: InsertStockCountItem): Promise<StockCountItem>;
  getStockCountItems(sessionId: string): Promise<(StockCountItem & { product: Product })[]>;
  deleteStockCountItem(itemId: string): Promise<void>;
  completeStockCountSession(
    userId: string, 
    sessionId: string, 
    completedBy: string,
    summary: {
      matched: number;
      transferred: number;
      newItems: number;
      markedMissing: number;
      derecognized: number;
    }
  ): Promise<void>;
  cancelStockCountSession(userId: string, sessionId: string): Promise<void>;
  calculateDiscrepancies(userId: string, sessionId: string): Promise<{
    missing: (Inventory & { product: Product })[];
    found: (StockCountItem & { product: Product; existsInHome?: boolean })[];
    matched: (StockCountItem & { product: Product; inventoryId: string })[];
  }>;
  applyStockCountAdjustments(
    userId: string,
    sessionId: string,
    adjustments: {
      transfers: { itemId: string; fromLocation: string; toLocation: string; quantity?: number }[];
      missing: { inventoryId: string; action: 'mark_missing' | 'derecognized' }[];
      newItems: { scannedItemId: string; location: string }[];
      deleteInvestigated: string[]; // IDs of items to delete from investigation
    },
    matchedCount: number
  ): Promise<{
    matched: number;
    transferred: number;
    newItems: number;
    markedMissing: number;
    derecognized: number;
  }>;
  getStockCountHistory(userId: string, limit?: number): Promise<StockCountSession[]>;
  cleanupOldStockCounts(): Promise<number>; // Returns number of deleted sessions
}

export class DatabaseStorage implements IStorage {
  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductByGtin(gtin: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.gtin, gtin));
    return result[0];
  }

  async searchProducts(query: string): Promise<Product[]> {
    const result = await db.select().from(products).where(
      sql`${products.modelNumber} = ${query} OR ${products.gtin} = ${query} OR ${products.boxGtin} = ${query}`
    );
    return result;
  }

  async searchProductsByMultipleFields(userId: string, query: string): Promise<Product[]> {
    // Search in products table by GTIN, model number, or product name (case-insensitive partial match)
    const searchPattern = `%${query}%`;
    const productResults = await db.select().from(products).where(
      or(
        ilike(products.modelNumber, searchPattern),
        ilike(products.gtin, searchPattern),
        ilike(products.name, searchPattern)
      )
    );
    
    if (productResults.length > 0) {
      return productResults;
    }
    
    // If not found in products, search by serial number in user's inventory (exact match)
    const inventoryResults = await db
      .select({
        product: {
          id: products.id,
          gtin: products.gtin,
          modelNumber: products.modelNumber,
          name: products.name,
          boxGtin: products.boxGtin,
          boxQuantity: products.boxQuantity,
          createdAt: products.createdAt,
        }
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(
        and(
          eq(inventory.userId, userId),
          eq(inventory.serialNumber, query)
        )
      );
    
    // Return unique products (in case multiple items have same serial)
    const uniqueProducts = inventoryResults
      .map(r => r.product)
      .filter((product, index, self) => 
        index === self.findIndex(p => p.id === product.id)
      );
    
    return uniqueProducts;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    // Check if product is used in any inventory
    const inventoryItems = await db.select().from(inventory).where(eq(inventory.productId, id)).limit(1);
    if (inventoryItems.length > 0) {
      throw new Error('Cannot delete product: it is currently in use in inventory');
    }
    
    // Safe to delete: first remove user product settings
    await db.delete(userProductSettings).where(eq(userProductSettings.productId, id));
    
    // Then delete the product
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Inventory
  async getInventory(userId: string, location?: string): Promise<(Inventory & { product: Product })[]> {
    const query = db
      .select({
        id: inventory.id,
        userId: inventory.userId,
        productId: inventory.productId,
        location: inventory.location,
        quantity: inventory.quantity,
        trackingMode: inventory.trackingMode,
        serialNumber: inventory.serialNumber,
        lotNumber: inventory.lotNumber,
        expirationDate: inventory.expirationDate,
        updatedAt: inventory.updatedAt,
        product: {
          id: products.id,
          gtin: products.gtin,
          modelNumber: products.modelNumber,
          name: products.name,
          boxGtin: products.boxGtin,
          boxQuantity: products.boxQuantity,
          createdAt: products.createdAt,
        },
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id));

    if (location) {
      return await query.where(and(
        eq(inventory.userId, userId),
        eq(inventory.location, location),
        gt(inventory.quantity, 0)
      ));
    }

    return await query.where(and(
      eq(inventory.userId, userId),
      gt(inventory.quantity, 0)
    ));
  }

  async getInventoryItem(userId: string, productId: string, location: string): Promise<Inventory | undefined> {
    const result = await db
      .select()
      .from(inventory)
      .where(and(
        eq(inventory.userId, userId),
        eq(inventory.productId, productId),
        eq(inventory.location, location)
      ));
    return result[0];
  }

  async getInventorySummary(userId: string, location?: string): Promise<{ product: Product; totalQuantity: number; location?: string }[]> {
    // Get ALL products
    const allProducts = await db.select().from(products);
    
    // Determine which inventory to fetch based on location parameter
    let inventoryItems;
    if (location === 'car') {
      // For car summary: show only car stock
      inventoryItems = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(and(
          eq(inventory.userId, userId),
          eq(inventory.location, 'car'),
          gt(inventory.quantity, 0)
        ));
    } else if (location === 'home') {
      // For home summary: show total stock (home + car)
      inventoryItems = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(and(
          eq(inventory.userId, userId),
          gt(inventory.quantity, 0)
        ));
    } else {
      // No location specified: show total stock
      inventoryItems = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(and(
          eq(inventory.userId, userId),
          gt(inventory.quantity, 0)
        ));
    }

    // Group inventory by productId and sum quantities
    const inventoryMap = new Map<string, number>();
    
    for (const item of inventoryItems) {
      inventoryMap.set(item.productId, (inventoryMap.get(item.productId) || 0) + item.quantity);
    }

    // Create summary with ALL products (showing 0 for products with no inventory)
    return allProducts.map(product => ({
      product,
      totalQuantity: inventoryMap.get(product.id) || 0,
      location,
    }));
  }

  async getStockOverview(userId: string): Promise<{ gtin: string; modelNumber: string; productName: string; homeQty: number; carQty: number; totalQty: number; items: Inventory[] }[]> {
    // Get all inventory items for the user with product info
    const allInventory = await db
      .select({
        inventory: inventory,
        product: {
          id: products.id,
          gtin: products.gtin,
          modelNumber: products.modelNumber,
          name: products.name,
          boxGtin: products.boxGtin,
          boxQuantity: products.boxQuantity,
          createdAt: products.createdAt,
        }
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.productId, products.id))
      .where(and(
        eq(inventory.userId, userId),
        gt(inventory.quantity, 0)
      ));

    // Group by product
    const productMap = new Map<string, {
      product: Product;
      homeQty: number;
      carQty: number;
      items: Inventory[];
    }>();

    for (const row of allInventory) {
      if (!row.product) continue;
      
      const productId = row.product.id;
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          product: row.product,
          homeQty: 0,
          carQty: 0,
          items: []
        });
      }

      const data = productMap.get(productId)!;
      data.items.push(row.inventory);
      
      if (row.inventory.location === 'home') {
        data.homeQty += row.inventory.quantity;
      } else if (row.inventory.location === 'car') {
        data.carQty += row.inventory.quantity;
      }
    }

    // Convert to array, flatten product data, and add totalQty
    const overview = Array.from(productMap.values()).map(data => ({
      gtin: data.product.gtin,
      modelNumber: data.product.modelNumber,
      productName: data.product.name,
      homeQty: data.homeQty,
      carQty: data.carQty,
      totalQty: data.homeQty + data.carQty,
      items: data.items
    }));

    // Sort by model number
    overview.sort((a, b) => {
      const modelA = a.modelNumber.toLowerCase();
      const modelB = b.modelNumber.toLowerCase();
      return modelA.localeCompare(modelB);
    });

    return overview;
  }

  async createInventoryItem(item: InsertInventory): Promise<Inventory> {
    // Normalize expiration date: convert empty string to null
    const normalizedExpiration = item.expirationDate && item.expirationDate.trim() !== '' 
      ? item.expirationDate.trim() 
      : null;
    
    // For lot-tracked items, check if an item with same product, location, lot, and expiration exists
    if (item.trackingMode === 'lot' && item.lotNumber) {
      // Find existing lot items, handling both null and empty string expirations
      const existingItems = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, item.userId),
            eq(inventory.productId, item.productId),
            eq(inventory.location, item.location),
            eq(inventory.trackingMode, 'lot'),
            eq(inventory.lotNumber, item.lotNumber)
          )
        );
      
      // Find matching item with same expiration (normalized comparison)
      const matchingItem = existingItems.find(existing => {
        const existingExp = existing.expirationDate && existing.expirationDate.trim() !== ''
          ? existing.expirationDate.trim()
          : null;
        return existingExp === normalizedExpiration;
      });
      
      if (matchingItem) {
        // Item exists - increment quantity
        const newQuantity = matchingItem.quantity + (item.quantity || 1);
        const updated = await db
          .update(inventory)
          .set({ quantity: newQuantity, updatedAt: new Date() })
          .where(eq(inventory.id, matchingItem.id))
          .returning();
        return updated[0];
      }
    }
    
    // Serial-tracked or new lot-tracked item - create new entry with normalized expiration
    const result = await db.insert(inventory).values({
      ...item,
      expirationDate: normalizedExpiration,
    }).returning();
    return result[0];
  }

  async updateInventoryQuantity(
    userId: string,
    productId: string,
    location: string,
    quantity: number
  ): Promise<Inventory | undefined> {
    // If quantity is 0 or less, delete the inventory row to prevent data bloat
    if (quantity <= 0) {
      const result = await db
        .delete(inventory)
        .where(and(
          eq(inventory.userId, userId),
          eq(inventory.productId, productId),
          eq(inventory.location, location)
        ))
        .returning();
      return result[0];
    }
    
    const result = await db
      .update(inventory)
      .set({ quantity, updatedAt: new Date() })
      .where(and(
        eq(inventory.userId, userId),
        eq(inventory.productId, productId),
        eq(inventory.location, location)
      ))
      .returning();
    return result[0];
  }

  async updateInventoryQuantityById(
    userId: string,
    id: string,
    quantity: number
  ): Promise<Inventory | undefined> {
    // If quantity is 0 or less, delete the inventory row to prevent data bloat
    if (quantity <= 0) {
      const result = await db
        .delete(inventory)
        .where(and(
          eq(inventory.id, id),
          eq(inventory.userId, userId)
        ))
        .returning();
      return result[0];
    }
    
    const result = await db
      .update(inventory)
      .set({ quantity, updatedAt: new Date() })
      .where(and(
        eq(inventory.id, id),
        eq(inventory.userId, userId)
      ))
      .returning();
    return result[0];
  }

  async deleteInventoryItem(userId: string, productId: string, location: string): Promise<boolean> {
    const result = await db
      .delete(inventory)
      .where(and(
        eq(inventory.userId, userId),
        eq(inventory.productId, productId),
        eq(inventory.location, location)
      ))
      .returning();
    return result.length > 0;
  }

  async deleteInventoryItemById(userId: string, id: string): Promise<boolean> {
    const result = await db
      .delete(inventory)
      .where(and(
        eq(inventory.id, id),
        eq(inventory.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  async transferInventoryItem(
    userId: string,
    id: string, 
    toLocation: string, 
    transferQuantity?: number
  ): Promise<Inventory | undefined> {
    const item = await db.select().from(inventory).where(and(
      eq(inventory.id, id),
      eq(inventory.userId, userId)
    ));
    if (!item || item.length === 0) {
      return undefined;
    }

    const sourceItem = item[0];
    const fromLocation = sourceItem.location;
    const productId = sourceItem.productId;
    const sourceQuantity = sourceItem.quantity;

    // Validate transfer quantity
    if (transferQuantity !== undefined) {
      if (transferQuantity <= 0 || transferQuantity > sourceQuantity) {
        throw new Error('Invalid transfer quantity');
      }
      
      // Only lot-tracked items can have partial transfers
      if (sourceItem.trackingMode !== 'lot') {
        throw new Error('Partial transfers are only allowed for lot-tracked items');
      }
    }

    // Determine if this is a partial or full transfer
    const isPartialTransfer = transferQuantity !== undefined && transferQuantity < sourceQuantity;
    const quantityToTransfer = transferQuantity ?? sourceQuantity;

    if (isPartialTransfer) {
      // Partial transfer: reduce source quantity and find/create destination item
      
      // For lot-tracked items, find existing item at destination with same lot/expiration
      const existingDestItem = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.userId, userId),
            eq(inventory.productId, productId),
            eq(inventory.location, toLocation),
            eq(inventory.trackingMode, 'lot'),
            sourceItem.lotNumber 
              ? eq(inventory.lotNumber, sourceItem.lotNumber)
              : isNull(inventory.lotNumber),
            sourceItem.expirationDate 
              ? eq(inventory.expirationDate, sourceItem.expirationDate)
              : isNull(inventory.expirationDate)
          )
        );

      if (existingDestItem.length > 0) {
        // Add to existing destination item
        await db
          .update(inventory)
          .set({ 
            quantity: existingDestItem[0].quantity + quantityToTransfer,
            updatedAt: new Date() 
          })
          .where(eq(inventory.id, existingDestItem[0].id));
      } else {
        // Create new destination item
        await db.insert(inventory).values({
          userId,
          productId,
          location: toLocation,
          quantity: quantityToTransfer,
          trackingMode: 'lot',
          serialNumber: null,
          lotNumber: sourceItem.lotNumber,
          expirationDate: sourceItem.expirationDate,
        });
      }

      // Reduce source quantity
      const updatedSource = await db
        .update(inventory)
        .set({ 
          quantity: sourceQuantity - quantityToTransfer,
          updatedAt: new Date() 
        })
        .where(eq(inventory.id, id))
        .returning();

      return updatedSource[0];
    } else {
      // Full transfer: move the entire item
      const result = await db
        .update(inventory)
        .set({ location: toLocation, updatedAt: new Date() })
        .where(eq(inventory.id, id))
        .returning();

      return result[0];
    }
  }

  async getLowStockItems(userId: string, location?: string): Promise<(Inventory & { product: Product })[]> {
    if (location === 'car') {
      // For car stock: check user's product settings and compare car stock to minCarStock
      const userSettings = await this.getUserProductSettings(userId);
      
      // Get user's car inventory
      const allCarInventory = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(and(
          eq(inventory.userId, userId),
          eq(inventory.location, 'car')
        ));

      // Group by productId and sum quantities
      const carStockMap = new Map<string, number>();
      for (const item of allCarInventory) {
        carStockMap.set(item.productId, (carStockMap.get(item.productId) || 0) + item.quantity);
      }

      // Iterate over user settings only and check against minCarStock
      const lowStockProducts: (Inventory & { product: Product; userSettings?: UserProductSettings })[] = [];
      
      // Fetch all products for the configured settings in one query
      const productIds = userSettings.map(s => s.productId);
      const productMap = new Map<string, Product>();
      if (productIds.length > 0) {
        const productsForSettings = await db.select().from(products).where(
          inArray(products.id, productIds)
        );
        for (const product of productsForSettings) {
          productMap.set(product.id, product);
        }
      }
      
      for (const settings of userSettings) {
        const product = productMap.get(settings.productId);
        if (product) {
          const carStock = carStockMap.get(settings.productId) || 0;
          if (carStock < settings.minCarStock) {
            // Create a dummy inventory item for low stock reporting
            lowStockProducts.push({
              id: product.id,
              userId,
              productId: product.id,
              location: 'car',
              quantity: carStock,
              trackingMode: null,
              serialNumber: null,
              lotNumber: null,
              expirationDate: null,
              updatedAt: null,
              product,
              userSettings: settings,
            });
          }
        }
      }

      return lowStockProducts;
    } else if (location === 'home') {
      // For home stock: check user's product settings and compare total stock to minTotalStock
      const userSettings = await this.getUserProductSettings(userId);
      
      // Get user's inventory across all locations
      const allInventory = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(eq(inventory.userId, userId));

      // Group by productId and sum quantities across all locations
      const totalStockMap = new Map<string, number>();
      for (const item of allInventory) {
        totalStockMap.set(item.productId, (totalStockMap.get(item.productId) || 0) + item.quantity);
      }

      // Iterate over user settings only and check against minTotalStock
      const lowStockProducts: (Inventory & { product: Product; userSettings?: UserProductSettings })[] = [];
      
      // Fetch all products for the configured settings in one query
      const productIds = userSettings.map(s => s.productId);
      const productMap = new Map<string, Product>();
      if (productIds.length > 0) {
        const productsForSettings = await db.select().from(products).where(
          inArray(products.id, productIds)
        );
        for (const product of productsForSettings) {
          productMap.set(product.id, product);
        }
      }
      
      for (const settings of userSettings) {
        const product = productMap.get(settings.productId);
        if (product) {
          const totalStock = totalStockMap.get(settings.productId) || 0;
          if (totalStock < settings.minTotalStock) {
            // Create a dummy inventory item for low stock reporting
            lowStockProducts.push({
              id: product.id,
              userId,
              productId: product.id,
              location: 'home',
              quantity: totalStock,
              trackingMode: null,
              serialNumber: null,
              lotNumber: null,
              expirationDate: null,
              updatedAt: null,
              product,
              userSettings: settings,
            });
          }
        }
      }

      return lowStockProducts;
    } else {
      // For total stock (no location specified): check user's product settings and compare total stock to minTotalStock
      const userSettings = await this.getUserProductSettings(userId);
      
      // Get user's inventory across all locations
      const allInventory = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(eq(inventory.userId, userId));

      // Group by productId and sum quantities across all locations
      const totalStockMap = new Map<string, number>();
      for (const item of allInventory) {
        totalStockMap.set(item.productId, (totalStockMap.get(item.productId) || 0) + item.quantity);
      }

      // Iterate over user settings only and check against minTotalStock
      const lowStockProducts: (Inventory & { product: Product; userSettings?: UserProductSettings })[] = [];
      
      // Fetch all products for the configured settings in one query
      const productIds = userSettings.map(s => s.productId);
      const productMap = new Map<string, Product>();
      if (productIds.length > 0) {
        const productsForSettings = await db.select().from(products).where(
          inArray(products.id, productIds)
        );
        for (const product of productsForSettings) {
          productMap.set(product.id, product);
        }
      }
      
      for (const settings of userSettings) {
        const product = productMap.get(settings.productId);
        if (product) {
          const totalStock = totalStockMap.get(settings.productId) || 0;
          if (totalStock < settings.minTotalStock) {
            // Create a dummy inventory item for low stock reporting
            lowStockProducts.push({
              id: product.id,
              userId,
              productId: product.id,
              location: undefined as any,
              quantity: totalStock,
              trackingMode: null,
              serialNumber: null,
              lotNumber: null,
              expirationDate: null,
              updatedAt: null,
              product,
              userSettings: settings,
            });
          }
        }
      }

      return lowStockProducts;
    }
  }

  // Hospitals (global - shared across all users)
  async getHospitals(): Promise<Hospital[]> {
    return await db.select().from(hospitals);
  }

  async getHospital(id: string): Promise<Hospital | undefined> {
    const result = await db.select().from(hospitals).where(eq(hospitals.id, id));
    return result[0];
  }

  async createHospital(hospital: InsertHospital): Promise<Hospital> {
    const result = await db.insert(hospitals).values(hospital).returning();
    return result[0];
  }

  async updateHospital(id: string, hospital: Partial<InsertHospital>): Promise<Hospital | undefined> {
    const result = await db
      .update(hospitals)
      .set(hospital)
      .where(eq(hospitals.id, id))
      .returning();
    return result[0];
  }

  async deleteHospital(id: string): Promise<boolean> {
    // Check if hospital is used in any procedures across all users
    const procedures = await db
      .select()
      .from(implantProcedures)
      .where(eq(implantProcedures.hospitalId, id))
      .limit(1);
    
    if (procedures.length > 0) {
      throw new Error('Cannot delete hospital: it has associated implant procedures. Delete all procedures first.');
    }
    
    // Safe to delete the hospital
    const result = await db.delete(hospitals).where(eq(hospitals.id, id)).returning();
    return result.length > 0;
  }

  // Implant Procedures
  async getImplantProcedures(userId: string): Promise<(ImplantProcedure & { hospital: Hospital; deviceProduct?: Product | null })[]> {
    return await db
      .select({
        id: implantProcedures.id,
        userId: implantProcedures.userId,
        hospitalId: implantProcedures.hospitalId,
        implantDate: implantProcedures.implantDate,
        procedureType: implantProcedures.procedureType,
        deviceUsed: implantProcedures.deviceUsed,
        deviceSerialNumber: implantProcedures.deviceSerialNumber,
        deviceLotNumber: implantProcedures.deviceLotNumber,
        deviceSource: implantProcedures.deviceSource,
        notes: implantProcedures.notes,
        createdAt: implantProcedures.createdAt,
        hospital: hospitals,
        deviceProduct: products,
      })
      .from(implantProcedures)
      .innerJoin(hospitals, eq(implantProcedures.hospitalId, hospitals.id))
      .leftJoin(products, eq(implantProcedures.deviceUsed, products.id))
      .where(eq(implantProcedures.userId, userId))
      .orderBy(desc(implantProcedures.implantDate));
  }

  async getImplantProcedure(userId: string, id: string): Promise<any> {
    const result = await db
      .select({
        id: implantProcedures.id,
        userId: implantProcedures.userId,
        hospitalId: implantProcedures.hospitalId,
        implantDate: implantProcedures.implantDate,
        procedureType: implantProcedures.procedureType,
        deviceUsed: implantProcedures.deviceUsed,
        deviceSerialNumber: implantProcedures.deviceSerialNumber,
        deviceLotNumber: implantProcedures.deviceLotNumber,
        deviceSource: implantProcedures.deviceSource,
        notes: implantProcedures.notes,
        createdAt: implantProcedures.createdAt,
        hospital: hospitals,
        deviceProduct: products,
      })
      .from(implantProcedures)
      .leftJoin(hospitals, eq(implantProcedures.hospitalId, hospitals.id))
      .leftJoin(products, eq(implantProcedures.deviceUsed, products.id))
      .where(and(
        eq(implantProcedures.userId, userId),
        eq(implantProcedures.id, id)
      ));
    return result[0];
  }

  async createImplantProcedure(
    procedure: InsertImplantProcedure,
    materials: InsertProcedureMaterial[]
  ): Promise<ImplantProcedure> {
    // Validate stock availability before proceeding
    // Check primary device stock if specified AND source is car (or undefined for backwards compatibility)
    if (procedure.deviceUsed && (!procedure.deviceSource || procedure.deviceSource === 'car')) {
      const deviceInventory = await this.getInventoryItem(procedure.userId, procedure.deviceUsed, 'car');
      if (!deviceInventory || deviceInventory.quantity < 1) {
        const product = await this.getProduct(procedure.deviceUsed);
        throw new Error(`Insufficient stock for primary device ${product?.name || procedure.deviceUsed}. Available: ${deviceInventory?.quantity || 0}, Required: 1`);
      }
    }
    
    // Check materials stock
    for (const material of materials) {
      if (material.source === 'car' && material.productId && material.quantity) {
        const inventoryItem = await this.getInventoryItem(procedure.userId, material.productId, 'car');
        if (!inventoryItem) {
          throw new Error(`Product ${material.productId} not found in car inventory`);
        }
        if (inventoryItem.quantity < material.quantity) {
          throw new Error(
            `Insufficient stock for product ${material.productId}. Available: ${inventoryItem.quantity}, Required: ${material.quantity}`
          );
        }
      }
    }

    try {
      // Create procedure
      const procedureResult = await db
        .insert(implantProcedures)
        .values(procedure)
        .returning();
      const createdProcedure = procedureResult[0];

      // Deduct primary device from car inventory if specified AND source is car (or undefined for backwards compatibility)
      if (procedure.deviceUsed && (!procedure.deviceSource || procedure.deviceSource === 'car')) {
        const deviceInventory = await this.getInventoryItem(procedure.userId, procedure.deviceUsed, 'car');
        if (deviceInventory) {
          const newQuantity = deviceInventory.quantity - 1;
          await this.updateInventoryQuantity(procedure.userId, procedure.deviceUsed, 'car', newQuantity);
        }
      }

      // Insert materials and deduct from car inventory
      for (const material of materials) {
        await db.insert(procedureMaterials).values({
          ...material,
          procedureId: createdProcedure.id,
        });

        // Deduct from car inventory if source is 'car'
        if (material.source === 'car' && material.productId && material.quantity) {
          const inventoryItem = await this.getInventoryItem(procedure.userId, material.productId, 'car');
          if (inventoryItem) {
            const newQuantity = inventoryItem.quantity - material.quantity;
            await this.updateInventoryQuantity(procedure.userId, material.productId, 'car', newQuantity);
          }
        }
      }

      return createdProcedure;
    } catch (error) {
      // If any part fails, log error - note: neon-http doesn't support transactions
      // In a production app, consider using a different driver or implementing compensating transactions
      // SECURITY: Only log error type, not full error object to prevent sensitive data exposure
      console.error('Failed to create implant procedure:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Failed to create implant procedure. Database operation failed.');
    }
  }

  async getProcedureMaterials(procedureId: string): Promise<any[]> {
    return await db
      .select({
        id: procedureMaterials.id,
        procedureId: procedureMaterials.procedureId,
        productId: procedureMaterials.productId,
        materialName: procedureMaterials.materialName,
        quantity: procedureMaterials.quantity,
        source: procedureMaterials.source,
        serialNumber: procedureMaterials.serialNumber,
        lotNumber: procedureMaterials.lotNumber,
        product: {
          id: products.id,
          gtin: products.gtin,
          modelNumber: products.modelNumber,
          name: products.name,
          boxGtin: products.boxGtin,
          boxQuantity: products.boxQuantity,
          createdAt: products.createdAt,
        },
      })
      .from(procedureMaterials)
      .leftJoin(products, eq(procedureMaterials.productId, products.id))
      .where(eq(procedureMaterials.procedureId, procedureId));
  }

  async updateImplantProcedure(
    userId: string,
    id: string,
    procedureData: Partial<InsertImplantProcedure>
  ): Promise<ImplantProcedure | null> {
    const result = await db
      .update(implantProcedures)
      .set(procedureData)
      .where(and(
        eq(implantProcedures.id, id),
        eq(implantProcedures.userId, userId)
      ))
      .returning();
    return result[0] || null;
  }

  async deleteImplantProcedure(userId: string, id: string): Promise<boolean> {
    // First verify ownership
    const procedure = await this.getImplantProcedure(userId, id);
    if (!procedure) {
      return false;
    }
    
    // Delete all associated materials
    await db.delete(procedureMaterials).where(eq(procedureMaterials.procedureId, id));
    
    // Then delete the procedure
    const result = await db
      .delete(implantProcedures)
      .where(and(
        eq(implantProcedures.id, id),
        eq(implantProcedures.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  // User Product Settings
  async getUserProductSettings(userId: string, productId?: string): Promise<UserProductSettings[]> {
    if (productId) {
      const result = await db
        .select()
        .from(userProductSettings)
        .where(and(
          eq(userProductSettings.userId, userId),
          eq(userProductSettings.productId, productId)
        ));
      return result;
    }
    
    return await db
      .select()
      .from(userProductSettings)
      .where(eq(userProductSettings.userId, userId));
  }

  async upsertUserProductSettings(
    userId: string,
    productId: string,
    settings: { minCarStock: number, minTotalStock: number }
  ): Promise<UserProductSettings> {
    // Check if settings exist
    const existing = await db
      .select()
      .from(userProductSettings)
      .where(and(
        eq(userProductSettings.userId, userId),
        eq(userProductSettings.productId, productId)
      ));

    if (existing.length > 0) {
      // Update existing settings
      const updated = await db
        .update(userProductSettings)
        .set({
          minCarStock: settings.minCarStock,
          minTotalStock: settings.minTotalStock,
        })
        .where(and(
          eq(userProductSettings.userId, userId),
          eq(userProductSettings.productId, productId)
        ))
        .returning();
      return updated[0];
    } else {
      // Insert new settings
      const inserted = await db
        .insert(userProductSettings)
        .values({
          userId,
          productId,
          minCarStock: settings.minCarStock,
          minTotalStock: settings.minTotalStock,
        })
        .returning();
      return inserted[0];
    }
  }

  // User Management
  async getAllUsers(): Promise<{ userId: string; email: string; isAdmin: boolean; isPrimeAdmin: boolean; inventoryCount: number; recentProcedureCount: number }[]> {
    const primeAdminEmail = process.env.AUTH0_ADMIN_EMAIL;
    
    // Get all users from users table
    const allUsers = await db.select().from(users);

    // Get admin users
    const adminUserRecords = await db.select().from(adminUsers);
    const adminUserIds = new Set(adminUserRecords.map(a => a.userId));

    // Get inventory counts per user
    const inventoryUsers = await db
      .select({
        userId: inventory.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(inventory)
      .groupBy(inventory.userId);

    // Get procedures from last 90 days per user
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const procedureUsers = await db
      .select({
        userId: implantProcedures.userId,
        count: sql<number>`count(*)::int`,
      })
      .from(implantProcedures)
      .where(sql`${implantProcedures.implantDate} >= ${ninetyDaysAgo.toISOString().split('T')[0]}`)
      .groupBy(implantProcedures.userId);

    // Build result with counts
    const userStats = allUsers.map(user => {
      const invCount = inventoryUsers.find(u => u.userId === user.userId)?.count || 0;
      const procCount = procedureUsers.find(u => u.userId === user.userId)?.count || 0;
      const isPrimeAdmin = user.email === primeAdminEmail;
      const isAdmin = isPrimeAdmin || adminUserIds.has(user.userId);

      return {
        userId: user.userId,
        email: user.email,
        isAdmin,
        isPrimeAdmin,
        inventoryCount: invCount,
        recentProcedureCount: procCount,
      };
    });

    return userStats;
  }

  async grantAdminAccess(userId: string, userEmail: string, grantedBy: string): Promise<void> {
    await db
      .insert(adminUsers)
      .values({
        userId,
        userEmail,
        grantedBy,
      })
      .onConflictDoNothing();
  }

  async revokeAdminAccess(userId: string): Promise<void> {
    await db
      .delete(adminUsers)
      .where(eq(adminUsers.userId, userId));
  }

  // Quick Search
  async quickSearchBySerialOrLot(userId: string, query: string): Promise<{
    inventoryItems: (Inventory & { product: Product })[];
    procedures: (ImplantProcedure & { hospital: Hospital; deviceProduct?: Product | null })[];
  }> {
    const trimmedQuery = query.trim();
    
    // Search inventory items by serial number or lot number
    const inventoryItems = await db
      .select()
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(
        and(
          eq(inventory.userId, userId),
          or(
            eq(inventory.serialNumber, trimmedQuery),
            eq(inventory.lotNumber, trimmedQuery)
          )
        )
      );
    
    // Search procedures by device serial number
    const proceduresByDevice = await db
      .select()
      .from(implantProcedures)
      .leftJoin(hospitals, eq(implantProcedures.hospitalId, hospitals.id))
      .leftJoin(products, eq(implantProcedures.deviceUsed, products.id))
      .where(
        and(
          eq(implantProcedures.userId, userId),
          eq(implantProcedures.deviceSerialNumber, trimmedQuery)
        )
      );
    
    // Search procedures by materials serial/lot number
    const proceduresByMaterials = await db
      .select({
        procedure: implantProcedures,
        hospital: hospitals,
        deviceProduct: products
      })
      .from(procedureMaterials)
      .innerJoin(implantProcedures, eq(procedureMaterials.procedureId, implantProcedures.id))
      .leftJoin(hospitals, eq(implantProcedures.hospitalId, hospitals.id))
      .leftJoin(products, eq(implantProcedures.deviceUsed, products.id))
      .where(
        and(
          eq(implantProcedures.userId, userId),
          or(
            eq(procedureMaterials.serialNumber, trimmedQuery),
            eq(procedureMaterials.lotNumber, trimmedQuery)
          )
        )
      );
    
    // Combine and deduplicate procedures
    const allProcedures = [
      ...proceduresByDevice.map(p => ({
        ...p.implant_procedures,
        hospital: p.hospitals!,
        deviceProduct: p.products
      })),
      ...proceduresByMaterials.map(p => ({
        ...p.procedure,
        hospital: p.hospital!,
        deviceProduct: p.deviceProduct
      }))
    ];
    
    // Deduplicate by procedure ID
    const uniqueProcedures = allProcedures.filter((proc, index, self) => 
      index === self.findIndex(p => p.id === proc.id)
    );
    
    return {
      inventoryItems: inventoryItems.map(item => ({
        ...item.inventory,
        product: item.products
      })),
      procedures: uniqueProcedures
    };
  }

  // User Preferences
  async getUserLanguage(userId: string): Promise<string> {
    const result = await db
      .select({ language: users.language })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    
    return result[0]?.language || 'de'; // Default to German
  }

  async updateUserLanguage(userId: string, language: string): Promise<void> {
    await db
      .update(users)
      .set({ language })
      .where(eq(users.userId, userId));
  }

  // Stock Count Methods
  async createStockCountSession(session: InsertStockCountSession): Promise<StockCountSession> {
    const result = await db.insert(stockCountSessions).values(session).returning();
    return result[0];
  }

  async getActiveStockCountSession(userId: string): Promise<StockCountSession | undefined> {
    const result = await db
      .select()
      .from(stockCountSessions)
      .where(
        and(
          eq(stockCountSessions.userId, userId),
          eq(stockCountSessions.status, 'in_progress')
        )
      )
      .orderBy(desc(stockCountSessions.startedAt))
      .limit(1);
    
    return result[0];
  }

  async getStockCountSession(userId: string, sessionId: string): Promise<StockCountSession | undefined> {
    const result = await db
      .select()
      .from(stockCountSessions)
      .where(
        and(
          eq(stockCountSessions.id, sessionId),
          eq(stockCountSessions.userId, userId)
        )
      )
      .limit(1);
    
    return result[0];
  }

  async addStockCountItem(item: InsertStockCountItem): Promise<StockCountItem> {
    // For lot-tracked items, check if same lot already scanned in this session
    if (item.trackingMode === 'lot' && item.lotNumber) {
      const existing = await db
        .select()
        .from(stockCountItems)
        .where(
          and(
            eq(stockCountItems.sessionId, item.sessionId),
            eq(stockCountItems.productId, item.productId),
            eq(stockCountItems.lotNumber, item.lotNumber),
            eq(stockCountItems.scannedLocation, item.scannedLocation)
          )
        )
        .limit(1);
      
      // If exists, increment quantity
      if (existing[0]) {
        const updated = await db
          .update(stockCountItems)
          .set({ quantity: existing[0].quantity + (item.quantity || 1) })
          .where(eq(stockCountItems.id, existing[0].id))
          .returning();
        
        return updated[0];
      }
    }
    
    // Otherwise insert new item
    const result = await db.insert(stockCountItems).values(item).returning();
    return result[0];
  }

  async getStockCountItems(sessionId: string): Promise<(StockCountItem & { product: Product })[]> {
    const result = await db
      .select()
      .from(stockCountItems)
      .innerJoin(products, eq(stockCountItems.productId, products.id))
      .where(eq(stockCountItems.sessionId, sessionId))
      .orderBy(desc(stockCountItems.scannedAt));
    
    return result.map(row => ({
      ...row.stock_count_items,
      product: row.products
    }));
  }

  async deleteStockCountItem(itemId: string): Promise<void> {
    await db
      .delete(stockCountItems)
      .where(eq(stockCountItems.id, itemId));
  }

  async completeStockCountSession(
    userId: string, 
    sessionId: string, 
    completedBy: string,
    summary: {
      matched: number;
      transferred: number;
      newItems: number;
      markedMissing: number;
      derecognized: number;
    }
  ): Promise<void> {
    await db
      .update(stockCountSessions)
      .set({ 
        status: 'completed',
        completedAt: sql`now()`,
        completedBy,
        completionSummary: summary,
      })
      .where(
        and(
          eq(stockCountSessions.id, sessionId),
          eq(stockCountSessions.userId, userId)
        )
      );
  }

  async cancelStockCountSession(userId: string, sessionId: string): Promise<void> {
    await db
      .update(stockCountSessions)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(stockCountSessions.id, sessionId),
          eq(stockCountSessions.userId, userId)
        )
      );
  }

  async calculateDiscrepancies(userId: string, sessionId: string): Promise<{
    missing: (Inventory & { product: Product })[];
    found: (StockCountItem & { product: Product; existsInHome?: boolean })[];
    matched: (StockCountItem & { product: Product; inventoryId: string })[];
  }> {
    const session = await this.getStockCountSession(userId, sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get all scanned items
    const scannedItems = await this.getStockCountItems(sessionId);
    console.log('📊 Scanned items:', scannedItems.length, 'items');
    scannedItems.forEach(item => {
      console.log(`  - Product: ${item.productId}, Tracking: ${item.trackingMode}, Qty: ${item.quantity}, Serial: ${item.serialNumber}, Lot: ${item.lotNumber}`);
    });

    // Get current inventory based on count type
    const locations = session.countType === 'car' ? ['car'] : ['home', 'car'];
    const currentInventory = await db
      .select()
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(
        and(
          eq(inventory.userId, userId),
          inArray(inventory.location, locations)
        )
      );

    const inventoryWithProduct = currentInventory.map(row => ({
      ...row.inventory,
      product: row.products
    }));
    
    console.log('📦 Inventory items:', inventoryWithProduct.length, 'items');
    inventoryWithProduct.forEach(item => {
      console.log(`  - Product: ${item.productId}, Tracking: ${item.trackingMode}, Qty: ${item.quantity}, Serial: ${item.serialNumber}, Lot: ${item.lotNumber}, Location: ${item.location}`);
    });

    // Get ALL home inventory for checking if items exist in home
    const allHomeInventory = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.userId, userId),
          eq(inventory.location, 'home')
        )
      );

    // Track which inventory items have been matched (to prevent double-matching)
    const matchedInventoryIds = new Set<string>();
    // Track matched quantities for lot-tracked items
    const matchedQuantities = new Map<string, number>();

    // Match scanned items to inventory
    const matched: (StockCountItem & { product: Product; inventoryId: string })[] = [];
    const found: (StockCountItem & { product: Product; existsInHome?: boolean })[] = [];

    for (const scanned of scannedItems) {
      let matchedInv: typeof inventoryWithProduct[0] | undefined;

      if (scanned.trackingMode === 'serial' && scanned.serialNumber) {
        // Match by serial number (find unmatched item)
        matchedInv = inventoryWithProduct.find(
          inv => inv.serialNumber === scanned.serialNumber && !matchedInventoryIds.has(inv.id)
        );
      } else if (scanned.trackingMode === 'lot' && scanned.lotNumber) {
        // Match by lot number - check quantity hasn't been exceeded
        matchedInv = inventoryWithProduct.find(inv => {
          if (inv.lotNumber === scanned.lotNumber && inv.productId === scanned.productId) {
            const alreadyMatched = matchedQuantities.get(inv.id) || 0;
            return alreadyMatched < inv.quantity;
          }
          return false;
        });
      } else {
        // Non-tracked: match by product only - check quantity hasn't been exceeded
        matchedInv = inventoryWithProduct.find(inv => {
          if (inv.productId === scanned.productId && !inv.serialNumber && !inv.lotNumber) {
            const alreadyMatched = matchedQuantities.get(inv.id) || 0;
            return alreadyMatched < inv.quantity;
          }
          return false;
        });
      }

      if (matchedInv) {
        // Check if location matches
        if (matchedInv.location === scanned.scannedLocation) {
          console.log(`✅ MATCHED: Scanned item (${scanned.trackingMode}, qty=${scanned.quantity}) matched to inventory (id=${matchedInv.id}, qty=${matchedInv.quantity})`);
          
          // Track quantity matched for lot-tracked and non-tracked items
          if (scanned.trackingMode === 'lot' || !scanned.trackingMode) {
            const currentMatched = matchedQuantities.get(matchedInv.id) || 0;
            const availableToMatch = matchedInv.quantity - currentMatched;
            const actuallyMatched = Math.min(scanned.quantity, availableToMatch);
            const surplus = scanned.quantity - actuallyMatched;
            
            console.log(`  📊 Quantity tracking: ${currentMatched} + ${scanned.quantity} = ${currentMatched + scanned.quantity} (inv has ${matchedInv.quantity}, available=${availableToMatch})`);
            console.log(`  📊 Split: ${actuallyMatched} matched, ${surplus} surplus`);
            
            if (actuallyMatched > 0) {
              // Add matched portion
              matched.push({ ...scanned, quantity: actuallyMatched, inventoryId: matchedInv.id });
              matchedQuantities.set(matchedInv.id, currentMatched + actuallyMatched);
            }
            
            if (surplus > 0) {
              // Add surplus portion to found items
              console.log(`  ⚠️ SURPLUS: ${surplus} units exceed inventory`);
              const existsInHome = allHomeInventory.some(homeInv => {
                if (scanned.trackingMode === 'lot' && scanned.lotNumber) {
                  return homeInv.lotNumber === scanned.lotNumber && homeInv.productId === scanned.productId;
                } else {
                  return homeInv.productId === scanned.productId && !homeInv.serialNumber && !homeInv.lotNumber;
                }
              });
              found.push({ ...scanned, quantity: surplus, existsInHome });
            }
          } else {
            // Serial-tracked items: 1:1 matching
            matched.push({ ...scanned, inventoryId: matchedInv.id });
            matchedInventoryIds.add(matchedInv.id);
          }
        } else {
          // Found in different location than system thinks
          const existsInHome = allHomeInventory.some(homeInv => {
            if (scanned.trackingMode === 'serial' && scanned.serialNumber) {
              return homeInv.serialNumber === scanned.serialNumber;
            } else if (scanned.trackingMode === 'lot' && scanned.lotNumber) {
              return homeInv.lotNumber === scanned.lotNumber && homeInv.productId === scanned.productId;
            } else {
              return homeInv.productId === scanned.productId && !homeInv.serialNumber && !homeInv.lotNumber;
            }
          });
          found.push({ ...scanned, existsInHome });
        }
      } else {
        // Not in system at all (or quantity exceeded) - check if exists in home
        console.log(`⚠️ NOT MATCHED: Scanned item (${scanned.trackingMode}, qty=${scanned.quantity}) - marking as found`);
        const existsInHome = allHomeInventory.some(homeInv => {
          if (scanned.trackingMode === 'serial' && scanned.serialNumber) {
            return homeInv.serialNumber === scanned.serialNumber;
          } else if (scanned.trackingMode === 'lot' && scanned.lotNumber) {
            return homeInv.lotNumber === scanned.lotNumber && homeInv.productId === scanned.productId;
          } else {
            return homeInv.productId === scanned.productId && !homeInv.serialNumber && !homeInv.lotNumber;
          }
        });
        console.log(`  📦 Exists in home: ${existsInHome}`);
        found.push({ ...scanned, existsInHome });
      }
    }
    
    console.log(`\n📋 Results: ${matched.length} matched, ${found.length} found, ${inventoryWithProduct.length} total inventory`);

    // Find missing items (in system but not scanned, or not fully scanned for lot-tracked)
    const missing = inventoryWithProduct.filter(inv => {
      // For serial-tracked items, check if ID was matched
      if (inv.trackingMode === 'serial') {
        return !matchedInventoryIds.has(inv.id);
      }
      // For lot-tracked and non-tracked, check if quantity was fully matched
      const matchedQty = matchedQuantities.get(inv.id) || 0;
      return matchedQty < inv.quantity;
    });

    return { missing, found, matched };
  }

  async applyStockCountAdjustments(
    userId: string,
    sessionId: string,
    adjustments: {
      transfers: { itemId: string; fromLocation: string; toLocation: string; quantity?: number }[];
      missing: { inventoryId: string; action: 'mark_missing' | 'derecognized' }[];
      newItems: { scannedItemId: string; location: string }[];
      deleteInvestigated: string[];
    },
    matchedCount: number
  ): Promise<{
    matched: number;
    transferred: number;
    newItems: number;
    markedMissing: number;
    derecognized: number;
  }> {
    let markedMissingCount = 0;
    let derecognizedCount = 0;

    // Note: Neon HTTP driver doesn't support transactions, so we execute sequentially
    // Apply transfers
    for (const transfer of adjustments.transfers) {
      const scannedItem = await db
        .select()
        .from(stockCountItems)
        .where(eq(stockCountItems.id, transfer.itemId))
        .limit(1);

      if (scannedItem[0]) {
        // Find the inventory item in wrong location
        let invItem;
        if (scannedItem[0].trackingMode === 'serial' && scannedItem[0].serialNumber) {
          const result = await db
            .select()
            .from(inventory)
            .where(
              and(
                eq(inventory.userId, userId),
                eq(inventory.serialNumber, scannedItem[0].serialNumber)
              )
            )
            .limit(1);
          invItem = result[0];
        } else if (scannedItem[0].trackingMode === 'lot' && scannedItem[0].lotNumber) {
          const result = await db
            .select()
            .from(inventory)
            .where(
              and(
                eq(inventory.userId, userId),
                eq(inventory.productId, scannedItem[0].productId),
                eq(inventory.lotNumber, scannedItem[0].lotNumber),
                eq(inventory.location, transfer.fromLocation)
              )
            )
            .limit(1);
          invItem = result[0];
        }

        if (invItem) {
          const transferQty = transfer.quantity || invItem.quantity;

          if (transferQty >= invItem.quantity) {
            // Transfer entire item
            await db
              .update(inventory)
              .set({ location: transfer.toLocation, updatedAt: sql`now()` })
              .where(eq(inventory.id, invItem.id));
          } else {
            // Partial transfer for lot-tracked items
            await db
              .update(inventory)
              .set({ quantity: invItem.quantity - transferQty, updatedAt: sql`now()` })
              .where(eq(inventory.id, invItem.id));

            // Create new item in target location
            await db.insert(inventory).values({
              userId,
              productId: invItem.productId,
              location: transfer.toLocation,
              quantity: transferQty,
              trackingMode: invItem.trackingMode,
              lotNumber: invItem.lotNumber,
              expirationDate: invItem.expirationDate,
            });
          }
        }
      }
    }

    // Handle missing items
    for (const missing of adjustments.missing) {
      if (missing.action === 'derecognized') {
        derecognizedCount++;
        // Delete immediately
        await db
          .delete(inventory)
          .where(
            and(
              eq(inventory.id, missing.inventoryId),
              eq(inventory.userId, userId)
            )
          );
      } else {
        markedMissingCount++;
      }
      // For 'mark_missing', we just leave them in system for investigation
    }

    // Add new items from scanned
    for (const newItem of adjustments.newItems) {
      const scannedItem = await db
        .select()
        .from(stockCountItems)
        .where(eq(stockCountItems.id, newItem.scannedItemId))
        .limit(1);

      if (scannedItem[0]) {
        await db.insert(inventory).values({
          userId,
          productId: scannedItem[0].productId,
          location: newItem.location,
          quantity: scannedItem[0].quantity,
          trackingMode: scannedItem[0].trackingMode,
          serialNumber: scannedItem[0].serialNumber,
          lotNumber: scannedItem[0].lotNumber,
          expirationDate: scannedItem[0].expirationDate,
        });
      }
    }

    // Delete investigated items user confirmed to remove
    if (adjustments.deleteInvestigated.length > 0) {
      await db
        .delete(inventory)
        .where(
          and(
            eq(inventory.userId, userId),
            inArray(inventory.id, adjustments.deleteInvestigated)
          )
        );
    }

    return {
      matched: matchedCount,
      transferred: adjustments.transfers.length,
      newItems: adjustments.newItems.length,
      markedMissing: markedMissingCount,
      derecognized: derecognizedCount,
    };
  }

  async getStockCountHistory(userId: string, limit: number = 50): Promise<StockCountSession[]> {
    const sessions = await db
      .select()
      .from(stockCountSessions)
      .where(
        and(
          eq(stockCountSessions.userId, userId),
          eq(stockCountSessions.status, 'completed')
        )
      )
      .orderBy(desc(stockCountSessions.completedAt))
      .limit(limit);
    
    return sessions;
  }

  async cleanupOldStockCounts(): Promise<number> {
    // Delete stock count sessions older than 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // First delete stock count items for these sessions
    const oldSessions = await db
      .select({ id: stockCountSessions.id })
      .from(stockCountSessions)
      .where(
        and(
          eq(stockCountSessions.status, 'completed'),
          sql`${stockCountSessions.completedAt} < ${twelveMonthsAgo.toISOString()}`
        )
      );

    if (oldSessions.length > 0) {
      const sessionIds = oldSessions.map(s => s.id);
      
      // Delete items first (foreign key constraint)
      await db
        .delete(stockCountItems)
        .where(inArray(stockCountItems.sessionId, sessionIds));
      
      // Then delete sessions
      const result = await db
        .delete(stockCountSessions)
        .where(inArray(stockCountSessions.id, sessionIds))
        .returning();
      
      return result.length;
    }

    return 0;
  }
}

export const storage = new DatabaseStorage();
