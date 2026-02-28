import { pool } from '../database/db.js';
import { log } from '../utils/logger.js';

export const name = 'voiceStateUpdate';

export async function execute(oldState, newState) {
  const member = newState.member;
  
  // Bot自身は記録しない
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
