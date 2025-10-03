import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertProductSchema,
  insertInventorySchema,
  insertHospitalSchema,
  insertImplantProcedureSchema,
  insertProcedureMaterialSchema,
  insertStockTransferSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });


  app.get("/api/products/search/:query", async (req, res) => {
    try {
      const products = await storage.searchProducts(req.params.query);
      if (products.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(products);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ error: "Failed to search products" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.updateProduct(req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Inventory
  app.get("/api/inventory", async (req, res) => {
    try {
      const location = req.query.location as string | undefined;
      const inventory = await storage.getInventory(location);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.get("/api/inventory/low-stock", async (req, res) => {
    try {
      const location = req.query.location as string | undefined;
      const lowStockItems = await storage.getLowStockItems(location);
      res.json(lowStockItems);
    } catch (error) {
      console.error("Error fetching low stock items:", error);
      res.status(500).json({ error: "Failed to fetch low stock items" });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const validatedData = insertInventorySchema.parse(req.body);
      const inventory = await storage.createInventoryItem(validatedData);
      res.status(201).json(inventory);
    } catch (error: any) {
      console.error("Error creating inventory item:", error);
      
      // Check for unique constraint violation on serial number
      if (error.code === '23505' && error.constraint === 'inventory_serial_number_unique') {
        return res.status(409).json({ 
          error: "Serial number already exists in inventory",
          field: "serialNumber"
        });
      }
      
      res.status(400).json({ error: "Failed to create inventory item" });
    }
  });

  // ID-based routes for individual inventory items (MUST be before the generic productId/location routes)
  app.patch("/api/inventory/item/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      
      if (typeof quantity !== 'number') {
        return res.status(400).json({ error: "Quantity must be a number" });
      }
      
      const inventory = await storage.updateInventoryQuantityById(id, quantity);
      if (!inventory) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(inventory);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(400).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/item/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteInventoryItemById(id);
      if (!success) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(400).json({ error: "Failed to delete inventory item" });
    }
  });

  app.post("/api/inventory/item/:id/transfer", async (req, res) => {
    try {
      const { id } = req.params;
      const { toLocation, quantity } = req.body;
      
      if (!toLocation || (toLocation !== 'home' && toLocation !== 'car')) {
        return res.status(400).json({ error: "Invalid location. Must be 'home' or 'car'" });
      }
      
      if (quantity !== undefined && (typeof quantity !== 'number' || quantity <= 0)) {
        return res.status(400).json({ error: "Quantity must be a positive number" });
      }
      
      const inventory = await storage.transferInventoryItem(id, toLocation, quantity);
      if (!inventory) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(inventory);
    } catch (error) {
      console.error("Error transferring inventory item:", error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to transfer inventory item" 
      });
    }
  });

  // Legacy routes using productId and location (kept for backwards compatibility)
  app.patch("/api/inventory/:productId/:location", async (req, res) => {
    try {
      const { productId, location } = req.params;
      const { quantity } = req.body;
      
      if (typeof quantity !== 'number') {
        return res.status(400).json({ error: "Quantity must be a number" });
      }
      
      const inventory = await storage.updateInventoryQuantity(productId, location, quantity);
      if (!inventory) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(inventory);
    } catch (error) {
      console.error("Error updating inventory:", error);
      res.status(400).json({ error: "Failed to update inventory" });
    }
  });

  app.delete("/api/inventory/:productId/:location", async (req, res) => {
    try {
      const { productId, location } = req.params;
      const success = await storage.deleteInventoryItem(productId, location);
      if (!success) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(400).json({ error: "Failed to delete inventory item" });
    }
  });

  // Hospitals
  app.get("/api/hospitals", async (req, res) => {
    try {
      const hospitals = await storage.getHospitals();
      res.json(hospitals);
    } catch (error) {
      console.error("Error fetching hospitals:", error);
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  app.get("/api/hospitals/:id", async (req, res) => {
    try {
      const hospital = await storage.getHospital(req.params.id);
      if (!hospital) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.json(hospital);
    } catch (error) {
      console.error("Error fetching hospital:", error);
      res.status(500).json({ error: "Failed to fetch hospital" });
    }
  });

  app.post("/api/hospitals", async (req, res) => {
    try {
      const validatedData = insertHospitalSchema.parse(req.body);
      const hospital = await storage.createHospital(validatedData);
      res.status(201).json(hospital);
    } catch (error) {
      console.error("Error creating hospital:", error);
      res.status(400).json({ error: "Failed to create hospital" });
    }
  });

  app.patch("/api/hospitals/:id", async (req, res) => {
    try {
      const hospital = await storage.updateHospital(req.params.id, req.body);
      if (!hospital) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.json(hospital);
    } catch (error) {
      console.error("Error updating hospital:", error);
      res.status(400).json({ error: "Failed to update hospital" });
    }
  });

  app.delete("/api/hospitals/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteHospital(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting hospital:", error);
      res.status(500).json({ error: "Failed to delete hospital" });
    }
  });

  // Implant Procedures
  app.get("/api/implant-procedures", async (req, res) => {
    try {
      const procedures = await storage.getImplantProcedures();
      res.json(procedures);
    } catch (error) {
      console.error("Error fetching implant procedures:", error);
      res.status(500).json({ error: "Failed to fetch implant procedures" });
    }
  });

  app.get("/api/implant-procedures/:id", async (req, res) => {
    try {
      const procedure = await storage.getImplantProcedure(req.params.id);
      if (!procedure) {
        return res.status(404).json({ error: "Procedure not found" });
      }
      res.json(procedure);
    } catch (error) {
      console.error("Error fetching procedure:", error);
      res.status(500).json({ error: "Failed to fetch procedure" });
    }
  });

  app.get("/api/implant-procedures/:id/materials", async (req, res) => {
    try {
      const materials = await storage.getProcedureMaterials(req.params.id);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching procedure materials:", error);
      res.status(500).json({ error: "Failed to fetch procedure materials" });
    }
  });

  app.post("/api/implant-procedures", async (req, res) => {
    try {
      const { materials, ...procedureData } = req.body;
      const validatedProcedure = insertImplantProcedureSchema.parse(procedureData);
      const validatedMaterials = materials?.map((m: any) => 
        insertProcedureMaterialSchema.parse(m)
      ) || [];
      
      const procedure = await storage.createImplantProcedure(
        validatedProcedure,
        validatedMaterials
      );
      res.status(201).json(procedure);
    } catch (error: any) {
      console.error("Error creating implant procedure:", error);
      if (error.message) {
        if (error.message.includes("Insufficient stock") || error.message.includes("not found in")) {
          return res.status(400).json({ error: error.message });
        }
        if (error.message.includes("Database operation failed")) {
          return res.status(500).json({ error: "Failed to create implant procedure due to database error" });
        }
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format" });
      }
      res.status(500).json({ error: "Failed to create implant procedure" });
    }
  });

  app.patch("/api/implant-procedures/:id", async (req, res) => {
    try {
      console.log("PATCH /api/implant-procedures/:id - ID:", req.params.id);
      console.log("PATCH /api/implant-procedures/:id - Body:", JSON.stringify(req.body));
      
      const updateData = insertImplantProcedureSchema.partial().parse(req.body);
      console.log("PATCH /api/implant-procedures/:id - Validated data:", JSON.stringify(updateData));
      
      const procedure = await storage.updateImplantProcedure(req.params.id, updateData);
      console.log("PATCH /api/implant-procedures/:id - Result:", procedure ? "Found" : "Not found");
      
      if (!procedure) {
        return res.status(404).json({ error: "Procedure not found" });
      }
      res.json(procedure);
    } catch (error: any) {
      console.error("Error updating implant procedure:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update implant procedure" });
    }
  });

  app.delete("/api/implant-procedures/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteImplantProcedure(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Procedure not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting implant procedure:", error);
      res.status(500).json({ error: "Failed to delete implant procedure" });
    }
  });

  // Stock Transfers
  app.get("/api/stock-transfers", async (req, res) => {
    try {
      const transfers = await storage.getStockTransfers();
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching stock transfers:", error);
      res.status(500).json({ error: "Failed to fetch stock transfers" });
    }
  });

  app.post("/api/stock-transfers", async (req, res) => {
    try {
      const validatedData = insertStockTransferSchema.parse(req.body);
      const transfer = await storage.createStockTransfer(validatedData);
      res.status(201).json(transfer);
    } catch (error: any) {
      console.error("Error creating stock transfer:", error);
      if (error.message) {
        if (error.message.includes("Insufficient stock") || error.message.includes("not found in")) {
          return res.status(400).json({ error: error.message });
        }
        if (error.message.includes("Database operation failed")) {
          return res.status(500).json({ error: "Failed to create stock transfer due to database error" });
        }
      }
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format" });
      }
      res.status(500).json({ error: "Failed to create stock transfer" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
