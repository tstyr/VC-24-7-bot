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
    const queue = musicPlayer.getQueue(interaction.guildId);
    
    // 既に接続している場合は切断
    if (queue.voiceConnection) {
      queue.voiceConnection.destroy();
      queue.voiceConnection = null;
    }
    if (queue.player) {
      queue.player = null;
    }

    log('接続開始', 'voice');

    // @discordjs/voice で接続
    const voiceConnection = joinVoiceChannel({
      channelId: targetChannel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    queue.voiceConnection = voiceConnection;
    log('Discord.js voice 接続成功', 'voice');

    // Shoukaku v4: shoukaku インスタンスから joinVoiceChannel を呼び出す
    queue.player = await musicPlayer.shoukaku.joinVoiceChannel({
      guildId: interaction.guildId,
      channelId: targetChannel.id,
      shardId: 0,
    });

    log(`${targetChannel.name} に接続しました`, 'voice');
    await interaction.editReply(`✅ ${targetChannel.name} に接続しました`);

  } catch (error) {
    log(`接続エラー: ${error.message}`, 'error');
    log(`エラースタック: ${error.stack}`, 'error');
    await interaction.editReply('❌ 接続中にエラーが発生しました');
  }
}
