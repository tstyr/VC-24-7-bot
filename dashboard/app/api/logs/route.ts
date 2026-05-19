import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = parseInt(searchParams.get('skip') || '0');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');

    let query = 'SELECT * FROM voice_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      query += ` AND user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (action) {
      query += ` AND action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    query += ' ORDER BY timestamp DESC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, skip);

    const result = await pool.query(query, params);

    // 総数取得
    let countQuery = 'SELECT COUNT(*) FROM voice_logs WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (userId) {
      countQuery += ` AND user_id = $${countParamIndex}`;
      countParams.push(userId);
      countParamIndex++;
    }

    if (action) {
      countQuery += ` AND action = $${countParamIndex}`;
      countParams.push(action);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total
      }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, guildId, channelId, channelName, action } = body;

    if (!userId || !username || !guildId || !channelId || !channelName || !action) {
      return NextResponse.json(
        { success: false, error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    if (!['join', 'leave'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'actionはjoinまたはleaveである必要があります' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO voice_logs (user_id, username, guild_id, channel_id, channel_name, action, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [userId, username, guildId, channelId, channelName, action]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
