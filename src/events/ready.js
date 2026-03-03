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
  client.musicPlayer.shoukaku.once('ready', async (nodeName) => {
    const vcChannelId = process.env.VC_CHANNEL_ID;
    if (!vcChannelId) return;

    // Lavalinkセッション初期化完了を待つ + 他のノードも接続する時間を確保
    log(`最初のLavalinkノード ${nodeName} が接続完了。5秒後にVC接続を開始します`, 'voice');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 利用可能ノードをログ
    const connectedNodes = [...client.musicPlayer.shoukaku.nodes.values()].filter(n => n.state === 2);
    log(`利用可能なLavalinkノード: ${connectedNodes.map(n => n.name).join(', ')} (${connectedNodes.length}ノード)`, 'voice');

    if (connectedNodes.length === 0) {
      log('利用可能なLavalinkノードがありません。VC接続をスキップします', 'error');
      return;
    }

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const channel = await client.channels.fetch(vcChannelId);
        if (!channel?.isVoiceBased()) {
          log(`VC_CHANNEL_ID ${vcChannelId} はVoiceチャンネルではありません`, 'error');
          return;
        }

        log(`24時間VC接続開始 (試行 ${attempt}/${maxRetries})`, 'voice');

        // 利用可能ノードを再チェック
        const availableNodes = [...client.musicPlayer.shoukaku.nodes.values()].filter(n => n.state === 2);
        log(`現在の利用可能ノード: ${availableNodes.map(n => n.name).join(', ')}`, 'voice');
        
        if (availableNodes.length === 0) {
          throw new Error('利用可能なLavalinkノードがありません');
        }

        // 既存プレイヤーをクリーンアップ
        try { client.musicPlayer.shoukaku.leaveVoiceChannel(channel.guildId); } catch (e) { /* ignore */ }

        // Shoukaku v4: shoukaku インスタンスから joinVoiceChannel を呼び出す
        const player = await client.musicPlayer.shoukaku.joinVoiceChannel({
          guildId: channel.guildId,
          channelId: channel.id,
          shardId: 0,
          deaf: true,
        });

        log('Shoukaku プレイヤー作成成功', 'voice');

        // 接続が安定するまで待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        log('接続安定化待機完了', 'voice');

        const queue = client.musicPlayer.getQueue(channel.guildId);
        queue.player = player;
        queue.voiceChannelId = channel.id;

        // Voice接続クローズ時にプレイヤーをクリア
        player.on('closed', (data) => {
          log(`🔌 24h VC接続クローズ: code=${data.code}, reason=${data.reason}, byRemote=${data.byRemote}`, 'error');
          client.musicPlayer.stopProgressBar(channel.guildId);
          queue.player = null;
          queue.current = null;
        });

        // 保存された音量を適用
        await client.musicPlayer.applySavedVolume(player, channel.guildId);

        log(`24時間VC接続完了: ${channel.name}`, 'voice');
        return; // 成功したのでループ終了
      } catch (error) {
        log(`24時間VC接続エラー (試行 ${attempt}/${maxRetries}): ${error.message}`, 'error');
        if (error.stack) log(`エラースタック: ${error.stack}`, 'error');

        if (attempt < maxRetries) {
          const waitMs = attempt * 3000; // 3s, 6s, 9s, 12s
          log(`${waitMs / 1000}秒後にリトライします...`, 'voice');
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else {
          log('24時間VC接続: 全リトライ失敗', 'error');
        }
      }
    }
  });
}
