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

export function createMusicPanel(track, queue, player = null) {
  const currentPos = player ? player.position : 0;
  
  const embed = new EmbedBuilder()
    .setColor('#5865F2') // Discord Blurple
    .setAuthor({ 
      name: '♪ Now Playing', 
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png' 
    })
    .setTitle(track.info.title)
    .setURL(track.info.uri || null)
    .setDescription(
      `**Artist:** ${track.info.author || 'Unknown Artist'}\n\n` +
      `${createProgressBar(currentPos, track.info.length, 20)}\n` +
      `**${formatDuration(currentPos)}** / **${formatDuration(track.info.length)}**`
    )
    .setThumbnail(
      track.info.artworkUrl || 
      'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?q=80&w=200&auto=format&fit=crop'
    )
    .addFields(
      { 
        name: '📋 Queue', 
        value: queue.tracks.length > 0 ? `${queue.tracks.length} track(s) waiting` : 'No tracks in queue', 
        inline: true 
      },
      { 
        name: '🔁 Repeat', 
        value: queue.repeat ? '✅ Enabled' : '❌ Disabled', 
        inline: true 
      },
      { 
        name: '🎚️ Volume', 
        value: `${player?.filters?.volume || 100}%`, 
        inline: true 
      }
    )
    .setFooter({ 
      text: '🎵 Music Player v2 • Powered by Lavalink', 
      iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png' 
    })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel('Pause')
        .setEmoji('⏯️')
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
