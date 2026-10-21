import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient = null;
let isConnected = false;
const fallbackMemoryCache = new Map();
const fallbackTimeouts = new Map();

export const connectRedis = () => {
  const redisUrl =
    process.env.REDIS_URL ||
    `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`;

  const redisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 5000,
    retryStrategy: (times) => {
      if (times > 5) {
        return null; // Stop reconnecting after retries in offline dev
      }
      return Math.min(times * 1000, 3000);
    },
  };

  if (redisUrl.startsWith('rediss://')) {
    redisOptions.tls = { rejectUnauthorized: false };
  }

  try {
    redisClient = new Redis(redisUrl, redisOptions);

    redisClient.on('connect', () => {
      isConnected = true;
      console.log(`[Cache] Redis connected successfully: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Do not crash the application if Redis is offline
      // console.warn(`[Cache] Redis connection notice: ${err.message}`);
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    redisClient.connect().catch(() => {
      // Handled by event listener
    });

    return redisClient;
  } catch (err) {
    console.warn(`[Cache] Redis client creation notice: ${err.message}. Using in-memory cache.`);
    isConnected = false;
    return null;
  }
};

export const getCache = async (key) => {
  try {
    if (isConnected && redisClient) {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    }
  } catch {
    // Fall back to memory
  }

  const memoryItem = fallbackMemoryCache.get(key);
  if (memoryItem !== undefined) {
    return memoryItem;
  }
  return null;
};

export const setCache = async (key, value, ttlSeconds = 60) => {
  try {
    if (isConnected && redisClient) {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    }
  } catch {
    // Fall back to memory
  }

  // Fallback memory cache
  fallbackMemoryCache.set(key, value);
  if (fallbackTimeouts.has(key)) {
    clearTimeout(fallbackTimeouts.get(key));
  }
  if (ttlSeconds > 0) {
    const timer = setTimeout(() => {
      fallbackMemoryCache.delete(key);
      fallbackTimeouts.delete(key);
    }, ttlSeconds * 1000);
    fallbackTimeouts.set(key, timer);
  }
  return true;
};

export const delCache = async (key) => {
  try {
    if (isConnected && redisClient) {
      await redisClient.del(key);
    }
  } catch {
    // Fall back
  }
  fallbackMemoryCache.delete(key);
  if (fallbackTimeouts.has(key)) {
    clearTimeout(fallbackTimeouts.get(key));
    fallbackTimeouts.delete(key);
  }
  return true;
};

export const delCacheByPattern = async (pattern) => {
  try {
    if (isConnected && redisClient) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    }
  } catch {
    // Ignore
  }

  // Clear matching keys from memory fallback
  const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
  for (const key of fallbackMemoryCache.keys()) {
    if (regex.test(key)) {
      fallbackMemoryCache.delete(key);
      if (fallbackTimeouts.has(key)) {
        clearTimeout(fallbackTimeouts.get(key));
        fallbackTimeouts.delete(key);
      }
    }
  }
  return true;
};

export const disconnectRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // Ignore
    }
    redisClient = null;
    isConnected = false;
  }
};

export const getRedisState = () => ({
  ready: isConnected,
  statusText: isConnected ? 'Connected (Redis Engine)' : 'Fallback (In-Memory Cache)',
});
