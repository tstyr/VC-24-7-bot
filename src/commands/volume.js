import { SlashCommandBuilder } from 'discord.js';
import { pool } from '../database/db.js';
import { log } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('音量を設定します（0〜100）')
  .addIntegerOption(option =>
    option.setName('level')
      .setDescription('音量レベル（0〜100）')
      .setMinValue(0)
      .setMaxValue(100)
      .setRequired(true)
  );

export async function execute(interaction, musicPlayer) {
  await interaction.deferReply();

  const volume = interaction.options.getInteger('level');

  try {
    // データベースに音量を保存（UPSERT）
    await pool.query(
      `INSERT INTO guild_settings (guild_id, volume) 
       VALUES ($1, $2)
       ON CONFLICT (guild_id) 
       DO UPDATE SET volume = EXCLUDED.volume`,
      [interaction.guildId, volume]
    );

    log(`音量設定保存: ${volume}% (Guild: ${interaction.guildId})`, 'music');

    // 現在再生中の場合は即座に音量を変更
    const queue = musicPlayer.getQueue(interaction.guildId);
    if (queue.player) {
      await queue.player.setGlobalVolume(volume);
      log(`現在の再生音量を変更: ${volume}%`, 'music');
    }

    await interaction.editReply(`✅ 音量を ${volume}% に設定・保存しました`);

  } catch (error) {
    log(`音量設定エラー: ${error.message}`, 'error');
    log(`エラースタック: ${error.stack}`, 'error');
    await interaction.editReply('❌ 音量設定中にエラーが発生しました');
  }
}
