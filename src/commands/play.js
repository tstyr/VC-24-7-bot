import { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { log } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('音楽を検索して再生します')
  .addStringOption(option =>
    option.setName('曲名')
      .setDescription('検索する曲名またはURL')
      .setRequired(true)
  );

export async function execute(interaction, musicPlayer) {
  await interaction.deferReply();

  const query = interaction.options.getString('曲名');
  const member = interaction.member;

  if (!member.voice.channel) {
    return interaction.editReply('❌ ボイスチャンネルに参加してください');
  }

  log(`検索開始: ${query}`, 'music');
  const result = await musicPlayer.search(query);

  if (!result.success || !result.tracks || result.tracks.length === 0) {
    return interaction.editReply('❌ 曲が見つかりませんでした。別のキーワードで試してください。');
  }

  // URLの場合は直接再生
  if (query.startsWith('http')) {
    const queue = musicPlayer.getQueue(interaction.guildId);
    queue.tracks.push(result.tracks[0]);
    queue.textChannel = interaction.channel;

    if (!queue.current) {
      await musicPlayer.play(interaction.guildId, member.voice.channelId);
    }

    return interaction.editReply(`✅ キューに追加: **${result.tracks[0].info.title}**`);
  }

  // 検索結果をSelect Menuで表示
  const options = result.tracks.map((track, index) => ({
    label: track.info.title.substring(0, 100),
    description: `${track.info.author} - ${formatDuration(track.info.length)}`.substring(0, 100),
    value: `track_${index}`
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_track_${interaction.user.id}`)
    .setPlaceholder('再生する曲を選択してください')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('🔍 検索結果')
    .setDescription(`**${query}** の検索結果 (${result.tracks.length}件)`)
    .setFooter({ text: '下のメニューから曲を選択してください' });

  const response = await interaction.editReply({
    embeds: [embed],
    components: [row]
  });

  // 検索結果を一時保存
  const collector = response.createMessageComponentCollector({
    filter: i => i.customId === `select_track_${interaction.user.id}` && i.user.id === interaction.user.id,
    time: 60000
  });

  collector.on('collect', async (i) => {
    const trackIndex = parseInt(i.values[0].split('_')[1]);
    const selectedTrack = result.tracks[trackIndex];

    const queue = musicPlayer.getQueue(interaction.guildId);
    queue.tracks.push(selectedTrack);
    queue.textChannel = interaction.channel;

    await i.update({
      content: `✅ キューに追加: **${selectedTrack.info.title}**`,
      embeds: [],
      components: []
    });

    if (!queue.current) {
      await musicPlayer.play(interaction.guildId, member.voice.channelId);
    }

    collector.stop();
  });

  collector.on('end', (collected, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        content: '⏱️ 選択がタイムアウトしました',
        embeds: [],
        components: []
      }).catch(() => {});
    }
  });
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
