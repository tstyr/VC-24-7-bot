import {
  ApplicationCommandOptionType,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder
} from 'discord.js';
import * as analysisCommand from './osu-analysis.js';
import * as dashboardCommand from './osu-dashboard.js';
import * as dmCommand from './osu-dm.js';
import * as goalCommand from './osu-goal.js';
import * as graphCommand from './osu-graph.js';
import * as growthCommand from './osu-growth.js';
import * as heatmapCommand from './osu-heatmap.js';
import * as leagueCommand from './osu-league.js';
import * as linkCommand from './osu-link.js';
import * as profileCommand from './osu-profile.js';
import * as rankingCommand from './osu-ranking.js';
import * as recentCommand from './osu-recent.js';
import * as recruitCommand from './osu-recruit.js';
import * as serverRankingCommand from './osu-server-ranking.js';
import * as topplaysCommand from './osu-topplays.js';

const SUBCOMMANDS = new Map([
  ['link', linkCommand],
  ['profile', profileCommand],
  ['recent', recentCommand],
  ['growth', growthCommand],
  ['ranking', rankingCommand],
  ['server-ranking', serverRankingCommand],
  ['graph', graphCommand],
  ['analysis', analysisCommand],
  ['dashboard', dashboardCommand],
  ['heatmap', heatmapCommand],
  ['topplays', topplaysCommand],
  ['league', leagueCommand],
  ['dm', dmCommand],
  ['recruit', recruitCommand]
]);

export const legacyOsuCommands = [
  ...SUBCOMMANDS.values(),
  goalCommand
];

const OPTION_ADDERS = new Map([
  [ApplicationCommandOptionType.String, 'addStringOption'],
  [ApplicationCommandOptionType.Integer, 'addIntegerOption'],
  [ApplicationCommandOptionType.Boolean, 'addBooleanOption'],
  [ApplicationCommandOptionType.User, 'addUserOption'],
  [ApplicationCommandOptionType.Channel, 'addChannelOption'],
  [ApplicationCommandOptionType.Role, 'addRoleOption'],
  [ApplicationCommandOptionType.Mentionable, 'addMentionableOption'],
  [ApplicationCommandOptionType.Number, 'addNumberOption'],
  [ApplicationCommandOptionType.Attachment, 'addAttachmentOption']
]);

function copyOption(subcommand, source) {
  const method = OPTION_ADDERS.get(source.type);
  if (!method) {
    throw new Error(`Unsupported Discord option type: ${source.type}`);
  }

  subcommand[method](option => {
    option
      .setName(source.name)
      .setDescription(source.description)
      .setRequired(Boolean(source.required));

    if (source.name_localizations) {
      option.setNameLocalizations(source.name_localizations);
    }
    if (source.description_localizations) {
      option.setDescriptionLocalizations(source.description_localizations);
    }
    if (Array.isArray(source.choices) && source.choices.length > 0) {
      option.addChoices(...source.choices);
    }
    if (source.autocomplete !== undefined && typeof option.setAutocomplete === 'function') {
      option.setAutocomplete(Boolean(source.autocomplete));
    }
    if (source.min_value !== undefined && typeof option.setMinValue === 'function') {
      option.setMinValue(source.min_value);
    }
    if (source.max_value !== undefined && typeof option.setMaxValue === 'function') {
      option.setMaxValue(source.max_value);
    }
    if (source.min_length !== undefined && typeof option.setMinLength === 'function') {
      option.setMinLength(source.min_length);
    }
    if (source.max_length !== undefined && typeof option.setMaxLength === 'function') {
      option.setMaxLength(source.max_length);
    }
    if (Array.isArray(source.channel_types) && typeof option.addChannelTypes === 'function') {
      option.addChannelTypes(...source.channel_types);
    }

    return option;
  });
}

function createSubcommand(source, name = source.name) {
  const subcommand = new SlashCommandSubcommandBuilder()
    .setName(name)
    .setDescription(source.description);

  if (source.name_localizations) {
    subcommand.setNameLocalizations(source.name_localizations);
  }
  if (source.description_localizations) {
    subcommand.setDescriptionLocalizations(source.description_localizations);
  }

  for (const option of source.options || []) {
    copyOption(subcommand, option);
  }

  return subcommand;
}

function createGoalGroup() {
  const source = goalCommand.data.toJSON();
  const group = new SlashCommandSubcommandGroupBuilder()
    .setName('goal')
    .setDescription(source.description);

  for (const subcommand of source.options || []) {
    if (subcommand.type !== ApplicationCommandOptionType.Subcommand) {
      throw new Error(`Unexpected /osu-goal option type: ${subcommand.type}`);
    }
    group.addSubcommand(createSubcommand(subcommand));
  }

  return group;
}

const builder = new SlashCommandBuilder()
  .setName('osu')
  .setDescription('osu!の連携・成績・分析・目標をまとめて操作します');

for (const [name, command] of SUBCOMMANDS) {
  builder.addSubcommand(createSubcommand(command.data.toJSON(), name));
}

builder.addSubcommandGroup(createGoalGroup());

export const data = builder;

export async function execute(interaction, musicPlayer) {
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const command = group === 'goal' ? goalCommand : SUBCOMMANDS.get(subcommand);

  if (!command) {
    throw new Error(`Unknown /osu subcommand: ${group ? `${group} ` : ''}${subcommand}`);
  }

  return command.execute(interaction, musicPlayer);
}
