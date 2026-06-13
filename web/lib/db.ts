import { Pool } from 'pg';

console.log('Initializing database connection...');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// DATABASE_URLからホスト名を抽出してログ出力（デバッグ用）
if (process.env.DATABASE_URL) {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log('Database host:', url.hostname);
    console.log('Database port:', url.port);
  } catch (e) {
    console.error('Invalid DATABASE_URL format');
  }
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  // Vercel用の接続設定
  max: 3, // 接続数を増やす
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // タイムアウトを長くする
  // DNS解決の問題対策
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Database connection test
pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// 接続テスト関数
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    console.log('Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    console.log('Database connection successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

export interface OsuUser {
  discord_id: string;
  osu_user_id: number;
  osu_username: string;
  first_linked_at: string;
  last_linked_at: string;
}

export interface OsuSnapshot {
  id: number;
  discord_id: string;
  osu_user_id: number;
  osu_username: string;
  mode: string;
  pp: number;
  global_rank: number;
  country_rank: number;
  play_time_seconds: number;
  play_count: number;
  captured_at: string;
}

export interface OsuBestScore {
  id: number;
  discord_id: string;
  osu_user_id: number;
  osu_username: string;
  mode: string;
  score_id: number;
  pp: number;
  beatmap_id: number;
  beatmap_title: string;
  accuracy: number;
  miss_count: number;
  max_combo: number;
  mods: string;
  recorded_at: string;
}

export async function getTrackedUsers(): Promise<OsuUser[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT discord_id, osu_user_id, osu_username, first_linked_at, last_linked_at
      FROM osu_tracked_users 
      ORDER BY last_linked_at DESC
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getUserSnapshots(
  osuUserId: number, 
  mode: string, 
  limit: number = 50
): Promise<OsuSnapshot[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM osu_user_snapshots 
      WHERE osu_user_id = $1 AND mode = $2 
      ORDER BY captured_at DESC 
      LIMIT $3
    `, [osuUserId, mode, limit]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getLatestUserStats(osuUserId: number, mode: string): Promise<OsuSnapshot | null> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM osu_user_snapshots 
      WHERE osu_user_id = $1 AND mode = $2 
      ORDER BY captured_at DESC 
      LIMIT 1
    `, [osuUserId, mode]);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getAllLatestStats(mode: string = 'osu'): Promise<OsuSnapshot[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT DISTINCT ON (osu_user_id) *
      FROM osu_user_snapshots 
      WHERE mode = $1 
      ORDER BY osu_user_id, captured_at DESC
    `, [mode]);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getBestScores(mode: string = 'osu'): Promise<OsuBestScore[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM osu_best_scores 
      WHERE mode = $1 
      ORDER BY pp DESC
    `, [mode]);
    return result.rows;
  } finally {
    client.release();
  }
}