import { Shoukaku, Connectors } from 'shoukaku';
import { log } from '../utils/logger.js';

export class MusicPlayer {
  constructor(client) {
    this.client = client;
    this.queues = new Map();
    
    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(client),
      [{
        name: 'main',
        url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
        auth: process.env.LAVALINK_PASSWORD,
        secure: process.env.LAVALINK_SECURE === 'true'
      }],
      {
        moveOnDisconnect: false,
        resumable: false,
        reconnectTries: 5,
        reconnectInterval: 5000
      }
    );

    this.setupEvents();
  }

  setupEvents() {
    this.shoukaku.on('ready', (name) => {
      log(`Lavalink ${name} 接続成功`, 'success');
    });

    this.shoukaku.on('error', (name, error) => {
      log(`Lavalink ${name} エラー: ${error.message}`, 'error');
    });

    this.shoukaku.on('disconnect', (name, reason) => {
      log(`Lavalink ${name} 切断: ${reason}`, 'error');
    });
  }

  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        tracks: [],
        current: null,
        repeat: false,
        player: null,
        textChannel: null,
        controlMessage: null
      });
    }
    return this.queues.get(guildId);
  }

  async search(query) {
    try {
      const node = this.shoukaku.getNode();
      if (!node) throw new Error('Lavalinkノードが利用できません');

      // URLの場合はそのまま、それ以外はYouTube検索
      let searchQuery;
      if (query.startsWith('http://') || query.startsWith('https://')) {
        searchQuery = query;
      } else {
        searchQuery = `ytsearch:${query}`;
      }

      const result = await node.rest.resolve(searchQuery);

      // 結果の検証
      if (!result) {
        log('検索結果がnullです', 'error');
        return { success: false, tracks: [] };
      }

      if (!result.tracks) {
        log('result.tracksが存在しません', 'error');
        return { success: false, tracks: [] };
      }

      if (result.tracks.length === 0) {
        log('検索結果が0件です', 'music');
        return { success: false, tracks: [] };
      }

      log(`検索成功: ${result.tracks.length}件`, 'music');
      return { 
        success: true, 
        tracks: result.tracks.slice(0, 15)
      };
    } catch (error) {
      log(`検索エラー: ${error.message}`, 'error');
      return { success: false, tracks: [], error: error.message };
    }
  }

  async play(guildId, voiceChannelId) {
    const queue = this.getQueue(guildId);
    
    if (queue.tracks.length === 0) {
      log('キューが空です', 'music');
      return;
    }

    try {
      if (!queue.player) {
        const node = this.shoukaku.getNode();
        queue.player = await node.joinChannel({
          guildId,
          channelId: voiceChannelId,
          shardId: 0
        });

        queue.player.on('end', () => {
          if (queue.repeat && queue.current) {
            queue.tracks.unshift(queue.current);
          }
          queue.current = null;
          this.play(guildId, voiceChannelId);
        });

        queue.player.on('exception', (error) => {
          log(`再生エラー: ${error.exception?.message}`, 'error');
          queue.current = null;
          this.play(guildId, voiceChannelId);
        });
      }

      queue.current = queue.tracks.shift();
      await queue.player.playTrack({ track: { encoded: queue.current.encoded } });
      log(`再生開始: ${queue.current.info.title}`, 'music');

    } catch (error) {
      log(`再生エラー: ${error.message}`, 'error');
    }
  }

  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      queue.player.stopTrack();
      return true;
    }
    return false;
  }

  async pause(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      await queue.player.setPaused(true);
      return true;
    }
    return false;
  }

  async resume(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      await queue.player.setPaused(false);
      return true;
    }
    return false;
  }

  toggleRepeat(guildId) {
    const queue = this.getQueue(guildId);
    queue.repeat = !queue.repeat;
    return queue.repeat;
  }

  async disconnect(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      await queue.player.connection.disconnect();
      this.queues.delete(guildId);
    }
  }
}
