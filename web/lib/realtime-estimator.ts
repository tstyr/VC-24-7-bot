export interface UserStats {
  pp: number;
  global_rank: number;
  country_rank: number;
  play_count: number;
  total_score: number;
  accuracy: number;
}

export interface RealtimeEstimation {
  estimated: UserStats;
  confidence: number; // 0-1 の信頼度
  lastUpdate: Date;
  trend: {
    pp_per_hour: number;
    rank_change_per_hour: number;
    plays_per_hour: number;
    score_per_hour: number; // 追加
  };
}

export class RealtimeEstimator {
  private snapshots: Array<{stats: UserStats, timestamp: Date}> = [];
  private estimation: RealtimeEstimation | null = null;
  private apiUpdateInterval: number = 5 * 60 * 1000; // 5分
  private lastApiUpdate: Date | null = null;
  private correctionFactor: number = 1.0; // 補正係数

  constructor(initialSnapshots: Array<{stats: UserStats, timestamp: Date}> = []) {
    this.snapshots = initialSnapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.calculateTrends();
  }

  addSnapshot(stats: UserStats, timestamp: Date) {
    this.snapshots.push({ stats, timestamp });
    
    // 最新50件のみ保持
    if (this.snapshots.length > 50) {
      this.snapshots = this.snapshots.slice(-50);
    }

    this.snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.calculateTrends();
  }

  private calculateTrends() {
    if (this.snapshots.length < 2) {
      console.log('[Estimator] Not enough snapshots for trend calculation:', this.snapshots.length);
      return;
    }

    // より多くのデータポイントを使用して精度を向上
    const recent = this.snapshots.slice(-20); // 最新20件で傾向を計算
    if (recent.length < 2) {
      return;
    }

    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeHours = (last.timestamp.getTime() - first.timestamp.getTime()) / (1000 * 60 * 60);

    if (timeHours <= 0) {
      console.log('[Estimator] Invalid time range for trend calculation');
      return;
    }

    // 線形回帰を使用してより正確な傾向を計算
    const ppTrend = this.calculateLinearTrend(recent.map(s => s.stats.pp));
    const rankTrend = this.calculateLinearTrend(recent.map(s => s.stats.global_rank));
    const playTrend = this.calculateLinearTrend(recent.map(s => s.stats.play_count));
    const scoreTrend = this.calculateLinearTrend(recent.map(s => s.stats.total_score));

    console.log('[Estimator] Trends calculated:', {
      snapshots: recent.length,
      timeSpanHours: timeHours.toFixed(2),
      ppPerHour: ppTrend.toFixed(2),
      scorePerHour: scoreTrend.toFixed(0),
      scorePerSecond: (scoreTrend / 3600).toFixed(2)
    });

    this.estimation = {
      estimated: { ...last.stats },
      confidence: Math.min(recent.length / 20, 1), // 20件で最大信頼度
      lastUpdate: last.timestamp,
      trend: {
        pp_per_hour: ppTrend * this.correctionFactor,
        rank_change_per_hour: rankTrend * this.correctionFactor,
        plays_per_hour: playTrend * this.correctionFactor,
        score_per_hour: scoreTrend * this.correctionFactor
      }
    };
  }

  // 線形回帰で傾向を計算（より正確）
  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const indices = Array.from({length: n}, (_, i) => i);
    
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    // 1時間あたりの変化率に変換
    const timeSpanHours = (this.snapshots[this.snapshots.length - 1].timestamp.getTime() - 
                          this.snapshots[Math.max(0, this.snapshots.length - values.length)].timestamp.getTime()) / 
                          (1000 * 60 * 60);
    
    return timeSpanHours > 0 ? (slope * values.length) / timeSpanHours : 0;
  }

  getEstimation(targetTime?: Date): RealtimeEstimation | null {
    if (!this.estimation || this.snapshots.length === 0) {
      console.log('[Estimator] No estimation available - snapshots:', this.snapshots.length);
      return null;
    }

    const now = targetTime || new Date();
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const secondsElapsed = (now.getTime() - lastSnapshot.timestamp.getTime()) / 1000; // 秒単位で計算
    const hoursElapsed = secondsElapsed / 3600;

    // 2時間以上経過している場合は信頼度を下げる
    const timeDecay = Math.max(0, 1 - (hoursElapsed / 2));
    const confidence = this.estimation.confidence * timeDecay;

    // 統計の推定（毎秒増加）
    // 1時間あたりの変化率を秒あたりに変換
    const ppPerSecond = this.estimation.trend.pp_per_hour / 3600;
    const rankPerSecond = this.estimation.trend.rank_change_per_hour / 3600;
    const playsPerSecond = this.estimation.trend.plays_per_hour / 3600;
    const scorePerSecond = this.estimation.trend.score_per_hour / 3600;

    const estimatedPp = Math.max(0, lastSnapshot.stats.pp + (ppPerSecond * secondsElapsed));
    const estimatedRank = Math.max(1, Math.round(lastSnapshot.stats.global_rank - (rankPerSecond * secondsElapsed)));
    const estimatedPlays = Math.max(lastSnapshot.stats.play_count, Math.round(lastSnapshot.stats.play_count + (playsPerSecond * secondsElapsed)));
    const estimatedScore = Math.max(lastSnapshot.stats.total_score, Math.round(lastSnapshot.stats.total_score + (scorePerSecond * secondsElapsed)));

    // デバッグログ（初回のみ）
    if (secondsElapsed < 2) {
      console.log('[Estimator] Calculation:', {
        secondsElapsed: secondsElapsed.toFixed(1),
        scorePerSecond: scorePerSecond.toFixed(0),
        baseScore: lastSnapshot.stats.total_score.toLocaleString(),
        estimatedScore: estimatedScore.toLocaleString(),
        scoreTrend: this.estimation.trend.score_per_hour.toFixed(0)
      });
    }

    return {
      estimated: {
        ...lastSnapshot.stats,
        pp: estimatedPp,
        global_rank: estimatedRank,
        play_count: estimatedPlays,
        total_score: estimatedScore
      },
      confidence,
      lastUpdate: now,
      trend: this.estimation.trend
    };
  }

  // 新しい実際のデータで補正
  correctWithRealData(realStats: UserStats, timestamp: Date) {
    this.lastApiUpdate = timestamp;
    
    // 補正前の推定値を取得
    const beforeCorrection = this.getEstimation(timestamp);
    
    // 実データを新しい基準点として追加（ここから再び増加を開始）
    this.addSnapshot(realStats, timestamp);
    
    // 推定精度を計算して補正係数を調整
    if (beforeCorrection) {
      const ppError = Math.abs(realStats.pp - beforeCorrection.estimated.pp) / Math.max(realStats.pp, 1);
      const scoreError = Math.abs(realStats.total_score - beforeCorrection.estimated.total_score) / Math.max(realStats.total_score, 1);
      
      // エラー率が低いほど補正係数を1に近づける
      const avgError = (ppError + scoreError) / 2;
      if (avgError < 0.01) {
        // 精度が高い場合は補正を緩める
        this.correctionFactor = Math.min(1.0, this.correctionFactor + 0.05);
      } else if (avgError > 0.05) {
        // 精度が低い場合は補正を強める
        this.correctionFactor = Math.max(0.5, this.correctionFactor - 0.05);
      }
      
      console.log('API Correction - New baseline set:', {
        timestamp: timestamp.toLocaleTimeString(),
        actualPP: realStats.pp,
        estimatedPP: beforeCorrection.estimated.pp.toFixed(2),
        actualScore: realStats.total_score.toLocaleString(),
        estimatedScore: beforeCorrection.estimated.total_score.toLocaleString(),
        ppError: (ppError * 100).toFixed(2) + '%',
        scoreError: (scoreError * 100).toFixed(2) + '%',
        correctionFactor: this.correctionFactor.toFixed(3)
      });
    }
    
    // トレンドを再計算（新しい基準点から増加を再開）
    this.calculateTrends();
  }

  getConfidence(): number {
    const estimation = this.getEstimation();
    return estimation?.confidence || 0;
  }

  getTrend() {
    return this.estimation?.trend || {
      pp_per_hour: 0,
      rank_change_per_hour: 0,
      plays_per_hour: 0,
      score_per_hour: 0 // 追加
    };
  }
}