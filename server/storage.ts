import { eq, and, sql, desc, isNull, gt } from "drizzle-orm";
import { db } from "./db";
import {
  products,
  inventory,
  hospitals,
  implantProcedures,
  procedureMaterials,
  stockTransfers,
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
  type StockTransfer,
  type InsertStockTransfer,
} from "@shared/schema";

export interface IStorage {
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductByGtin(gtin: string): Promise<Product | undefined>;
  searchProducts(query: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Inventory
  getInventory(location?: string): Promise<(Inventory & { product: Product })[]>;
  getInventoryItem(productId: string, location: string): Promise<Inventory | undefined>;
  getInventorySummary(location?: string): Promise<{ product: Product; totalQuantity: number; location?: string }[]>;
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryQuantity(productId: string, location: string, quantity: number): Promise<Inventory | undefined>;
  deleteInventoryItem(productId: string, location: string): Promise<boolean>;

  // Hospitals
  getHospitals(): Promise<Hospital[]>;
  getHospital(id: string): Promise<Hospital | undefined>;
  createHospital(hospital: InsertHospital): Promise<Hospital>;
  updateHospital(id: string, hospital: Partial<InsertHospital>): Promise<Hospital | undefined>;
  deleteHospital(id: string): Promise<boolean>;

  // Implant Procedures
  getImplantProcedures(): Promise<(ImplantProcedure & { hospital: Hospital })[]>;
  getImplantProcedure(id: string): Promise<ImplantProcedure | undefined>;
  createImplantProcedure(procedure: InsertImplantProcedure, materials: InsertProcedureMaterial[]): Promise<ImplantProcedure>;
  getProcedureMaterials(procedureId: string): Promise<ProcedureMaterial[]>;

  // Stock Transfers
  getStockTransfers(): Promise<(StockTransfer & { product: Product })[]>;
  createStockTransfer(transfer: InsertStockTransfer): Promise<StockTransfer>;
  
  // Individual inventory item methods (for serial-tracked items)
  updateInventoryQuantityById(id: string, quantity: number): Promise<Inventory | undefined>;
  deleteInventoryItemById(id: string): Promise<boolean>;
  transferInventoryItem(id: string, toLocation: string): Promise<Inventory | undefined>;
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
      sql`${products.modelNumber} = ${query} OR ${products.gtin} = ${query}`
    );
    return result;
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
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Inventory
  async getInventory(location?: string): Promise<(Inventory & { product: Product })[]> {
    const query = db
      .select({
        id: inventory.id,
        productId: inventory.productId,
        location: inventory.location,
        quantity: inventory.quantity,
        trackingMode: inventory.trackingMode,
        serialNumber: inventory.serialNumber,
        lotNumber: inventory.lotNumber,
        expirationDate: inventory.expirationDate,
        updatedAt: inventory.updatedAt,
        product: products,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id));

    if (location) {
      return await query.where(and(
        eq(inventory.location, location),
        gt(inventory.quantity, 0)
      ));
    }

    return await query.where(gt(inventory.quantity, 0));
  }

  async getInventoryItem(productId: string, location: string): Promise<Inventory | undefined> {
    const result = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.productId, productId), eq(inventory.location, location)));
    return result[0];
  }

  async getInventorySummary(location?: string): Promise<{ product: Product; totalQuantity: number; location?: string }[]> {
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
        .where(gt(inventory.quantity, 0));
    } else {
      // No location specified: show total stock
      inventoryItems = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(gt(inventory.quantity, 0));
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
    productId: string,
    location: string,
    quantity: number
  ): Promise<Inventory | undefined> {
    // If quantity is 0 or less, delete the inventory row to prevent data bloat
    if (quantity <= 0) {
      const result = await db
        .delete(inventory)
        .where(and(eq(inventory.productId, productId), eq(inventory.location, location)))
        .returning();
      return result[0];
    }
    
    const result = await db
      .update(inventory)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(inventory.productId, productId), eq(inventory.location, location)))
      .returning();
    return result[0];
  }

  async updateInventoryQuantityById(
    id: string,
    quantity: number
  ): Promise<Inventory | undefined> {
    // If quantity is 0 or less, delete the inventory row to prevent data bloat
    if (quantity <= 0) {
      const result = await db
        .delete(inventory)
        .where(eq(inventory.id, id))
        .returning();
      return result[0];
    }
    
    const result = await db
      .update(inventory)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(inventory.id, id))
      .returning();
    return result[0];
  }

  async deleteInventoryItem(productId: string, location: string): Promise<boolean> {
    const result = await db
      .delete(inventory)
      .where(and(eq(inventory.productId, productId), eq(inventory.location, location)))
      .returning();
    return result.length > 0;
  }

  async deleteInventoryItemById(id: string): Promise<boolean> {
    const result = await db
      .delete(inventory)
      .where(eq(inventory.id, id))
      .returning();
    return result.length > 0;
  }

  async transferInventoryItem(
    id: string, 
    toLocation: string, 
    transferQuantity?: number
  ): Promise<Inventory | undefined> {
    const item = await db.select().from(inventory).where(eq(inventory.id, id));
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
          productId,
          location: toLocation,
          quantity: quantityToTransfer,
          trackingMode: 'lot',
          serialNumber: '',
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

      // Create audit trail
      await db.insert(stockTransfers).values({
        productId,
        fromLocation,
        toLocation,
        quantity: quantityToTransfer,
        notes: `Partial transfer from item ${id} (${quantityToTransfer} of ${sourceQuantity})`,
      });

      return updatedSource[0];
    } else {
      // Full transfer: move the entire item
      const result = await db
        .update(inventory)
        .set({ location: toLocation, updatedAt: new Date() })
        .where(eq(inventory.id, id))
        .returning();

      if (result && result.length > 0) {
        await db.insert(stockTransfers).values({
          productId,
          fromLocation,
          toLocation,
          quantity: quantityToTransfer,
          notes: `Full item transfer (ID: ${id})`,
        });
      }

      return result[0];
    }
  }

  async getLowStockItems(location?: string): Promise<(Inventory & { product: Product })[]> {
    if (location === 'car') {
      // For car stock: check ALL products and compare car stock to minCarStock
      const allProducts = await db.select().from(products);
      
      // Get car inventory
      const allCarInventory = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory)
        .where(eq(inventory.location, 'car'));

      // Group by productId and sum quantities
      const carStockMap = new Map<string, number>();
      for (const item of allCarInventory) {
        carStockMap.set(item.productId, (carStockMap.get(item.productId) || 0) + item.quantity);
      }

      // Check all products against minCarStock
      const lowStockProducts: (Inventory & { product: Product })[] = [];
      for (const product of allProducts) {
        const carStock = carStockMap.get(product.id) || 0;
        if (carStock < product.minCarStock) {
          // Create a dummy inventory item for low stock reporting
          lowStockProducts.push({
            id: product.id,
            productId: product.id,
            location: 'car',
            quantity: carStock,
            trackingMode: null,
            serialNumber: null,
            lotNumber: null,
            expirationDate: null,
            updatedAt: null,
            product,
          });
        }
      }

      return lowStockProducts;
    } else if (location === 'home') {
      // For home stock: check ALL products and compare total stock (home+car) to minTotalStock
      const allProducts = await db.select().from(products);
      
      // Get all inventory across all locations
      const allInventory = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory);

      // Group by productId and sum quantities across all locations
      const totalStockMap = new Map<string, number>();
      for (const item of allInventory) {
        totalStockMap.set(item.productId, (totalStockMap.get(item.productId) || 0) + item.quantity);
      }

      // Check all products against minTotalStock
      const lowStockProducts: (Inventory & { product: Product })[] = [];
      for (const product of allProducts) {
        const totalStock = totalStockMap.get(product.id) || 0;
        if (totalStock < product.minTotalStock) {
          // Create a dummy inventory item for low stock reporting
          lowStockProducts.push({
            id: product.id,
            productId: product.id,
            location: 'home',
            quantity: totalStock,
            trackingMode: null,
            serialNumber: null,
            lotNumber: null,
            expirationDate: null,
            updatedAt: null,
            product,
          });
        }
      }

      return lowStockProducts;
    } else {
      // For total stock (no location specified): check ALL products and compare total stock to minTotalStock
      const allProducts = await db.select().from(products);
      
      // Get all inventory across all locations
      const allInventory = await db
        .select({
          productId: inventory.productId,
          quantity: inventory.quantity,
        })
        .from(inventory);

      // Group by productId and sum quantities across all locations
      const totalStockMap = new Map<string, number>();
      for (const item of allInventory) {
        totalStockMap.set(item.productId, (totalStockMap.get(item.productId) || 0) + item.quantity);
      }

      // Check all products against minTotalStock
      const lowStockProducts: (Inventory & { product: Product })[] = [];
      for (const product of allProducts) {
        const totalStock = totalStockMap.get(product.id) || 0;
        if (totalStock < product.minTotalStock) {
          // Create a dummy inventory item for low stock reporting
          lowStockProducts.push({
            id: product.id,
            productId: product.id,
            location: undefined as any,
            quantity: totalStock,
            trackingMode: null,
            serialNumber: null,
            lotNumber: null,
            expirationDate: null,
            updatedAt: null,
            product,
          });
        }
      }

      return lowStockProducts;
    }
  }

  // Hospitals
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
    const result = await db.delete(hospitals).where(eq(hospitals.id, id)).returning();
    return result.length > 0;
  }

  // Implant Procedures
  async getImplantProcedures(): Promise<(ImplantProcedure & { hospital: Hospital })[]> {
    return await db
      .select({
        id: implantProcedures.id,
        hospitalId: implantProcedures.hospitalId,
        patientId: implantProcedures.patientId,
        implantDate: implantProcedures.implantDate,
        procedureType: implantProcedures.procedureType,
        deviceUsed: implantProcedures.deviceUsed,
        deviceSerialNumber: implantProcedures.deviceSerialNumber,
        notes: implantProcedures.notes,
        createdAt: implantProcedures.createdAt,
        hospital: hospitals,
      })
      .from(implantProcedures)
      .innerJoin(hospitals, eq(implantProcedures.hospitalId, hospitals.id))
      .orderBy(desc(implantProcedures.implantDate));
  }

  async getImplantProcedure(id: string): Promise<any> {
    const result = await db
      .select({
        id: implantProcedures.id,
        hospitalId: implantProcedures.hospitalId,
        patientId: implantProcedures.patientId,
        implantDate: implantProcedures.implantDate,
        procedureType: implantProcedures.procedureType,
        deviceUsed: implantProcedures.deviceUsed,
        deviceSerialNumber: implantProcedures.deviceSerialNumber,
        notes: implantProcedures.notes,
        createdAt: implantProcedures.createdAt,
        hospital: hospitals,
        deviceProduct: products,
      })
      .from(implantProcedures)
      .leftJoin(hospitals, eq(implantProcedures.hospitalId, hospitals.id))
      .leftJoin(products, eq(implantProcedures.deviceUsed, products.id))
      .where(eq(implantProcedures.id, id));
    return result[0];
  }

  async createImplantProcedure(
    procedure: InsertImplantProcedure,
    materials: InsertProcedureMaterial[]
  ): Promise<ImplantProcedure> {
    // Validate stock availability before proceeding
    for (const material of materials) {
      if (material.source === 'car' && material.productId && material.quantity) {
        const inventoryItem = await this.getInventoryItem(material.productId, 'car');
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

      // Insert materials and deduct from car inventory
      for (const material of materials) {
        await db.insert(procedureMaterials).values({
          ...material,
          procedureId: createdProcedure.id,
        });

        // Deduct from car inventory if source is 'car'
        if (material.source === 'car' && material.productId && material.quantity) {
          const inventoryItem = await this.getInventoryItem(material.productId, 'car');
          if (inventoryItem) {
            const newQuantity = inventoryItem.quantity - material.quantity;
            await this.updateInventoryQuantity(material.productId, 'car', newQuantity);
          }
        }
      }

      return createdProcedure;
    } catch (error) {
      // If any part fails, log error - note: neon-http doesn't support transactions
      // In a production app, consider using a different driver or implementing compensating transactions
      console.error('Failed to create implant procedure:', error);
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
        product: products,
      })
      .from(procedureMaterials)
      .leftJoin(products, eq(procedureMaterials.productId, products.id))
      .where(eq(procedureMaterials.procedureId, procedureId));
  }

  async updateImplantProcedure(
    id: string,
    procedureData: Partial<InsertImplantProcedure>
  ): Promise<ImplantProcedure | null> {
    const result = await db
      .update(implantProcedures)
      .set(procedureData)
      .where(eq(implantProcedures.id, id))
      .returning();
    return result[0] || null;
  }

  async deleteImplantProcedure(id: string): Promise<boolean> {
    // First delete all associated materials
    await db.delete(procedureMaterials).where(eq(procedureMaterials.procedureId, id));
    
    // Then delete the procedure
    const result = await db
      .delete(implantProcedures)
      .where(eq(implantProcedures.id, id))
      .returning();
    return result.length > 0;
  }

  // Stock Transfers
  async getStockTransfers(): Promise<(StockTransfer & { product: Product })[]> {
    return await db
      .select({
        id: stockTransfers.id,
        productId: stockTransfers.productId,
        fromLocation: stockTransfers.fromLocation,
        toLocation: stockTransfers.toLocation,
        quantity: stockTransfers.quantity,
        transferDate: stockTransfers.transferDate,
        notes: stockTransfers.notes,
        product: products,
      })
      .from(stockTransfers)
      .innerJoin(products, eq(stockTransfers.productId, products.id))
      .orderBy(desc(stockTransfers.transferDate));
  }

  async createStockTransfer(transfer: InsertStockTransfer): Promise<StockTransfer> {
    // Validate stock availability before proceeding
    const fromInventory = await this.getInventoryItem(transfer.productId, transfer.fromLocation);
    
    if (!fromInventory) {
      throw new Error(
        `Product ${transfer.productId} not found in ${transfer.fromLocation} inventory`
      );
    }
    
    if (fromInventory.quantity < transfer.quantity) {
      throw new Error(
        `Insufficient stock for transfer. Available: ${fromInventory.quantity}, Required: ${transfer.quantity}`
      );
    }

    try {
      // Create the transfer record
      const result = await db.insert(stockTransfers).values(transfer).returning();
      const createdTransfer = result[0];

      // Update inventory quantities
      const toInventory = await this.getInventoryItem(transfer.productId, transfer.toLocation);

      // Deduct from source
      const newFromQuantity = fromInventory.quantity - transfer.quantity;
      await this.updateInventoryQuantity(transfer.productId, transfer.fromLocation, newFromQuantity);

      // Add to destination
      if (toInventory) {
        const newToQuantity = toInventory.quantity + transfer.quantity;
        await this.updateInventoryQuantity(transfer.productId, transfer.toLocation, newToQuantity);
      } else {
        // Create inventory item if it doesn't exist at destination
        await this.createInventoryItem({
          productId: transfer.productId,
          location: transfer.toLocation,
          quantity: transfer.quantity,
        });
      }

      return createdTransfer;
    } catch (error) {
      // If any part fails, log error - note: neon-http doesn't support transactions
      // In a production app, consider using a different driver or implementing compensating transactions
      console.error('Failed to create stock transfer:', error);
      throw new Error('Failed to create stock transfer. Database operation failed.');
    }
  }
}

export const storage = new DatabaseStorage();
