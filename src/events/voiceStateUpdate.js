import { pool } from '../database/db.js';
import { log } from '../utils/logger.js';

export const name = 'voiceStateUpdate';

export async function execute(oldState, newState) {
  const member = newState.member;
  const client = newState.client;

  // Bot自身がVCから切断された場合 → 自動再接続
  if (member.id === client.user?.id) {
    if (oldState.channelId && !newState.channelId) {
      log(`ボットがVCから切断されました（${oldState.channel?.name || oldState.channelId}）`, 'voice');
      const vcChannelId = process.env.VC_CHANNEL_ID;
      if (vcChannelId) {
        const queue = client.musicPlayer?.getQueue(oldState.guild.id);
        // 音楽再生中でなければ5秒後に再接続
        if (!queue?.current) {
          setTimeout(() => {
            log('ボット切断検知 → Raw Gatewayで再接続します...', 'voice');
            client.musicPlayer?.joinVCRaw(oldState.guild.id, vcChannelId);
          }, 5000);
        }
      }
    }
    return; // Bot自身のイベントはログ記録しない
  }
  
  // Bot以外のユーザーのVC記録
  if (member.user.bot) return;

  try {
    // チャンネルに参加
    if (!oldState.channelId && newState.channelId) {
      await pool.query(
        `INSERT INTO voice_logs (user_id, username, guild_id, channel_id, channel_name, action, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [member.id, member.user.tag, newState.guild.id, newState.channelId, newState.channel.name, 'join']
      );
      log(`${member.user.tag} が ${newState.channel.name} に参加`, 'voice');
    }
    
    // チャンネルから退出
    if (oldState.channelId && !newState.channelId) {
      await pool.query(
        `INSERT INTO voice_logs (user_id, username, guild_id, channel_id, channel_name, action, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [member.id, member.user.tag, oldState.guild.id, oldState.channelId, oldState.channel.name, 'leave']
      );
      log(`${member.user.tag} が ${oldState.channel.name} から退出`, 'voice');
    }
    
    // チャンネル移動
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      // 退出ログ
      await pool.query(
        `INSERT INTO voice_logs (user_id, username, guild_id, channel_id, channel_name, action, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [member.id, member.user.tag, oldState.guild.id, oldState.channelId, oldState.channel.name, 'leave']
      );
      
      // 参加ログ
      await pool.query(
        `INSERT INTO voice_logs (user_id, username, guild_id, channel_id, channel_name, action, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [member.id, member.user.tag, newState.guild.id, newState.channelId, newState.channel.name, 'join']
      );
      
      log(`${member.user.tag} が ${oldState.channel.name} から ${newState.channel.name} に移動`, 'voice');
    }
  } catch (error) {
    log(`通話ログ記録エラー: ${error.message}`, 'error');
  }
}
