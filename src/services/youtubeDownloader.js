import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from '../utils/logger.js';

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ダウンロードディレクトリ
const DOWNLOAD_DIR = path.join(__dirname, '../../downloads');

// exec用のデフォルトオプション
const execOptions = {
  maxBuffer: 50 * 1024 * 1024, // 50MB
  timeout: 300000 // 5分
};

/**
 * ダウンロードディレクトリを初期化
 */
export async function initDownloadDir() {
  try {
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
    log(`Download directory initialized: ${DOWNLOAD_DIR}`, 'info');
  } catch (error) {
    log(`Failed to create download directory: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * yt-dlpがインストールされているか確認
 */
async function checkYtDlpInstalled() {
  try {
    await execPromise('yt-dlp --version');
    return true;
  } catch (error) {
    log('yt-dlp is not installed. Please install it: https://github.com/yt-dlp/yt-dlp#installation', 'error');
    return false;
  }
}

/**
 * URLからサイトタイプを判定
 */
function getSiteType(url) {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (lowerUrl.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'twitter';
  }
  if (lowerUrl.includes('instagram.com')) {
    return 'instagram';
  }
  
  return 'other';
}

/**
 * サイトタイプに応じた追加オプションを取得
 */
function getExtraOptions(siteType) {
  const options = [];
  
  switch (siteType) {
    case 'youtube':
      // YouTubeのBot検出回避策
      if (process.env.YOUTUBE_COOKIES_PATH) {
        // Cookie認証を使用（最も安定）
        options.push(
          '--cookies', process.env.YOUTUBE_COOKIES_PATH,
          '--extractor-args', 'youtube:player_client=android,ios,web'
        );
      } else if (process.env.YOUTUBE_VISITOR_DATA) {
        // Visitor Data認証を使用（Cookieなし）
        options.push(
          '--extractor-args', `youtubetab:skip=webpage`,
          '--extractor-args', `youtube:player_skip=webpage,configs;visitor_data=${process.env.YOUTUBE_VISITOR_DATA}`
        );
      } else {
        // デフォルト: player_skipのみ（不安定だが試す価値あり）
        options.push(
          '--extractor-args', 'youtube:player_client=android,ios,web;player_skip=webpage,configs'
        );
      }
      
      // 共通オプション
      options.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      break;
    
    case 'tiktok':
      // TikTokは特別なオプション不要
      break;
    
    case 'twitter':
      // Twitterは特別なオプション不要
      break;
    
    case 'instagram':
      // Instagramは特別なオプション不要
      break;
    
    default:
      // その他のサイトもオプション不要
      break;
  }
  
  return options;
}

/**
 * YouTube動画情報を取得
 */
export async function getVideoInfo(url) {
  try {
    const siteType = getSiteType(url);
    const extraOptions = getExtraOptions(siteType);
    
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-check-certificate',
      '--ignore-errors',
      '--geo-bypass',
      '--socket-timeout', '30',
      ...extraOptions,
      url
    ];

    log(`Getting video info with args: ${args.join(' ')}`, 'info');

    // spawnを使って配列で引数を渡す（シェルを経由しない）
    const { stdout } = await new Promise((resolve, reject) => {
      const child = spawn('yt-dlp', args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Process exited with code ${code}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    const info = JSON.parse(stdout);
    
    return {
      title: info.title,
      duration: info.duration,
      thumbnail: info.thumbnail,
      uploader: info.uploader || info.uploader_id || 'Unknown',
      formats: info.formats
    };
  } catch (error) {
    log(`Failed to get video info: ${error.message}`, 'error');
    
    // YouTubeのBot検出エラーの場合、より詳細なメッセージ
    if (error.message.includes('Sign in to confirm')) {
      throw new Error('YouTube Bot検出: Cookieファイルが必要です。YOUTUBE_FIX.mdを参照してください。');
    }
    
    throw error;
  }
}

/**
 * YouTube動画をダウンロード
 * @param {string} url - YouTube URL
 * @param {string} format - 'mp4' or 'm4a'
 * @param {string} quality - 'best', '720p', '1080p', etc.
 * @returns {Promise<{filePath: string, fileName: string, fileSize: number}>}
 */
export async function downloadVideo(url, format = 'mp4', quality = 'best') {
  try {
    // yt-dlpがインストールされているか確認
    const isInstalled = await checkYtDlpInstalled();
    if (!isInstalled) {
      throw new Error('yt-dlp is not installed on the system');
    }

    // ダウンロードディレクトリが存在しない場合は作成
    await initDownloadDir();

    // ファイル名を生成（タイムスタンプ付き）
    const timestamp = Date.now();
    const extension = format === 'm4a' ? 'm4a' : 'mp4';
    const outputTemplate = path.join(DOWNLOAD_DIR, `%(title)s_${timestamp}.%(ext)s`);

    log(`Starting download: ${url} (format: ${format}, quality: ${quality})`, 'info');

    const siteType = getSiteType(url);
    const extraOptions = getExtraOptions(siteType);

    let formatOption;
    if (format === 'm4a') {
      // 音声のみ
      formatOption = 'bestaudio[ext=m4a]/bestaudio';
    } else {
      // 動画
      if (quality === 'best') {
        formatOption = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
      } else {
        // 特定の解像度
        const heightValue = quality.replace('p', '');
        formatOption = `bestvideo[height<=${heightValue}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;
      }
    }

    // yt-dlp でダウンロード（spawnを使って配列で引数を渡す）
    const args = [
      '-f', formatOption,
      '-o', outputTemplate,
      '--no-playlist',
      '--newline',
      '--no-check-certificate',
      '--ignore-errors',
      '--geo-bypass',
      '--socket-timeout', '30',
      '--retries', '3',
      '--fragment-retries', '3',
      ...extraOptions,
      url
    ];

    await new Promise((resolve, reject) => {
      const child = spawn('yt-dlp', args, {
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Process exited with code ${code}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });

    log(`Download completed`, 'info');

    // ダウンロードされたファイルを検索
    const files = await fs.readdir(DOWNLOAD_DIR);
    const downloadedFile = files
      .filter(f => f.endsWith(`.${extension}`) && f.includes(`_${timestamp}`))
      .sort((a, b) => b.localeCompare(a))[0];

    if (!downloadedFile) {
      throw new Error('Downloaded file not found');
    }

    const filePath = path.join(DOWNLOAD_DIR, downloadedFile);
    const stats = await fs.stat(filePath);

    return {
      filePath,
      fileName: downloadedFile,
      fileSize: stats.size
    };
  } catch (error) {
    log(`Download failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * 古いファイルを削除（1時間以上前のファイル）
 */
export async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(DOWNLOAD_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(DOWNLOAD_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > oneHour) {
        await fs.unlink(filePath);
        log(`Cleaned up old file: ${file}`, 'info');
      }
    }
  } catch (error) {
    log(`Cleanup failed: ${error.message}`, 'error');
  }
}

/**
 * ファイルサイズを人間が読める形式に変換
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
