import { createClient } from '@supabase/supabase-js';

console.log('Initializing Supabase client...');

// Supabase URL とアノニマスキーが必要
const supabaseUrl = process.env.SUPABASE_URL || 'https://wztbjovwcilupdvnjjjv.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is required');
}

export const supabase = createClient(supabaseUrl, supabaseKey || '');

// Supabase用のデータベース関数
// Supabase用の型定義
interface OsuTrackedUser {
  discord_id: string;
  osu_user_id: number;
  osu_username: string;
  first_linked_at: string;
  last_linked_at: string;
}

interface OsuSnapshot {
  id: number;
  discord_id: string;
  osu_user_id: number;
  osu_username: string;
  mode: string;
  pp: number;
  global_rank: number;
  country_rank: number;
  play_time_seconds: number;
  play_count: number;
  total_score: number; // 追加
  captured_at: string;
}

export async function getTrackedUsers(): Promise<OsuTrackedUser[]> {
  console.log('Fetching tracked users via Supabase...');
  const { data, error } = await supabase
    .from('osu_tracked_users')
    .select('discord_id, osu_user_id, osu_username, first_linked_at, last_linked_at')
    .order('last_linked_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(`Failed to fetch tracked users: ${error.message}`);
  }

  return data || [];
}

export async function getAllLatestStats(mode: string = 'osu'): Promise<OsuSnapshot[]> {
  console.log(`Fetching latest stats for mode: ${mode}`);
  
  // DISTINCT ON は Supabase では直接サポートされていないため、
  // 各ユーザーの最新レコードを取得する別のアプローチを使用
  const { data, error } = await supabase.rpc('get_latest_user_stats', { 
    game_mode: mode 
  });

  if (error) {
    console.error('Supabase RPC error:', error);
    // RPC関数が存在しない場合は、通常のクエリで代替
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('osu_user_snapshots')
      .select('*')
      .eq('mode', mode)
      .order('captured_at', { ascending: false });
    
    if (fallbackError) {
      throw new Error(`Failed to fetch latest stats: ${fallbackError.message}`);
    }

    // 手動でユーザーごとの最新レコードを取得
    const latestByUser = new Map();
    fallbackData?.forEach(record => {
      const key = record.osu_user_id;
      if (!latestByUser.has(key)) {
        latestByUser.set(key, record);
      }
    });

    return Array.from(latestByUser.values());
  }

  return data || [];
}

export async function getUserSnapshots(osuUserId: number, mode: string, limit: number = 50): Promise<OsuSnapshot[]> {
  console.log(`Fetching user snapshots for ${osuUserId} in ${mode} mode`);
  const { data, error } = await supabase
    .from('osu_user_snapshots')
    .select('*')
    .eq('osu_user_id', osuUserId)
    .eq('mode', mode)
    .order('captured_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch user snapshots: ${error.message}`);
  }

  return data || [];
}

export async function getLatestUserStats(osuUserId: number, mode: string): Promise<OsuSnapshot | null> {
  console.log(`Fetching latest stats for user ${osuUserId} in ${mode} mode`);
  const { data, error } = await supabase
    .from('osu_user_snapshots')
    .select('*')
    .eq('osu_user_id', osuUserId)
    .eq('mode', mode)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to fetch latest user stats: ${error.message}`);
  }

  return data;
}

export async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('osu_tracked_users')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }

    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error);
    return false;
  }
}

// 増加率の型定義
export interface GrowthRate {
  osu_user_id: number;
  mode: string;
  pp_per_hour: number;
  rank_change_per_hour: number;
  score_per_hour: number;
  plays_per_hour: number;
  confidence: number;
  data_points: number;
  last_calculated_at: string;
  updated_at: string;
}

// 増加率を取得
export async function getGrowthRate(osuUserId: number, mode: string): Promise<GrowthRate | null> {
  console.log(`Fetching growth rate for user ${osuUserId} in ${mode} mode`);
  const { data, error } = await supabase
    .from('osu_growth_rates')
    .select('*')
    .eq('osu_user_id', osuUserId)
    .eq('mode', mode)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to fetch growth rate:', error);
    return null;
  }

  return data;
}

// 増加率を保存/更新
export async function saveGrowthRate(growthRate: Omit<GrowthRate, 'last_calculated_at' | 'updated_at'>): Promise<boolean> {
  console.log(`Saving growth rate for user ${growthRate.osu_user_id} in ${growthRate.mode} mode`);
  const { error } = await supabase
    .from('osu_growth_rates')
    .upsert({
      osu_user_id: growthRate.osu_user_id,
      mode: growthRate.mode,
      pp_per_hour: growthRate.pp_per_hour,
      rank_change_per_hour: growthRate.rank_change_per_hour,
      score_per_hour: growthRate.score_per_hour,
      plays_per_hour: growthRate.plays_per_hour,
      confidence: growthRate.confidence,
      data_points: growthRate.data_points,
      last_calculated_at: new Date().toISOString()
    }, {
      onConflict: 'osu_user_id,mode'
    });

  if (error) {
    console.error('Failed to save growth rate:', error);
    return false;
  }

  return true;
}