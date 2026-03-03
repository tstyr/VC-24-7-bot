import { Server } from 'http';
import { Shoukaku, Connectors } from 'shoukaku';
import {
  joinVoiceChannel as djsJoinVC,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
  StreamType
} from '@discordjs/voice';
import ytdlExecute from 'yt-dlp-exec';
import { pool } from '../database/db.js';
import { log } from '../utils/logger.js';

export class MusicPlayer {
  constructor(client) {
    this.client = client;
    this.queues = new Map();
    this.connections = new Map(); // guildId -> VoiceConnection

    // Lavalink は検索専用
    const nodes = [
      {
        name: 'main',
        url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
        auth: process.env.LAVALINK_PASSWORD,
        secure: process.env.LAVALINK_SECURE === 'true'
      },
      {
        name: 'lavahatry4',
        url: 'lavahatry4.techbyte.host:3000',
        auth: 'naig.is-a.dev',
        secure: false
      },
      {
        name: 'embotic',
        url: '46.202.82.147:1026',
        auth: 'jmlitev4',
        secure: false
      },
      {
        name: 'aiko',
        url: 'lavalink.aiko-project.xyz:2333',
        auth: 'Rikka',
        secure: false
      },
      {
        name: 'jirayu-nonssl',
        url: 'lavalink.jirayu.net:13592',
        auth: 'youshallnotpass',
        secure: false
      }
    ];

    log(`Lavalinkノード構成 (検索用): ${nodes.map(n => n.name).join(', ')}`, 'music');

    this.readyNodes = new Set();

    this.shoukaku = new Shoukaku(
      new Connectors.DiscordJS(client),
      nodes,
      {
        moveOnDisconnect: false,
        resumable: false,
        reconnectTries: 3,
        reconnectInterval: 5000,
        nodeResolver: (nodes) => {
          return [...nodes.values()].find(n => this.readyNodes.has(n.name)) || null;
        }
      }
    );

    this.setupLavalinkEvents();
  }

  setupLavalinkEvents() {
    this.shoukaku.on('ready', (name, reconnected) => {
      this.readyNodes.add(name);
      log(`Lavalink ${name} 接続成功 (検索用, 利用可能: [${[...this.readyNodes].join(', ')}])`, 'success');
    });

    this.shoukaku.on('error', (name, error) => {
      log(`Lavalink ${name} エラー: ${error.message}`, 'error');
    });

    this.shoukaku.on('disconnect', (name) => {
      this.readyNodes.delete(name);
      log(`Lavalink ${name} 切断 (残り: [${[...this.readyNodes].join(', ')}])`, 'error');
    });

    this.shoukaku.on('reconnecting', (name) => {
      this.readyNodes.delete(name);
      log(`Lavalink ${name} 再接続中...`, 'error');
    });

    this.shoukaku.on('close', (name, code, reason) => {
      this.readyNodes.delete(name);
      log(`Lavalink ${name} クローズ: code=${code}`, 'error');
    });
  }

  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, {
        tracks: [],
        current: null,
        repeat: false,
        audioPlayer: null,
        resource: null,
        textChannel: null,
        controlMessage: null,
        progressInterval: null,
        skipRequested: false,
        voiceChannelId: null,
        volume: 100,
      });
    }
    return this.queues.get(guildId);
  }

  /**
   * @discordjs/voice でVCに接続
   */
  joinVC(guildId, channelId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        log(`joinVC: ギルドが見つかりません: ${guildId}`, 'error');
        return null;
      }

      // 既存コネクションを破棄
      const existing = this.connections.get(guildId);
      if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
        try { existing.destroy(); } catch (e) { /* ignore */ }
      }

      const connection = djsJoinVC({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      this.connections.set(guildId, connection);

      // 切断時の自動復帰
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        log('VoiceConnection Disconnected検知', 'voice');
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
          log('VoiceConnection 再接続成功', 'voice');
        } catch {
          log('VoiceConnection 再接続失敗 → コネクション破棄', 'error');
          connection.destroy();
          this.connections.delete(guildId);
        }
      });

      connection.on(VoiceConnectionStatus.Destroyed, () => {
        this.connections.delete(guildId);
      });

      log(`VC接続: guild=${guildId}, channel=${channelId}`, 'voice');
      return connection;
    } catch (error) {
      log(`joinVC エラー: ${error.message}`, 'error');
      return null;
    }
  }

  async applySavedVolume(guildId) {
    try {
      const res = await pool.query('SELECT volume FROM guild_settings WHERE guild_id = $1', [guildId]);
      const vol = res.rows.length > 0 ? res.rows[0].volume : 100;
      const queue = this.getQueue(guildId);
      queue.volume = vol;
      if (queue.resource?.volume) {
        queue.resource.volume.setVolume(vol / 100);
      }
      log(`音量適用: ${vol}% (Guild: ${guildId})`, 'music');
    } catch (error) {
      log(`音量適用エラー: ${error.message}`, 'error');
    }
  }

  startProgressBar(guildId) {
    const queue = this.getQueue(guildId);
    this.stopProgressBar(guildId);

    queue.progressInterval = setInterval(async () => {
      try {
        if (queue.audioPlayer && queue.current && queue.controlMessage) {
          const { createMusicPanel } = await import('./panel.js');
          const panel = createMusicPanel(queue.current, queue);
          await queue.controlMessage.edit(panel).catch(err => {
            if (err.code !== 10008) throw err;
          });
        } else {
          this.stopProgressBar(guildId);
        }
      } catch (error) {
        log(`プログレスバー更新エラー: ${error.message}`, 'error');
        this.stopProgressBar(guildId);
      }
    }, 10000);
  }

  stopProgressBar(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.progressInterval) {
      clearInterval(queue.progressInterval);
      queue.progressInterval = null;
    }
  }

  async search(query) {
    const startTime = Date.now();

    try {
      const node = [...this.shoukaku.nodes.values()].find(n => this.readyNodes.has(n.name));
      if (!node) {
        log(`利用可能なLavalinkノードがありません`, 'error');
        return { success: false, tracks: [], error: 'Lavalinkノードが利用できません' };
      }
      log(`検索ノード: ${node.name}`, 'music');

      let searchQuery;
      if (query.startsWith('http://') || query.startsWith('https://')) {
        searchQuery = query;
      } else {
        searchQuery = `ytsearch:${query}`;
      }

      log(`Lavalink検索実行: ${searchQuery}`, 'music');

      const searchPromise = node.rest.resolve(searchQuery);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Lavalink検索がタイムアウトしました')), 25000)
      );

      const result = await Promise.race([searchPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;
      log(`検索完了: ${elapsed}ms`, 'music');

      if (!result) {
        return { success: false, tracks: [], error: '検索結果が取得できませんでした' };
      }

      log(`検索結果: loadType=${result.loadType}`, 'music');

      let tracks = [];
      if (result.loadType === 'search' || result.loadType === 'track' || result.loadType === 'playlist') {
        if (result.data) {
          if (Array.isArray(result.data)) {
            tracks = result.data;
          } else if (result.data.tracks && Array.isArray(result.data.tracks)) {
            tracks = result.data.tracks;
          } else if (result.data.encoded) {
            tracks = [result.data];
          }
        }
      } else if (result.loadType === 'empty' || result.loadType === 'error') {
        return { success: false, tracks: [], error: '検索結果が見つかりませんでした' };
      } else if (Array.isArray(result.tracks)) {
        tracks = result.tracks;
      } else if (Array.isArray(result)) {
        tracks = result;
      }

      if (tracks.length === 0) {
        return { success: false, tracks: [], error: '検索結果が見つかりませんでした' };
      }

      log(`検索成功: ${tracks.length}件`, 'music');
      return { success: true, tracks: tracks.slice(0, 15) };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      log(`検索エラー (${elapsed}ms): ${error.message}`, 'error');

      if (error.message.includes('タイムアウト')) {
        return { success: false, tracks: [], error: 'Lavalinkサーバーの応答が遅れています。' };
      }
      return { success: false, tracks: [], error: error.message };
    }
  }

  async play(guildId, voiceChannelId, _retryCount = 0) {
    const MAX_RETRIES = 2;
    const queue = this.getQueue(guildId);

    if (voiceChannelId) queue.voiceChannelId = voiceChannelId;

    if (queue.tracks.length === 0) {
      log('キューが空です - VC接続を維持', 'music');
      this.stopProgressBar(guildId);
      if (queue.controlMessage) {
        queue.controlMessage.delete().catch(() => {});
        queue.controlMessage = null;
      }
      if (queue.audioPlayer) {
        queue.audioPlayer.stop();
      }
      queue.current = null;
      queue.resource = null;
      return;
    }

    try {
      // VC接続を確保
      let connection = this.connections.get(guildId);
      if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
        log(`VC接続開始: guild=${guildId}, channel=${queue.voiceChannelId}`, 'music');
        connection = this.joinVC(guildId, queue.voiceChannelId);
        if (!connection) throw new Error('VC接続に失敗しました');
        await entersState(connection, VoiceConnectionStatus.Ready, 15000);
        log('VC接続完了 (Ready)', 'music');
      }

      // AudioPlayer作成（初回のみ）
      if (!queue.audioPlayer) {
        queue.audioPlayer = createAudioPlayer({
          behaviors: { noSubscriber: NoSubscriberBehavior.Play }
        });
        connection.subscribe(queue.audioPlayer);

        queue.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
          log(`曲終了, skipRequested=${queue.skipRequested}`, 'music');
          this.stopProgressBar(guildId);

          if (queue.controlMessage) {
            await queue.controlMessage.delete().catch(() => {});
            queue.controlMessage = null;
          }

          if (queue.repeat && queue.current && !queue.skipRequested) {
            queue.tracks.unshift(queue.current);
          }

          queue.skipRequested = false;
          queue.current = null;
          queue.resource = null;

          if (queue.tracks.length > 0) {
            log(`次の曲を再生: キュー残り${queue.tracks.length}曲`, 'music');
            await this.play(guildId, queue.voiceChannelId);
          } else {
            log('キューが空になりました - VC接続は維持', 'music');
          }
        });

        queue.audioPlayer.on('error', async (error) => {
          log(`AudioPlayer エラー: ${error.message}`, 'error');
          this.stopProgressBar(guildId);

          if (queue.controlMessage) {
            await queue.controlMessage.delete().catch(() => {});
            queue.controlMessage = null;
          }

          queue.current = null;
          queue.resource = null;

          if (queue.tracks.length > 0) {
            log('エラー後に次の曲を再生', 'music');
            await this.play(guildId, queue.voiceChannelId);
          }
        });

        queue.audioPlayer.on(AudioPlayerStatus.Playing, () => {
          log(`🎵 再生中: ${queue.current?.info?.title || 'Unknown'}`, 'music');
        });
      } else {
        // 既存AudioPlayerを再サブスクライブ
        connection.subscribe(queue.audioPlayer);
      }

      queue.current = queue.tracks.shift();
      const trackUrl = queue.current.info?.uri;
      if (!trackUrl) throw new Error('トラックURLが見つかりません');

      log(`ストリーム取得: ${queue.current.info?.title} (${trackUrl})`, 'music');

      // yt-dlp-exec を使って直接ストリームを取得（Botチェック回避の最終手段）
      const stream = ytdlExecute.exec(trackUrl, {
        output: '-',
        format: 'bestaudio/best',
        limitRate: '100K',
        rmCacheDir: true,
        verbose: true
      }, { stdio: ['ignore', 'pipe', 'ignore'] }).stdout;

      if (!stream) {
        throw new Error('yt-dlp-execからのストリーム取得に失敗しました');
      }

      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });

      // 音量適用
      resource.volume?.setVolume(queue.volume / 100);
      queue.resource = resource;

      // 再生開始
      queue.audioPlayer.play(resource);
      log(`✅ playTrack成功: ${queue.current.info?.title}`, 'music');

      // プログレスバー開始
      this.startProgressBar(guildId);

      // パネル送信
      if (queue.textChannel) {
        if (queue.controlMessage) {
          await queue.controlMessage.delete().catch(() => {});
        }
        const { createMusicPanel } = await import('./panel.js');
        queue.controlMessage = await queue.textChannel.send(createMusicPanel(queue.current, queue));
      }

    } catch (error) {
      log(`❌ 再生エラー: ${error.message}`, 'error');
      log(`エラースタック: ${error.stack}`, 'error');

      this.stopProgressBar(guildId);

      if (queue.current) {
        queue.tracks.unshift(queue.current);
        queue.current = null;
      }
      queue.resource = null;

      if (_retryCount < MAX_RETRIES) {
        const waitMs = (_retryCount + 1) * 3000;
        log(`${waitMs / 1000}秒後にリトライ (${_retryCount + 1}/${MAX_RETRIES})`, 'music');
        await new Promise(r => setTimeout(r, waitMs));
        return this.play(guildId, voiceChannelId, _retryCount + 1);
      }

      if (queue.textChannel) {
        await queue.textChannel.send('❌ 再生に失敗しました。しばらく待ってから `/play` を再試行してください。').catch(() => {});
      }
    }
  }

  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.audioPlayer) {
      this.stopProgressBar(guildId);
      queue.skipRequested = true;
      queue.audioPlayer.stop();
      return true;
    }
    return false;
  }

  async pause(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.audioPlayer) {
      queue.audioPlayer.pause();
      return true;
    }
    return false;
  }

  async resume(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.audioPlayer) {
      queue.audioPlayer.unpause();
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
    this.stopProgressBar(guildId);

    if (queue.audioPlayer) {
      queue.audioPlayer.stop();
      queue.audioPlayer = null;
    }
    queue.resource = null;

    const connection = this.connections.get(guildId);
    if (connection) {
      connection.destroy();
      this.connections.delete(guildId);
    }

    if (queue.controlMessage) {
      await queue.controlMessage.delete().catch(() => {});
      queue.controlMessage = null;
    }

    this.queues.delete(guildId);
  }
}
