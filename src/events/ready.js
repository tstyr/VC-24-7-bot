import { log } from '../utils/logger.js';

export const name = 'ready';
export const once = true;

export async function execute(client) {
  log(`${client.user.tag} としてログインしました`, 'success');

  // スラッシュコマンド登録
  try {
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    await client.application.commands.set(commands);
    log(`${commands.length}個のコマンドを登録しました`, 'success');
  } catch (error) {
    log(`コマンド登録エラー: ${error.message}`, 'error');
  }

  // 24時間VC接続（Lavalink不要 - Raw Discord Gateway opcode 4）
  const vcChannelId = process.env.VC_CHANNEL_ID;
  if (vcChannelId) {
    try {
      const channel = await client.channels.fetch(vcChannelId);
      if (!channel?.isVoiceBased()) {
        log(`VC_CHANNEL_ID ${vcChannelId} はVoiceチャンネルではありません`, 'error');
      } else {
        // Gateway接続が安定するまで少し待機
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const queue = client.musicPlayer.getQueue(channel.guildId);
        queue.voiceChannelId = channel.id;
        
        client.musicPlayer.joinVCRaw(channel.guildId, channel.id);
        log(`24時間VC接続完了（Raw Gateway）: ${channel.name}`, 'voice');
      }
    } catch (error) {
      log(`24時間VC接続エラー: ${error.message}`, 'error');
    }

    // 定期的にVCに再接続チェック（30秒ごと）
    setInterval(async () => {
      try {
        const guildId = process.env.GUILD_ID;
        if (!guildId) return;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const me = guild.members.me;
        if (!me?.voice?.channelId) {
          // 音楽再生中でなければ再接続
          const queue = client.musicPlayer.getQueue(guildId);
          if (!queue.current && !queue.player) {
            log('ボットがVCにいません。Raw Gatewayで再接続します...', 'voice');
            client.musicPlayer.joinVCRaw(guildId, vcChannelId);
          }
        }
      } catch (error) {
        // silent - 30秒ごとのチェックなのでエラー無視
      }
    }, 30000);
  }

  // Lavalink接続状態ログ（音楽再生用）
  client.musicPlayer.shoukaku.on('ready', (nodeName) => {
    log(`Lavalink ${nodeName} 接続完了（音楽検索・再生用）`, 'success');
  });
}
