import { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
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
  // 最優先で deferReply を実行（3秒ルールを守る）
  try {
    await interaction.deferReply();
  } catch (error) {
    log(`deferReply エラー: ${error.message}`, 'error');
    return;
  }

  const query = interaction.options.getString('曲名');
  const member = interaction.member;

  // ボイスチャンネルチェック（即座に実行）
  if (!member.voice.channel) {
    try {
      return await interaction.editReply('❌ ボイスチャンネルに参加してください');
    } catch (error) {
      log(`editReply エラー: ${error.message}`, 'error');
      return;
    }
  }

  try {
    log(`検索開始: ${query}`, 'music');
    
    // タイムアウト付きで検索実行（28秒 - deferReplyの猶予を考慮）
    const searchPromise = musicPlayer.search(query);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('検索がタイムアウトしました')), 28000)
    );
    
    let result;
    try {
      result = await Promise.race([searchPromise, timeoutPromise]);
    } catch (searchError) {
      log(`検索エラー: ${searchError.message}`, 'error');
      return await interaction.editReply('❌ 検索中にエラーが発生しました。もう一度お試しください。');
    }

    if (!result.success || !result.tracks || result.tracks.length === 0) {
      const errorMsg = result.error || '曲が見つかりませんでした。別のキーワードで試してください。';
      return await interaction.editReply(`❌ ${errorMsg}`);
    }

    // URLの場合は直接再生
    if (query.startsWith('http')) {
      const queue = musicPlayer.getQueue(interaction.guildId);
      queue.tracks.push(result.tracks[0]);
      queue.textChannel = interaction.channel;

      if (!queue.current) {
        try {
          await musicPlayer.play(interaction.guildId, member.voice.channelId);
        } catch (playError) {
          log(`再生エラー: ${playError.message}`, 'error');
          
          // RestError の詳細をログ
          if (playError.body) {
            log(`RestError body: ${JSON.stringify(playError.body)}`, 'error');
          }
          
          return await interaction.editReply(`❌ 再生開始に失敗しました: ${playError.message}`);
        }
      }

      return await interaction.editReply(`✅ キューに追加: **${result.tracks[0].info?.title || 'Unknown'}**`);
    }

    // 検索結果をSelect Menuで表示
    const options = result.tracks.map((track, index) => ({
      label: (track.info?.title || 'Unknown').substring(0, 100),
      description: `${track.info?.author || 'Unknown'} - ${formatDuration(track.info?.length || 0)}`.substring(0, 100),
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
      try {
        const trackIndex = parseInt(i.values[0].split('_')[1]);
        const selectedTrack = result.tracks[trackIndex];

        const queue = musicPlayer.getQueue(interaction.guildId);
        queue.tracks.push(selectedTrack);
        queue.textChannel = interaction.channel;

        // 先に update してから再生を開始
        await i.update({
          content: `✅ キューに追加: **${selectedTrack.info?.title || 'Unknown'}**`,
          embeds: [],
          components: []
        });

        if (!queue.current) {
          try {
            await musicPlayer.play(interaction.guildId, member.voice.channelId);
          } catch (playError) {
            log(`再生開始エラー: ${playError.message}`, 'error');
            log(`エラースタック: ${playError.stack}`, 'error');
            
            // RestError の詳細をログ
            if (playError.body) {
              log(`RestError body: ${JSON.stringify(playError.body)}`, 'error');
            }
            
            // 再生エラーは別途通知
            await interaction.followUp({
              content: `❌ 再生開始に失敗しました: ${playError.message}`,
              flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
          }
        }

        collector.stop();
      } catch (error) {
        log(`選択処理エラー: ${error.message}`, 'error');
        log(`エラースタック: ${error.stack}`, 'error');
        
        // インタラクションの状態を確認してから応答
        try {
          if (!i.replied && !i.deferred) {
            await i.reply({
              content: '❌ 曲の追加中にエラーが発生しました',
              flags: [MessageFlags.Ephemeral]
            });
          } else if (i.deferred) {
            await i.editReply({
              content: '❌ 曲の追加中にエラーが発生しました',
              embeds: [],
              components: []
            });
          }
        } catch (updateError) {
          log(`update エラー: ${updateError.message}`, 'error');
        }
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          content: '⏱️ 選択がタイムアウトしました',
          embeds: [],
          components: []
        }).catch(error => log(`タイムアウト通知エラー: ${error.message}`, 'error'));
      }
    });
  } catch (error) {
    log(`/play コマンドエラー: ${error.message}`, 'error');
    log(`エラースタック: ${error.stack}`, 'error');
    
    try {
      await interaction.editReply('❌ 検索中にエラーが発生しました。もう一度お試しください。');
    } catch (replyError) {
      log(`エラー応答の送信に失敗: ${replyError.message}`, 'error');
    }
  }
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
