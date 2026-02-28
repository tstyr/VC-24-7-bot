import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { createServer } from 'http';
import { MusicPlayer } from './music/player.js';
import { testConnection } from './database/db.js';
import { log } from './utils/logger.js';
import { createMusicPanel } from './music/panel.js';

// イベントとコマンドのインポート
import * as readyEvent from './events/ready.js';
import * as voiceStateUpdateEvent from './events/voiceStateUpdate.js';
import * as interactionCreateEvent from './events/interactionCreate.js';
import * as playCommand from './commands/play.js';
import * as connectCommand from './commands/connect.js';
import * as disconnectCommand from './commands/disconnect.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// コマンドとイベントの登録
client.commands = new Collection();
client.commands.set(playCommand.data.name, playCommand);
client.commands.set(connectCommand.data.name, connectCommand);
client.commands.set(disconnectCommand.data.name, disconnectCommand);

// 音楽プレイヤー初期化
client.musicPlayer = new MusicPlayer(client);

// 再生開始時にパネルを送信
client.musicPlayer.shoukaku.on('ready', () => {
  const originalPlay = client.musicPlayer.play.bind(client.musicPlayer);
  
  client.musicPlayer.play = async function(guildId, voiceChannelId) {
    await originalPlay(guildId, voiceChannelId);
    
    const queue = this.getQueue(guildId);
    if (queue.current && queue.textChannel) {
      try {
        const panel = createMusicPanel(queue.current, queue);
        const message = await queue.textChannel.send(panel);
        queue.controlMessage = message;
      } catch (error) {
        log(`パネル送信エラー: ${error.message}`, 'error');
      }
    }
  };
});

// イベントハンドラー
client.once('clientReady', (...args) => readyEvent.execute(...args, client));
client.on(voiceStateUpdateEvent.name, voiceStateUpdateEvent.execute);
client.on(interactionCreateEvent.name, (...args) => interactionCreateEvent.execute(...args, client));

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
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  log(`ヘルスチェックサーバー起動: ポート ${PORT}`, 'success');
});

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
