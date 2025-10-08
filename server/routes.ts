import type { Express, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertProductSchema,
  insertInventorySchema,
  insertHospitalSchema,
  insertImplantProcedureSchema,
  insertProcedureMaterialSchema,
  insertUserProductSettingsSchema,
  updateProductSchema,
  updateHospitalSchema,
  updateInventoryQuantitySchema,
  transferInventoryItemSchema,
  languageSchema,
  toggleAdminSchema,
} from "@shared/schema";
import { requireAuth, requireAdmin, type AuthRequest } from "./middleware/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Products (read operations are public, mutations require admin)
  app.get("/api/products", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/products/search/:query", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const products = await storage.searchProducts(req.params.query);
      if (products.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(products);
    } catch (error) {
      console.error("Error searching products:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to search products" });
    }
  });

  // Enhanced search by GTIN, model number, or serial number (user-specific for serial search)
  app.get("/api/products/multi-search/:query", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth?.payload?.sub) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const products = await storage.searchProductsByMultipleFields(req.auth.payload.sub, req.params.query);
      if (products.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(products);
    } catch (error) {
      console.error("Error searching products by multiple fields:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to search products" });
    }
  });

  app.post("/api/products", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error instanceof Error ? error.message : 'Unknown error');
      res.status(400).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = updateProductSchema.parse(req.body);
      const product = await storage.updateProduct(req.params.id, validatedData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      console.error("Error updating product:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.message.includes('Cannot delete product')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // User Product Settings (per-user min stock thresholds)
  app.get("/api/user-product-settings", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const settings = await storage.getUserProductSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user product settings:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch user product settings" });
    }
  });

  app.put("/api/user-product-settings/:productId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { productId } = req.params;
      const validatedData = insertUserProductSettingsSchema.parse({
        userId,
        productId,
        ...req.body
      });
      const { minCarStock = 0, minTotalStock = 0 } = validatedData;
      const settings = await storage.upsertUserProductSettings(userId, productId, { minCarStock, minTotalStock });
      res.json(settings);
    } catch (error) {
      console.error("Error updating user product settings:", error instanceof Error ? error.message : 'Unknown error');
      res.status(400).json({ error: "Failed to update user product settings" });
    }
  });

  // Inventory (user-specific)
  app.get("/api/inventory", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const location = req.query.location as string | undefined;
      const inventory = await storage.getInventory(userId, location);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.get("/api/inventory/summary", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const location = req.query.location as string | undefined;
      const summary = await storage.getInventorySummary(userId, location);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching inventory summary:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch inventory summary" });
    }
  });

  app.get("/api/inventory/low-stock", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const location = req.query.location as string | undefined;
      const lowStockItems = await storage.getLowStockItems(userId, location);
      res.json(lowStockItems);
    } catch (error) {
      console.error("Error fetching low stock items:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch low stock items" });
    }
  });

  app.post("/api/inventory", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const validatedData = insertInventorySchema.parse({
        ...req.body,
        userId
      });
      const inventory = await storage.createInventoryItem(validatedData);
      res.status(201).json(inventory);
    } catch (error: any) {
      console.error("Error creating inventory item:", error instanceof Error ? error.message : 'Unknown error');
      
      if (error.code === '23505' && error.constraint === 'inventory_serial_number_unique') {
        return res.status(409).json({ 
          error: "Serial number already exists in inventory",
          field: "serialNumber"
        });
      }
      
      res.status(400).json({ error: "Failed to create inventory item" });
    }
  });

  // ID-based routes for individual inventory items
  app.patch("/api/inventory/item/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const validatedData = updateInventoryQuantitySchema.parse(req.body);
      
      const inventory = await storage.updateInventoryQuantityById(userId, id, validatedData.quantity);
      if (!inventory) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(inventory);
    } catch (error: any) {
      console.error("Error updating inventory item:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/item/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const success = await storage.deleteInventoryItemById(userId, id);
      if (!success) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory item:", error instanceof Error ? error.message : 'Unknown error');
      res.status(400).json({ error: "Failed to delete inventory item" });
    }
  });

  app.post("/api/inventory/item/:id/transfer", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const validatedData = transferInventoryItemSchema.parse(req.body);
      
      const inventory = await storage.transferInventoryItem(userId, id, validatedData.toLocation, validatedData.quantity);
      if (!inventory) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(inventory);
    } catch (error: any) {
      console.error("Error transferring inventory item:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Failed to transfer inventory item" 
      });
    }
  });

  // Legacy routes using productId and location
  app.patch("/api/inventory/:productId/:location", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { productId, location } = req.params;
      const validatedData = updateInventoryQuantitySchema.parse(req.body);
      
      const inventory = await storage.updateInventoryQuantity(userId, productId, location, validatedData.quantity);
      if (!inventory) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(inventory);
    } catch (error: any) {
      console.error("Error updating inventory:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update inventory" });
    }
  });

  app.delete("/api/inventory/:productId/:location", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { productId, location } = req.params;
      const success = await storage.deleteInventoryItem(userId, productId, location);
      if (!success) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory item:", error instanceof Error ? error.message : 'Unknown error');
      res.status(400).json({ error: "Failed to delete inventory item" });
    }
  });

  // Hospitals (global - shared across all users)
  app.get("/api/hospitals", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const hospitals = await storage.getHospitals();
      res.json(hospitals);
    } catch (error) {
      console.error("Error fetching hospitals:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch hospitals" });
    }
  });

  app.get("/api/hospitals/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const hospital = await storage.getHospital(req.params.id);
      if (!hospital) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.json(hospital);
    } catch (error) {
      console.error("Error fetching hospital:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch hospital" });
    }
  });

  app.post("/api/hospitals", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertHospitalSchema.parse(req.body);
      const hospital = await storage.createHospital(validatedData);
      res.status(201).json(hospital);
    } catch (error) {
      console.error("Error creating hospital:", error instanceof Error ? error.message : 'Unknown error');
      res.status(400).json({ error: "Failed to create hospital" });
    }
  });

  app.patch("/api/hospitals/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = updateHospitalSchema.parse(req.body);
      const hospital = await storage.updateHospital(req.params.id, validatedData);
      if (!hospital) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.json(hospital);
    } catch (error: any) {
      console.error("Error updating hospital:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update hospital" });
    }
  });

  app.delete("/api/hospitals/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const deleted = await storage.deleteHospital(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting hospital:", error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.message.includes('Cannot delete hospital')) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete hospital" });
    }
  });

  // Implant Procedures (user-specific)
  app.get("/api/implant-procedures", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const procedures = await storage.getImplantProcedures(userId);
      res.json(procedures);
    } catch (error) {
      console.error("Error fetching implant procedures:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch implant procedures" });
    }
  });

  app.get("/api/implant-procedures/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const procedure = await storage.getImplantProcedure(userId, req.params.id);
      if (!procedure) {
        return res.status(404).json({ error: "Procedure not found" });
      }
      res.json(procedure);
    } catch (error) {
      console.error("Error fetching procedure:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch procedure" });
    }
  });

  app.get("/api/implant-procedures/:id/materials", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const materials = await storage.getProcedureMaterials(req.params.id);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching procedure materials:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch procedure materials" });
    }
  });

  app.post("/api/implant-procedures", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { materials, ...procedureData } = req.body;
      const validatedProcedure = insertImplantProcedureSchema.parse({
        ...procedureData,
        userId
      });
      const validatedMaterials = materials?.map((m: any) => 
        insertProcedureMaterialSchema.parse(m)
      ) || [];
      
      const procedure = await storage.createImplantProcedure(
        validatedProcedure,
        validatedMaterials
      );
      res.status(201).json(procedure);
    } catch (error: any) {
      console.error("Error creating implant procedure:", error instanceof Error ? error.message : 'Unknown error');
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

  app.patch("/api/implant-procedures/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const updateData = insertImplantProcedureSchema.partial().parse(req.body);
      
      const procedure = await storage.updateImplantProcedure(userId, req.params.id, updateData);
      
      if (!procedure) {
        return res.status(404).json({ error: "Procedure not found" });
      }
      res.json(procedure);
    } catch (error: any) {
      console.error("Error updating implant procedure:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid data format", details: error.errors });
      }
      res.status(400).json({ error: "Failed to update implant procedure" });
    }
  });

  app.delete("/api/implant-procedures/:id", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const deleted = await storage.deleteImplantProcedure(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Procedure not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting implant procedure:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to delete implant procedure" });
    }
  });

  // User Management (admin-only)
  app.get("/api/users", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Toggle admin status (admin-only, cannot toggle prime admin)
  app.post("/api/users/:userId/toggle-admin", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      const validatedData = toggleAdminSchema.parse(req.body);
      const { email, isAdmin } = validatedData;
      const currentUserId = req.userId!;
      
      // Prevent toggling the prime admin
      const primeAdminEmail = process.env.AUTH0_ADMIN_EMAIL;
      if (email === primeAdminEmail) {
        return res.status(403).json({ error: "Cannot modify prime admin status" });
      }

      if (isAdmin) {
        // Revoke admin access
        await storage.revokeAdminAccess(targetUserId);
      } else {
        // Grant admin access
        await storage.grantAdminAccess(targetUserId, email, currentUserId);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error toggling admin status:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to toggle admin status" });
    }
  });

  // Get current user info (including admin status)
  app.get("/api/user/me", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      res.json({
        userId: req.userId,
        email: req.userEmail,
        isAdmin: req.isAdmin || false,
        isPrimeAdmin: req.isPrimeAdmin || false,
      });
    } catch (error) {
      console.error("Error fetching current user info:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch user info" });
    }
  });

  // User preferences
  app.get("/api/user/language", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const language = await storage.getUserLanguage(userId);
      res.json({ language });
    } catch (error) {
      console.error("Error fetching user language:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch user language" });
    }
  });

  app.put("/api/user/language", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const validatedData = languageSchema.parse(req.body);

      await storage.updateUserLanguage(userId, validatedData.language);
      res.json({ success: true, language: validatedData.language });
    } catch (error: any) {
      console.error("Error updating user language:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid language. Must be 'de' or 'en'", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update user language" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
