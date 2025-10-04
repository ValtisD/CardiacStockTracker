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

  // Upsert user info (record user activity and email)
  if (req.userId && req.userEmail) {
    await db
      .insert(users)
      .values({
        userId: req.userId,
        email: req.userEmail,
        lastSeen: sql`now()`,
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          email: req.userEmail,
          lastSeen: sql`now()`,
        },
      });
  }

  // Check if user is prime admin based on email
  const adminEmail = process.env.AUTH0_ADMIN_EMAIL;
  req.isPrimeAdmin = req.userEmail === adminEmail;

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
