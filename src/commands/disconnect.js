import { SlashCommandBuilder } from 'discord.js';
import { log } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('disconnect')
  .setDescription('ボイスチャンネルから切断します');

export async function execute(interaction, musicPlayer) {
  await interaction.deferReply();

  try {
    const queue = musicPlayer.getQueue(interaction.guildId);

    if (!queue.player) {
      return interaction.editReply('❌ ボイスチャンネルに接続していません');
    }

    // プレイヤーを破棄 & キューをクリア
    await musicPlayer.disconnect(interaction.guildId);

    log('ボイスチャンネルから切断しました', 'voice');
    await interaction.editReply('✅ 切断しました');

  } catch (error) {
    log(`切断エラー: ${error.message}`, 'error');
    await interaction.editReply('❌ 切断中にエラーが発生しました');
  }
}
