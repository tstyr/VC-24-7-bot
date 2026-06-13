import { NextRequest, NextResponse } from 'next/server';
import { getUserSnapshots } from '@/lib/db';
import { subHours } from 'date-fns';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'osu';
    const hours = parseInt(searchParams.get('hours') || '24');
    const userId = parseInt(params.userId);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // 指定時間範囲のスナップショットを取得
    const snapshots = await getUserSnapshots(userId, mode, Math.min(hours * 3, 200)); // 最大200件
    
    // 指定時間以内のデータのみフィルタ
    const cutoffTime = subHours(new Date(), hours);
    const filteredSnapshots = snapshots.filter(snapshot => 
      new Date(snapshot.captured_at) >= cutoffTime
    );

    // 時系列順にソート
    filteredSnapshots.sort((a, b) => 
      new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
    );

    return NextResponse.json(filteredSnapshots);

  } catch (error) {
    console.error('Failed to fetch user history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user history' },
      { status: 500 }
    );
  }
}