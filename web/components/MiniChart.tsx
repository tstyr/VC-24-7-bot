'use client';

import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  timestamp: number;
  value: number;
}

interface MiniChartProps {
  currentValue: number;
  label: string;
  color: string;
  formatValue?: (value: number) => string;
  maxPoints?: number;
}

export default function MiniChart({ 
  currentValue, 
  label, 
  color, 
  formatValue = (v) => v.toLocaleString(),
  maxPoints = 30 
}: MiniChartProps) {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);

  // 毎秒データポイントを追加
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setDataPoints(prev => {
        const newPoints = [...prev, { timestamp: now, value: currentValue }];
        // 最大ポイント数を制限
        if (newPoints.length > maxPoints) {
          return newPoints.slice(-maxPoints);
        }
        return newPoints;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentValue, maxPoints]);

  const chartData = {
    labels: dataPoints.map((_, index) => index.toString()),
    datasets: [
      {
        label,
        data: dataPoints.map(point => point.value),
        borderColor: color,
        backgroundColor: `${color}20`,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3,
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: color,
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            if (value === null) return `${label}: N/A`;
            return `${label}: ${formatValue(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        display: false,
        beginAtZero: false
      }
    },
    elements: {
      line: {
        borderJoinStyle: 'round'
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  return (
    <div className="relative h-16 w-full">
      {dataPoints.length > 1 ? (
        <Line data={chartData} options={options} />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500 text-xs">
          Collecting data...
        </div>
      )}
    </div>
  );
}