'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';
import { formatNumber } from '@/lib/osu-api';
import { RealtimeEstimator, UserStats } from '@/lib/realtime-estimator';

interface UserData {
  osu_user_id: number;
  osu_username: string;
  avatar_url?: string;
  latest_stats: UserStats;
}

interface HistoricalData {
  captured_at: string;
  pp: number;
  global_rank: number;
  total_score: number;
  play_count: number;
}

type GraphType = 'score' | 'rank' | 'pp';

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [history, setHistory] = useState<HistoricalData[]>([]);
  const [realtimeHistory, setRealtimeHistory] = useState<HistoricalData[]>([]);
  const [estimator] = useState(() => new RealtimeEstimator());
  const [currentStats, setCurrentStats] = useState<UserStats | null>(null);
  const [previousStats, setPreviousStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphType, setGraphType] = useState<GraphType>('score');
  const [mode] = useState('osu');

  // 毎秒推定値を更新
  useEffect(() => {
    const interval = setInterval(() => {
      const estimation = estimator.getEstimation();
      if (estimation) {
        setPreviousStats(currentStats);
        setCurrentStats(estimation.estimated);
        
        // リアルタイムグラフ用のデータポイントを追加
        setRealtimeHistory(prev => {
          const newPoint: HistoricalData = {
            captured_at: new Date().toISOString(),
            pp: estimation.estimated.pp,
            global_rank: estimation.estimated.global_rank,
            total_score: estimation.estimated.total_score,
            play_count: estimation.estimated.play_count
          };
          const updated = [...prev, newPoint];
          // 最新60ポイント（1分間）を保持
          return updated.slice(-60);
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [estimator, currentStats]);

  // 初期化とデータ取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // ユーザー一覧から該当ユーザーを取得
        const usersResponse = await fetch('/api/users');
        const users = await usersResponse.json();
        const user = users.find((u: UserData) => u.osu_user_id === parseInt(userId));
        
        if (user) {
          setUserData(user);
          setCurrentStats(user.latest_stats);
          setPreviousStats(user.latest_stats);
          
          // Estimatorに初期データを追加
          estimator.addSnapshot(user.latest_stats, new Date());
        }

        // 増加率をDBから取得
        const growthResponse = await fetch(`/api/growth-rates/${userId}?mode=${mode}`);
        if (growthResponse.ok) {
          const growthRate = await growthResponse.json();
          if (growthRate.data_points >= 2) {
            estimator.setTrendFromDB({
              pp_per_hour: growthRate.pp_per_hour,
              rank_change_per_hour: growthRate.rank_change_per_hour,
              plays_per_hour: growthRate.plays_per_hour,
              score_per_hour: growthRate.score_per_hour
            }, growthRate.confidence);
          }
        }

        // 履歴データを取得
        const historyResponse = await fetch(`/api/users/${userId}/history?mode=${mode}&hours=720`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setHistory(historyData);
          setRealtimeHistory(historyData.slice(-60)); // 最新60件
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId, mode, estimator]);

  // 20秒ごとに最新データを取得してEstimatorを補正
  useEffect(() => {
    if (!currentStats) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/users/${userId}/stats?mode=${mode}`);
        if (response.ok) {
          const stats = await response.json();
          estimator.correctWithRealData({
            pp: stats.pp,
            global_rank: stats.global_rank,
            country_rank: stats.country_rank,
            play_count: stats.play_count,
            total_score: stats.total_score,
            accuracy: stats.accuracy
          }, new Date());
        }
      } catch (error) {
        console.error('Failed to fetch latest stats:', error);
      }
    }, 20000);

    // 初回実行
    (async () => {
      try {
        const response = await fetch(`/api/users/${userId}/stats?mode=${mode}`);
        if (response.ok) {
          const stats = await response.json();
          estimator.correctWithRealData({
            pp: stats.pp,
            global_rank: stats.global_rank,
            country_rank: stats.country_rank,
            play_count: stats.play_count,
            total_score: stats.total_score,
            accuracy: stats.accuracy
          }, new Date());
        }
      } catch (error) {
        console.error('Failed to fetch initial stats:', error);
      }
    })();

    return () => clearInterval(interval);
  }, [userId, mode, estimator, currentStats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!userData || !currentStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">User not found</div>
      </div>
    );
  }

  // グラフ用のデータ（履歴 + リアルタイム）
  const graphData = [...history, ...realtimeHistory];
  
  // グラフの値を取得
  const getGraphValue = (point: HistoricalData) => {
    switch (graphType) {
      case 'score':
        return point.total_score;
      case 'rank':
        return point.global_rank;
      case 'pp':
        return point.pp;
    }
  };

  const getGraphLabel = () => {
    switch (graphType) {
      case 'score':
        return 'Total Score';
      case 'rank':
        return 'Global Rank';
      case 'pp':
        return 'Performance Points';
    }
  };

  // 統計計算
  const avgPerPlay = currentStats.play_count > 0 ? currentStats.total_score / currentStats.play_count : 0;
  const subsInLast30Days = history.filter(h => 
    new Date(h.captured_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-4">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </Link>
        </div>

        {/* メインスコア表示 */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-4 mb-4">
            {userData.avatar_url && (
              <img 
                src={userData.avatar_url} 
                alt={userData.osu_username}
                className="w-24 h-24 rounded-full border-4 border-osu-pink"
              />
            )}
            <div>
              <h1 className="text-5xl font-bold mb-2">{userData.osu_username}</h1>
              <p className="text-gray-400">osu! Standard</p>
            </div>
          </div>
          
          <div className="text-8xl font-bold mb-4 font-mono">
            <AnimatedNumber
              value={currentStats.total_score}
              previousValue={previousStats?.total_score}
              format={(v) => Math.round(v).toLocaleString()}
              duration={800}
            />
          </div>
          <div className="text-2xl text-gray-400">Total Score (Live)</div>
        </div>

        {/* 統計グリッド */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold mb-2 font-mono">
              <AnimatedNumber
                value={currentStats.global_rank}
                previousValue={previousStats?.global_rank}
                format={(v) => formatNumber(Math.round(v))}
                duration={800}
              />
            </div>
            <div className="text-sm text-gray-400 mb-1">Global Rank</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold mb-2 font-mono">
              <AnimatedNumber
                value={currentStats.pp}
                previousValue={previousStats?.pp}
                format={(v) => v.toFixed(0)}
                duration={800}
              />
            </div>
            <div className="text-sm text-gray-400 mb-1">Performance Points</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold mb-2 font-mono">
              <AnimatedNumber
                value={currentStats.play_count}
                previousValue={previousStats?.play_count}
                format={(v) => formatNumber(Math.round(v))}
                duration={800}
              />
            </div>
            <div className="text-sm text-gray-400 mb-1">Play Count</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold mb-2">
              {currentStats.accuracy.toFixed(2)}%
            </div>
            <div className="text-sm text-gray-400 mb-1">Accuracy</div>
          </div>
        </div>

        {/* セカンダリ統計 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
          <div className="text-center">
            <div className="text-2xl font-bold mb-1">
              {formatNumber(Math.round(avgPerPlay))}
            </div>
            <div className="text-sm text-gray-400">Avg Score/Play</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold mb-1">
              {formatNumber(currentStats.play_count)}
            </div>
            <div className="text-sm text-gray-400">Total Plays</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold mb-1">
              {subsInLast30Days}
            </div>
            <div className="text-sm text-gray-400">Snapshots in last 30 days</div>
          </div>
        </div>

        {/* グラフ切り替えボタン */}
        <div className="flex justify-center space-x-4 mb-6">
          <button
            onClick={() => setGraphType('score')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              graphType === 'score'
                ? 'bg-osu-pink text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Total Score
          </button>
          <button
            onClick={() => setGraphType('rank')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              graphType === 'rank'
                ? 'bg-osu-blue text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Global Rank
          </button>
          <button
            onClick={() => setGraphType('pp')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              graphType === 'pp'
                ? 'bg-osu-purple text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Performance Points
          </button>
        </div>

        {/* グラフ */}
        {graphData.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-center">{getGraphLabel()} Growth (Realtime)</h2>
            <div className="relative h-64">
              <svg className="w-full h-full" viewBox="0 0 1000 250">
                {/* グリッドライン */}
                {[0, 1, 2, 3, 4].map(i => (
                  <line
                    key={i}
                    x1="0"
                    y1={i * 50 + 25}
                    x2="1000"
                    y2={i * 50 + 25}
                    stroke="#374151"
                    strokeWidth="1"
                  />
                ))}

                {/* データライン */}
                <polyline
                  fill="none"
                  stroke={graphType === 'score' ? '#8B5CF6' : graphType === 'rank' ? '#3B82F6' : '#EC4899'}
                  strokeWidth="3"
                  points={graphData.map((point, index) => {
                    const x = (index / (graphData.length - 1)) * 1000;
                    const values = graphData.map(getGraphValue);
                    const maxValue = Math.max(...values);
                    const minValue = Math.min(...values);
                    const range = maxValue - minValue || 1;
                    const normalizedValue = (getGraphValue(point) - minValue) / range;
                    // ランクは逆転（小さいほど良い）
                    const y = graphType === 'rank' 
                      ? 25 + (normalizedValue * 200)
                      : 225 - (normalizedValue * 200);
                    return `${x},${y}`;
                  }).join(' ')}
                />

                {/* X軸ラベル */}
                {graphData.filter((_, i) => i % Math.ceil(graphData.length / 5) === 0).map((point, index) => {
                  const i = graphData.indexOf(point);
                  const x = (i / (graphData.length - 1)) * 1000;
                  const date = new Date(point.captured_at);
                  return (
                    <text
                      key={index}
                      x={x}
                      y="245"
                      fill="#9CA3AF"
                      fontSize="12"
                      textAnchor="middle"
                    >
                      {date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                    </text>
                  );
                })}
              </svg>
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              Realtime updates every second • API correction every 20 seconds
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
