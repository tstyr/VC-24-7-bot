import { createMusicPanel } from '../music/panel.js';
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
      const reply = { content: '❌ コマンド実行中にエラーが発生しました', ephemeral: true };
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
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
          await interaction.reply({ content: '⏭️ スキップしました', ephemeral: true });
          break;

        case 'music_pause':
          await musicPlayer.pause(interaction.guildId);
          await interaction.reply({ content: '⏸️ 一時停止しました', ephemeral: true });
          break;

        case 'music_resume':
          await musicPlayer.resume(interaction.guildId);
          await interaction.reply({ content: '▶️ 再開しました', ephemeral: true });
          break;

        case 'music_repeat':
          const repeatStatus = musicPlayer.toggleRepeat(interaction.guildId);
          await interaction.reply({ 
            content: repeatStatus ? '🔁 リピートON' : '➡️ リピートOFF', 
            ephemeral: true 
          });
          
          // パネルを更新
          if (queue.current && queue.controlMessage) {
            const panel = createMusicPanel(queue.current, queue);
            await queue.controlMessage.edit(panel);
          }
          break;

        default:
          await interaction.reply({ content: '❌ 不明なボタンです', ephemeral: true });
      }
    } catch (error) {
      log(`ボタン処理エラー: ${error.message}`, 'error');
      await interaction.reply({ content: '❌ 処理中にエラーが発生しました', ephemeral: true });
    }
  }
}
