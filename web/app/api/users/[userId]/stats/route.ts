import { NextRequest, NextResponse } from 'next/server';
import { getLatestUserStats } from '@/lib/db';
import { fetchOsuUser } from '@/lib/osu-api';

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

    // DBから最新の統計を取得
    const dbStats = await getLatestUserStats(userId, mode);
    
    // osu! APIから最新データを取得
    let apiStats;
    try {
      apiStats = await fetchOsuUser(userId, mode);
    } catch (error) {
      console.error(`Failed to fetch API stats for user ${userId}:`, error);
      
      // APIが失敗した場合はDBデータのみ返す
      if (dbStats) {
        return NextResponse.json({
          pp: dbStats.pp || 0,
          global_rank: dbStats.global_rank || 0,
          country_rank: dbStats.country_rank || 0,
          play_count: dbStats.play_count || 0,
          total_score: 0,
          accuracy: 0,
          source: 'database',
          last_updated: dbStats.captured_at
        });
      } else {
        return NextResponse.json(
          { error: 'No data available for this user' },
          { status: 404 }
        );
      }
    }

    // APIデータを返す
    const stats = apiStats.statistics || {};
    return NextResponse.json({
      pp: stats.pp || 0,
      global_rank: stats.global_rank || 0,
      country_rank: stats.country_rank || 0,
      play_count: stats.play_count || 0,
      total_score: stats.total_score || 0,
      accuracy: stats.accuracy || 0,
      source: 'api',
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to fetch user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user stats' },
      { status: 500 }
    );
  }
}