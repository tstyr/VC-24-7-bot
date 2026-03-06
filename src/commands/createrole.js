import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { log } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('createrole')
  .setDescription('新しいロールを作成します')
  .addStringOption(option =>
    option.setName('name')
      .setDescription('ロール名')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('color')
      .setDescription('ロールの色（例: #FF0000, Red, Blue）')
      .setRequired(true)
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const name = interaction.options.getString('name');
  const colorInput = interaction.options.getString('color');

  // 色の解決
  let color;
  try {
    // HEXカラーコードの場合
    if (/^#?[0-9A-Fa-f]{6}$/.test(colorInput)) {
      color = colorInput.startsWith('#') ? colorInput : `#${colorInput}`;
    } else {
      // 名前付きカラーのマッピング
      const colorMap = {
        'red': '#FF0000',
        'blue': '#0000FF',
        'green': '#00FF00',
        'yellow': '#FFFF00',
        'purple': '#800080',
        'orange': '#FFA500',
        'pink': '#FFC0CB',
        'white': '#FFFFFF',
        'black': '#000000',
        'cyan': '#00FFFF',
        'magenta': '#FF00FF',
        'gold': '#FFD700',
        'silver': '#C0C0C0',
        'navy': '#000080',
        'lime': '#00FF00',
        'aqua': '#00FFFF',
        'teal': '#008080',
        'maroon': '#800000',
        'olive': '#808000',
        'coral': '#FF7F50',
      };
      
      const resolved = colorMap[colorInput.toLowerCase()];
      if (resolved) {
        color = resolved;
      } else {
        return interaction.editReply('❌ 無効な色です。HEXコード（例: #FF0000）または色名（例: Red, Blue）を指定してください');
      }
    }
  } catch {
    return interaction.editReply('❌ 色の解析に失敗しました');
  }

  try {
    const role = await interaction.guild.roles.create({
      name: name,
      color: color,
      permissions: [],  // 普通のメンバーロール（追加権限なし）
      reason: `${interaction.user.tag} がコマンドで作成`,
    });

    log(`ロール "${role.name}" (${color}) を作成しました`, 'success');
    await interaction.editReply(`✅ ロール **${role.name}** を作成しました（色: ${color}）`);
  } catch (error) {
    log(`ロール作成エラー: ${error.message}`, 'error');
    await interaction.editReply('❌ ロールの作成中にエラーが発生しました');
  }
}
