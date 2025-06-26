import { Pool, PoolClient } from 'pg';
import { logger } from '@cloudmastershub/utils';

let pool: Pool | null = null;

export const connectDatabase = async (): Promise<void> => {
  try {
    const connectionString = process.env.PAYMENT_DATABASE_URL || 
      `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Payment Service connected to PostgreSQL database');
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL database:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Payment Service disconnected from PostgreSQL database');
  }
};

export const getDatabase = (): Pool => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
};

export const executeQuery = async <T = any>(
  text: string,
  params?: any[]
): Promise<T[]> => {
  const client = await getDatabase().connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
};

export const executeTransaction = async <T = any>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getDatabase().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};