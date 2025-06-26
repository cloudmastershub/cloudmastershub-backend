import { Pool, PoolClient } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger';

export interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

export class DatabaseMigrator {
  private pool: Pool;
  private migrationsPath: string;

  constructor(pool: Pool, migrationsPath?: string) {
    this.pool = pool;
    this.migrationsPath = migrationsPath || join(__dirname, '../../migrations');
  }

  async createMigrationsTable(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_admin_migrations_name ON admin_migrations (name);
        CREATE INDEX IF NOT EXISTS idx_admin_migrations_executed_at ON admin_migrations (executed_at);
      `);
      
      logger.info('Admin migrations table ensured');
    } catch (error) {
      logger.error('Error creating migrations table:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getExecutedMigrations(): Promise<Migration[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT id, name, executed_at FROM admin_migrations ORDER BY id ASC'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching executed migrations:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getPendingMigrations(): Promise<string[]> {
    try {
      const migrationFiles = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      const executedMigrations = await this.getExecutedMigrations();
      const executedNames = new Set(executedMigrations.map(m => m.name));

      return migrationFiles.filter(file => !executedNames.has(file));
    } catch (error) {
      logger.error('Error getting pending migrations:', error);
      throw error;
    }
  }

  async executeMigration(migrationName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const migrationPath = join(this.migrationsPath, migrationName);
      const migrationSql = readFileSync(migrationPath, 'utf8');

      logger.info(`Executing migration: ${migrationName}`);
      
      // Execute the migration SQL
      await client.query(migrationSql);

      // Record the migration as executed
      await client.query(
        'INSERT INTO admin_migrations (name) VALUES ($1)',
        [migrationName]
      );

      await client.query('COMMIT');
      logger.info(`Migration completed: ${migrationName}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration failed: ${migrationName}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async runPendingMigrations(): Promise<void> {
    try {
      await this.createMigrationsTable();
      
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending admin migrations');
        return;
      }

      logger.info(`Found ${pendingMigrations.length} pending admin migrations`);
      
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }

      logger.info('All admin migrations completed successfully');
    } catch (error) {
      logger.error('Error running migrations:', error);
      throw error;
    }
  }

  async rollbackMigration(migrationName: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check if migration exists
      const result = await client.query(
        'SELECT id FROM admin_migrations WHERE name = $1',
        [migrationName]
      );

      if (result.rows.length === 0) {
        throw new Error(`Migration ${migrationName} not found in executed migrations`);
      }

      // For now, we don't have rollback scripts, so we just remove the record
      // In a production system, you'd want rollback SQL files
      await client.query(
        'DELETE FROM admin_migrations WHERE name = $1',
        [migrationName]
      );

      await client.query('COMMIT');
      logger.warn(`Migration rolled back: ${migrationName} (record removed, manual cleanup may be required)`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Rollback failed: ${migrationName}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getMigrationStatus(): Promise<{
    executed: Migration[];
    pending: string[];
    total: number;
  }> {
    try {
      const executed = await this.getExecutedMigrations();
      const pending = await this.getPendingMigrations();
      
      return {
        executed,
        pending,
        total: executed.length + pending.length
      };
    } catch (error) {
      logger.error('Error getting migration status:', error);
      throw error;
    }
  }
}