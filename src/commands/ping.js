import { SlashCommandBuilder } from 'discord.js';
import { resolveUserLanguage, translate } from '../utils/i18n.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check bot latency');

export async function execute(interaction) {
  await interaction.deferReply();
  const sentAt = Date.now();
  const wsPing = Math.round(interaction.client.ws.ping);
  const lang = await resolveUserLanguage(interaction.user.id);

  await interaction.editReply(translate(lang, 'ping.pong', {
    latency: Math.max(0, sentAt - interaction.createdTimestamp),
    ws: Number.isFinite(wsPing) ? wsPing : 'N/A'
  }));
}
