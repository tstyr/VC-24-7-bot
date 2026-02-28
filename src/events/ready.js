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
          log('24時間VC接続開始', 'voice');

          // Shoukaku v4: shoukaku インスタンスから joinVoiceChannel を呼び出す
          const player = await client.musicPlayer.shoukaku.joinVoiceChannel({
            guildId: channel.guildId,
            channelId: channel.id,
            shardId: 0,
            deaf: true,
          });

          log('Shoukaku プレイヤー作成成功', 'voice');

          // 接続が安定するまで待機（500ms）
          await new Promise(resolve => setTimeout(resolve, 500));
          log('接続安定化待機完了', 'voice');

          const queue = client.musicPlayer.getQueue(channel.guildId);
          queue.player = player;

          log(`24時間VC接続完了: ${channel.name}`, 'voice');
        }
      } catch (error) {
        log(`24時間VC接続エラー: ${error.message}`, 'error');
        log(`エラースタック: ${error.stack}`, 'error');
      }
    }
  });
}
