const { createCache } = require('cache-manager')

/**
 * Cache wrapper that adds keys() functionality for cache-manager v7
 * since the underlying cache-manager doesn't expose keys() directly
 */
class CacheWrapper {
  constructor (cache) {
    this.cache = cache
    this.trackedKeys = new Set()
  }

  async get (key) {
    return this.cache.get(key)
  }

  async set (key, value, ttl) {
    this.trackedKeys.add(key)
    return this.cache.set(key, value, ttl)
  }

  async del (key) {
    this.trackedKeys.delete(key)
    return this.cache.del(key)
  }

  async keys () {
    // Filter out keys that may have been expired or deleted
    const validKeys = []
    for (const key of this.trackedKeys) {
      const value = await this.cache.get(key)
      if (value !== undefined && value !== null) {
        validKeys.push(key)
      } else {
        this.trackedKeys.delete(key)
      }
    }
    return validKeys
  }

  async clear () {
    this.trackedKeys.clear()
    return this.cache.clear()
  }
}

class Cache {
  constructor () {
    let cache = null

    switch (process.env.CACHE_STORAGE) {
      case 'redis': {
        const { Keyv } = require('keyv')
        const KeyvRedis = require('@keyv/redis')
        const redisUri = `redis://${process.env.CACHE_REDIS_HOST || 'localhost'}:${process.env.CACHE_REDIS_PORT || 6379}${process.env.CACHE_REDIS_DB ? `/${process.env.CACHE_REDIS_DB}` : ''}`
        const keyvRedis = new KeyvRedis(redisUri, {
          password: process.env.CACHE_REDIS_PASSWORD
        })
        const keyv = new Keyv({ store: keyvRedis, ttl: (process.env.CACHE_TTL || 600) * 1000 })
        cache = createCache({ stores: [keyv] })
        break
      }
      case 'memory':
      default: {
        // cache-manager v7 uses memory store by default when no stores provided
        cache = createCache({
          ttl: (process.env.CACHE_TTL || 600) * 1000
        })
        break
      }
    }
    return new CacheWrapper(cache)
  }
}

module.exports = Cache
