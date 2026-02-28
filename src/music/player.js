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
        voiceConnection: null,
        textChannel: null,
        controlMessage: null
      });
    }
    return this.queues.get(guildId);
  }

  async search(query) {
    const startTime = Date.now();
    
    try {
      const node = this.shoukaku.nodes.get('main');
      if (!node) {
        log('Lavalinkノードが利用できません', 'error');
        return { success: false, tracks: [], error: 'Lavalinkノードが利用できません' };
      }

      // URLの場合はそのまま、それ以外はYouTube検索
      let searchQuery;
      if (query.startsWith('http://') || query.startsWith('https://')) {
        searchQuery = query;
      } else {
        searchQuery = `ytsearch:${query}`;
      }

      log(`Lavalink検索実行: ${searchQuery}`, 'music');
      
      // タイムアウト付きで検索実行（25秒）
      const searchPromise = node.rest.resolve(searchQuery);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Lavalink検索がタイムアウトしました')), 25000)
      );
      
      const result = await Promise.race([searchPromise, timeoutPromise]);
      
      const elapsed = Date.now() - startTime;
      log(`検索完了: ${elapsed}ms`, 'music');

      // Lavalink v4 のレスポンス形式に対応
      let tracks = [];
      
      if (!result) {
        log('検索結果がnullです', 'error');
        return { success: false, tracks: [], error: '検索結果が取得できませんでした' };
      }

      log(`検索結果の型: ${typeof result}, loadType: ${result.loadType}`, 'music');

      // Lavalink v4 では loadType と data を持つ
      if (result.loadType === 'search' || result.loadType === 'track' || result.loadType === 'playlist') {
        if (result.data) {
          if (Array.isArray(result.data)) {
            tracks = result.data;
          } else if (result.data.tracks && Array.isArray(result.data.tracks)) {
            tracks = result.data.tracks;
          } else if (result.data.encoded) {
            // 単一トラック
            tracks = [result.data];
          }
        }
      } else if (result.loadType === 'empty' || result.loadType === 'error') {
        log(`検索失敗: ${result.loadType}`, 'error');
        return { success: false, tracks: [], error: '検索結果が見つかりませんでした' };
      } else if (Array.isArray(result.tracks)) {
        // 旧形式（Lavalink v3）
        tracks = result.tracks;
      } else if (Array.isArray(result)) {
        tracks = result;
      }

      if (tracks.length === 0) {
        log('検索結果が0件です', 'music');
        return { success: false, tracks: [], error: '検索結果が見つかりませんでした' };
      }

      log(`検索成功: ${tracks.length}件`, 'music');
      return { 
        success: true, 
        tracks: tracks.slice(0, 15)
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      log(`検索エラー (${elapsed}ms): ${error.message}`, 'error');
      log(`エラースタック: ${error.stack}`, 'error');
      
      // タイムアウトエラーの場合は明確に通知
      if (error.message.includes('タイムアウト')) {
        return { success: false, tracks: [], error: 'Lavalinkサーバーの応答が遅れています。しばらく待ってから再試行してください。' };
      }
      
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
        const node = this.shoukaku.nodes.get('main');
        if (!node) {
          throw new Error('Lavalinkノードが利用できません');
        }

        // Shoukaku v4 では joinVoiceChannel で接続してから player を取得
        // すでに @discordjs/voice で接続済みの場合は player のみ作成
        const existingPlayer = node.players.get(guildId);
        if (existingPlayer) {
          queue.player = existingPlayer;
        } else {
          // 新しいプレイヤーを作成（接続は @discordjs/voice が管理）
          queue.player = await node.joinChannel({
            guildId,
            channelId: voiceChannelId,
            shardId: 0,
          });
        }

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
      
      // Lavalink v4 形式に対応
      const trackData = queue.current.encoded || queue.current.track;
      await queue.player.playTrack({ track: trackData });
      
      log(`再生開始: ${queue.current.info.title}`, 'music');

    } catch (error) {
      log(`再生エラー: ${error.message}`, 'error');
      throw error;
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
    if (queue.voiceConnection) {
      queue.voiceConnection.destroy();
    }
    if (queue.player) {
      queue.player = null;
    }
    this.queues.delete(guildId);
  }
}
