import logger from '../lib/logger';
import { db } from './index';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

export async function runMigrations() {
  try {
    logger.info('Running database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    logger.info('Database migrations complete');
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    throw err;
  }
}
