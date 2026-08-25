import { log } from './logger.js';

const OSU_BASE_URL = 'https://osu.ppy.sh';
const TOKEN_ENDPOINT = `${OSU_BASE_URL}/oauth/token`;

function readNumberEnv(name, fallback, minimum, { integer = false } = {}) {
  const parsed = Number(process.env[name]);
  const value = Number.isFinite(parsed) ? parsed : fallback;
  const bounded = Math.max(minimum, value);
  return integer ? Math.trunc(bounded) : bounded;
}

const OSU_API_CACHE_SECONDS = readNumberEnv('OSU_API_CACHE_SECONDS', 20, 0);
const OSU_API_CACHE_MAX_ENTRIES = readNumberEnv('OSU_API_CACHE_MAX_ENTRIES', 1000, 50, { integer: true });
const OSU_API_MIN_INTERVAL_MS = readNumberEnv('OSU_API_MIN_INTERVAL_MS', 120, 0);
const OSU_API_MAX_RETRIES = readNumberEnv('OSU_API_MAX_RETRIES', 3, 0, { integer: true });
const OSU_API_TIMEOUT_MS = readNumberEnv('OSU_API_TIMEOUT_MS', 8_000, 1_000);
const OSU_API_MAX_CONCURRENCY = readNumberEnv('OSU_API_MAX_CONCURRENCY', 2, 1, { integer: true });

let accessToken = null;
let accessTokenExpiresAt = 0;
let accessTokenRequest = null;
let lastApiRequestAt = 0;
let activeRequestCount = 0;
let requestPumpTimer = null;
const responseCache = new Map();
const inFlightResponses = new Map();
const requestQueues = {
  interactive: [],
  background: []
};

export class OsuApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'OsuApiError';
    this.status = status;
    this.details = details;
  }
}

const numberFormatter = new Intl.NumberFormat('ja-JP');
const MODE_ALIAS_MAP = {
  std: 'osu',
  standard: 'osu',
  osu: 'osu',
  mania: 'mania',
  catch: 'fruits',
  fruits: 'fruits',
  taiko: 'taiko'
};
const MODE_LABEL_MAP = {
  osu: 'std',
  mania: 'mania',
  fruits: 'catch',
  taiko: 'taiko'
};

function parseOsuClientId(rawValue) {
  const clientId = Number(rawValue);
  if (!Number.isFinite(clientId)) {
    throw new OsuApiError('OSU_CLIENT_ID が数値ではありません', 500);
  }
  return clientId;
}

function getOsuCredentials() {
  const rawClientId = process.env.OSU_CLIENT_ID;
  const clientSecret = process.env.OSU_CLIENT_SECRET;

  if (!rawClientId || !clientSecret) {
    throw new OsuApiError('OSU_CLIENT_ID と OSU_CLIENT_SECRET を設定してください', 500);
  }

  return {
    clientId: parseOsuClientId(rawClientId),
    clientSecret
  };
}

async function safeJson(response) {
  const body = await response.text();
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

function toOsuApiError(status, payload) {
  if (status === 404) {
    return new OsuApiError('指定した osu! ユーザーが見つかりませんでした', status, payload);
  }

  if (status === 429) {
    return new OsuApiError('osu! API のレート制限に達しました。時間をおいて再実行してください', status, payload);
  }

  if (status === 401 || status === 403) {
    return new OsuApiError('osu! API 認証に失敗しました。Client ID / Secret を確認してください', status, payload);
  }

  const details = payload?.error || payload?.message;
  const suffix = details ? `: ${details}` : '';
  return new OsuApiError(`osu! API エラー (${status})${suffix}`, status, payload);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function deepClone(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function sortedQueryEntries(query) {
  return Object.entries(query || {})
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b));
}

function buildCacheKey(path, query) {
  const serialized = sortedQueryEntries(query)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
  return `${path}?${serialized}`;
}

function getCachedResponse(cacheKey) {
  if (OSU_API_CACHE_SECONDS <= 0) {
    return null;
  }

  const cached = responseCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, cached);
  return deepClone(cached.payload);
}

function setCachedResponse(cacheKey, payload) {
  if (OSU_API_CACHE_SECONDS <= 0) {
    return;
  }

  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, {
    payload: deepClone(payload),
    expiresAt: Date.now() + OSU_API_CACHE_SECONDS * 1000
  });

  while (responseCache.size > OSU_API_CACHE_MAX_ENTRIES) {
    responseCache.delete(responseCache.keys().next().value);
  }
}

function shouldRetryStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function normalizePriority(priority) {
  return priority === 'background' ? 'background' : 'interactive';
}

function nextQueuedRequest() {
  return requestQueues.interactive.shift() || requestQueues.background.shift() || null;
}

function pumpRequestQueue() {
  if (requestPumpTimer || activeRequestCount >= OSU_API_MAX_CONCURRENCY) {
    return;
  }

  const hasQueuedRequest = requestQueues.interactive.length > 0 || requestQueues.background.length > 0;
  if (!hasQueuedRequest) {
    return;
  }

  const waitMs = OSU_API_MIN_INTERVAL_MS - (Date.now() - lastApiRequestAt);
  if (waitMs > 0) {
    requestPumpTimer = setTimeout(() => {
      requestPumpTimer = null;
      pumpRequestQueue();
    }, waitMs);
    requestPumpTimer.unref?.();
    return;
  }

  const queued = nextQueuedRequest();
  if (!queued) {
    return;
  }

  activeRequestCount += 1;
  lastApiRequestAt = Date.now();

  Promise.resolve()
    .then(queued.task)
    .then(queued.resolve, queued.reject)
    .finally(() => {
      activeRequestCount -= 1;
      pumpRequestQueue();
    });

  // Schedule another request after the minimum start interval when capacity
  // remains, without waiting for this network request to finish.
  pumpRequestQueue();
}

function scheduleApiRequest(task, priority = 'interactive') {
  return new Promise((resolve, reject) => {
    requestQueues[normalizePriority(priority)].push({ task, resolve, reject });
    pumpRequestQueue();
  });
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSU_API_TIMEOUT_MS);
  timeout.unref?.();

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`タイムアウト (${OSU_API_TIMEOUT_MS}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getOsuApiQueueStats() {
  return {
    active: activeRequestCount,
    interactive: requestQueues.interactive.length,
    background: requestQueues.background.length,
    cached: responseCache.size,
    inFlight: inFlightResponses.size
  };
}

export async function getOsuAccessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && accessToken && now < accessTokenExpiresAt - 60_000) {
    return accessToken;
  }

  if (accessTokenRequest) {
    return accessTokenRequest;
  }

  accessTokenRequest = (async () => {
    const { clientId, clientSecret } = getOsuCredentials();
    let response;

    try {
      response = await fetchWithTimeout(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
          scope: 'public'
        })
      });
    } catch (error) {
      throw new OsuApiError(`osu! API への接続に失敗しました: ${error.message}`, 503, error);
    }

    const payload = await safeJson(response);
    if (!response.ok || !payload?.access_token) {
      throw toOsuApiError(response.status, payload);
    }

    accessToken = payload.access_token;
    const expiresIn = Number(payload.expires_in) || 3600;
    accessTokenExpiresAt = Date.now() + expiresIn * 1000;
    log('osu! API トークンを更新しました', 'info');

    return accessToken;
  })();

  try {
    return await accessTokenRequest;
  } finally {
    accessTokenRequest = null;
  }
}

async function requestOsuGet(path, query = {}, options = {}) {
  const canRetryAuth = options.canRetryAuth !== false;
  const retryCount = Number(options.retryCount || 0);

  const token = await getOsuAccessToken();
  const url = new URL(path, OSU_BASE_URL);

  for (const [key, value] of sortedQueryEntries(query)) {
      url.searchParams.set(key, String(value));
  }

  let response;

  try {
    const request = () =>
      fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      });

    response = await scheduleApiRequest(request, options.priority);
  } catch (error) {
    throw new OsuApiError(`osu! API への接続に失敗しました: ${error.message}`, 503, error);
  }

  const payload = await safeJson(response);

  if (response.status === 401 && canRetryAuth) {
    await getOsuAccessToken(true);
    return requestOsuGet(path, query, { ...options, canRetryAuth: false });
  }

  if (!response.ok && shouldRetryStatus(response.status) && retryCount < OSU_API_MAX_RETRIES) {
    const retryAfterHeader = Number(response.headers.get('retry-after'));
    const backoffMs = Number.isFinite(retryAfterHeader)
      ? Math.max(500, retryAfterHeader * 1000)
      : Math.min(5000, 500 * (retryCount + 1));
    await sleep(backoffMs);
    return requestOsuGet(path, query, {
      ...options,
      retryCount: retryCount + 1,
      canRetryAuth: false
    });
  }

  if (!response.ok) {
    throw toOsuApiError(response.status, payload);
  }

  return payload;
}

async function osuGet(path, query = {}, options = {}) {
  const noCache = options.noCache === true;
  const cacheKey = buildCacheKey(path, query);

  if (!noCache) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Do not make a command wait for an identical request that is still queued
  // at background priority. Deduplication remains active within each priority.
  const inFlightKey = `${noCache ? 'fresh' : 'cached'}:${normalizePriority(options.priority)}:${cacheKey}`;
  const existingRequest = inFlightResponses.get(inFlightKey);
  if (existingRequest) {
    return deepClone(await existingRequest);
  }

  const request = requestOsuGet(path, query, options);
  inFlightResponses.set(inFlightKey, request);

  try {
    const payload = await request;
    if (!noCache) {
      setCachedResponse(cacheKey, payload);
    }
    return payload;
  } finally {
    if (inFlightResponses.get(inFlightKey) === request) {
      inFlightResponses.delete(inFlightKey);
    }
  }
}

async function osuGetOrNull(path, query = {}, options = {}) {
  try {
    return await osuGet(path, query, options);
  } catch (error) {
    if (error instanceof OsuApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function buildUserPath(identifier, mode = null) {
  const suffix = mode ? `/${mode}` : '';
  return `/api/v2/users/${encodeURIComponent(identifier)}${suffix}`;
}

export function normalizeOsuMode(mode = 'osu') {
  const key = String(mode || 'osu').trim().toLowerCase();
  return MODE_ALIAS_MAP[key] || 'osu';
}

export function getModeLabel(mode = 'osu') {
  const normalized = normalizeOsuMode(mode);
  return MODE_LABEL_MAP[normalized] || normalized;
}

export async function fetchOsuUser(usernameOrId, mode = null, options = {}) {
  const rawTarget = String(usernameOrId || '').trim();
  if (!rawTarget) {
    throw new OsuApiError('osu! ユーザー名を指定してください', 400);
  }

  const target = rawTarget.startsWith('@') ? rawTarget.slice(1) : rawTarget;
  if (!target) {
    throw new OsuApiError('osu! ユーザー名を指定してください', 400);
  }

  const normalizedMode = mode ? normalizeOsuMode(mode) : null;
  const isNumericId = /^\d+$/.test(target);
  const atTarget = `@${target}`;

  const attempts = [];

  if (isNumericId) {
    attempts.push({ path: buildUserPath(target, normalizedMode) });
    attempts.push({ path: buildUserPath(target, normalizedMode), query: { key: 'username' } });
  } else {
    attempts.push({ path: buildUserPath(target, normalizedMode), query: { key: 'username' } });
    attempts.push({ path: buildUserPath(atTarget, normalizedMode) });
  }

  for (const attempt of attempts) {
    const user = await osuGetOrNull(attempt.path, attempt.query || {}, options);
    if (user) {
      return user;
    }
  }

  const lookedUpUser = await osuGetOrNull('/api/v2/users/lookup', {
    key: 'username',
    username: target
  }, options);

  if (lookedUpUser?.id) {
    if (normalizedMode) {
      const userByMode = await osuGetOrNull(
        buildUserPath(String(lookedUpUser.id), normalizedMode),
        {},
        options
      );
      if (userByMode) {
        return userByMode;
      }
    }
    return lookedUpUser;
  }

  throw new OsuApiError('指定した osu! ユーザーが見つかりませんでした', 404);
}

export async function fetchRecentScores(userIdOrName, mode = 'osu', limit = 1, options = {}) {
  const target = String(userIdOrName || '').trim();
  if (!target) {
    throw new OsuApiError('osu! ユーザー名を指定してください', 400);
  }

  const normalizedMode = normalizeOsuMode(mode);
  const offset = Number(options?.offset ?? 0);

  return osuGet(`/api/v2/users/${encodeURIComponent(target)}/scores/recent`, {
    mode: normalizedMode,
    include_fails: 1,
    limit,
    offset: Number.isFinite(offset) && offset > 0 ? Math.trunc(offset) : undefined
  }, { noCache: true, priority: options?.priority });
}

export async function fetchBestScores(userIdOrName, mode = 'osu', limit = 1, options = {}) {
  const target = String(userIdOrName || '').trim();
  if (!target) {
    throw new OsuApiError('osu! ユーザー名を指定してください', 400);
  }

  const normalizedMode = normalizeOsuMode(mode);

  return osuGet(`/api/v2/users/${encodeURIComponent(target)}/scores/best`, {
    mode: normalizedMode,
    limit
  }, { noCache: true, priority: options?.priority });
}

export async function fetchBeatmap(beatmapId, options = {}) {
  const target = String(beatmapId || '').trim();
  if (!target) {
    return null;
  }

  return osuGet(`/api/v2/beatmaps/${encodeURIComponent(target)}`, {}, options);
}

export function formatNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 'N/A';
  }
  return numberFormatter.format(numericValue);
}

export function formatPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 'N/A';
  }
  return `${numericValue.toFixed(2)}%`;
}

export function formatRatioPercent(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 'N/A';
  }
  return `${(numericValue * 100).toFixed(2)}%`;
}

export function formatPlayTime(seconds, lang = 'ja') {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) {
    return 'N/A';
  }

  const unitsByLang = {
    ja: { day: '日', hour: '時間', minute: '分' },
    en: { day: 'd', hour: 'h', minute: 'm' },
    ko: { day: '일', hour: '시간', minute: '분' }
  };
  const units = unitsByLang[lang] || unitsByLang.ja;

  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}${units.day}`);
  if (hours > 0) parts.push(`${hours}${units.hour}`);
  parts.push(`${minutes}${units.minute}`);

  return parts.join(' ');
}

export function toDiscordTimestamp(dateLike) {
  if (!dateLike) {
    return 'N/A';
  }

  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'N/A';
  }

  const unix = Math.floor(timestamp / 1000);
  return `<t:${unix}:F> (<t:${unix}:R>)`;
}
