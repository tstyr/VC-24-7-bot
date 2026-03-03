import { Shoukaku, Connectors } from 'shoukaku';
import { pool } from '../database/db.js';
import { log } from '../utils/logger.js';

export class MusicPlayer {
  constructor(client) {
    this.client = client;
    this.queues = new Map();
    
    // 複数のLavalinkノード（フォールバック用 - SSL + Non-SSL）
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

    log(`Lavalinkノード構成: ${nodes.map(n => n.name).join(', ')} (${nodes.length}ノード)`, 'music');

    // readyイベントで手動追跡（Shoukaku内部のstate値が信頼できないため）
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
          // readyNodesセットを使って利用可能ノードを探す
          return [...nodes.values()].find(n => this.readyNodes.has(n.name)) || null;
        }
      }
    );

    this.setupEvents();
  }

  setupEvents() {
    this.shoukaku.on('ready', (name, reconnected) => {
      this.readyNodes.add(name);
      log(`Lavalink ${name} 接続成功 (再接続=${!!reconnected}, 利用可能: [${[...this.readyNodes].join(', ')}] ${this.readyNodes.size}ノード)`, 'success');
    });

    this.shoukaku.on('error', (name, error) => {
      log(`Lavalink ${name} エラー: ${error.message}`, 'error');
      if (error.code) log(`エラーコード: ${error.code}`, 'error');
    });

    this.shoukaku.on('disconnect', (name, reason) => {
      this.readyNodes.delete(name);
      log(`Lavalink ${name} 切断 (理由: ${JSON.stringify(reason)}, 残り: [${[...this.readyNodes].join(', ')}] ${this.readyNodes.size}ノード)`, 'error');
      
      // 利用可能なノードが0の場合のみプレイヤーをクリア
      if (this.readyNodes.size === 0) {
        for (const [guildId, queue] of this.queues) {
          this.stopProgressBar(guildId);
          queue.player = null;
          queue.current = null;
        }
        log('全プレイヤーをクリアしました（利用可能ノード0）', 'error');
      }
    });

    this.shoukaku.on('reconnecting', (name) => {
      this.readyNodes.delete(name);
      log(`Lavalink ${name} 再接続中... (利用可能: [${[...this.readyNodes].join(', ')}])`, 'error');
    });

    this.shoukaku.on('close', (name, code, reason) => {
      this.readyNodes.delete(name);
      log(`Lavalink ${name} クローズ: code=${code}, reason=${reason}`, 'error');
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
        skipRequested: false,
        voiceChannelId: null
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
    
    // 10秒おきにプログレスバーを更新（API制限回避 & パフォーマンス最適化）
    queue.progressInterval = setInterval(async () => {
      try {
        if (queue.player && queue.current && queue.controlMessage) {
          const { createMusicPanel } = await import('./panel.js');
          const panel = createMusicPanel(queue.current, queue, queue.player);
          await queue.controlMessage.edit(panel).catch(err => {
            // メッセージが削除されている場合は無視
            if (err.code !== 10008) {
              throw err;
            }
          });
        } else {
          // 条件が満たされない場合はインターバルを停止
          this.stopProgressBar(guildId);
        }
      } catch (error) {
        log(`プログレスバー更新エラー: ${error.message}`, 'error');
        this.stopProgressBar(guildId);
      }
    }, 10000); // 10秒に変更
    
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
      // 利用可能なノードを探す（readyNodesセットで追跡）
      const node = [...this.shoukaku.nodes.values()].find(n => this.readyNodes.has(n.name));
      if (!node) {
        log(`利用可能なLavalinkノードがありません (readyNodes: [${[...this.readyNodes].join(', ')}])`, 'error');
        // 全ノードのstateをデバッグログ
        for (const [name, n] of this.shoukaku.nodes) {
          log(`  ノード ${name}: state=${n.state}, ws=${n.ws?.readyState}`, 'error');
        }
        return { success: false, tracks: [], error: 'Lavalinkノードが利用できません' };
      }
      log(`検索ノード: ${node.name}`, 'music');

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

  async play(guildId, voiceChannelId, _retryCount = 0) {
    const MAX_RETRIES = 2;
    const queue = this.getQueue(guildId);
    
    // voiceChannelIdを保存
    if (voiceChannelId) {
      queue.voiceChannelId = voiceChannelId;
    }
    
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
      // 既存プレイヤーの接続状態を検証
      if (queue.player) {
        const managedPlayer = this.shoukaku.players.get(guildId);
        log(`プレイヤー状態チェック: managed=${!!managedPlayer}`, 'music');
        
        // Shoukaku管理外の場合は再作成
        if (!managedPlayer) {
          log(`プレイヤー接続が無効です。再接続します`, 'music');
          try { this.shoukaku.leaveVoiceChannel(guildId); } catch (e) { /* ignore */ }
          queue.player = null;
        }
      }

      if (!queue.player) {
        log(`プレイヤー作成開始: guildId=${guildId}, channelId=${queue.voiceChannelId}`, 'music');

        // 既存のセッションを確実にクリーンアップ
        try { this.shoukaku.leaveVoiceChannel(guildId); } catch (e) { /* ignore */ }
        await new Promise(resolve => setTimeout(resolve, 500));

        // Shoukaku v4: shoukaku インスタンスから joinVoiceChannel を呼び出す
        queue.player = await this.shoukaku.joinVoiceChannel({
          guildId: guildId,
          channelId: queue.voiceChannelId,
          shardId: 0,
          deaf: true,
        });

        log('Shoukaku プレイヤー作成成功', 'music');

        // 接続が安定するまで待機
        await new Promise(resolve => setTimeout(resolve, 1000));
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
            log(`次の曲を再生: キュー残り${queue.tracks.length}曲`, 'music');
            await this.play(guildId, queue.voiceChannelId);
          } else {
            log('キューが空になりました - 24時間接続を維持', 'music');
            // Lavalinkプレイヤーをクリーンアップして、raw接続で24時間維持
            try { this.shoukaku.leaveVoiceChannel(guildId); } catch (e) { /* ignore */ }
            queue.player = null;
            const vcChannelId = queue.voiceChannelId || process.env.VC_CHANNEL_ID;
            if (vcChannelId) {
              setTimeout(() => this.joinVCRaw(guildId, vcChannelId), 1000);
            }
          }
        });

        queue.player.on('exception', async (error) => {
          log(`❌ 再生例外発生`, 'error');
          log(`例外メッセージ: ${error.exception?.message}`, 'error');
          log(`例外の深刻度: ${error.exception?.severity}`, 'error');
          log(`例外の原因: ${error.exception?.cause}`, 'error');
          
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
            log(`エラー後に次の曲を再生: キュー残り${queue.tracks.length}曲`, 'music');
            await this.play(guildId, queue.voiceChannelId);
          } else {
            log('エラー後、キューが空になりました', 'music');
          }
        });

        // 診断・接続管理用イベントリスナー
        queue.player.on('start', () => {
          log(`🎵 トラック開始イベント発火: ${queue.current?.info?.title || 'Unknown'}`, 'music');
        });

        queue.player.on('stuck', (data) => {
          log(`⚠️ トラックスタック: threshold=${data.thresholdMs}ms`, 'error');
        });

        queue.player.on('closed', (data) => {
          log(`🔌 Voice接続クローズ: code=${data.code}, reason=${data.reason}, byRemote=${data.byRemote}`, 'error');
          this.stopProgressBar(guildId);
          queue.player = null;
          queue.current = null;
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
      log(`トラック情報: ${JSON.stringify(queue.current.info)}`, 'music');
      
      // Shoukaku v4 の正しい形式で再生
      try {
        await queue.player.playTrack({ 
          track: { 
            encoded: encodedTrack 
          } 
        });
        log(`✅ playTrack 成功: ${queue.current.info?.title || 'Unknown'}`, 'music');
      } catch (playError) {
        log(`❌ playTrack 失敗: ${playError.message}`, 'error');
        if (playError.body) {
          log(`RestError詳細: ${JSON.stringify(playError.body, null, 2)}`, 'error');
        }
        if (playError.status) {
          log(`HTTPステータス: ${playError.status}`, 'error');
        }
        throw playError;
      }
      
      // プログレスバーを開始
      this.startProgressBar(guildId);

      // v2パネルを送信
      if (queue.textChannel) {
        // 古いパネルを削除
        if (queue.controlMessage) {
          await queue.controlMessage.delete().catch(() => {});
        }
        // 新しいv2パネルを送信（playerを渡す）
        const { createMusicPanel } = await import('./panel.js');
        queue.controlMessage = await queue.textChannel.send(createMusicPanel(queue.current, queue, queue.player));
      }

    } catch (error) {
      log(`❌ 再生エラー発生`, 'error');
      log(`エラーメッセージ: ${error.message}`, 'error');
      log(`エラースタック: ${error.stack}`, 'error');
      
      // エラーの全プロパティを出力（RestError bodyなど）
      try {
        log(`エラー全情報: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`, 'error');
      } catch (logErr) { /* circular reference */ }
      
      // プログレスバーを停止
      this.stopProgressBar(guildId);
      
      // joinVoiceChannel / sendServerUpdate の RestError は接続問題
      // → 曲をスキップしても無意味なので、リトライ上限付きで再接続を試みる
      const isConnectionError = error.stack?.includes('sendServerUpdate') || error.stack?.includes('joinVoiceChannel');
      
      if (isConnectionError) {
        log(`接続エラー検出 (リトライ ${_retryCount + 1}/${MAX_RETRIES})`, 'error');
        // 失敗した曲をキューに戻す
        if (queue.current) {
          queue.tracks.unshift(queue.current);
          queue.current = null;
        }
        // プレイヤーをクリア
        try { this.shoukaku.leaveVoiceChannel(guildId); } catch (e) { /* ignore */ }
        queue.player = null;
        
        if (_retryCount < MAX_RETRIES) {
          const waitMs = (_retryCount + 1) * 3000;
          log(`${waitMs / 1000}秒後にリトライします...`, 'music');
          await new Promise(resolve => setTimeout(resolve, waitMs));
          return this.play(guildId, voiceChannelId, _retryCount + 1);
        } else {
          log('接続リトライ上限に達しました。再生を中止します', 'error');
          // 24時間接続は raw opcode で維持
          const vcChannelId = queue.voiceChannelId || process.env.VC_CHANNEL_ID;
          if (vcChannelId) {
            setTimeout(() => this.joinVCRaw(guildId, vcChannelId), 1000);
          }
          // ユーザーに通知
          if (queue.textChannel) {
            await queue.textChannel.send('❌ Lavalinkサーバーへの接続に失敗しました。しばらく待ってから `/play` を再試行してください。').catch(() => {});
          }
          return;
        }
      }
      
      // トラック固有のエラー: 次の曲を試す（リトライ上限あり）
      if (queue.tracks.length > 0 && _retryCount < MAX_RETRIES) {
        log(`トラックエラーのため次の曲を再生試行`, 'music');
        queue.current = null;
        await this.play(guildId, voiceChannelId, _retryCount + 1);
      } else {
        queue.current = null;
        if (queue.textChannel) {
          await queue.textChannel.send('❌ 再生に失敗しました。').catch(() => {});
        }
      }
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

  /**
   * Raw Discord Gateway opcode 4 でVCに接続（Lavalink不要）
   * 24時間常駐用 - Lavalinkの sendServerUpdate を経由しない
   */
  joinVCRaw(guildId, channelId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        log(`joinVCRaw: ギルドが見つかりません: ${guildId}`, 'error');
        return false;
      }
      guild.shard.send({
        op: 4,
        d: {
          guild_id: guildId,
          channel_id: channelId,
          self_mute: false,
          self_deaf: true
        }
      });
      log(`Raw VC接続送信: guild=${guildId}, channel=${channelId}`, 'voice');
      return true;
    } catch (error) {
      log(`Raw VC接続エラー: ${error.message}`, 'error');
      return false;
    }
  }

  /**
   * Raw Gateway opcode 4 でVCから切断
   */
  leaveVCRaw(guildId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) return false;
      guild.shard.send({
        op: 4,
        d: {
          guild_id: guildId,
          channel_id: null,
          self_mute: false,
          self_deaf: true
        }
      });
      log(`Raw VC切断送信: guild=${guildId}`, 'voice');
      return true;
    } catch (error) {
      log(`Raw VC切断エラー: ${error.message}`, 'error');
      return false;
    }
  }

  async disconnect(guildId) {
    const queue = this.getQueue(guildId);
    this.stopProgressBar(guildId);
    if (queue.player) {
      try {
        this.shoukaku.leaveVoiceChannel(guildId);
      } catch (e) {
        log(`切断エラー: ${e.message}`, 'error');
      }
      queue.player = null;
    }
    // Lavalinkプレイヤーが無くてもraw接続を切断
    this.leaveVCRaw(guildId);
    if (queue.controlMessage) {
      await queue.controlMessage.delete().catch(() => {});
      queue.controlMessage = null;
    }
    this.queues.delete(guildId);
  }
}
