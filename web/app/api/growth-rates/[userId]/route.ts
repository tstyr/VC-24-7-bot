import { NextRequest, NextResponse } from 'next/server';
import { getGrowthRate, saveGrowthRate, getUserSnapshots } from '@/lib/supabase';

// 線形回帰で傾向を計算
function calculateLinearTrend(values: number[], timeSpanHours: number): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const indices = Array.from({length: n}, (_, i) => i);
  
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  return timeSpanHours > 0 ? (slope * n) / timeSpanHours : 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'osu';
    const userId = parseInt(params.userId);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    console.log(`[Growth Rate API] Request for user ${userId}, mode: ${mode}`);

    // 既存の増加率を取得
    const existingRate = await getGrowthRate(userId, mode);
    
    // 5分以内に計算されていれば、それを返す
    if (existingRate) {
      const lastCalc = new Date(existingRate.last_calculated_at).getTime();
      const now = Date.now();
      if (now - lastCalc < 5 * 60 * 1000) {
        console.log(`[Growth Rate API] Using cached rate (${Math.round((now - lastCalc) / 1000)}s old)`);
        return NextResponse.json(existingRate);
      }
    }

    // 履歴データから増加率を再計算
    const snapshots = await getUserSnapshots(userId, mode, 100);
    
    if (snapshots.length < 2) {
      console.log(`[Growth Rate API] Not enough data (${snapshots.length} snapshots)`);
      return NextResponse.json({
        pp_per_hour: 0,
        rank_change_per_hour: 0,
        score_per_hour: 0,
        plays_per_hour: 0,
        confidence: 0,
        data_points: snapshots.length
      });
    }

    // 最新20件で計算
    const recent = snapshots.slice(0, Math.min(20, snapshots.length)).reverse();
    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeHours = (new Date(last.captured_at).getTime() - new Date(first.captured_at).getTime()) / (1000 * 60 * 60);

    if (timeHours <= 0) {
      console.log(`[Growth Rate API] Invalid time range`);
      return NextResponse.json({
        pp_per_hour: 0,
        rank_change_per_hour: 0,
        score_per_hour: 0,
        plays_per_hour: 0,
        confidence: 0,
        data_points: recent.length
      });
    }

    const ppTrend = calculateLinearTrend(recent.map(s => s.pp || 0), timeHours);
    const rankTrend = calculateLinearTrend(recent.map(s => s.global_rank || 0), timeHours);
    const scoreTrend = calculateLinearTrend(recent.map(s => s.total_score || 0), timeHours);
    const playTrend = calculateLinearTrend(recent.map(s => s.play_count || 0), timeHours);

    const growthRate = {
      osu_user_id: userId,
      mode,
      pp_per_hour: ppTrend,
      rank_change_per_hour: rankTrend,
      score_per_hour: Math.round(scoreTrend),
      plays_per_hour: playTrend,
      confidence: Math.min(recent.length / 20, 1),
      data_points: recent.length
    };

    // DBに保存
    await saveGrowthRate(growthRate);

    console.log(`[Growth Rate API] Calculated new rate - PP/h: ${ppTrend.toFixed(2)}, Score/h: ${scoreTrend.toFixed(0)}`);

    return NextResponse.json(growthRate);

  } catch (error) {
    console.error('[Growth Rate API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch growth rate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
