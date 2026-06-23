import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getDownloadSettings } from '../database/youtubeDownloadSettings.js';
import { downloadVideo, getVideoInfo, formatFileSize } from '../services/youtubeDownloader.js';
import { log } from '../utils/logger.js';

// Discord の最大ファイルサイズ（25MB for non-boosted, 50MB for boosted level 2, 100MB for level 3）
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (デフォルト)

export const data = new SlashCommandBuilder()
  .setName('youtube-download')
  .setDescription('YouTube動画をダウンロードします')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('YouTube動画のURL')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const url = interaction.options.getString('url');

    // URLの検証
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return await interaction.editReply({
        content: '❌ 有効なYouTube URLを入力してください。'
      });
    }

    // ユーザーの設定を取得
    const settings = await getDownloadSettings(interaction.user.id);
    
    log(`Download request from ${interaction.user.tag}: ${url} (format: ${settings.format}, quality: ${settings.quality})`, 'info');

    // 動画情報を取得
    await interaction.editReply({
      content: '📊 動画情報を取得しています...'
    });

    let videoInfo;
    try {
      videoInfo = await getVideoInfo(url);
    } catch (error) {
      log(`Failed to get video info: ${error.message}`, 'error');
      return await interaction.editReply({
        content: '❌ 動画情報の取得に失敗しました。URLを確認してください。'
      });
    }

    // ダウンロード開始
    await interaction.editReply({
      content: `⬇️ ダウンロード中...\n**${videoInfo.title}**\n形式: ${settings.format.toUpperCase()}`
    });

    let downloadResult;
    try {
      downloadResult = await downloadVideo(url, settings.format, settings.quality);
    } catch (error) {
      log(`Download failed: ${error.message}`, 'error');
      return await interaction.editReply({
        content: `❌ ダウンロードに失敗しました。\nエラー: ${error.message}`
      });
    }

    // ファイルサイズチェック
    if (downloadResult.fileSize > MAX_FILE_SIZE) {
      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⚠️ ファイルサイズ制限')
        .setDescription('ファイルサイズがDiscordの制限（25MB）を超えています。')
        .addFields(
          { name: '動画タイトル', value: videoInfo.title, inline: false },
          { name: 'ファイルサイズ', value: formatFileSize(downloadResult.fileSize), inline: true },
          { name: '形式', value: settings.format.toUpperCase(), inline: true }
        )
        .setFooter({ text: 'より低い品質を設定するか、外部サービスをご利用ください。' })
        .setTimestamp();

      // ファイルを削除
      await import('fs').then(fs => fs.promises.unlink(downloadResult.filePath));

      return await interaction.editReply({
        content: null,
        embeds: [embed]
      });
    }

    // ファイルを送信
    await interaction.editReply({
      content: '📤 アップロード中...'
    });

    const attachment = new AttachmentBuilder(downloadResult.filePath);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ ダウンロード完了')
      .setDescription(`**${videoInfo.title}**`)
      .addFields(
        { name: 'アップロード者', value: videoInfo.uploader || 'Unknown', inline: true },
        { name: 'ファイルサイズ', value: formatFileSize(downloadResult.fileSize), inline: true },
        { name: '形式', value: settings.format.toUpperCase(), inline: true }
      )
      .setThumbnail(videoInfo.thumbnail || null)
      .setFooter({ text: `リクエスト: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({
      content: null,
      embeds: [embed],
      files: [attachment]
    });

    log(`Download completed: ${videoInfo.title} (${formatFileSize(downloadResult.fileSize)})`, 'info');

    // ファイルを削除（送信後）
    setTimeout(async () => {
      try {
        await import('fs').then(fs => fs.promises.unlink(downloadResult.filePath));
        log(`Cleaned up file: ${downloadResult.fileName}`, 'info');
      } catch (error) {
        log(`Failed to clean up file: ${error.message}`, 'error');
      }
    }, 5000); // 5秒後に削除

  } catch (error) {
    log(`YouTube download command error: ${error.message}`, 'error');
    log(error.stack, 'error');

    await interaction.editReply({
      content: `❌ エラーが発生しました。\n${error.message}`
    }).catch(() => {});
  }
}
