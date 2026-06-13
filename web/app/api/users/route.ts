import { NextRequest, NextResponse } from 'next/server';
import { getTrackedUsers, getAllLatestStats } from '@/lib/db';
import { fetchOsuUser } from '@/lib/osu-api';

export async function GET(request: NextRequest) {
  console.log('API /users called');
  
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'osu';
    console.log('Mode:', mode);

    // DBから追跡対象ユーザー一覧を取得
    console.log('Fetching tracked users...');
    const trackedUsers = await getTrackedUsers();
    console.log('Tracked users count:', trackedUsers.length);
    
    if (trackedUsers.length === 0) {
      console.log('No tracked users found in database');
      return NextResponse.json([]);
    }

    // 各ユーザーの最新統計を取得
    console.log('Fetching latest stats...');
    const latestStats = await getAllLatestStats(mode);
    console.log('Latest stats count:', latestStats.length);
    
    const statsMap = new Map(latestStats.map(stat => [stat.osu_user_id, stat]));

    // ユーザー情報を結合
    const usersWithStats = await Promise.allSettled(
      trackedUsers.map(async (user) => {
        const stats = statsMap.get(user.osu_user_id);
        console.log(`User ${user.osu_username} (ID: ${user.osu_user_id}) - Has stats:`, !!stats);
        
        let avatarUrl;
        try {
          // osu! APIからアバターURLを取得
          const osuUser = await fetchOsuUser(user.osu_user_id, mode);
          avatarUrl = osuUser.avatar_url;
        } catch (error) {
          console.warn(`Failed to fetch avatar for user ${user.osu_user_id}:`, error.message);
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

    console.log('Valid users with stats:', validUsers.length);
    console.log('Users data:', validUsers.map(u => ({ username: u.osu_username, pp: u.latest_stats?.pp })));

    return NextResponse.json(validUsers);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    console.error('Error stack:', error.stack);
    console.error('Database URL exists:', !!process.env.DATABASE_URL);
    console.error('OSU_CLIENT_ID exists:', !!process.env.OSU_CLIENT_ID);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch users', 
        details: error.message,
        env_check: {
          database_url: !!process.env.DATABASE_URL,
          osu_client_id: !!process.env.OSU_CLIENT_ID,
          osu_client_secret: !!process.env.OSU_CLIENT_SECRET
        }
      },
      { status: 500 }
    );
  }
}