import { eq, and, sql, desc } from "drizzle-orm";
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
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  searchProducts(query: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Inventory
  getInventory(location?: string): Promise<(Inventory & { product: Product })[]>;
  getInventoryItem(productId: string, location: string): Promise<Inventory | undefined>;
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryQuantity(productId: string, location: string, quantity: number): Promise<Inventory | undefined>;
  deleteInventoryItem(productId: string, location: string): Promise<boolean>;
  getLowStockItems(location?: string): Promise<(Inventory & { product: Product })[]>;

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

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.barcode, barcode));
    return result[0];
  }

  async searchProducts(query: string): Promise<Product[]> {
    const result = await db.select().from(products).where(
      sql`${products.barcode} = ${query} OR ${products.modelNumber} = ${query} OR ${products.serialNumber} = ${query} OR ${products.gtin} = ${query}`
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
        minStockLevel: inventory.minStockLevel,
        updatedAt: inventory.updatedAt,
        product: products,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id));

    if (location) {
      return await query.where(eq(inventory.location, location));
    }

    return await query;
  }

  async getInventoryItem(productId: string, location: string): Promise<Inventory | undefined> {
    const result = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.productId, productId), eq(inventory.location, location)));
    return result[0];
  }

  async createInventoryItem(item: InsertInventory): Promise<Inventory> {
    const result = await db.insert(inventory).values(item).returning();
    return result[0];
  }

  async updateInventoryQuantity(
    productId: string,
    location: string,
    quantity: number
  ): Promise<Inventory | undefined> {
    const result = await db
      .update(inventory)
      .set({ quantity, updatedAt: new Date() })
      .where(and(eq(inventory.productId, productId), eq(inventory.location, location)))
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

  async getLowStockItems(location?: string): Promise<(Inventory & { product: Product })[]> {
    if (location === 'car') {
      // For car stock: check if car quantity < minCarStock
      return await db
        .select({
          id: inventory.id,
          productId: inventory.productId,
          location: inventory.location,
          quantity: inventory.quantity,
          updatedAt: inventory.updatedAt,
          product: products,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(
          and(
            eq(inventory.location, 'car'),
            sql`${inventory.quantity} < ${products.minCarStock}`
          )
        );
    } else {
      // For total stock: check if (car + home) < minTotalStock
      // Get all products and their total quantities across locations
      const allInventory = await db
        .select({
          productId: inventory.productId,
          location: inventory.location,
          quantity: inventory.quantity,
          product: products,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id));

      // Group by product and calculate totals
      const productTotals = new Map<string, { carQty: number; homeQty: number; product: Product }>();
      
      for (const item of allInventory) {
        if (!productTotals.has(item.productId)) {
          productTotals.set(item.productId, {
            carQty: 0,
            homeQty: 0,
            product: item.product,
          });
        }
        const totals = productTotals.get(item.productId)!;
        if (item.location === 'car') {
          totals.carQty = item.quantity;
        } else if (item.location === 'home') {
          totals.homeQty = item.quantity;
        }
      }

      // Find products where total < minTotalStock
      const lowStockProducts: (Inventory & { product: Product })[] = [];
      for (const [productId, { carQty, homeQty, product }] of productTotals) {
        const totalQty = carQty + homeQty;
        if (totalQty < product.minTotalStock) {
          // Return the home inventory item to represent this low stock condition
          const homeItem = await db
            .select()
            .from(inventory)
            .where(
              and(
                eq(inventory.productId, productId),
                eq(inventory.location, 'home')
              )
            );
          
          if (homeItem[0]) {
            lowStockProducts.push({
              ...homeItem[0],
              product,
            });
          }
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
        notes: implantProcedures.notes,
        createdAt: implantProcedures.createdAt,
        hospital: hospitals,
      })
      .from(implantProcedures)
      .leftJoin(hospitals, eq(implantProcedures.hospitalId, hospitals.id))
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
        product: products,
      })
      .from(procedureMaterials)
      .leftJoin(products, eq(procedureMaterials.productId, products.id))
      .where(eq(procedureMaterials.procedureId, procedureId));
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
          minStockLevel: 1,
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
