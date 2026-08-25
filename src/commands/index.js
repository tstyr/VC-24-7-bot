import { Collection } from 'discord.js';
import * as authCommand from './auth.js';
import * as authAdminCommand from './auth-admin.js';
import * as authPanelCommand from './auth-panel.js';
import * as cloneCategoryCommand from './clone-category.js';
import * as connectCommand from './connect.js';
import * as disconnectCommand from './disconnect.js';
import * as languageCommand from './language.js';
import * as notifyCommand from './notify.js';
import * as notifyRoleSetupCommand from './notify-role-setup.js';
import * as osuCommand from './osu.js';
import * as osuAdminCommand from './osu-admin.js';
import * as osuRecruitAdminCommand from './osu-recruit-admin.js';
import * as osuRoleSetupCommand from './osu-role-setup.js';
import * as pingCommand from './ping.js';
import * as playCommand from './play.js';
import * as rolePanelCommand from './role-panel.js';
import * as timezoneCommand from './timezone.js';
import * as videoDownloadCommand from './video-download.js';
import * as volumeCommand from './volume.js';
import * as youtubeConfigCommand from './youtube-config.js';

const commands = [
  osuCommand,
  osuAdminCommand,
  osuRecruitAdminCommand,
  osuRoleSetupCommand,
  authCommand,
  authAdminCommand,
  authPanelCommand,
  notifyCommand,
  notifyRoleSetupCommand,
  rolePanelCommand,
  languageCommand,
  pingCommand,
  playCommand,
  connectCommand,
  disconnectCommand,
  volumeCommand,
  timezoneCommand,
  youtubeConfigCommand,
  videoDownloadCommand,
  cloneCategoryCommand
];

export function createCommandCollection() {
  const collection = new Collection();
  const includeLegacyOsuCommands = process.env.ENABLE_LEGACY_OSU_COMMANDS === 'true';
  const registeredCommands = includeLegacyOsuCommands
    ? [...commands, ...osuCommand.legacyOsuCommands]
    : commands;

  for (const command of registeredCommands) {
    const name = command.data?.name;
    if (!name) {
      throw new Error('Command is missing data.name');
    }
    if (collection.has(name)) {
      throw new Error(`Duplicate command name: ${name}`);
    }
    collection.set(name, command);
  }

  return collection;
}
