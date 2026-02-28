import { VoiceLog } from '../database/models.js';
import { log } from '../utils/logger.js';

export const name = 'voiceStateUpdate';

export async function execute(oldState, newState) {
  const member = newState.member;
  
  // Bot自身は記録しない
  if (member.user.bot) return;

  try {
    // チャンネルに参加
    if (!oldState.channelId && newState.channelId) {
      await VoiceLog.create({
        userId: member.id,
        username: member.user.tag,
        guildId: newState.guild.id,
        channelId: newState.channelId,
        channelName: newState.channel.name,
        action: 'join',
        timestamp: new Date()
      });
      log(`${member.user.tag} が ${newState.channel.name} に参加`, 'voice');
    }
    
    // チャンネルから退出
    if (oldState.channelId && !newState.channelId) {
      await VoiceLog.create({
        userId: member.id,
        username: member.user.tag,
        guildId: oldState.guild.id,
        channelId: oldState.channelId,
        channelName: oldState.channel.name,
        action: 'leave',
        timestamp: new Date()
      });
      log(`${member.user.tag} が ${oldState.channel.name} から退出`, 'voice');
    }
    
    // チャンネル移動
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await VoiceLog.create({
        userId: member.id,
        username: member.user.tag,
        guildId: oldState.guild.id,
        channelId: oldState.channelId,
        channelName: oldState.channel.name,
        action: 'leave',
        timestamp: new Date()
      });
      
      await VoiceLog.create({
        userId: member.id,
        username: member.user.tag,
        guildId: newState.guild.id,
        channelId: newState.channelId,
        channelName: newState.channel.name,
        action: 'join',
        timestamp: new Date()
      });
      
      log(`${member.user.tag} が ${oldState.channel.name} から ${newState.channel.name} に移動`, 'voice');
    }
  } catch (error) {
    log(`通話ログ記録エラー: ${error.message}`, 'error');
  }
}
