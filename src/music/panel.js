import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createMusicPanel(track, queue) {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🎵 再生中')
    .setDescription(`**${track.info.title}**`)
    .addFields(
      { name: '作者', value: track.info.author || '不明', inline: true },
      { name: '長さ', value: formatDuration(track.info.length), inline: true },
      { name: 'リピート', value: queue.repeat ? '🔁 ON' : '➡️ OFF', inline: true }
    )
    .setThumbnail(track.info.artworkUrl || null)
    .setFooter({ text: `キュー: ${queue.tracks.length}曲` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('スキップ')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel('一時停止')
        .setEmoji('⏸️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_resume')
        .setLabel('再開')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('music_repeat')
        .setLabel('リピート')
        .setEmoji('🔁')
        .setStyle(queue.repeat ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [row] };
}

export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
