import { auth } from 'express-oauth2-jwt-bearer';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { adminUsers, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// JWT validation middleware
export const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  tokenSigningAlg: 'RS256'
});

// Extended request type with user context
export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  isAdmin?: boolean;
  isPrimeAdmin?: boolean;
}

// Middleware to extract user info and set admin flag
export async function extractUserInfo(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.auth as any; // Type assertion for payload access
  
  if (!auth?.payload?.sub) {
    return res.status(401).json({ error: 'Unauthorized - no user ID in token' });
  }

  // Set userId and email from Auth0 claims
  req.userId = auth.payload.sub;
  req.userEmail = auth.payload.email;

  // Check if user is prime admin based on email
  const adminEmail = process.env.AUTH0_ADMIN_EMAIL;
  req.isPrimeAdmin = req.userEmail === adminEmail;

  // Upsert user info (record user activity and email)
  // Prime admin is auto-validated
  if (req.userId && req.userEmail) {
    const userRecord = await db
      .insert(users)
      .values({
        userId: req.userId,
        email: req.userEmail,
        validated: req.isPrimeAdmin, // Prime admin is automatically validated
        lastSeen: sql`now()`,
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          email: req.userEmail,
          lastSeen: sql`now()`,
          // Update validated to true if prime admin
          ...(req.isPrimeAdmin ? { validated: true } : {}),
        },
      })
      .returning();

    // Check if user is validated (required for non-admin users)
    const user = userRecord[0] || await db
      .select()
      .from(users)
      .where(eq(users.userId, req.userId))
      .limit(1)
      .then(rows => rows[0]);

    if (!req.isPrimeAdmin && user && !user.validated) {
      return res.status(403).json({ 
        error: 'Account not validated. Please complete registration through the proper channel.',
        code: 'UNVALIDATED_USER'
      });
    }
  }

  // Check if user is admin (either prime admin or in admin_users table)
  if (req.isPrimeAdmin) {
    req.isAdmin = true;
  } else {
    // Check database for admin status
    const adminRecord = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.userId, req.userId!))
      .limit(1);
    req.isAdmin = adminRecord.length > 0;
  }

  next();
}

// Combined middleware: validate JWT and extract user info
export const requireAuth = [jwtCheck, extractUserInfo];

// Middleware to require admin privileges
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Forbidden - admin access required' });
  }
  next();
}
