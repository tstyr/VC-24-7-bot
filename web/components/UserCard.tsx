'use client';

import { useState, useEffect } from 'react';
import { RealtimeEstimator, UserStats } from '@/lib/realtime-estimator';
import { formatNumber } from '@/lib/osu-api';
import { TrendingUp, TrendingDown, User, Clock } from 'lucide-react';
import MiniChart from './MiniChart';
import AnimatedNumber from './AnimatedNumber';

interface UserCardProps {
  username: string;
  osuUserId: number;
  mode: string;
  initialStats?: UserStats;
  avatarUrl?: string;
}

export default function UserCard({ 
  username, 
  osuUserId, 
  mode, 
  initialStats,
  avatarUrl 
}: UserCardProps) {
  const [estimator] = useState(() => new RealtimeEstimator());
  const [currentStats, setCurrentStats] = useState<UserStats | null>(initialStats || null);
  const [previousStats, setPreviousStats] = useState<UserStats | null>(initialStats || null);
  const [confidence, setConfidence] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [nextApiUpdate, setNextApiUpdate] = useState<number>(20); // 20秒
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const estimation = estimator.getEstimation();
      if (estimation) {
        setPreviousStats(currentStats); // 前の値を保存
        setCurrentStats(estimation.estimated);
        setConfidence(estimation.confidence);
        setLastUpdate(estimation.lastUpdate);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [estimator, currentStats]);

  // 初期化: DBから増加率を取得してEstimatorに設定
  useEffect(() => {
    if (isInitialized) return;

    const initializeEstimator = async () => {
      try {
        console.log(`[${username}] Initializing estimator...`);
        
        // 初期統計がある場合は現在のデータポイントとして追加
        if (initialStats) {
          console.log(`[${username}] Adding initial stats:`, initialStats);
          estimator.addSnapshot(initialStats, new Date());
        }
        
        // DBから保存された増加率を取得
        console.log(`[${username}] Loading growth rate from DB...`);
        const growthResponse = await fetch(`/api/growth-rates/${osuUserId}?mode=${mode}`);
        
        if (growthResponse.ok) {
          const growthRate = await growthResponse.json();
          console.log(`[${username}] Loaded growth rate:`, growthRate);
          
          // 増加率をEstimatorに設定
          if (growthRate.data_points >= 2) {
            estimator.setTrendFromDB({
              pp_per_hour: growthRate.pp_per_hour,
              rank_change_per_hour: growthRate.rank_change_per_hour,
              plays_per_hour: growthRate.plays_per_hour,
              score_per_hour: growthRate.score_per_hour
            }, growthRate.confidence);
            console.log(`[${username}] Applied saved growth rate`);
          }
        } else {
          console.warn(`[${username}] Failed to load growth rate from DB`);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error(`[${username}] Failed to initialize:`, error);
        setIsInitialized(true);
      }
    };

    initializeEstimator();
  }, [estimator, osuUserId, mode, username, initialStats, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return; // 初期化完了まで待つ
    
    let apiCallCount = 0;
    
    // API から最新データを取得
    const fetchLatestData = async () => {
      try {
        console.log(`[${username}] Fetching API update #${apiCallCount + 1}...`);
        const response = await fetch(`/api/users/${osuUserId}/stats?mode=${mode}`);
        if (response.ok) {
          const realData = await response.json();
          console.log(`[${username}] API correction applied - Score: ${realData.total_score.toLocaleString()}`);
          estimator.correctWithRealData({
            pp: realData.pp,
            global_rank: realData.global_rank,
            country_rank: realData.country_rank,
            play_count: realData.play_count,
            total_score: realData.total_score,
            accuracy: realData.accuracy
          }, new Date());
          apiCallCount++;
          setNextApiUpdate(20); // カウントダウンを20秒にリセット
          console.log(`[${username}] Next API update in 20 seconds`);
        }
      } catch (error) {
        console.error(`[${username}] Failed to fetch latest data:`, error);
      }
    };

    // カウントダウンタイマー（毎秒減らす）
    const countdownInterval = setInterval(() => {
      setNextApiUpdate(prev => {
        if (prev <= 0) {
          return 20; // 0になったら20にリセット（次のAPI呼び出しに備える）
        }
        return prev - 1;
      });
    }, 1000);

    // 20秒ごとに実際のデータを取得して補正
    const apiInterval = setInterval(fetchLatestData, 20 * 1000);
    
    // 初回実行（即座に）
    fetchLatestData();

    return () => {
      clearInterval(apiInterval);
      clearInterval(countdownInterval);
    };
  }, [estimator, osuUserId, mode, username, isInitialized]);

  const trend = estimator.getTrend();
  const confidenceColor = confidence > 0.8 ? 'text-green-400' : 
                         confidence > 0.5 ? 'text-yellow-400' : 'text-red-400';

  if (!currentStats) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gray-600 rounded-full"></div>
          <div className="flex-1">
            <div className="h-6 bg-gray-600 rounded mb-2"></div>
            <div className="h-4 bg-gray-600 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 hover:glow transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={username}
              className="w-16 h-16 rounded-full border-2 border-osu-pink"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-osu-pink to-osu-blue flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-gradient">{username}</h3>
            <p className="text-gray-400 text-sm">
              {mode === 'osu' ? 'osu!' : 
               mode === 'taiko' ? 'osu!taiko' : 
               mode === 'fruits' ? 'osu!catch' : 
               'osu!mania'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-sm">
          <Clock className="w-4 h-4" />
          <span className={confidenceColor}>
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold">
            <AnimatedNumber
              value={currentStats.pp}
              previousValue={previousStats?.pp}
              format={(v) => v.toFixed(2)}
              className="font-bold"
            />
          </div>
          <div className="text-sm text-gray-400">PP</div>
          {trend.pp_per_hour !== 0 && (
            <div className={`text-xs flex items-center justify-center mt-1 ${
              trend.pp_per_hour > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {trend.pp_per_hour > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(trend.pp_per_hour).toFixed(2)}/h
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold">
            #<AnimatedNumber
              value={currentStats.global_rank}
              previousValue={previousStats?.global_rank}
              format={(v) => formatNumber(v)}
              className="font-bold"
            />
          </div>
          <div className="text-sm text-gray-400">Global Rank</div>
          {trend.rank_change_per_hour !== 0 && (
            <div className={`text-xs flex items-center justify-center mt-1 ${
              trend.rank_change_per_hour > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {trend.rank_change_per_hour > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(trend.rank_change_per_hour).toFixed(0)}/h
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <div className="font-semibold">
            <AnimatedNumber
              value={currentStats.play_count}
              previousValue={previousStats?.play_count}
              format={(v) => formatNumber(v)}
            />
          </div>
          <div className="text-gray-400 text-xs">Plays</div>
          {trend.plays_per_hour !== 0 && (
            <div className={`text-xs flex items-center justify-center mt-1 ${
              trend.plays_per_hour > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {trend.plays_per_hour > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(trend.plays_per_hour).toFixed(0)}/h
            </div>
          )}
        </div>
        
        <div className="text-center">
          <div className="font-semibold">
            {currentStats.accuracy ? `${currentStats.accuracy.toFixed(2)}%` : 'N/A'}
          </div>
          <div className="text-gray-400 text-xs">Accuracy</div>
        </div>
        
        <div className="text-center">
          <div className="font-semibold">
            <AnimatedNumber
              value={currentStats.total_score}
              previousValue={previousStats?.total_score}
              format={(v) => formatNumber(v)}
            />
          </div>
          <div className="text-gray-400 text-xs">Total Score</div>
        </div>
      </div>

      {/* 合計スコアのリアルタイム推移グラフ */}
      <div className="mt-4 p-3 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-gray-300 flex items-center">
            Total Score (Live)
            {trend.score_per_hour > 0 && (
              <span className="ml-2 text-xs text-green-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{formatNumber(Math.round(trend.score_per_hour / 3600))}/sec
              </span>
            )}
          </div>
          <div className="text-lg font-bold font-mono">
            <AnimatedNumber
              value={currentStats.total_score || 0}
              previousValue={previousStats?.total_score}
              format={(v) => v.toLocaleString()}
              className="font-mono font-bold"
            />
          </div>
        </div>
        <MiniChart
          currentValue={currentStats.total_score || 0}
          label="Total Score"
          color="#8866EE"
          formatValue={(v) => v.toLocaleString()}
          maxPoints={30}
        />
        <div className="mt-2 text-xs text-gray-500 flex justify-between">
          <span>毎秒リアルタイム更新</span>
          <span>次のAPI補正: {nextApiUpdate}秒後</span>
        </div>
      </div>

      {/* PP推移のリアルタイムグラフ */}
      <div className="mt-3 p-3 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-gray-300 flex items-center">
            PP Trend (Live)
            {trend.pp_per_hour > 0 && (
              <span className="ml-2 text-xs text-green-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{(trend.pp_per_hour / 3600).toFixed(3)}/sec
              </span>
            )}
          </div>
          <div className="text-lg font-bold">
            <AnimatedNumber
              value={currentStats.pp}
              previousValue={previousStats?.pp}
              format={(v) => `${v.toFixed(2)}pp`}
              className="font-bold"
            />
          </div>
        </div>
        <MiniChart
          currentValue={currentStats.pp}
          label="Performance Points"
          color="#FF66AA"
          formatValue={(v) => `${v.toFixed(2)}pp`}
          maxPoints={30}
        />
      </div>

      {/* グローバルランクのリアルタイムグラフ */}
      <div className="mt-3 p-3 bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-gray-300">Rank Trend (Live)</div>
          <div className="text-lg font-bold">
            #<AnimatedNumber
              value={currentStats.global_rank}
              previousValue={previousStats?.global_rank}
              format={(v) => formatNumber(v)}
              className="font-bold"
            />
          </div>
        </div>
        <MiniChart
          currentValue={currentStats.global_rank}
          label="Global Rank"
          color="#3366FF"
          formatValue={(v) => `#${formatNumber(v)}`}
          maxPoints={30}
        />
      </div>

      <div className="mt-4 text-xs text-gray-500 flex justify-between">
        <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
        <span>Confidence: {Math.round(confidence * 100)}%</span>
      </div>
    </div>
  );
}