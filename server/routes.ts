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
  insertStockCountSessionSchema,
  insertStockCountItemSchema,
} from "@shared/schema";
import { requireAuth, requireAdmin, type AuthRequest } from "./middleware/auth";

// In-memory storage for validation tokens (expires after 5 minutes)
const validationTokens = new Map<string, { timestamp: number }>();

// Clean up expired tokens every minute
setInterval(() => {
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;
  const tokensToDelete: string[] = [];
  
  validationTokens.forEach((data, token) => {
    if (now - data.timestamp > FIVE_MINUTES) {
      tokensToDelete.push(token);
    }
  });
  
  tokensToDelete.forEach(token => validationTokens.delete(token));
}, 60 * 1000);

export async function registerRoutes(app: Express): Promise<Server> {
  // Registration gate - validate secret word (public endpoint, no auth required)
  app.post("/api/auth/validate-secret-word", async (req, res) => {
    try {
      const { secretWord } = req.body;
      
      if (!secretWord || typeof secretWord !== 'string') {
        return res.status(400).json({ valid: false, error: "Secret word is required" });
      }

      const expectedSecretWord = process.env.SIGNUP_SECRET_WORD;
      
      if (!expectedSecretWord) {
        console.error('SIGNUP_SECRET_WORD environment variable is not set');
        return res.status(500).json({ valid: false, error: "Server configuration error" });
      }

      // SECURITY: No logging of secret words to prevent exposure in production logs
      const isValid = secretWord.trim() === expectedSecretWord.trim();
      
      if (isValid) {
        // Generate cryptographically strong token
        const crypto = await import('crypto');
        const validationToken = crypto.randomBytes(32).toString('hex');
        
        // Store token with timestamp (expires in 5 minutes)
        validationTokens.set(validationToken, { timestamp: Date.now() });
        
        res.json({ valid: true, validationToken });
      } else {
        res.json({ valid: false });
      }
    } catch (error) {
      console.error("Error validating secret word:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ valid: false, error: "Validation failed" });
    }
  });

  // Verify registration token (protected endpoint - requires authentication)
  app.post("/api/auth/verify-registration-token", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { token } = req.body;
      const userId = req.userId!; // SECURITY: Use userId from authenticated JWT, not from client
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, error: "Token is required" });
      }

      const tokenData = validationTokens.get(token);
      
      if (!tokenData) {
        return res.json({ valid: false, error: "Invalid or expired token" });
      }

      // Check if token is expired (5 minutes)
      const FIVE_MINUTES = 5 * 60 * 1000;
      if (Date.now() - tokenData.timestamp > FIVE_MINUTES) {
        validationTokens.delete(token);
        return res.json({ valid: false, error: "Token expired" });
      }

      // Token is valid - delete it (one-time use)
      validationTokens.delete(token);
      
      // Mark authenticated user as validated
      try {
        const { db } = await import('./db');
        const { users } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        
        await db
          .update(users)
          .set({ validated: true })
          .where(eq(users.userId, userId));
        
        console.log(`User ${userId} marked as validated`);
      } catch (dbError) {
        console.error('Error marking user as validated:', dbError);
        return res.status(500).json({ valid: false, error: "Failed to validate user" });
      }
      
      res.json({ valid: true });
    } catch (error) {
      console.error("Error verifying registration token:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ valid: false, error: "Verification failed" });
    }
  });

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

  app.get("/api/inventory/overview", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const overview = await storage.getStockOverview(userId);
      res.json(overview);
    } catch (error) {
      console.error("Error fetching stock overview:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch stock overview" });
    }
  });

  // Quick search by serial or lot number
  app.get("/api/quick-search/:query", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const { query } = req.params;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const results = await storage.quickSearchBySerialOrLot(userId, query);
      res.json(results);
    } catch (error) {
      console.error("Error in quick search:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to perform search" });
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
      const userId = req.userId!;
      const procedureId = req.params.id;
      
      // SECURITY: Verify procedure belongs to requesting user before returning materials
      const procedure = await storage.getImplantProcedure(userId, procedureId);
      if (!procedure) {
        return res.status(404).json({ error: "Procedure not found" });
      }
      
      const materials = await storage.getProcedureMaterials(procedureId);
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

  // Stock Count Routes
  
  // Create new stock count session
  app.post("/api/stock-count/sessions", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const validatedData = insertStockCountSessionSchema.parse({ ...req.body, userId });
      
      // Check if there's already an active session
      const activeSession = await storage.getActiveStockCountSession(userId);
      if (activeSession) {
        return res.status(400).json({ error: "There is already an active stock count session" });
      }

      const session = await storage.createStockCountSession(validatedData);
      res.json(session);
    } catch (error: any) {
      console.error("Error creating stock count session:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create stock count session" });
    }
  });

  // Get active stock count session
  app.get("/api/stock-count/sessions/active", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const session = await storage.getActiveStockCountSession(userId);
      res.json(session || null);
    } catch (error) {
      console.error("Error fetching active session:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch active session" });
    }
  });

  // Get specific stock count session
  app.get("/api/stock-count/sessions/:sessionId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = req.params.sessionId;
      const session = await storage.getStockCountSession(userId, sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error fetching session:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Add item to stock count
  app.post("/api/stock-count/sessions/:sessionId/items", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = req.params.sessionId;
      
      // Verify session belongs to user
      const session = await storage.getStockCountSession(userId, sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      if (session.status !== 'in_progress') {
        return res.status(400).json({ error: "Session is not active" });
      }

      const validatedData = insertStockCountItemSchema.parse({ ...req.body, sessionId });
      const item = await storage.addStockCountItem(validatedData);
      res.json(item);
    } catch (error: any) {
      console.error("Error adding stock count item:", error instanceof Error ? error.message : 'Unknown error');
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add item" });
    }
  });

  // Get all items in stock count
  app.get("/api/stock-count/sessions/:sessionId/items", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = req.params.sessionId;
      
      // Verify session belongs to user
      const session = await storage.getStockCountSession(userId, sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const items = await storage.getStockCountItems(sessionId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching stock count items:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  // Delete scanned item from stock count
  app.delete("/api/stock-count/sessions/:sessionId/items/:itemId", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = req.params.sessionId;
      const itemId = req.params.itemId;
      
      // Verify session belongs to user
      const session = await storage.getStockCountSession(userId, sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      if (session.status !== 'in_progress') {
        return res.status(400).json({ error: "Session is not active" });
      }

      await storage.deleteStockCountItem(itemId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting stock count item:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // Calculate discrepancies
  app.get("/api/stock-count/sessions/:sessionId/discrepancies", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = req.params.sessionId;
      
      const discrepancies = await storage.calculateDiscrepancies(userId, sessionId);
      res.json(discrepancies);
    } catch (error) {
      console.error("Error calculating discrepancies:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to calculate discrepancies" });
    }
  });

  // Apply stock count adjustments
  app.post("/api/stock-count/sessions/:sessionId/apply", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = req.params.sessionId;
      
      // Verify session belongs to user
      const session = await storage.getStockCountSession(userId, sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      await storage.applyStockCountAdjustments(userId, sessionId, req.body);
      await storage.completeStockCountSession(userId, sessionId);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error applying adjustments:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to apply adjustments" });
    }
  });

  // Cancel stock count session
  app.post("/api/stock-count/sessions/:sessionId/cancel", requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const sessionId = req.params.sessionId;
      
      await storage.cancelStockCountSession(userId, sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error cancelling session:", error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ error: "Failed to cancel session" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
