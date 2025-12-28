/**
 * Cache Middleware Unit Tests
 * Phase C-3: キャッシュ機能テスト
 */

const {
  generateCacheKey,
  getTTL,
  cache,
  clearAllCache,
  getCacheStats,
  CACHE_ENABLED
} = require('../../middleware/cache');

describe('Cache Middleware', () => {
  beforeEach(() => {
    clearAllCache();
  });

  describe('generateCacheKey', () => {
    it('パスのみの場合、パスをそのまま返す', () => {
      const req = { path: '/api/v1/incidents', query: {} };
      expect(generateCacheKey(req)).toBe('/api/v1/incidents');
    });

    it('クエリパラメータをソートして含める', () => {
      const req = {
        path: '/api/v1/incidents',
        query: { page: '2', limit: '50' }
      };
      expect(generateCacheKey(req)).toBe('/api/v1/incidents?limit=50&page=2');
    });

    it('IDパスも正しく処理する', () => {
      const req = {
        path: '/api/v1/incidents/INC-123',
        query: {}
      };
      expect(generateCacheKey(req)).toBe('/api/v1/incidents/INC-123');
    });

    it('複数クエリパラメータをソート', () => {
      const req = {
        path: '/api/v1/incidents',
        query: { status: 'Open', priority: 'High', page: '1' }
      };
      expect(generateCacheKey(req)).toBe('/api/v1/incidents?page=1&priority=High&status=Open');
    });
  });

  describe('getTTL', () => {
    it('dashboard/kpi のTTLは30秒', () => {
      expect(getTTL('/api/v1/dashboard/kpi')).toBe(30);
    });

    it('incidents のTTLは60秒', () => {
      expect(getTTL('/api/v1/incidents')).toBe(60);
    });

    it('assets のTTLは300秒', () => {
      expect(getTTL('/api/v1/assets')).toBe(300);
    });

    it('knowledge-articles のTTLは600秒', () => {
      expect(getTTL('/api/v1/knowledge-articles')).toBe(600);
    });

    it('詳細パスは親パスのTTLを継承', () => {
      expect(getTTL('/api/v1/incidents/INC-123')).toBe(60);
    });

    it('未設定パスはデフォルトTTL (60秒)', () => {
      expect(getTTL('/api/v1/unknown')).toBe(60);
    });
  });

  describe('getCacheStats', () => {
    it('統計情報を返す', () => {
      const stats = getCacheStats();

      expect(stats).toHaveProperty('enabled');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('ksize');
      expect(stats).toHaveProperty('vsize');
    });

    it('キャッシュ有効状態を反映', () => {
      const stats = getCacheStats();
      expect(stats.enabled).toBe(CACHE_ENABLED);
    });

    it('初期状態ではhitRate 0%', () => {
      const stats = getCacheStats();
      expect(stats.hitRate).toBe('0%');
      expect(stats.keys).toBe(0);
    });
  });

  describe('clearAllCache', () => {
    it('全キャッシュをクリア', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.keys().length).toBe(2);

      clearAllCache();

      expect(cache.keys().length).toBe(0);
    });
  });

  describe('cache functionality', () => {
    it('TTL期限切れでキャッシュが削除される', (done) => {
      cache.set('test-key', 'test-value', 1); // 1秒TTL

      expect(cache.get('test-key')).toBe('test-value');

      setTimeout(() => {
        expect(cache.get('test-key')).toBeUndefined();
        done();
      }, 1100); // 1.1秒後に確認
    }, 2000);

    it('キャッシュHIT/MISS統計が正確', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // HIT
      cache.get('key1'); // HIT
      cache.get('key2'); // MISS

      const stats = getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.67%');
    });
  });
});
