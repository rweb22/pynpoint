import { DataSource } from 'typeorm';
import { Pincode } from './entities/pincode.entity';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * TypeORM DataSource for migrations
 * 
 * This is used by the TypeORM CLI to run migrations.
 * 
 * Usage:
 *   npm run migration:run    - Run pending migrations
 *   npm run migration:revert - Revert last migration
 *   npm run migration:show   - Show migration status
 * 
 * In production (Railway):
 *   Set RUN_MIGRATIONS=true to auto-run on startup
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Pincode],
  migrations: ['dist/database/migrations/*.js'], // Compiled JS files
  migrationsTableName: 'typeorm_migrations',
  synchronize: false, // Always false - use migrations instead
  logging: process.env.NODE_ENV === 'development',
});

// Initialize data source (needed for CLI)
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => {
      console.log('✅ Data Source initialized for migrations');
    })
    .catch((error) => {
      console.error('❌ Error initializing Data Source:', error);
      process.exit(1);
    });
}
