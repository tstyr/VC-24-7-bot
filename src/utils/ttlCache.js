/**
 * Small bounded TTL cache with in-flight request deduplication.
 *
 * This is intentionally dependency-free: the bot runs on a small Koyeb
 * instance and only needs short-lived process-local caching.
 */
export class TtlCache {
  constructor({ ttlMs, maxEntries = 1000 } = {}) {
    this.ttlMs = Math.max(0, Number(ttlMs) || 0);
    this.maxEntries = Math.max(1, Math.trunc(Number(maxEntries) || 1000));
    this.entries = new Map();
    this.pending = new Map();
  }

  read(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return { hit: false, value: undefined };
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return { hit: false, value: undefined };
    }

    // Touch the entry so the Map insertion order acts as a simple LRU.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return { hit: true, value: entry.value };
  }

  get(key) {
    return this.read(key).value;
  }

  set(key, value) {
    if (this.ttlMs <= 0) {
      return value;
    }

    this.entries.delete(key);
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }

    return value;
  }

  delete(key) {
    this.entries.delete(key);
    this.pending.delete(key);
  }

  clear() {
    this.entries.clear();
    this.pending.clear();
  }

  async getOrLoad(key, loader) {
    const cached = this.read(key);
    if (cached.hit) {
      return cached.value;
    }

    const inFlight = this.pending.get(key);
    if (inFlight) {
      return inFlight;
    }

    const promise = Promise.resolve()
      .then(loader)
      .then(value => this.set(key, value))
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }
}
