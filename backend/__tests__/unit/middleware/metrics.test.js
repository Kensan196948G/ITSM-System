/**
 * Metrics Middleware Tests
 * Prometheusメトリクスミドルウェアのユニットテスト
 */

const {
  register,
  metricsEndpoint,
  metricsMiddleware,
  trackDbQuery,
  trackIncident,
  updateActiveUsers,
  updateSlaCompliance,
  updateOpenIncidents,
  trackCacheHit,
  trackCacheMiss,
  updateCacheStats,
  trackCacheEviction
} = require('../../../middleware/metrics');

describe('Metrics Middleware', () => {
  describe('Helper functions - basic metrics', () => {
    it('trackDbQuery updates database query counter', async () => {
      trackDbQuery('select', 'incidents');
      trackDbQuery('insert', 'users');

      const output = await register.metrics();
      expect(output).toContain('itsm_database_queries_total');
    });

    it('trackIncident records incident with priority and security flag', async () => {
      trackIncident('High', true);
      trackIncident('Low', false);
      trackIncident(null, false); // default to 'Medium'

      const output = await register.metrics();
      expect(output).toContain('itsm_incidents_total');
    });

    it('updateActiveUsers sets gauge value', async () => {
      updateActiveUsers(5);

      const output = await register.metrics();
      expect(output).toContain('itsm_active_users_total');
    });

    it('updateSlaCompliance sets compliance rate for service', async () => {
      updateSlaCompliance('Email Service', 99.5);

      const output = await register.metrics();
      expect(output).toContain('itsm_sla_compliance_rate');
    });

    it('updateOpenIncidents sets open incidents gauge', async () => {
      updateOpenIncidents('Critical', 3);

      const output = await register.metrics();
      expect(output).toContain('itsm_incidents_open');
    });
  });

  describe('Cache metrics functions', () => {
    it('trackCacheHit increments hit counter for endpoint', async () => {
      trackCacheHit('/api/v1/incidents');

      const output = await register.metrics();
      expect(output).toContain('itsm_cache_hits_total');
    });

    it('trackCacheMiss increments miss counter for endpoint', async () => {
      trackCacheMiss('/api/v1/users');

      const output = await register.metrics();
      expect(output).toContain('itsm_cache_misses_total');
    });

    it('updateCacheStats sets all stats when all fields present', async () => {
      updateCacheStats({
        hitRateNumeric: 85.5,
        keys: 120,
        vsize: 4096
      });

      const output = await register.metrics();
      expect(output).toContain('itsm_cache_hit_rate');
      expect(output).toContain('itsm_cache_keys_total');
      expect(output).toContain('itsm_cache_memory_bytes');
    });

    it('updateCacheStats handles partial stats (only hitRateNumeric)', () => {
      // Should not throw when only hitRateNumeric is provided
      expect(() => updateCacheStats({ hitRateNumeric: 50.0 })).not.toThrow();
    });

    it('updateCacheStats handles partial stats (only keys)', () => {
      expect(() => updateCacheStats({ keys: 42 })).not.toThrow();
    });

    it('updateCacheStats handles partial stats (only vsize)', () => {
      expect(() => updateCacheStats({ vsize: 2048 })).not.toThrow();
    });

    it('updateCacheStats handles empty object (no fields)', () => {
      expect(() => updateCacheStats({})).not.toThrow();
    });

    it('trackCacheEviction increments eviction counter with default count', async () => {
      trackCacheEviction();

      const output = await register.metrics();
      expect(output).toContain('itsm_cache_evictions_total');
    });

    it('trackCacheEviction increments eviction counter with custom count', () => {
      expect(() => trackCacheEviction(5)).not.toThrow();
    });
  });

  describe('metricsMiddleware', () => {
    it('should call next() immediately', () => {
      const req = { method: 'GET', path: '/api/v1/test', route: null };
      const res = { on: jest.fn(), statusCode: 200 };
      const next = jest.fn();

      metricsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should track request on finish with route path', () => {
      const req = { method: 'GET', path: '/api/v1/incidents', route: { path: '/incidents' } };
      const res = { on: jest.fn(), statusCode: 200 };
      const next = jest.fn();

      metricsMiddleware(req, res, next);

      // Trigger the finish callback
      const finishCallback = res.on.mock.calls[0][1];
      finishCallback();

      // No error should occur
      expect(next).toHaveBeenCalled();
    });

    it('should use req.path when req.route is null', () => {
      const req = { method: 'POST', path: '/api/v1/fallback', route: null };
      const res = { on: jest.fn(), statusCode: 201 };
      const next = jest.fn();

      metricsMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls[0][1];
      finishCallback();

      expect(next).toHaveBeenCalled();
    });

    it('should track 401 as unauthorized auth error', () => {
      const req = { method: 'GET', path: '/api/v1/protected', route: null };
      const res = { on: jest.fn(), statusCode: 401 };
      const next = jest.fn();

      metricsMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls[0][1];
      expect(() => finishCallback()).not.toThrow();
    });

    it('should track 403 as forbidden auth error', () => {
      const req = { method: 'GET', path: '/api/v1/admin', route: null };
      const res = { on: jest.fn(), statusCode: 403 };
      const next = jest.fn();

      metricsMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls[0][1];
      expect(() => finishCallback()).not.toThrow();
    });

    it('should not track auth error for normal status codes', () => {
      const req = { method: 'GET', path: '/api/v1/ok', route: null };
      const res = { on: jest.fn(), statusCode: 200 };
      const next = jest.fn();

      metricsMiddleware(req, res, next);

      const finishCallback = res.on.mock.calls[0][1];
      expect(() => finishCallback()).not.toThrow();
    });
  });

  describe('metricsEndpoint', () => {
    it('returns Prometheus payload', async () => {
      const res = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await metricsEndpoint({}, res);

      expect(res.set).toHaveBeenCalledWith('Content-Type', register.contentType);
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 500 on error', async () => {
      // Create a broken register scenario
      const originalMetrics = register.metrics;
      register.metrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

      const res = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      await metricsEndpoint({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Metrics error');

      // Restore
      register.metrics = originalMetrics;
    });
  });
});
