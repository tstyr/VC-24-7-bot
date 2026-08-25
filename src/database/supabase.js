import { createClient } from '@supabase/supabase-js';
import { TtlCache } from '../utils/ttlCache.js';

let supabaseClient = null;
const linkedUserCache = new TtlCache({
  ttlMs: Math.max(1_000, Number(process.env.USER_LINK_CACHE_MS || 60_000)),
  maxEntries: Math.max(100, Number(process.env.USER_LINK_CACHE_MAX || 5_000))
});
const linkedUserListCache = new TtlCache({ ttlMs: 30_000, maxEntries: 1 });

function getSupabaseKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
}

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY (または SUPABASE_ANON_KEY) を設定してください');
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseClient;
}

export async function upsertUserLink(discordId, osuUsername) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('user_links')
    .upsert(
      {
        discord_id: discordId,
        osu_username: osuUsername
      },
      { onConflict: 'discord_id' }
    )
    .select('discord_id, osu_username')
    .single();

  if (error) {
    throw error;
  }

  linkedUserCache.set(String(discordId), data?.osu_username ?? osuUsername);
  linkedUserListCache.delete('all');
  return data;
}

export async function getLinkedOsuUsername(discordId) {
  const id = String(discordId || '').trim();
  if (!id) {
    throw new Error('discordId is required');
  }

  return linkedUserCache.getOrLoad(id, async () => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('user_links')
      .select('osu_username')
      .eq('discord_id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.osu_username ?? null;
  });
}

export async function listLinkedOsuUsers() {
  return linkedUserListCache.getOrLoad('all', async () => {
    const client = getSupabaseClient();
    const pageSize = 1000;
    let from = 0;
    const rows = [];

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await client
        .from('user_links')
        .select('discord_id, osu_username')
        .order('discord_id', { ascending: true })
        .range(from, to);

      if (error) {
        throw error;
      }

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      rows.push(...data);
      if (data.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return rows;
  });
}
