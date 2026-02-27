/**
 * Integration Tests for Audit Logs API
 * Tests the enhanced audit log endpoints with real database operations
 *
 * COVERED TEST CASES:
 * - GET /api/v1/audit-logs (list with pagination and filters)
 * - GET /api/v1/audit-logs/:id (detail with diff information)
 * - GET /api/v1/audit-logs/stats (statistics)
 * - GET /api/v1/audit-logs/export (CSV export)
 * - Authorization checks for admin/manager only
 */

const request = require('supertest');
const { app, dbReady } = require('../../server');
const knex = require('../../knex');

describe('Audit Logs API Integration Tests', () => {
  let adminToken;
  let analystToken;
  let viewerToken;
  let testAuditLogId;

  // Helper function to create test audit log entries (using knex for better concurrency)
  const createTestAuditLog = async (data) => {
    const [id] = await knex('audit_logs').insert({
      user_id: data.user_id || 1,
      action: data.action || 'create',
      resource_type: data.resource_type || 'test_resource',
      resource_id: data.resource_id || 'TEST-001',
      old_values: data.old_values || null,
      new_values: data.new_values || JSON.stringify({ test: 'TEST_DATA' }),
      ip_address: data.ip_address || '127.0.0.1',
      user_agent: data.user_agent || 'Jest Test Agent',
      is_security_action: data.is_security_action || 0
    });
    return id;
  };

  // Cleanup test data (using knex for better concurrency)
  const cleanupTestData = async () => {
    await knex('audit_logs').where('resource_type', 'test_resource').del();
  };

  beforeAll(async () => {
    // Wait for database initialization
    await dbReady;

    // Add a small delay to ensure WAL checkpoint completes
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Login as admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    if (!adminRes.body.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminRes.body)}`);
    }
    adminToken = adminRes.body.token;

    // Login as analyst
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });

    analystToken = analystRes.body.token;

    // Login as viewer
    const viewerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'viewer', password: 'viewer123' });

    viewerToken = viewerRes.body.token;

    // Create test data
    await cleanupTestData();

    // Add a longer delay after cleanup before creating test data (WAL checkpoint)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create multiple test audit logs one by one with delays to avoid SQLITE_BUSY
    testAuditLogId = await createTestAuditLog({
      action: 'create',
      resource_type: 'test_resource',
      resource_id: 'TEST-001',
      new_values: JSON.stringify({ title: 'Test Item', status: 'new' })
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await createTestAuditLog({
      action: 'update',
      resource_type: 'test_resource',
      resource_id: 'TEST-002',
      old_values: JSON.stringify({
        previousValues: { status: 'new' },
        diff: {
          changed: { status: { from: 'new', to: 'active' } }
        }
      }),
      new_values: JSON.stringify({ status: 'active' })
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await createTestAuditLog({
      action: 'delete',
      resource_type: 'test_resource',
      resource_id: 'TEST-003',
      old_values: JSON.stringify({ title: 'Deleted Item', status: 'archived' }),
      is_security_action: 1
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }, 90000);

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('GET /api/v1/audit-logs', () => {
    it('should return audit logs list for admin', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 2);
    });

    it('should filter by action type', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?action=create&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((log) => {
        expect(log.action).toBe('create');
      });
    });

    it('should filter by security actions only', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?security_only=true&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.data.forEach((log) => {
        expect(log.is_security_action).toBe(1);
      });
    });

    it('should filter by resource type', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((log) => {
        expect(log.resource_type).toContain('test_resource');
      });
    });

    it('should filter by user_id', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?user_id=1&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((log) => {
        expect(log.user_id).toBe(1);
      });
    });

    it('should filter by username search', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?user=admin&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by resource_id', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?resource_id=TEST-001&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((log) => {
        expect(log.resource_id).toBe('TEST-001');
      });
    });

    it('should filter by from_date', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?from_date=2026-01-01&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by to_date', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?to_date=2099-12-31&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter by ip_address', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs?ip_address=127.0.0.1&resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((log) => {
        expect(log.ip_address).toContain('127.0.0.1');
      });
    });

    it('should deny access to viewer role', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny access without authentication', async () => {
      const response = await request(app).get('/api/v1/audit-logs');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/audit-logs/:id', () => {
    it('should return audit log detail for admin', async () => {
      const response = await request(app)
        .get(`/api/v1/audit-logs/${testAuditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testAuditLogId);
      expect(response.body).toHaveProperty('action');
      expect(response.body).toHaveProperty('resource_type');
    });

    it('should include parsed JSON fields', async () => {
      const response = await request(app)
        .get(`/api/v1/audit-logs/${testAuditLogId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // new_values should be parsed as object
      if (response.body.new_values) {
        expect(typeof response.body.new_values).toBe('object');
      }
    });

    it('should return 404 for non-existent log', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should deny access to viewer role', async () => {
      const response = await request(app)
        .get(`/api/v1/audit-logs/${testAuditLogId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/audit-logs/stats', () => {
    it('should return statistics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('total_logs');
      expect(response.body).toHaveProperty('security_actions');
      expect(response.body).toHaveProperty('actions_by_type');
      expect(response.body).toHaveProperty('actions_by_resource');
    });

    it('should support different periods', async () => {
      const periods = ['day', 'week', 'month'];

      // Test each period sequentially
      const responses = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const period of periods) {
        // eslint-disable-next-line no-await-in-loop
        const response = await request(app)
          .get(`/api/v1/audit-logs/stats?period=${period}`)
          .set('Authorization', `Bearer ${adminToken}`);
        responses.push({ period, response });
      }

      responses.forEach(({ period, response }) => {
        expect(response.status).toBe(200);
        expect(response.body.period).toBe(period);
      });
    });

    it('should deny access to viewer role', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/stats')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(403);
    });

    it('should reject invalid period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/stats?period=invalid_value')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'INVALID_PERIOD');
    });

    it('should reject potentially dangerous period values', async () => {
      const dangerousValues = ['1; DROP TABLE audit_logs;--', "' OR '1'='1", '../etc/passwd'];
      for (const val of dangerousValues) {
        const response = await request(app)
          .get(`/api/v1/audit-logs/stats?period=${encodeURIComponent(val)}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('INVALID_PERIOD');
      }
    });

    it('should return all required stats fields', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/stats?period=day')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total_logs');
      expect(response.body).toHaveProperty('security_actions');
      expect(response.body).toHaveProperty('actions_by_type');
      expect(response.body).toHaveProperty('actions_by_resource');
      expect(response.body).toHaveProperty('top_users');
      expect(response.body).toHaveProperty('activity_timeline');
      expect(response.body).toHaveProperty('top_ips');
    });
  });

  describe('GET /api/v1/audit-logs/export', () => {
    it('should return CSV for admin', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
    });

    it('should include CSV headers', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toContain('ID');
      expect(csvContent).toContain('Timestamp');
      expect(csvContent).toContain('User');
      expect(csvContent).toContain('Action');
    });

    it('should support date range filter', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(app)
        .get(`/api/v1/audit-logs/export?from_date=${today}&to_date=${today}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should filter by action in export', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export?action=create')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should filter by resource_type in export', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export?resource_type=test_resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should filter by security_only in export', async () => {
      const response = await request(app)
        .get('/api/v1/audit-logs/export?security_only=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should deny access to non-admin users', async () => {
      // Analyst should not have access to export
      const analystResponse = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(analystResponse.status).toBe(403);

      // Viewer should not have access
      const viewerResponse = await request(app)
        .get('/api/v1/audit-logs/export')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(viewerResponse.status).toBe(403);
    });
  });
});

describe('Audit Log Middleware Integration Tests', () => {
  let adminToken;

  beforeAll(async () => {
    await dbReady;

    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    adminToken = adminRes.body.token;
  });

  it('should record audit log for POST request', async () => {
    // Get count before (using knex for better concurrency)
    const beforeResult = await knex('audit_logs')
      .where('resource_type', 'incidents')
      .count('* as count')
      .first();
    const beforeCount = beforeResult ? beforeResult.count : 0;

    // Create an incident
    await request(app).post('/api/v1/incidents').set('Authorization', `Bearer ${adminToken}`).send({
      title: 'Audit Test Incident',
      priority: 'Medium',
      status: 'New',
      description: 'Test incident for audit logging'
    });

    // Poll for audit log creation with retries (CI environments may be slower)
    let afterCount = beforeCount;
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const afterResult = await knex('audit_logs')
        .where('resource_type', 'incidents')
        .count('* as count')
        .first();
      afterCount = afterResult ? afterResult.count : 0;
      if (afterCount > beforeCount) break;
    }

    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it('should mask sensitive data in audit logs', async () => {
    // Find the last audit log for auth (using knex)
    const log = await knex('audit_logs')
      .select('new_values')
      .where('resource_type', 'auth')
      .orderBy('id', 'desc')
      .first();

    if (log && log.new_values) {
      const values = JSON.parse(log.new_values);
      // Password should be redacted
      if (values.password) {
        expect(values.password).toBe('[REDACTED]');
      }
    }
  });
});
