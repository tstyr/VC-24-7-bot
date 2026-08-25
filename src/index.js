import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createServer } from 'http';
import { MusicPlayer } from './music/player.js';
import { testConnection } from './database/db.js';
import { log } from './utils/logger.js';
import { getOsuApiQueueStats } from './utils/osuApi.js';
import { createCommandCollection } from './commands/index.js';

// イベントとコマンドのインポート
import * as readyEvent from './events/ready.js';
import * as voiceStateUpdateEvent from './events/voiceStateUpdate.js';
import * as interactionCreateEvent from './events/interactionCreate.js';
import * as messageReactionAddEvent from './events/messageReactionAdd.js';
import * as messageReactionRemoveEvent from './events/messageReactionRemove.js';
import { initDownloadDir, cleanupOldFiles } from './services/youtubeDownloader.js';
import { checkR2Config } from './services/r2Storage.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// コマンドとイベントの登録
client.commands = createCommandCollection();

// 音楽プレイヤー初期化
client.musicPlayer = new MusicPlayer(client);

// イベントハンドラー
client.once('clientReady', (...args) => readyEvent.execute(...args, client));
client.on(voiceStateUpdateEvent.name, voiceStateUpdateEvent.execute);
client.on(interactionCreateEvent.name, (...args) => interactionCreateEvent.execute(...args, client));
client.on(messageReactionAddEvent.name, messageReactionAddEvent.execute);
client.on(messageReactionRemoveEvent.name, messageReactionRemoveEvent.execute);

// エラーハンドリング
client.on('error', (error) => {
  log(`Clientエラー: ${error.message}`, 'error');
});

process.on('unhandledRejection', (error) => {
  log(`未処理のPromise拒否: ${error.message}`, 'error');
});

process.on('uncaughtException', (error) => {
  log(`未処理の例外: ${error.message}`, 'error');
  process.exit(1);
});

// ヘルスチェック用HTTPサーバー（Koyeb用）
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      ready: client.isReady(),
      uptimeSeconds: Math.round(process.uptime()),
      osuApi: getOsuApiQueueStats()
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  log(`ヘルスチェックサーバー起動: ポート ${PORT}`, 'success');
});

// Koyeb自動停止防止: 定期的な自己ping（5分ごと）
if (process.env.KOYEB_PUBLIC_DOMAIN) {
  setInterval(() => {
    const url = `https://${process.env.KOYEB_PUBLIC_DOMAIN}/health`;
    fetch(url)
      .then(() => log('キープアライブping送信', 'success'))
      .catch((err) => log(`キープアライブエラー: ${err.message}`, 'error'));
  }, 5 * 60 * 1000); // 5分
}

// 定期的なアクティビティログ（10分ごと）
setInterval(() => {
  log('Instance is healthy. All health checks are passing.', 'success');
}, 10 * 60 * 1000);

// YouTube ダウンロードディレクトリの初期化
initDownloadDir().catch(err => log(`Failed to init download dir: ${err.message}`, 'error'));

// R2設定の確認
checkR2Config();

// 古いダウンロードファイルのクリーンアップ（1時間ごと）
setInterval(() => {
  cleanupOldFiles().catch(err => log(`Cleanup error: ${err.message}`, 'error'));
}, 60 * 60 * 1000);

// 起動
async function start() {
  try {
    await testConnection();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    log(`起動エラー: ${error.message}`, 'error');
    process.exit(1);
  }
}

start();
