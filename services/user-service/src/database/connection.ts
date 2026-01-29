import { Pool, PoolClient, QueryResult } from 'pg';
import logger from '../utils/logger';

// Database connection configuration
// SSL is disabled by default for internal Kubernetes cluster connections
// Set DB_SSL=true to enable SSL for external/cloud PostgreSQL connections
const sslEnabled = process.env.DB_SSL === 'true';
const connectionConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://cloudmaster:cloudpass@localhost:5432/cloudmastershub',
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Connection timeout: 10 seconds
  allowExitOnIdle: false
};

// Create connection pool
const pool = new Pool(connectionConfig);

// Pool error handling
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
});

pool.on('connect', (client) => {
  logger.debug('New database client connected');
});

pool.on('acquire', (client) => {
  logger.debug('Database client acquired from pool');
});

pool.on('remove', (client) => {
  logger.debug('Database client removed from pool');
});

// Database connection class
export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;
  private isConnected: boolean = false;

  private constructor() {
    this.pool = pool;
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Initialize database connection and test connectivity
   */
  public async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('Database connected successfully', {
        database: this.getDatabaseName(),
        maxConnections: connectionConfig.max
      });
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to database', error);
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if database is connected
   */
  public isConnectionHealthy(): boolean {
    return this.isConnected && !this.pool.ended;
  }

  /**
   * Execute a query with automatic connection management
   */
  public async query<T extends Record<string, any> = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      const result = await client.query<T>(text, params);
      
      const duration = Date.now() - start;
      logger.debug('Database query executed', {
        duration: `${duration}ms`,
        rowCount: result.rowCount,
        command: result.command
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: text,
        params: params ? '[REDACTED]' : 'none',
        duration: `${duration}ms`
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const client = await this.pool.connect();
    const start = Date.now();

    try {
      await client.query('BEGIN');
      logger.debug('Transaction started');

      const result = await callback(client);

      await client.query('COMMIT');
      const duration = Date.now() - start;
      logger.debug('Transaction committed', { duration: `${duration}ms` });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      const duration = Date.now() - start;
      logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for manual management
   */
  public async getClient(): Promise<PoolClient> {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return await this.pool.connect();
  }

  /**
   * Get database statistics
   */
  public getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      ended: this.pool.ended
    };
  }

  /**
   * Get database name from connection string
   */
  private getDatabaseName(): string {
    try {
      const url = new URL(connectionConfig.connectionString!);
      return url.pathname.substring(1); // Remove leading slash
    } catch {
      return 'unknown';
    }
  }

  /**
   * Health check for the database connection
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    database: string;
    connectionPool: {
      total: number;
      idle: number;
      waiting: number;
    };
    responseTime?: number;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      await this.query('SELECT 1');
      const responseTime = Date.now() - start;
      const poolStats = this.getPoolStats();

      return {
        status: 'healthy',
        database: this.getDatabaseName(),
        connectionPool: {
          total: poolStats.totalCount,
          idle: poolStats.idleCount,
          waiting: poolStats.waitingCount
        },
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      const poolStats = this.getPoolStats();

      return {
        status: 'unhealthy',
        database: this.getDatabaseName(),
        connectionPool: {
          total: poolStats.totalCount,
          idle: poolStats.idleCount,
          waiting: poolStats.waitingCount
        },
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Close all database connections
   */
  public async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', error);
      throw error;
    }
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance();

// Export types for convenience
export type { PoolClient, QueryResult };