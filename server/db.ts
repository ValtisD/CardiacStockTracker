import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "./config/database.js";

// Automatically uses DEV_DATABASE_URL in development, DATABASE_URL in production
const databaseUrl = getDatabaseUrl();
const sql = neon(databaseUrl);
export const db = drizzle(sql);
