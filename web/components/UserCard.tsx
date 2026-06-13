'use client';

import { useState, useEffect } from 'react';
import { RealtimeEstimator, UserStats } from '@/lib/realtime-estimator';
import { formatNumber } from '@/lib/osu-api';
import { TrendingUp, TrendingDown, User, Clock } from 'lucide-react';
import MiniChart from './MiniChart';

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
  const [confidence, setConfidence] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [nextApiUpdate, setNextApiUpdate] = useState<number>(120); // 2分=120秒
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const estimation = estimator.getEstimation();
      if (estimation) {
        setCurrentStats(estimation.estimated);
        setConfidence(estimation.confidence);
        setLastUpdate(estimation.lastUpdate);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [estimator]);

  // 初期化: 履歴データを取得してEstimatorに渡す
  useEffect(() => {
    if (isInitialized) return;

    const initializeEstimator = async () => {
      try {
        console.log(`[${username}] Loading historical data...`);
        
        // 過去24時間の履歴データを取得
        const response = await fetch(`/api/users/${osuUserId}/history?mode=${mode}&hours=24`);
        if (response.ok) {
          const history = await response.json();
          console.log(`[${username}] Loaded ${history.length} historical snapshots`);
          
          // 履歴データをEstimatorに追加
          if (Array.isArray(history) && history.length > 0) {
            history.forEach((snapshot: any) => {
              estimator.addSnapshot({
                pp: snapshot.pp,
                global_rank: snapshot.global_rank,
                country_rank: snapshot.country_rank,
                play_count: snapshot.play_count,
                total_score: snapshot.total_score,
                accuracy: snapshot.accuracy
              }, new Date(snapshot.created_at));
            });
            console.log(`[${username}] Estimator initialized with ${history.length} snapshots`);
          }
        }
        
        // 初期統計がある場合は現在のデータポイントとして追加
        if (initialStats) {
          estimator.addSnapshot(initialStats, new Date());
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error(`[${username}] Failed to load historical data:`, error);
        // エラーでも初期化済みにして、初期統計のみで動作させる
        if (initialStats) {
          estimator.addSnapshot(initialStats, new Date());
        }
        setIsInitialized(true);
      }
    };

    initializeEstimator();
  }, [estimator, osuUserId, mode, username, initialStats, isInitialized]);

  useEffect(() => {
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
          setNextApiUpdate(120); // カウントダウンをリセット
        }
      } catch (error) {
        console.error('Failed to fetch latest data:', error);
      }
    };

    // カウントダウンタイマー
    const countdownInterval = setInterval(() => {
      setNextApiUpdate(prev => Math.max(0, prev - 1));
    }, 1000);

    // 2分ごとに実際のデータを取得して補正
    const apiInterval = setInterval(fetchLatestData, 2 * 60 * 1000);
    fetchLatestData(); // 初回実行

    return () => {
      clearInterval(apiInterval);
      clearInterval(countdownInterval);
    };
  }, [estimator, osuUserId, mode, username]);

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
          <div className="text-2xl font-bold animate-counter text-osu-pink">
            {currentStats.pp.toFixed(2)}
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
          <div className="text-2xl font-bold animate-counter text-osu-blue">
            #{formatNumber(currentStats.global_rank)}
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
          <div className="font-semibold animate-counter">
            {formatNumber(currentStats.play_count)}
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
          <div className="font-semibold animate-counter text-osu-purple">
            {currentStats.total_score ? formatNumber(currentStats.total_score) : 'N/A'}
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
          <div className="text-lg font-bold text-osu-purple animate-counter font-mono">
            {currentStats.total_score ? currentStats.total_score.toLocaleString() : 'N/A'}
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
          <div className="text-lg font-bold text-osu-pink animate-counter">
            {currentStats.pp.toFixed(2)}pp
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
          <div className="text-lg font-bold text-osu-blue animate-counter">
            #{formatNumber(currentStats.global_rank)}
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