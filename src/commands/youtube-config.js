import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDownloadSettings, saveDownloadSettings } from '../database/youtubeDownloadSettings.js';
import { log } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('youtube-config')
  .setDescription('YouTubeダウンロード設定を変更します')
  .addStringOption(option =>
    option.setName('format')
      .setDescription('ダウンロード形式を選択')
      .setRequired(true)
      .addChoices(
        { name: 'MP4 (動画)', value: 'mp4' },
        { name: 'M4A (音声のみ)', value: 'm4a' }
      )
  )
  .addStringOption(option =>
    option.setName('quality')
      .setDescription('動画品質を選択（MP4のみ）')
      .setRequired(false)
      .addChoices(
        { name: '最高画質', value: 'best' },
        { name: '1080p', value: '1080p' },
        { name: '720p', value: '720p' },
        { name: '480p', value: '480p' },
        { name: '360p', value: '360p' }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const format = interaction.options.getString('format');
    const quality = interaction.options.getString('quality') || 'best';

    // 設定を保存
    await saveDownloadSettings(interaction.user.id, format, quality);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ 設定が保存されました')
      .addFields(
        { name: 'ダウンロード形式', value: format === 'mp4' ? 'MP4 (動画)' : 'M4A (音声のみ)', inline: true },
        { name: '動画品質', value: format === 'mp4' ? quality : 'N/A', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    
    log(`YouTube download settings updated for user ${interaction.user.id}: ${format} (${quality})`, 'info');
  } catch (error) {
    log(`Failed to update YouTube download settings: ${error.message}`, 'error');
    
    await interaction.editReply({
      content: '❌ 設定の保存に失敗しました。',
      ephemeral: true
    });
  }
}
