import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { log } from '../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('role')
  .setDescription('ユーザーにロールを付与します')
  .addRoleOption(option =>
    option.setName('role')
      .setDescription('付与するロール')
      .setRequired(true)
  )
  .addUserOption(option =>
    option.setName('user')
      .setDescription('ロールを付与するユーザー（省略時は自分）')
      .setRequired(false)
  );

export async function execute(interaction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const role = interaction.options.getRole('role');
  const targetUser = interaction.options.getUser('user');
  const member = targetUser
    ? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
    : interaction.member;

  if (!member) {
    return interaction.editReply('❌ 指定されたユーザーが見つかりません');
  }

  // Botのロールより上位のロールは付与できない
  const botMember = interaction.guild.members.me;
  if (role.position >= botMember.roles.highest.position) {
    return interaction.editReply('❌ Botの最上位ロールより上位のロールは付与できません');
  }

  // 管理対象外のロール（@everyone等）チェック
  if (role.managed) {
    return interaction.editReply('❌ このロールは管理対象外のため付与できません');
  }

  try {
    if (member.roles.cache.has(role.id)) {
      // 既に持っている場合は削除
      await member.roles.remove(role);
      log(`${member.user.tag} から ${role.name} を削除しました`, 'success');
      await interaction.editReply(`✅ ${member.user.tag} から **${role.name}** を削除しました`);
    } else {
      // 持っていない場合は付与
      await member.roles.add(role);
      log(`${member.user.tag} に ${role.name} を付与しました`, 'success');
      await interaction.editReply(`✅ ${member.user.tag} に **${role.name}** を付与しました`);
    }
  } catch (error) {
    log(`ロール付与エラー: ${error.message}`, 'error');
    await interaction.editReply('❌ ロールの操作中にエラーが発生しました');
  }
}
