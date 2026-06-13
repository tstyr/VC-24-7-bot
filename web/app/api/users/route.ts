import { NextRequest, NextResponse } from 'next/server';
import { getTrackedUsers, getAllLatestStats } from '@/lib/db';
import { fetchOsuUser } from '@/lib/osu-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'osu';

    // DBから追跡対象ユーザー一覧を取得
    const trackedUsers = await getTrackedUsers();
    
    // 各ユーザーの最新統計を取得
    const latestStats = await getAllLatestStats(mode);
    const statsMap = new Map(latestStats.map(stat => [stat.osu_user_id, stat]));

    // ユーザー情報を結合
    const usersWithStats = await Promise.allSettled(
      trackedUsers.map(async (user) => {
        const stats = statsMap.get(user.osu_user_id);
        
        let avatarUrl;
        try {
          // osu! APIからアバターURLを取得
          const osuUser = await fetchOsuUser(user.osu_user_id, mode);
          avatarUrl = osuUser.avatar_url;
        } catch (error) {
          console.warn(`Failed to fetch avatar for user ${user.osu_user_id}:`, error);
        }

        return {
          discord_id: user.discord_id,
          osu_user_id: user.osu_user_id,
          osu_username: user.osu_username,
          latest_stats: stats ? {
            pp: stats.pp || 0,
            global_rank: stats.global_rank || 0,
            country_rank: stats.country_rank || 0,
            play_count: stats.play_count || 0,
            total_score: 0, // DBに保存されていない場合
            accuracy: 0 // DBに保存されていない場合
          } : null,
          avatar_url: avatarUrl
        };
      })
    );

    // 成功したもののみを返す
    const validUsers = usersWithStats
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value)
      .filter(user => user.latest_stats !== null) // 統計データがあるユーザーのみ
      .sort((a, b) => (b.latest_stats?.pp || 0) - (a.latest_stats?.pp || 0)); // PP順でソート

    return NextResponse.json(validUsers);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}