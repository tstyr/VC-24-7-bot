import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/utils/ttlCache.js';

test('TtlCache deduplicates concurrent loads including null values', async () => {
  const cache = new TtlCache({ ttlMs: 1_000, maxEntries: 10 });
  let loads = 0;
  const loader = async () => {
    loads += 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    return null;
  };

  const [first, second] = await Promise.all([
    cache.getOrLoad('user', loader),
    cache.getOrLoad('user', loader)
  ]);
  const third = await cache.getOrLoad('user', loader);

  assert.equal(first, null);
  assert.equal(second, null);
  assert.equal(third, null);
  assert.equal(loads, 1);
});

test('TtlCache evicts the least recently used entry', () => {
  const cache = new TtlCache({ ttlMs: 1_000, maxEntries: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);

  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), 3);
});
