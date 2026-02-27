/**
 * Unit Tests for Enhanced Audit Log Middleware
 * Tests audit logging functionality for POST/PUT/DELETE requests
 * Including sensitive data masking, diff calculation, and old values fetching
 */

// Mock knex before requiring auditLog
const mockInsert = jest.fn().mockResolvedValue([1]);
const mockWhere = jest.fn().mockReturnThis();
const mockFirst = jest.fn().mockResolvedValue(null);

const mockKnex = jest.fn((tableName) => ({
  insert: mockInsert,
  where: mockWhere,
  first: mockFirst
}));

jest.mock('../../../knex', () => mockKnex);

// Mock Winston logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../../utils/logger');
const auditLog = require('../../../middleware/auditLog');

const {
  sanitizeSensitiveData,
  calculateDiff,
  isExcludedPath,
  isSecurityAction,
  extractResourceInfo,
  methodToAction
} = auditLog;

describe('Audit Log Middleware Unit Tests', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock request
    req = {
      method: 'POST',
      path: '/api/vulnerabilities',
      body: { title: 'Test Vulnerability', severity: 'High' },
      user: { id: 1, username: 'admin' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn((header) => {
        if (header === 'user-agent') return 'Jest Test Agent';
        return null;
      })
    };

    // Setup mock response
    res = {
      send: jest.fn()
    };

    // Setup mock next function
    next = jest.fn();

    // Reset knex mocks
    mockKnex.mockClear();
    mockInsert.mockClear();
    mockWhere.mockClear();
    mockFirst.mockClear();

    // Mock knex to succeed
    mockInsert.mockResolvedValue([1]);
    mockFirst.mockResolvedValue(null);
  });

  describe('sanitizeSensitiveData', () => {
    it('should mask password fields', () => {
      const input = { username: 'user', password: 'secret123' };
      const result = sanitizeSensitiveData(input);

      expect(result.username).toBe('user');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should mask password_hash fields', () => {
      const input = { email: 'test@test.com', password_hash: 'hash123' };
      const result = sanitizeSensitiveData(input);

      expect(result.email).toBe('test@test.com');
      expect(result.password_hash).toBe('[REDACTED]');
    });

    it('should mask token fields', () => {
      const input = { user: 'test', access_token: 'token123', refresh_token: 'refresh123' };
      const result = sanitizeSensitiveData(input);

      expect(result.access_token).toBe('[REDACTED]');
      expect(result.refresh_token).toBe('[REDACTED]');
    });

    it('should mask API keys', () => {
      const input = { api_key: 'key123', apiKey: 'key456' };
      const result = sanitizeSensitiveData(input);

      expect(result.api_key).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const input = {
        user: 'test',
        credentials: {
          password: 'secret',
          api_key: 'key123'
        }
      };
      const result = sanitizeSensitiveData(input);

      expect(result.credentials.password).toBe('[REDACTED]');
      expect(result.credentials.api_key).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const input = [{ password: 'secret1' }, { password: 'secret2' }];
      const result = sanitizeSensitiveData(input);

      expect(result[0].password).toBe('[REDACTED]');
      expect(result[1].password).toBe('[REDACTED]');
    });

    it('should return null/undefined as-is', () => {
      expect(sanitizeSensitiveData(null)).toBe(null);
      expect(sanitizeSensitiveData(undefined)).toBe(undefined);
    });
  });

  describe('calculateDiff', () => {
    it('should detect changed fields', () => {
      const oldValues = { status: 'new', priority: 'High' };
      const newValues = { status: 'active', priority: 'High' };
      const diff = calculateDiff(oldValues, newValues);

      expect(diff.changed).toHaveProperty('status');
      expect(diff.changed.status.from).toBe('new');
      expect(diff.changed.status.to).toBe('active');
      expect(Object.keys(diff.added)).toHaveLength(0);
      expect(Object.keys(diff.removed)).toHaveLength(0);
    });

    it('should detect added fields', () => {
      const oldValues = { status: 'new' };
      const newValues = { status: 'new', description: 'Added description' };
      const diff = calculateDiff(oldValues, newValues);

      expect(diff.added).toHaveProperty('description', 'Added description');
    });

    it('should detect removed fields', () => {
      const oldValues = { status: 'new', notes: 'Some notes' };
      const newValues = { status: 'new' };
      const diff = calculateDiff(oldValues, newValues);

      expect(diff.removed).toHaveProperty('notes', 'Some notes');
    });

    it('should return null when no changes', () => {
      const oldValues = { status: 'new', priority: 'High' };
      const newValues = { status: 'new', priority: 'High' };
      const diff = calculateDiff(oldValues, newValues);

      expect(diff).toBeNull();
    });

    it('should return null for null inputs', () => {
      expect(calculateDiff(null, { status: 'new' })).toBeNull();
      expect(calculateDiff({ status: 'new' }, null)).toBeNull();
      expect(calculateDiff(null, null)).toBeNull();
    });
  });

  describe('isExcludedPath', () => {
    it('should exclude GET requests', () => {
      expect(isExcludedPath('/api/v1/incidents', 'GET')).toBe(true);
    });

    it('should exclude health endpoints', () => {
      expect(isExcludedPath('/health/check', 'POST')).toBe(true);
      expect(isExcludedPath('/health/live', 'POST')).toBe(true);
    });

    it('should exclude metrics endpoint', () => {
      expect(isExcludedPath('/metrics', 'POST')).toBe(true);
    });

    it('should exclude api-docs', () => {
      expect(isExcludedPath('/api-docs/swagger.json', 'POST')).toBe(true);
    });

    it('should exclude audit-logs endpoint itself', () => {
      expect(isExcludedPath('/api/v1/audit-logs', 'POST')).toBe(true);
    });

    it('should not exclude regular API endpoints', () => {
      expect(isExcludedPath('/api/v1/incidents', 'POST')).toBe(false);
      expect(isExcludedPath('/api/v1/vulnerabilities', 'PUT')).toBe(false);
    });
  });

  describe('isSecurityAction', () => {
    it('should mark vulnerability updates as security action', () => {
      expect(isSecurityAction('PUT', '/api/vulnerabilities/1', {})).toBe(true);
    });

    it('should mark incident creation as security action', () => {
      expect(isSecurityAction('POST', '/api/incidents', {})).toBe(true);
    });

    it('should mark user updates as security action', () => {
      expect(isSecurityAction('PUT', '/api/users/5', {})).toBe(true);
    });

    it('should mark user deletions as security action', () => {
      expect(isSecurityAction('DELETE', '/api/users/5', {})).toBe(true);
    });

    it('should mark security changes with is_security_change=1', () => {
      expect(isSecurityAction('POST', '/api/changes', { is_security_change: 1 })).toBe(true);
    });

    it('should not mark regular changes as security action', () => {
      expect(isSecurityAction('POST', '/api/changes', { is_security_change: 0 })).toBe(false);
    });

    it('should mark login attempts as security action', () => {
      expect(isSecurityAction('POST', '/api/v1/auth/login', {})).toBe(true);
    });
  });

  describe('extractResourceInfo', () => {
    it('should extract resource type and id from v1 path', () => {
      const result = extractResourceInfo('/api/v1/incidents/123');
      expect(result.resourceType).toBe('incidents');
      expect(result.resourceId).toBe('123');
    });

    it('should extract resource type and id from non-v1 path', () => {
      const result = extractResourceInfo('/api/vulnerabilities/CVE-2024-001');
      expect(result.resourceType).toBe('vulnerabilities');
      expect(result.resourceId).toBe('CVE-2024-001');
    });

    it('should handle path without id', () => {
      const result = extractResourceInfo('/api/v1/incidents');
      expect(result.resourceType).toBe('incidents');
      expect(result.resourceId).toBeNull();
    });

    it('should return unknown for unmatched paths', () => {
      const result = extractResourceInfo('/some/random/path');
      expect(result.resourceType).toBe('unknown');
    });
  });

  describe('methodToAction', () => {
    it('should map POST to create', () => {
      expect(methodToAction('POST')).toBe('create');
    });

    it('should map PUT to update', () => {
      expect(methodToAction('PUT')).toBe('update');
    });

    it('should map PATCH to update', () => {
      expect(methodToAction('PATCH')).toBe('update');
    });

    it('should map DELETE to delete', () => {
      expect(methodToAction('DELETE')).toBe('delete');
    });

    it('should lowercase unknown methods', () => {
      expect(methodToAction('OPTIONS')).toBe('options');
    });
  });

  describe('Middleware behavior', () => {
    // Helper function to wait for all async operations
    const waitForAsyncOps = (ms = 50) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    it('should call next() for all requests', async () => {
      req.method = 'POST';
      req.path = '/api/vulnerabilities';

      auditLog(req, res, next);

      // Wait for async promise to resolve (next is called inside .then())
      await waitForAsyncOps();

      expect(next).toHaveBeenCalled();
    });

    it('should skip GET requests', async () => {
      req.method = 'GET';
      req.path = '/api/vulnerabilities';

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();
      res.send({ success: true });

      await waitForAsyncOps();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should record POST request to database', async () => {
      req.method = 'POST';
      req.path = '/api/vulnerabilities';

      auditLog(req, res, next);

      // Wait for Promise in middleware to resolve (next is called inside .then())
      await waitForAsyncOps();

      expect(next).toHaveBeenCalled();

      // Trigger response
      res.send({ success: true });

      // Wait for async write
      await waitForAsyncOps();

      expect(mockKnex).toHaveBeenCalledWith('audit_logs');
      expect(mockInsert).toHaveBeenCalled();

      const insertCallArgs = mockInsert.mock.calls[0][0];

      expect(insertCallArgs.user_id).toBe(1);
      expect(insertCallArgs.action).toBe('create');
      expect(insertCallArgs.resource_type).toBe('vulnerabilities');
    });

    it('should handle missing user gracefully', async () => {
      req.user = null;
      req.method = 'POST';
      req.path = '/api/vulnerabilities';

      auditLog(req, res, next);

      await waitForAsyncOps();
      res.send({ success: true });
      await waitForAsyncOps();

      expect(mockInsert).toHaveBeenCalled();
      const insertCallArgs = mockInsert.mock.calls[0][0];

      expect(insertCallArgs.user_id).toBeNull(); // user_id should be null
    });

    it('should record IP address from req.ip', async () => {
      req.ip = '192.168.1.100';

      auditLog(req, res, next);

      await waitForAsyncOps();
      res.send({ success: true });
      await waitForAsyncOps();

      expect(mockInsert).toHaveBeenCalled();
      const insertCallArgs = mockInsert.mock.calls[0][0];

      expect(insertCallArgs.ip_address).toBe('192.168.1.100');
    });

    it('should mark security actions correctly', async () => {
      req.method = 'PUT';
      req.path = '/api/vulnerabilities/CVE-2024-001';

      auditLog(req, res, next);

      await waitForAsyncOps();
      res.send({ success: true });
      await waitForAsyncOps();

      expect(mockInsert).toHaveBeenCalled();
      const insertCallArgs = mockInsert.mock.calls[0][0];

      expect(insertCallArgs.is_security_action).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      mockInsert.mockRejectedValue(new Error('Database error'));

      auditLog(req, res, next);

      await waitForAsyncOps();
      res.send({ success: true });
      await waitForAsyncOps();

      expect(logger.error).toHaveBeenCalledWith(
        '[AuditLog] Failed to write audit log:',
        expect.any(Error)
      );
    });
  });
});
