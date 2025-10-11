import mysql from 'mysql2/promise';
import logger from '../utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
  enableKeepAlive: boolean;
  keepAliveInitialDelay: number;
}

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'reach_api',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    logger.info('Database connection pool created successfully');
    connection.release();
    return true;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Execute a SQL query with parameters
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  try {
    const [results] = await pool.execute(sql, params);
    return results as T;
  } catch (error) {
    logger.error('Database query error:', { sql, params, error });
    throw error;
  }
}

/**
 * Execute a SQL query and return first row
 */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  try {
    const [results] = await pool.execute(sql, params);
    const rows = results as any[];
    return rows.length > 0 ? (rows[0] as T) : null;
  } catch (error) {
    logger.error('Database queryOne error:', { sql, params, error });
    throw error;
  }
}

/**
 * Get a connection from the pool for transactions
 */
export async function getConnection(): Promise<mysql.PoolConnection> {
  return await pool.getConnection();
}

export { pool };
export default pool;
