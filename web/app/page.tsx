'use client';

import { useState, useEffect } from 'react';
import UserCard from '@/components/UserCard';
import RealtimeChart from '@/components/RealtimeChart';
import { Activity, Users, BarChart3, Settings } from 'lucide-react';

interface TrackedUser {
  discord_id: string;
  osu_user_id: number;
  osu_username: string;
  latest_stats?: {
    pp: number;
    global_rank: number;
    country_rank: number;
    play_count: number;
    total_score: number;
    accuracy: number;
  };
  avatar_url?: string;
}

export default function Dashboard() {
  const [users, setUsers] = useState<TrackedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectedMode, setSelectedMode] = useState<string>('osu');
  const [selectedMetric, setSelectedMetric] = useState<'pp' | 'global_rank' | 'play_count' | 'total_score'>('pp');
  const [timeRange, setTimeRange] = useState<number>(24);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`/api/users?mode=${selectedMode}`);
        if (response.ok) {
          const userData = await response.json();
          setUsers(userData);
          // デフォルトで最初の3ユーザーを選択
          setSelectedUsers(userData.slice(0, 3).map((u: TrackedUser) => u.osu_user_id));
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [selectedMode]);

  const handleUserToggle = (userId: number) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        // 最大5ユーザーまで
        return prev.length < 5 ? [...prev, userId] : prev;
      }
    });
  };

  const selectedUsernames = users
    .filter(u => selectedUsers.includes(u.osu_user_id))
    .map(u => u.osu_username);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-16 h-16 text-osu-pink animate-bounce-soft mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gradient">Loading osu! Dashboard...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">
              osu! Realtime Dashboard
            </h1>
            <p className="text-gray-400">
              Live statistics with real-time estimation and trend analysis
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Activity className="w-8 h-8 text-osu-pink animate-pulse-soft" />
            <div className="text-right">
              <div className="text-sm text-gray-400">Active Users</div>
              <div className="text-2xl font-bold text-osu-pink">{users.length}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="mb-6 card p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Mode:</span>
            <select 
              value={selectedMode} 
              onChange={(e) => setSelectedMode(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              <option value="osu">osu!</option>
              <option value="taiko">osu!taiko</option>
              <option value="fruits">osu!catch</option>
              <option value="mania">osu!mania</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium">Metric:</span>
            <select 
              value={selectedMetric} 
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              <option value="pp">Performance Points</option>
              <option value="global_rank">Global Rank</option>
              <option value="play_count">Play Count</option>
              <option value="total_score">Total Score</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-medium">Time Range:</span>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm"
            >
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      {selectedUsers.length > 0 && (
        <div className="mb-6">
          <RealtimeChart
            userIds={selectedUsers}
            usernames={selectedUsernames}
            mode={selectedMode}
            metric={selectedMetric}
            timeRange={timeRange}
          />
        </div>
      )}

      {/* User Selection */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Users className="w-6 h-6 text-osu-blue mr-2" />
          <h2 className="text-2xl font-bold">
            Select Users for Chart 
            <span className="text-gray-400 text-lg ml-2">
              ({selectedUsers.length}/5)
            </span>
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users.map((user) => (
            <div
              key={user.osu_user_id}
              className={`cursor-pointer transition-all duration-300 ${
                selectedUsers.includes(user.osu_user_id)
                  ? 'ring-2 ring-osu-pink'
                  : 'hover:ring-1 hover:ring-gray-500'
              }`}
              onClick={() => handleUserToggle(user.osu_user_id)}
            >
              <UserCard
                username={user.osu_username}
                osuUserId={user.osu_user_id}
                mode={selectedMode}
                initialStats={user.latest_stats}
                avatarUrl={user.avatar_url}
              />
            </div>
          ))}
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400 mb-2">No Users Found</h3>
          <p className="text-gray-500">
            No tracked users found for {selectedMode} mode. Make sure users are linked in the Discord bot.
          </p>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>
          osu! Realtime Dashboard • Data updated every minute with real-time estimation between updates
        </p>
      </footer>
    </div>
  );
}