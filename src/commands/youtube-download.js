import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDownloadSettings } from '../database/youtubeDownloadSettings.js';
import { downloadVideo, getVideoInfo, formatFileSize } from '../services/youtubeDownloader.js';
import { uploadToR2, checkR2Config } from '../services/r2Storage.js';
import { log } from '../utils/logger.js';
import { unlink } from 'fs/promises';

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
    // R2設定を確認
    if (!checkR2Config()) {
      return await interaction.editReply({
        content: '❌ Cloudflare R2の設定が完了していません。管理者に連絡してください。'
      });
    }

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
      content: `⬇️ ダウンロード中...\n**${videoInfo.title}**\n形式: ${settings.format.toUpperCase()}\n\nこの処理には時間がかかる場合があります...`
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

    // R2にアップロード
    await interaction.editReply({
      content: `☁️ Cloudflare R2にアップロード中...\n**${videoInfo.title}**\nファイルサイズ: ${formatFileSize(downloadResult.fileSize)}\n\nこの処理には時間がかかる場合があります...`
    });

    let uploadResult;
    try {
      const contentType = settings.format === 'mp4' ? 'video/mp4' : 'audio/mp4';
      uploadResult = await uploadToR2(downloadResult.filePath, downloadResult.fileName, contentType);
    } catch (error) {
      log(`R2 upload failed: ${error.message}`, 'error');
      
      // ローカルファイルを削除
      await unlink(downloadResult.filePath).catch(() => {});
      
      return await interaction.editReply({
        content: `❌ アップロードに失敗しました。\nエラー: ${error.message}`
      });
    }

    // ローカルファイルを削除（アップロード完了後）
    try {
      await unlink(downloadResult.filePath);
      log(`Cleaned up local file: ${downloadResult.fileName}`, 'info');
    } catch (error) {
      log(`Failed to clean up local file: ${error.message}`, 'error');
    }

    // 成功メッセージとダイレクトリンクを送信
    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ ダウンロード完了')
      .setDescription(`**${videoInfo.title}**`)
      .addFields(
        { name: 'アップロード者', value: videoInfo.uploader || 'Unknown', inline: true },
        { name: 'ファイルサイズ', value: formatFileSize(uploadResult.size), inline: true },
        { name: '形式', value: settings.format.toUpperCase(), inline: true },
        { name: '有効期限', value: '3日間', inline: true }
      )
      .setThumbnail(videoInfo.thumbnail || null)
      .setFooter({ text: `リクエスト: ${interaction.user.tag} | Cloudflare R2経由` })
      .setTimestamp();

    // ダイレクトリンクをメッセージとして送信（Discordのインライン再生用）
    await interaction.editReply({
      content: `🎬 **ダウンロード完了！**\n\n${uploadResult.url}\n\n*このリンクは3日間有効です*`,
      embeds: [embed]
    });

    log(`Download completed and uploaded to R2: ${videoInfo.title} (${formatFileSize(uploadResult.size)})`, 'success');
    log(`Public URL: ${uploadResult.url}`, 'info');

  } catch (error) {
    log(`YouTube download command error: ${error.message}`, 'error');
    log(error.stack, 'error');

    await interaction.editReply({
      content: `❌ エラーが発生しました。\n${error.message}`
    }).catch(() => {});
  }
}

