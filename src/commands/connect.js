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
    
    // 既に接続している場合は切断
    if (queue.player) {
      await queue.player.disconnect();
      queue.player = null;
    }

    log('接続開始', 'voice');

    // Shoukaku v4: shoukaku インスタンスから joinVoiceChannel を呼び出す
    queue.player = await musicPlayer.shoukaku.joinVoiceChannel({
      guildId: interaction.guildId,
      channelId: targetChannel.id,
      shardId: 0,
      deaf: true,
    });

    log('Shoukaku プレイヤー作成成功', 'voice');

    // 接続が安定するまで待機
    await new Promise(resolve => setTimeout(resolve, 300));
    log('接続安定化待機完了', 'voice');

    log(`${targetChannel.name} に接続しました`, 'voice');
    await interaction.editReply(`✅ ${targetChannel.name} に接続しました`);

  } catch (error) {
    log(`接続エラー: ${error.message}`, 'error');
    log(`エラースタック: ${error.stack}`, 'error');
    
    // RestError の詳細をログ
    if (error.body) {
      log(`RestError body: ${JSON.stringify(error.body)}`, 'error');
    }
    
    await interaction.editReply('❌ 接続中にエラーが発生しました');
  }
}
