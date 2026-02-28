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

  // 24時間VC接続（Lavalink接続後に実行）
  client.musicPlayer.shoukaku.once('ready', async () => {
    const vcChannelId = process.env.VC_CHANNEL_ID;
    if (vcChannelId) {
      try {
        const channel = await client.channels.fetch(vcChannelId);
        if (channel?.isVoiceBased()) {
          const node = client.musicPlayer.shoukaku.nodes.get('main');
          if (node) {
            await node.joinChannel({
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
  });
}
