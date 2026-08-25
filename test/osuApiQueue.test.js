import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OSU_CLIENT_ID = '1';
process.env.OSU_CLIENT_SECRET = 'test-secret';
process.env.OSU_API_CACHE_SECONDS = '0';
process.env.OSU_API_MIN_INTERVAL_MS = '0';
process.env.OSU_API_MAX_CONCURRENCY = '1';
process.env.OSU_API_MAX_RETRIES = '0';

const startedUsers = [];
let releaseFirstRequest;
let markFirstStarted;
const firstRequestStarted = new Promise(resolve => {
  markFirstStarted = resolve;
});
const firstRequestGate = new Promise(resolve => {
  releaseFirstRequest = resolve;
});

globalThis.fetch = async input => {
  const url = new URL(String(input));
  if (url.pathname === '/oauth/token') {
    return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  const user = decodeURIComponent(url.pathname.split('/')[4]);
  startedUsers.push(user);
  if (user === '1') {
    markFirstStarted();
    await firstRequestGate;
  }

  return new Response(JSON.stringify({ id: Number(user), username: `user-${user}` }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
};

const { fetchOsuUser } = await import('../src/utils/osuApi.js');

test('interactive osu requests jump ahead of queued background work', async () => {
  const backgroundOne = fetchOsuUser('1', 'osu', { priority: 'background' });
  const backgroundTwo = fetchOsuUser('2', 'osu', { priority: 'background' });
  const backgroundThree = fetchOsuUser('3', 'osu', { priority: 'background' });

  await firstRequestStarted;
  // Use the same user as queued background work. The command must be promoted
  // instead of deduplicating onto the low-priority queued request.
  const interactive = fetchOsuUser('2', 'osu');
  releaseFirstRequest();

  await Promise.all([backgroundOne, backgroundTwo, backgroundThree, interactive]);
  assert.deepEqual(startedUsers.slice(0, 4), ['1', '2', '2', '3']);
});
