import { createMusicPanel } from '../music/panel.js';
import { MessageFlags } from 'discord.js';
import { log } from '../utils/logger.js';

export const name = 'interactionCreate';

export async function execute(interaction, client) {
  // スラッシュコマンド処理
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client.musicPlayer);
    } catch (error) {
      log(`コマンドエラー: ${error.message}`, 'error');
      log(`エラースタック: ${error.stack}`, 'error');
      
      const reply = { 
        content: '❌ コマンド実行中にエラーが発生しました', 
        flags: [MessageFlags.Ephemeral]
      };
      
      try {
        if (interaction.deferred) {
          await interaction.editReply(reply);
        } else if (interaction.replied) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyError) {
        log(`エラー応答の送信に失敗: ${replyError.message}`, 'error');
      }
    }
    return;
  }

  // ボタン処理
  if (interaction.isButton()) {
    const musicPlayer = client.musicPlayer;
    const queue = musicPlayer.getQueue(interaction.guildId);

    try {
      switch (interaction.customId) {
        case 'music_skip':
          await musicPlayer.skip(interaction.guildId);
          await interaction.reply({ 
            content: '⏭️ スキップしました', 
            flags: [MessageFlags.Ephemeral]
          });
          break;

        case 'music_pause':
          await musicPlayer.pause(interaction.guildId);
          await interaction.reply({ 
            content: '⏸️ 一時停止しました', 
            flags: [MessageFlags.Ephemeral]
          });
          break;

        case 'music_resume':
          await musicPlayer.resume(interaction.guildId);
          await interaction.reply({ 
            content: '▶️ 再開しました', 
            flags: [MessageFlags.Ephemeral]
          });
          break;

        case 'music_repeat':
          const repeatStatus = musicPlayer.toggleRepeat(interaction.guildId);
          await interaction.reply({ 
            content: repeatStatus ? '🔁 リピートON' : '➡️ リピートOFF', 
            flags: [MessageFlags.Ephemeral]
          });
          
          // パネルを更新
          if (queue.current && queue.controlMessage) {
            const panel = createMusicPanel(queue.current, queue, queue.player);
            await queue.controlMessage.edit(panel);
          }
          break;

        case 'music_stop':
          this.stopProgressBar(interaction.guildId);
          if (queue.controlMessage) {
            await queue.controlMessage.delete().catch(() => {});
            queue.controlMessage = null;
          }
          queue.tracks = [];
          queue.current = null;
          await musicPlayer.skip(interaction.guildId);
          await interaction.reply({ 
            content: '⏹️ 停止しました', 
            flags: [MessageFlags.Ephemeral]
          });
          break;

        default:
          await interaction.reply({ 
            content: '❌ 不明なボタンです', 
            flags: [MessageFlags.Ephemeral]
          });
      }
    } catch (error) {
      log(`ボタン処理エラー: ${error.message}`, 'error');
      log(`エラースタック: ${error.stack}`, 'error');
      
      try {
        if (interaction.replied) {
          await interaction.followUp({ 
            content: '❌ 処理中にエラーが発生しました', 
            flags: [MessageFlags.Ephemeral]
          });
        } else if (interaction.deferred) {
          await interaction.editReply({ 
            content: '❌ 処理中にエラーが発生しました'
          });
        } else {
          await interaction.reply({ 
            content: '❌ 処理中にエラーが発生しました', 
            flags: [MessageFlags.Ephemeral]
          });
        }
      } catch (replyError) {
        log(`エラー応答の送信に失敗: ${replyError.message}`, 'error');
      }
    }
  }
}
