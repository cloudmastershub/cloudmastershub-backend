import { Pool, PoolConfig } from 'pg';
import logger from '../utils/logger';

class DatabaseConnection {
  private pool: Pool | null = null;

  getPool(): Pool {
    if (!this.pool) {
      const config: PoolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in the pool
        min: 5,  // Minimum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
        maxUses: 7500, // Close and replace a client after it has been used 7500 times
      };

      this.pool = new Pool(config);

      // Handle pool errors
      this.pool.on('error', (err) => {
        logger.error('Unexpected error on idle PostgreSQL client', err);
      });

      // Handle pool connection
      this.pool.on('connect', () => {
        logger.debug('New PostgreSQL client connected to admin service');
      });

      // Handle pool removal
      this.pool.on('remove', () => {
        logger.debug('PostgreSQL client removed from admin service pool');
      });

      logger.info('PostgreSQL connection pool created for admin service');
    }

    return this.pool;
  }

  async testConnection(): Promise<boolean> {
    try {
      const pool = this.getPool();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connection test successful');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('PostgreSQL connection pool closed');
    }
  }

  async getPoolStats(): Promise<{
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }> {
    const pool = this.getPool();
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
  }
}

// Export singleton instance
export const dbConnection = new DatabaseConnection();
export default dbConnection;