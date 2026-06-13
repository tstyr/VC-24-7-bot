'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subHours } from 'date-fns';

interface ChartDataPoint {
  timestamp: string;
  time: string;
  [key: string]: string | number;
}

interface RealtimeChartProps {
  userIds: number[];
  usernames: string[];
  mode: string;
  metric: 'pp' | 'global_rank' | 'play_count' | 'total_score'; // total_score追加
  timeRange: number; // hours
}

const colors = ['#FF66AA', '#3366FF', '#8866EE', '#FF8800', '#66FF66'];

export default function RealtimeChart({ 
  userIds, 
  usernames, 
  mode, 
  metric,
  timeRange = 24 
}: RealtimeChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoading(true);
      try {
        // 各ユーザーのデータを取得
        const promises = userIds.map(async (userId, index) => {
          const response = await fetch(`/api/users/${userId}/history?mode=${mode}&hours=${timeRange}`);
          if (response.ok) {
            const userData = await response.json();
            return { userId, username: usernames[index], data: userData };
          }
          return null;
        });

        const results = await Promise.all(promises);
        const validResults = results.filter(Boolean);

        // データを時系列でマージ
        const timeMap = new Map<string, ChartDataPoint>();
        
        validResults.forEach(result => {
          if (result) {
            result.data.forEach((point: any) => {
              const timestamp = point.captured_at;
              const timeKey = new Date(timestamp).toISOString();
              
              if (!timeMap.has(timeKey)) {
                timeMap.set(timeKey, {
                  timestamp: timeKey,
                  time: format(new Date(timestamp), 'HH:mm')
                });
              }
              
              const existing = timeMap.get(timeKey)!;
              existing[result.username] = point[metric];
            });
          }
        });

        const sortedData = Array.from(timeMap.values())
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-100); // 最新100ポイント

        setData(sortedData);
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();

    // リアルタイム更新 (1分ごと)
    const interval = setInterval(() => {
      fetchHistoricalData();
    }, 60000);

    return () => clearInterval(interval);
  }, [userIds, usernames, mode, metric, timeRange]);

  const getMetricLabel = () => {
    switch (metric) {
      case 'pp': return 'Performance Points';
      case 'global_rank': return 'Global Rank';
      case 'play_count': return 'Play Count';
      case 'total_score': return 'Total Score'; // 追加
      default: return metric;
    }
  };

  const formatYAxis = (value: number) => {
    if (metric === 'global_rank') {
      return `#${value.toLocaleString()}`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-600 rounded mb-4 w-1/4"></div>
          <div className="h-64 bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-xl font-bold mb-4 text-gradient">
        {getMetricLabel()} - {timeRange}時間
      </h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
            <XAxis 
              dataKey="time" 
              stroke="#888"
              fontSize={12}
            />
            <YAxis 
              stroke="#888"
              fontSize={12}
              tickFormatter={formatYAxis}
              domain={metric === 'global_rank' ? ['dataMin', 'dataMax'] : [0, 'dataMax']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--foreground)'
              }}
              labelFormatter={(label) => `Time: ${label}`}
              formatter={(value: number, name: string) => [
                metric === 'global_rank' ? `#${value.toLocaleString()}` : 
                metric === 'pp' ? `${value.toFixed(2)}pp` :
                metric === 'total_score' ? value.toLocaleString() : // 追加
                value.toLocaleString(),
                name
              ]}
            />
            <Legend />
            {usernames.map((username, index) => (
              <Line
                key={username}
                type="monotone"
                dataKey={username}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center mt-4 text-sm text-gray-400">
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
}