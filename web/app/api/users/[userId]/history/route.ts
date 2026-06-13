import { NextRequest, NextResponse } from 'next/server';
import { getUserSnapshots } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'osu';
    const hours = parseInt(searchParams.get('hours') || '24');
    const userId = parseInt(params.userId);

    console.log(`[History API] Request for user ${userId}, mode: ${mode}, hours: ${hours}`);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // 指定時間範囲のスナップショットを取得
    const snapshots = await getUserSnapshots(userId, mode, Math.min(hours * 3, 200)); // 最大200件
    
    console.log(`[History API] Retrieved ${snapshots.length} snapshots from DB`);
    
    // 指定時間以内のデータのみフィルタ
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const filteredSnapshots = snapshots.filter(snapshot => 
      new Date(snapshot.captured_at) >= cutoffTime
    );

    console.log(`[History API] Filtered to ${filteredSnapshots.length} snapshots within ${hours} hours`);

    // 時系列順にソート
    filteredSnapshots.sort((a, b) => 
      new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    );

    return NextResponse.json(filteredSnapshots);

  } catch (error) {
    console.error('[History API] Error:', error);
    console.error('[History API] Error details:', error instanceof Error ? error.stack : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch user history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}