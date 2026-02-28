import { log } from '../utils/logger.js';
import { joinChannel } from '@discordjs/voice';

export const name = 'ready';
export const once = true;

export async function execute(client) {
  log(`${client.user.tag} としてログインしました`, 'success');

  // 24時間VC接続
  const vcChannelId = process.env.VC_CHANNEL_ID;
  if (vcChannelId) {
    try {
      const channel = await client.channels.fetch(vcChannelId);
      if (channel?.isVoiceBased()) {
        const player = client.musicPlayer.shoukaku.getNode();
        if (player) {
          await player.joinChannel({
            guildId: channel.guildId,
            channelId: channel.id,
            shardId: 0
          });
          log(`24時間VC接続: ${channel.name}`, 'voice');
        }
      }
    } catch (error) {
      log(`24時間VC接続エラー: ${error.message}`, 'error');
    }
  }

  // スラッシュコマンド登録
  try {
    const commands = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());
    await client.application.commands.set(commands);
    log(`${commands.length}個のコマンドを登録しました`, 'success');
  } catch (error) {
    log(`コマンド登録エラー: ${error.message}`, 'error');
  }
}
