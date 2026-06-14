'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';
import { formatNumber } from '@/lib/osu-api';

interface UserStats {
  pp: number;
  global_rank: number;
  country_rank: number;
  play_count: number;
  total_score: number;
  accuracy: number;
}

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

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [history, setHistory] = useState<HistoricalData[]>([]);
  const [currentStats, setCurrentStats] = useState<UserStats | null>(null);
  const [previousStats, setPreviousStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode] = useState('osu');

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
        }

        // 履歴データを取得
        const historyResponse = await fetch(`/api/users/${userId}/history?mode=${mode}&hours=720`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setHistory(historyData);
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();

    // 20秒ごとに最新データを取得
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/users/${userId}/stats?mode=${mode}`);
        if (response.ok) {
          const stats = await response.json();
          setPreviousStats(currentStats);
          setCurrentStats({
            pp: stats.pp,
            global_rank: stats.global_rank,
            country_rank: stats.country_rank,
            play_count: stats.play_count,
            total_score: stats.total_score,
            accuracy: stats.accuracy
          });
        }
      } catch (error) {
        console.error('Failed to fetch latest stats:', error);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [userId, mode, currentStats]);

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

  // 統計計算
  const totalViews = currentStats.total_score;
  const avgPerSub = history.length > 0 ? currentStats.total_score / currentStats.play_count : 0;
  const subsInLast30Days = history.length > 0 ? 
    history.filter(h => new Date(h.captured_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length : 0;

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
          
          <div className="text-8xl font-bold mb-4">
            <AnimatedNumber
              value={currentStats.total_score}
              previousValue={previousStats?.total_score}
              format={(v) => v.toLocaleString()}
              className="font-bold"
            />
          </div>
          <div className="text-2xl text-gray-400">Total Score</div>
        </div>

        {/* 統計グリッド */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold mb-2">
              <AnimatedNumber
                value={currentStats.global_rank}
                previousValue={previousStats?.global_rank}
                format={(v) => formatNumber(v)}
              />
            </div>
            <div className="text-sm text-gray-400 mb-1">Global Rank</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold mb-2">
              <AnimatedNumber
                value={currentStats.pp}
                previousValue={previousStats?.pp}
                format={(v) => v.toFixed(0)}
              />
            </div>
            <div className="text-sm text-gray-400 mb-1">Performance Points</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <div className="text-4xl font-bold mb-2">
              <AnimatedNumber
                value={currentStats.play_count}
                previousValue={previousStats?.play_count}
                format={(v) => formatNumber(v)}
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
              {(avgPerSub).toFixed(0)}
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

        {/* グラフ */}
        {history.length > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-center">Total Score Growth</h2>
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
                  stroke="#3B82F6"
                  strokeWidth="3"
                  points={history.map((point, index) => {
                    const x = (index / (history.length - 1)) * 1000;
                    const maxScore = Math.max(...history.map(h => h.total_score));
                    const minScore = Math.min(...history.map(h => h.total_score));
                    const y = 225 - ((point.total_score - minScore) / (maxScore - minScore)) * 200;
                    return `${x},${y}`;
                  }).join(' ')}
                />

                {/* X軸ラベル */}
                {history.filter((_, i) => i % Math.ceil(history.length / 5) === 0).map((point, index, arr) => {
                  const x = (history.indexOf(point) / (history.length - 1)) * 1000;
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
                      {date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
