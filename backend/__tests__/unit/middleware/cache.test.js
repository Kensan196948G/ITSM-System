let cacheMiddleware;
let invalidateCacheMiddleware;
let invalidateCache;
let clearAllCache;
let generateCacheKey;
let getTTL;
let getCacheStats;
let cache;

describe('Cache Middleware', () => {
  const originalCacheEnabled = process.env.CACHE_ENABLED;

  beforeAll(() => {
    process.env.CACHE_ENABLED = 'true';
    jest.resetModules();
    ({
      cacheMiddleware,
      invalidateCacheMiddleware,
      invalidateCache,
      clearAllCache,
      generateCacheKey,
      getTTL,
      getCacheStats,
      cache
    } = require('../../../middleware/cache'));
  });

  afterAll(() => {
    process.env.CACHE_ENABLED = originalCacheEnabled;
  });

  beforeEach(() => {
    clearAllCache();
  });

  it('generateCacheKey sorts query params', () => {
    // 注意: generateCacheKey は originalUrl を使用する
    const req = { originalUrl: '/api/v1/incidents', query: { b: '2', a: '1' } };
    expect(generateCacheKey(req)).toBe('/api/v1/incidents?a=1&b=2');
  });

  it('getTTL returns configured values or default', () => {
    expect(getTTL('/api/v1/incidents')).toBe(60);
    expect(getTTL('/api/v1/incidents/INC-1')).toBe(60);
    expect(getTTL('/api/v1/unknown-path')).toBe(60);
  });

  it('cacheMiddleware caches GET responses and serves from cache', () => {
    // 注意: cacheMiddleware は originalUrl を使用する
    const req = { method: 'GET', originalUrl: '/api/v1/incidents', query: {} };
    const res = { statusCode: 200, json: jest.fn((payload) => payload) };
    const next = jest.fn();

    cacheMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    res.json({ ok: true });
    expect(cache.get('/api/v1/incidents')).toEqual({ ok: true });

    const resCached = { json: jest.fn() };
    const nextCached = jest.fn();
    cacheMiddleware(req, resCached, nextCached);
    expect(resCached.json).toHaveBeenCalledWith({ ok: true });
    expect(nextCached).not.toHaveBeenCalled();
  });

  it('invalidateCacheMiddleware clears matching patterns after success', () => {
    cache.set('/api/v1/incidents', { ok: true }, 60);

    const req = { method: 'POST' };
    const res = { statusCode: 201, json: jest.fn((payload) => payload) };
    const next = jest.fn();

    const middleware = invalidateCacheMiddleware('incidents');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    res.json({ ok: true });
    expect(cache.keys().length).toBe(0);
  });

  it('manual invalidation and stats access are available', () => {
    cache.set('/api/v1/incidents', { ok: true }, 60);
    invalidateCache('incidents');

    const stats = getCacheStats();
    expect(stats).toHaveProperty('enabled');
    expect(stats).toHaveProperty('keys');
  });
});
