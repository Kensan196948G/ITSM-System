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
const { db } = require('../../db');

describe('Audit Logs API Integration Tests', () => {
  let adminToken;
  let analystToken;
  let viewerToken;
  let testAuditLogId;

  // Helper function to create test audit log entries
  const createTestAuditLog = (data) =>
    new Promise((resolve, reject) => {
      const sql = `INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id,
        old_values, new_values, ip_address, user_agent, is_security_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      db.run(
        sql,
        [
          data.user_id || 1,
          data.action || 'create',
          data.resource_type || 'test_resource',
          data.resource_id || 'TEST-001',
          data.old_values || null,
          data.new_values || JSON.stringify({ test: 'TEST_DATA' }),
          data.ip_address || '127.0.0.1',
          data.user_agent || 'Jest Test Agent',
          data.is_security_action || 0
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

  // Cleanup test data
  const cleanupTestData = () =>
    new Promise((resolve) => {
      db.run('DELETE FROM audit_logs WHERE resource_type = ?', ['test_resource'], () => {
        resolve();
      });
    });

  beforeAll(async () => {
    // Wait for database initialization
    await dbReady;

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

    // Create multiple test audit logs
    testAuditLogId = await createTestAuditLog({
      action: 'create',
      resource_type: 'test_resource',
      resource_id: 'TEST-001',
      new_values: JSON.stringify({ title: 'Test Item', status: 'new' })
    });

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

    await createTestAuditLog({
      action: 'delete',
      resource_type: 'test_resource',
      resource_id: 'TEST-003',
      old_values: JSON.stringify({ title: 'Deleted Item', status: 'archived' }),
      is_security_action: 1
    });
  });

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
    // Get count before
    const beforeCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) as count FROM audit_logs WHERE resource_type = 'incidents'",
        (err, row) => {
          resolve(row ? row.count : 0);
        }
      );
    });

    // Create an incident
    await request(app).post('/api/v1/incidents').set('Authorization', `Bearer ${adminToken}`).send({
      title: 'Audit Test Incident',
      priority: 'Medium',
      status: 'New',
      description: 'Test incident for audit logging'
    });

    // Wait a bit for async audit log write (increased for CI environments)
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    // Get count after
    const afterCount = await new Promise((resolve) => {
      db.get(
        "SELECT COUNT(*) as count FROM audit_logs WHERE resource_type = 'incidents'",
        (err, row) => {
          resolve(row ? row.count : 0);
        }
      );
    });

    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it('should mask sensitive data in audit logs', async () => {
    // Find the last audit log for auth
    const log = await new Promise((resolve) => {
      db.get(
        "SELECT new_values FROM audit_logs WHERE resource_type = 'auth' ORDER BY id DESC LIMIT 1",
        (err, row) => {
          resolve(row);
        }
      );
    });

    if (log && log.new_values) {
      const values = JSON.parse(log.new_values);
      // Password should be redacted
      if (values.password) {
        expect(values.password).toBe('[REDACTED]');
      }
    }
  });
});
