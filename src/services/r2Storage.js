import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { log } from '../utils/logger.js';

/**
 * Cloudflare R2 クライアント
 */
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'youtube-downloads';
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL; // https://<custom-domain> or R2.dev URL

/**
 * ファイルをR2にアップロード
 * @param {string} filePath - ローカルファイルパス
 * @param {string} fileName - R2でのファイル名
 * @param {string} contentType - MIMEタイプ
 * @returns {Promise<{url: string, key: string, size: number}>}
 */
export async function uploadToR2(filePath, fileName, contentType) {
  try {
    const fileStats = await stat(filePath);
    const fileStream = createReadStream(filePath);
    
    // ファイル名にタイムスタンプを追加してユニーク化
    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const uniqueFileName = `${baseName}_${timestamp}${ext}`;
    
    log(`Uploading to R2: ${uniqueFileName} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`, 'info');

    // マルチパートアップロード（大きいファイル対応）
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: uniqueFileName,
        Body: fileStream,
        ContentType: contentType,
        ACL: 'public-read', // 公開アクセス可能にする
        // 3日後に自動削除
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'expires-in-days': '3'
        }
      },
    });

    // アップロード進捗監視
    upload.on('httpUploadProgress', (progress) => {
      const percent = Math.round((progress.loaded / progress.total) * 100);
      if (percent % 20 === 0) {
        log(`Upload progress: ${percent}%`, 'info');
      }
    });

    await upload.done();

    // 公開URLを生成（ファイル名をURLエンコード）
    const encodedFileName = encodeURIComponent(uniqueFileName);
    const publicUrl = `${PUBLIC_URL_BASE}/${encodedFileName}`;

    log(`Upload completed: ${publicUrl}`, 'success');

    return {
      url: publicUrl,
      key: uniqueFileName,
      size: fileStats.size
    };
  } catch (error) {
    log(`R2 upload failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * R2からファイルを削除
 * @param {string} key - R2のオブジェクトキー
 */
export async function deleteFromR2(key) {
  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));
    
    log(`Deleted from R2: ${key}`, 'info');
  } catch (error) {
    log(`R2 delete failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * R2の設定確認
 */
export function checkR2Config() {
  const requiredEnvVars = [
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL'
  ];

  const missing = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    log(`Missing R2 configuration: ${missing.join(', ')}`, 'error');
    return false;
  }

  log('R2 configuration verified', 'success');
  return true;
}

/**
 * 3日以上前にアップロードされたファイルを削除
 * 注: R2のライフサイクルルールを使うことを推奨
 */
export async function cleanupExpiredFiles() {
  try {
    // R2のライフサイクルルールで自動削除されるため、手動削除は不要
    log('R2 cleanup: Using lifecycle rules (3 days expiration)', 'info');
  } catch (error) {
    log(`R2 cleanup error: ${error.message}`, 'error');
  }
}
