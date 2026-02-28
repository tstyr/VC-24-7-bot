import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createProgressBar(current, total, length = 18) {
  if (!total || total === 0) return '▬'.repeat(length);
  const progress = Math.round((current / total) * length);
  const emptyProgress = length - progress;
  const progressText = '▇'.repeat(Math.max(0, progress - 1));
  const emptyProgressText = '▬'.repeat(Math.max(0, emptyProgress));
  return `${progressText}🔘${emptyProgressText}`;
}

export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function createMusicPanel(track, queue) {
  const embed = new EmbedBuilder()
    .setColor('#2b2d31') // Discordモダンダーク
    .setAuthor({ 
      name: '🎵 Now Playing', 
      iconURL: 'https://cdn-icons-png.flaticon.com/512/1384/1384061.png' 
    })
    .setTitle(track.info.title)
    .setURL(track.info.uri || null)
    .setDescription(
      `**${track.info.author || 'Unknown Artist'}**\n\n` +
      `\`${createProgressBar(0, track.info.length, 20)}\`\n` +
      `\`0:00 / ${formatDuration(track.info.length)}\``
    )
    .setThumbnail(
      track.info.artworkUrl || 
      'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?q=80&w=200&auto=format&fit=crop'
    )
    .addFields(
      { name: '📋 待機中のキュー', value: `${queue.tracks.length} 曲`, inline: true },
      { name: '🔁 リピート', value: queue.repeat ? '`ON`' : '`OFF`', inline: true }
    )
    .setFooter({ text: 'Music Player v2 • Powered by Lavalink' })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel('一時停止')
        .setEmoji('⏯️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('スキップ')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_repeat')
        .setLabel(queue.repeat ? 'リピートON' : 'リピートOFF')
        .setEmoji('🔁')
        .setStyle(queue.repeat ? ButtonStyle.Success : ButtonStyle.Secondary)
    );

  return { embeds: [embed], components: [row] };
}
