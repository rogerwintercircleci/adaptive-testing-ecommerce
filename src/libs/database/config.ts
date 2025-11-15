import { DataSource, DataSourceOptions } from 'typeorm';
import { logger } from '../logger';

/**
 * Database configuration based on environment variables
 */
export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ecommerce_db',
  synchronize: process.env.NODE_ENV === 'development', // Auto-sync in dev only
  logging: process.env.NODE_ENV === 'development',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/libs/database/migrations/*.ts'],
  subscribers: [],
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  maxQueryExecutionTime: 1000, // Log slow queries (>1s)
  poolSize: 10,
};

/**
 * TypeORM DataSource instance
 */
export const AppDataSource = new DataSource(databaseConfig);

/**
 * Initialize database connection
 */
export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    await AppDataSource.initialize();
    logger.info('Database connection established', {
      host: databaseConfig.host,
      database: databaseConfig.database,
    });
    return AppDataSource;
  } catch (error) {
    logger.error('Database connection failed', { error });
    throw error;
  }
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    logger.info('Database connection closed');
  }
};

/**
 * Test database configuration (uses separate test database)
 */
export const testDatabaseConfig: DataSourceOptions = {
  ...databaseConfig,
  database: process.env.DB_NAME_TEST || 'ecommerce_test_db',
  synchronize: true, // Auto-sync for tests
  logging: false, // Disable logging in tests
  dropSchema: true, // Clean slate for each test run
};

export const TestDataSource = new DataSource(testDatabaseConfig);
