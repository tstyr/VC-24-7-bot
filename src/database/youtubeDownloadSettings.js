import pool from './db.js';

/**
 * ユーザーのYouTubeダウンロード設定を取得
 */
export async function getDownloadSettings(userId) {
  const result = await pool.query(
    'SELECT * FROM youtube_download_settings WHERE user_id = $1',
    [userId]
  );
  
  if (result.rows.length === 0) {
    // デフォルト設定を返す
    return {
      user_id: userId,
      format: 'mp4',
      quality: 'best'
    };
  }
  
  return result.rows[0];
}

/**
 * ユーザーのYouTubeダウンロード設定を保存
 */
export async function saveDownloadSettings(userId, format, quality = 'best') {
  const result = await pool.query(
    `INSERT INTO youtube_download_settings (user_id, format, quality)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) 
     DO UPDATE SET format = $2, quality = $3, updated_at = NOW()
     RETURNING *`,
    [userId, format, quality]
  );
  
  return result.rows[0];
}

/**
 * ユーザーの設定を削除
 */
export async function deleteDownloadSettings(userId) {
  await pool.query(
    'DELETE FROM youtube_download_settings WHERE user_id = $1',
    [userId]
  );
}
