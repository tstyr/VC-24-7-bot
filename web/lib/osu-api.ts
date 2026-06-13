let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getOsuApiToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const response = await fetch('https://osu.ppy.sh/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.OSU_CLIENT_ID,
      client_secret: process.env.OSU_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'public',
    }),
  });

  if (!response.ok) {
    throw new Error(`osu! API token request failed: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // 1分の余裕

  return accessToken;
}

export async function fetchOsuUser(userId: number | string, mode: string = 'osu') {
  const token = await getOsuApiToken();
  
  const response = await fetch(`https://osu.ppy.sh/api/v2/users/${userId}/${mode}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`osu! user fetch failed: ${response.status}`);
  }

  return response.json();
}

export interface OsuUser {
  id: number;
  username: string;
  country_code: string;
  statistics: {
    pp: number;
    global_rank: number;
    country_rank: number;
    play_count: number;
    play_time: number;
    total_score: number;
    ranked_score: number;
    accuracy: number;
    level: {
      current: number;
      progress: number;
    };
  };
  avatar_url: string;
  cover_url: string;
}

export function getModeLabel(mode: string): string {
  switch (mode) {
    case 'osu':
      return 'osu!';
    case 'taiko':
      return 'osu!taiko';
    case 'fruits':
      return 'osu!catch';
    case 'mania':
      return 'osu!mania';
    default:
      return mode;
  }
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}