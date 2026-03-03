import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function createProgressBar(current, total, length = 20) {
  if (!total || total === 0) return '▬'.repeat(length);
  const progress = Math.round((current / total) * length);
  const emptyProgress = length - progress;
  const progressText = '▇'.repeat(Math.max(0, progress));
  const emptyProgressText = '▬'.repeat(Math.max(0, emptyProgress));
  return `${progressText}${emptyProgressText}`;
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

export function createMusicPanel(track, queue) {
  const currentPos = queue.resource?.playbackDuration || 0;
  const totalLength = track.info?.length || 0;
  
  // プログレスバーの視覚的表現
  const progressBar = createProgressBar(currentPos, totalLength, 20);
  const currentTime = formatDuration(currentPos);
  const totalTime = formatDuration(totalLength);
  const percentage = totalLength > 0 ? Math.round((currentPos / totalLength) * 100) : 0;
  
  const embed = new EmbedBuilder()
    .setColor('#5865F2') // Discord Blurple
    .setAuthor({ 
      name: '🎵 Now Playing', 
      iconURL: 'https://cdn.discordapp.com/attachments/1234567890/music-icon.png' 
    })
    .setTitle(track.info?.title || 'Unknown Title')
    .setURL(track.info?.uri || null)
    .setDescription(
      `**${track.info?.author || 'Unknown Artist'}**\n\n` +
      `\`\`\`\n${progressBar}\n\`\`\`\n` +
      `⏱️ **${currentTime}** ━━━━━━━━━━━━ **${totalTime}** \`${percentage}%\``
    )
    .setThumbnail(
      track.info?.artworkUrl || 
      'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?q=80&w=300&auto=format&fit=crop'
    )
    .addFields(
      { 
        name: '📋 Queue', 
        value: queue.tracks.length > 0 
          ? `\`${queue.tracks.length}\` track${queue.tracks.length > 1 ? 's' : ''} waiting` 
          : '`Empty`', 
        inline: true 
      },
      { 
        name: '🔁 Repeat', 
        value: queue.repeat ? '`✅ ON`' : '`❌ OFF`', 
        inline: true 
      },
      { 
        name: '🔊 Status', 
        value: queue.audioPlayer?.state?.status === 'paused' ? '`⏸️ Paused`' : '`▶️ Playing`', 
        inline: true 
      }
    )
    .setFooter({ 
      text: '🎵 Music Player v2', 
    })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel(queue.audioPlayer?.state?.status === 'paused' ? 'Resume' : 'Pause')
        .setEmoji(queue.audioPlayer?.state?.status === 'paused' ? '▶️' : '⏸️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('Skip')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_repeat')
        .setLabel(queue.repeat ? 'Repeat: ON' : 'Repeat: OFF')
        .setEmoji('🔁')
        .setStyle(queue.repeat ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_stop')
        .setLabel('Stop')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
    );

  return { embeds: [embed], components: [row] };
}
