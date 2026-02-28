import pg from 'pg';
import { log } from '../utils/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  log(`PostgreSQL接続エラー: ${err.message}`, 'error');
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    log('PostgreSQL接続成功', 'success');
    return true;
  } catch (error) {
    log(`PostgreSQL接続失敗: ${error.message}`, 'error');
    return false;
  }
}
