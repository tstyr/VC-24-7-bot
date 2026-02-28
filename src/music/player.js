import { Shoukaku, Connectors } from 'shoukaku';
import { pool } from '../database/db.js';
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
        controlMessage: null,
        progressInterval: null,
        skipRequested: false
      });
    }
    return this.queues.get(guildId);
  }

  async applySavedVolume(player, guildId) {
    try {
      const res = await pool.query('SELECT volume FROM guild_settings WHERE guild_id = $1', [guildId]);
      const vol = res.rows.length > 0 ? res.rows[0].volume : 100;
      await player.setGlobalVolume(vol);
      log(`音量適用: ${vol}% (Guild: ${guildId})`, 'music');
    } catch (error) {
      log(`音量適用エラー: ${error.message}`, 'error');
    }
  }

  startProgressBar(guildId) {
    const queue = this.getQueue(guildId);
    
    // 既存のインターバルをクリア
    this.stopProgressBar(guildId);
    
    // 5秒おきにプログレスバーを更新（API制限回避）
    queue.progressInterval = setInterval(async () => {
      try {
        if (queue.player && queue.current && queue.controlMessage) {
          const { createMusicPanel } = await import('./panel.js');
          const panel = createMusicPanel(queue.current, queue, queue.player);
          await queue.controlMessage.edit(panel);
        }
      } catch (error) {
        log(`プログレスバー更新エラー: ${error.message}`, 'error');
        this.stopProgressBar(guildId);
      }
    }, 5000);
    
    log(`プログレスバー開始: Guild ${guildId}`, 'music');
  }

  stopProgressBar(guildId) {
    const queue = this.getQueue(guildId);
    
    if (queue.progressInterval) {
      clearInterval(queue.progressInterval);
      queue.progressInterval = null;
      log(`プログレスバー停止: Guild ${guildId}`, 'music');
    }
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
      log('キューが空です - 常時接続を維持', 'music');
      
      // プログレスバーを停止
      this.stopProgressBar(guildId);
      
      // リモコンパネルを削除
      if (queue.controlMessage) {
        queue.controlMessage.delete().catch(() => {});
        queue.controlMessage = null;
      }
      
      // 常時接続を維持するため、プレイヤーは切断しない
      queue.current = null;
      return;
    }

    try {
      if (!queue.player) {
        log(`プレイヤー作成開始: guildId=${guildId}, channelId=${voiceChannelId}`, 'music');

        // Shoukaku v4: shoukaku インスタンスから joinVoiceChannel を呼び出す
        queue.player = await this.shoukaku.joinVoiceChannel({
          guildId: guildId,
          channelId: voiceChannelId,
          shardId: 0,
          deaf: true,
        });

        log('Shoukaku プレイヤー作成成功', 'music');

        // 接続が安定するまで待機（500ms）
        await new Promise(resolve => setTimeout(resolve, 500));
        log('接続安定化待機完了', 'music');

        // 保存された音量を適用
        await this.applySavedVolume(queue.player, guildId);
      }

      // イベントリスナーの重複登録を防止
      if (queue.player.listeners('end').length === 0) {
        queue.player.on('end', async (data) => {
          // REPLACED イベントは無視（次の曲が既にキューに入っている場合）
          if (data.reason === 'REPLACED') return;
          
          log(`曲終了: reason=${data.reason}, skipRequested=${queue.skipRequested}`, 'music');
          
          // プログレスバーを停止
          this.stopProgressBar(guildId);
          
          // 古いパネルを削除
          if (queue.controlMessage) {
            await queue.controlMessage.delete().catch(() => {});
            queue.controlMessage = null;
          }
          
          // スキップが要求されていない場合のみリピート処理
          if (queue.repeat && queue.current && !queue.skipRequested) {
            queue.tracks.unshift(queue.current);
          }
          
          // スキップフラグをリセット
          queue.skipRequested = false;
          queue.current = null;
          
          // 次の曲を再生
          if (queue.tracks.length > 0) {
            await this.play(guildId, queue.player.connection.channelId);
          }
        });

        queue.player.on('exception', async (error) => {
          log(`再生エラー: ${error.exception?.message}`, 'error');
          
          // プログレスバーを停止
          this.stopProgressBar(guildId);
          
          // 古いパネルを削除
          if (queue.controlMessage) {
            await queue.controlMessage.delete().catch(() => {});
            queue.controlMessage = null;
          }
          
          queue.current = null;
          
          // 次の曲を再生
          if (queue.tracks.length > 0) {
            await this.play(guildId, queue.player.connection.channelId);
          }
        });
      }

      queue.current = queue.tracks.shift();
      
      // Lavalink v4 形式: encoded フィールドを確実に取得
      const encodedTrack = queue.current.encoded || queue.current.track;
      
      if (!encodedTrack) {
        throw new Error('トラックデータが見つかりません');
      }
      
      log(`再生開始試行: ${queue.current.info?.title || 'Unknown'}`, 'music');
      log(`トラックデータ長: ${encodedTrack.length}文字`, 'music');
      
      // Shoukaku v4 + Lavalink v4: 厳密なJSON構造で渡す
      await queue.player.playTrack({ 
        track: { 
          encoded: encodedTrack 
        } 
      });
      
      log(`再生開始成功: ${queue.current.info?.title || 'Unknown'}`, 'music');
      
      // プログレスバーを開始
      this.startProgressBar(guildId);

      // v2パネルを送信
      if (queue.textChannel) {
        // 古いパネルを削除
        if (queue.controlMessage) {
          await queue.controlMessage.delete().catch(() => {});
        }
        // 新しいv2パネルを送信
        const { createMusicPanel } = await import('./panel.js');
        queue.controlMessage = await queue.textChannel.send(createMusicPanel(queue.current, queue));
      }

    } catch (error) {
      log(`再生エラー: ${error.message}`, 'error');
      log(`エラースタック: ${error.stack}`, 'error');
      
      // RestError の詳細をログ
      if (error.body) {
        log(`RestError body: ${JSON.stringify(error.body)}`, 'error');
      }
      
      // プログレスバーを停止
      this.stopProgressBar(guildId);
      
      throw error;
    }
  }

  async skip(guildId) {
    const queue = this.getQueue(guildId);
    if (queue.player) {
      // プログレスバーを停止
      this.stopProgressBar(guildId);
      
      // スキップフラグを立てる（リピートを一時的に無効化）
      queue.skipRequested = true;
      
      queue.player.stopTrack();
      log('スキップ実行 - end イベントが発火してキュー進行', 'music');
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
      await queue.player.disconnect();
      queue.player = null;
    }
    this.queues.delete(guildId);
  }
}
