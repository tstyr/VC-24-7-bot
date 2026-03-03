import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { log } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('connect')
  .setDescription('ボイスチャンネルに接続します')
  .addChannelOption(option =>
    option.setName('channel')
      .setDescription('接続するボイスチャンネル')
      .addChannelTypes(ChannelType.GuildVoice)
      .setRequired(false)
  );

export async function execute(interaction, musicPlayer) {
  await interaction.deferReply();

  const member = interaction.member;
  let targetChannel = interaction.options.getChannel('channel');

  // チャンネル指定がない場合は実行者のVCに接続
  if (!targetChannel) {
    if (!member.voice.channel) {
      return interaction.editReply('❌ ボイスチャンネルに参加するか、チャンネルを指定してください');
    }
    targetChannel = member.voice.channel;
  }

  try {
    const queue = musicPlayer.getQueue(interaction.guildId);
    queue.voiceChannelId = targetChannel.id;

    // @discordjs/voice で接続
    musicPlayer.joinVC(interaction.guildId, targetChannel.id);

    log(`${targetChannel.name} に接続しました`, 'voice');
    await interaction.editReply(`✅ ${targetChannel.name} に接続しました`);

  } catch (error) {
    log(`接続エラー: ${error.message}`, 'error');
    log(`エラースタック: ${error.stack}`, 'error');
    await interaction.editReply('❌ 接続中にエラーが発生しました');
  }
}
