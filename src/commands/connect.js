import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { joinVoiceChannel } from '@discordjs/voice';
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
    const node = musicPlayer.shoukaku.nodes.get('main');
    if (!node) {
      return interaction.editReply('❌ Lavalinkノードが利用できません');
    }

    const queue = musicPlayer.getQueue(interaction.guildId);
    
    // 既に接続している場合は切断
    if (queue.voiceConnection) {
      queue.voiceConnection.destroy();
      queue.voiceConnection = null;
    }
    if (queue.player) {
      queue.player = null;
    }

    // @discordjs/voice で接続
    const voiceConnection = joinVoiceChannel({
      channelId: targetChannel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });

    queue.voiceConnection = voiceConnection;

    // Shoukaku player を作成
    queue.player = await node.joinChannel({
      guildId: interaction.guildId,
      channelId: targetChannel.id,
      shardId: 0,
    });

    log(`${targetChannel.name} に接続しました`, 'voice');
    await interaction.editReply(`✅ ${targetChannel.name} に接続しました`);

  } catch (error) {
    log(`接続エラー: ${error.message}`, 'error');
    await interaction.editReply('❌ 接続中にエラーが発生しました');
  }
}
