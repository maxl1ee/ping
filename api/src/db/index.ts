import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const isProduction = process.env.NODE_ENV === 'production';
const needsSsl = process.env.DATABASE_URL?.includes('render.com') ||
                 process.env.DATABASE_URL?.includes('neon.tech') ||
                 isProduction;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export * from './schema';
