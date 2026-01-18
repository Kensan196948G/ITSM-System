/**
 * API Versioning Middleware Tests
 */

const {
  extractVersion,
  normalizeVersion,
  apiVersionMiddleware,
  requireVersion,
  deprecated,
  SUPPORTED_VERSIONS,
  CURRENT_VERSION,
  DEFAULT_VERSION
} = require('../../../middleware/apiVersion');

describe('API Versioning Middleware', () => {
  describe('normalizeVersion', () => {
    it('should return null for empty input', () => {
      expect(normalizeVersion(null)).toBeNull();
      expect(normalizeVersion(undefined)).toBeNull();
      expect(normalizeVersion('')).toBeNull();
    });

    it('should handle vX format', () => {
      expect(normalizeVersion('v1')).toBe('v1');
      expect(normalizeVersion('V1')).toBe('v1');
      expect(normalizeVersion('v2')).toBe('v2');
    });

    it('should handle numeric format', () => {
      expect(normalizeVersion('1')).toBe('v1');
      expect(normalizeVersion('2')).toBe('v2');
    });

    it('should handle semver format', () => {
      expect(normalizeVersion('1.0.0')).toBe('v1');
      expect(normalizeVersion('2.5.3')).toBe('v2');
    });

    it('should return null for invalid format', () => {
      expect(normalizeVersion('abc')).toBeNull();
      expect(normalizeVersion('version1')).toBeNull();
    });
  });

  describe('extractVersion', () => {
    it('should extract version from URL path', () => {
      const req = {
        originalUrl: '/api/v1/users',
        headers: {},
        query: {}
      };
      const result = extractVersion(req);
      expect(result.version).toBe('v1');
      expect(result.source).toBe('url');
    });

    it('should extract version from X-API-Version header', () => {
      const req = {
        originalUrl: '/api/users',
        headers: { 'x-api-version': '1' },
        query: {}
      };
      const result = extractVersion(req);
      expect(result.version).toBe('v1');
      expect(result.source).toBe('header');
    });

    it('should extract version from Accept header', () => {
      const req = {
        originalUrl: '/api/users',
        headers: { accept: 'application/vnd.itsm+json;version=1' },
        query: {}
      };
      const result = extractVersion(req);
      expect(result.version).toBe('v1');
      expect(result.source).toBe('accept');
    });

    it('should extract version from query parameter', () => {
      const req = {
        originalUrl: '/api/users?api-version=1',
        headers: {},
        query: { 'api-version': '1' }
      };
      const result = extractVersion(req);
      expect(result.version).toBe('v1');
      expect(result.source).toBe('query');
    });

    it('should return default version when not specified', () => {
      const req = {
        originalUrl: '/api/users',
        headers: {},
        query: {}
      };
      const result = extractVersion(req);
      expect(result.version).toBe(DEFAULT_VERSION);
      expect(result.source).toBe('default');
    });

    it('should prioritize URL over header', () => {
      const req = {
        originalUrl: '/api/v1/users',
        headers: { 'x-api-version': '2' },
        query: {}
      };
      const result = extractVersion(req);
      expect(result.version).toBe('v1');
      expect(result.source).toBe('url');
    });
  });

  describe('apiVersionMiddleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = {
        originalUrl: '/api/v1/users',
        headers: {},
        query: {},
        method: 'GET',
        ip: '127.0.0.1'
      };
      mockRes = {
        setHeader: jest.fn()
      };
      mockNext = jest.fn();
    });

    it('should set apiVersion on request', () => {
      apiVersionMiddleware(mockReq, mockRes, mockNext);
      expect(mockReq.apiVersion).toBe('v1');
      expect(mockReq.apiVersionSource).toBe('url');
    });

    it('should set version headers on response', () => {
      apiVersionMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-API-Supported-Versions',
        SUPPORTED_VERSIONS.join(', ')
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-API-Current-Version', CURRENT_VERSION);
    });

    it('should call next()', () => {
      apiVersionMiddleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireVersion', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockReq = { apiVersion: 'v1' };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      mockNext = jest.fn();
    });

    it('should allow request if version matches', () => {
      const middleware = requireVersion('v1');
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow request if version is in array', () => {
      const middleware = requireVersion(['v1', 'v2']);
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request if version does not match', () => {
      mockReq.apiVersion = 'v2';
      const middleware = requireVersion('v1');
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'API Version Not Supported'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('deprecated', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let originalJson;

    beforeEach(() => {
      originalJson = jest.fn();
      mockReq = {};
      mockRes = {
        setHeader: jest.fn(),
        json: originalJson
      };
      mockNext = jest.fn();
    });

    it('should set Deprecation header', () => {
      const middleware = deprecated({});
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set Sunset header when provided', () => {
      const middleware = deprecated({ sunset: '2026-06-01' });
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Sunset', '2026-06-01');
    });

    it('should set Link header when alternative is provided', () => {
      const middleware = deprecated({ alternative: '/api/v2/users' });
      middleware(mockReq, mockRes, mockNext);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Link',
        '</api/v2/users>; rel="successor-version"'
      );
    });

    it('should add deprecation warning to JSON response', () => {
      const middleware = deprecated({
        sunset: '2026-06-01',
        message: 'Use v2 API'
      });
      middleware(mockReq, mockRes, mockNext);

      // Call the wrapped json method
      mockRes.json({ data: 'test' });

      expect(originalJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: 'test',
          deprecationWarning: expect.objectContaining({
            deprecated: true,
            sunset: '2026-06-01',
            message: 'Use v2 API'
          })
        })
      );
    });
  });

  describe('Constants', () => {
    it('should have v1 in supported versions', () => {
      expect(SUPPORTED_VERSIONS).toContain('v1');
    });

    it('should have v1 as current version', () => {
      expect(CURRENT_VERSION).toBe('v1');
    });

    it('should have v1 as default version', () => {
      expect(DEFAULT_VERSION).toBe('v1');
    });
  });
});
