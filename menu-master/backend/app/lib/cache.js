'use strict';

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = 300) {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async del(key) {
    this.store.delete(key);
  }

  async clearByPrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

class RedisCache {
  constructor(options) {
    const Redis = require('ioredis');
    this.client = new Redis({
      host: options.host || '127.0.0.1',
      port: Number(options.port || 6379),
      password: options.password || undefined,
      db: Number(options.db || 0),
    });
  }

  async get(key) {
    const raw = await this.client.get(key);
    return raw ? JSON.parse(raw) : null;
  }

  async set(key, value, ttlSeconds = 300) {
    const payload = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
      return;
    }
    await this.client.set(key, payload);
  }

  async del(key) {
    await this.client.del(key);
  }

  async clearByPrefix(prefix) {
    let cursor = '0';
    do {
      const [ nextCursor, keys ] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }
}

function createCache(config = {}) {
  const driver = (config.driver || 'memory').toLowerCase();

  if (driver === 'redis') {
    try {
      return new RedisCache(config.redis || {});
    } catch (err) {
      console.warn('[cache] Redis 不可用，回退内存缓存:', err.message);
      return new MemoryCache();
    }
  }

  return new MemoryCache();
}

module.exports = {
  createCache,
  MemoryCache,
};
