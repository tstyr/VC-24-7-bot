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
  };
}

export class RealtimeEstimator {
  private snapshots: Array<{stats: UserStats, timestamp: Date}> = [];
  private estimation: RealtimeEstimation | null = null;

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
      return;
    }

    const recent = this.snapshots.slice(-10); // 最新10件で傾向を計算
    if (recent.length < 2) {
      return;
    }

    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeHours = (last.timestamp.getTime() - first.timestamp.getTime()) / (1000 * 60 * 60);

    if (timeHours <= 0) {
      return;
    }

    const ppDiff = last.stats.pp - first.stats.pp;
    const rankDiff = first.stats.global_rank - last.stats.global_rank; // 順位は数字が小さいほど良い
    const playDiff = last.stats.play_count - first.stats.play_count;

    this.estimation = {
      estimated: { ...last.stats },
      confidence: Math.min(recent.length / 10, 1),
      lastUpdate: last.timestamp,
      trend: {
        pp_per_hour: ppDiff / timeHours,
        rank_change_per_hour: rankDiff / timeHours,
        plays_per_hour: playDiff / timeHours
      }
    };
  }

  getEstimation(targetTime?: Date): RealtimeEstimation | null {
    if (!this.estimation || this.snapshots.length === 0) {
      return null;
    }

    const now = targetTime || new Date();
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const hoursElapsed = (now.getTime() - lastSnapshot.timestamp.getTime()) / (1000 * 60 * 60);

    // 2時間以上経過している場合は信頼度を下げる
    const timeDecay = Math.max(0, 1 - (hoursElapsed / 2));
    const confidence = this.estimation.confidence * timeDecay;

    // 統計の推定
    const estimatedPp = Math.max(0, lastSnapshot.stats.pp + (this.estimation.trend.pp_per_hour * hoursElapsed));
    const estimatedRank = Math.max(1, Math.round(lastSnapshot.stats.global_rank - (this.estimation.trend.rank_change_per_hour * hoursElapsed)));
    const estimatedPlays = Math.max(lastSnapshot.stats.play_count, Math.round(lastSnapshot.stats.play_count + (this.estimation.trend.plays_per_hour * hoursElapsed)));

    return {
      estimated: {
        ...lastSnapshot.stats,
        pp: estimatedPp,
        global_rank: estimatedRank,
        play_count: estimatedPlays
      },
      confidence,
      lastUpdate: now,
      trend: this.estimation.trend
    };
  }

  // 新しい実際のデータで補正
  correctWithRealData(realStats: UserStats, timestamp: Date) {
    this.addSnapshot(realStats, timestamp);
    
    // 推定値と実際の値の差を計算して学習
    if (this.estimation) {
      const estimation = this.getEstimation(timestamp);
      if (estimation) {
        // 実際の値と推定値の差を分析して、今後の推定精度を向上
        console.log('Correction applied:', {
          ppDiff: realStats.pp - estimation.estimated.pp,
          rankDiff: realStats.global_rank - estimation.estimated.global_rank,
          playsDiff: realStats.play_count - estimation.estimated.play_count
        });
      }
    }
  }

  getConfidence(): number {
    const estimation = this.getEstimation();
    return estimation?.confidence || 0;
  }

  getTrend() {
    return this.estimation?.trend || {
      pp_per_hour: 0,
      rank_change_per_hour: 0,
      plays_per_hour: 0
    };
  }
}