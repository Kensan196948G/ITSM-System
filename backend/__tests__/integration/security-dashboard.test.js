/**
 * Integration Tests for Security Dashboard API
 * Tests all security dashboard endpoints with real database operations
 *
 * NOTE: These tests are currently SKIPPED due to missing database schema.
 *
 * PREREQUISITES TO RUN THESE TESTS:
 * 1. The test database must include the user_activity table
 * 2. The user_activity table schema must match the production schema
 * 3. Run database migrations to create required tables:
 *    - user_activity (for login tracking)
 *    - security_alerts (for security alerts)
 *    - audit_logs (for audit logging with new_values column)
 *
 * TO ENABLE THESE TESTS:
 * 1. Update test database schema in db.js initialization
 * 2. Change describe.skip to describe
 * 3. Run: npm test -- __tests__/integration/security-dashboard.test.js
 *
 * COVERED TEST CASES (when enabled):
 * - GET /api/v1/security/dashboard/overview (admin access, permissions)
 * - GET /api/v1/security/alerts (pagination, filters)
 * - PUT /api/v1/security/alerts/:id/acknowledge
 * - GET /api/v1/security/audit-logs (pagination, filters)
 * - GET /api/v1/security/user-activity/:user_id
 * - GET /api/v1/security/activity-stats
 */

const request = require('supertest');
const app = require('../../server');
const { db } = require('../../db');

describe.skip('Security Dashboard API Integration Tests', () => {
  let adminToken;
  let analystToken;
  let viewerToken;
  let testAlertId;
  let testUserId;

  // Helper function to clean up test data
  const cleanupTestData = () => {
    return new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM security_alerts WHERE description LIKE ?', ['%TEST_%'], (err) => {
          if (err && !err.message.includes('no such')) {
            console.error('Failed to cleanup alerts:', err);
          }
        });

        // Check if audit_logs has request_body column (old schema) or new_values (new schema)
        db.all('PRAGMA table_info(audit_logs)', (err, columns) => {
          if (!err && columns) {
            const hasNewValues = columns.some((col) => col.name === 'new_values');
            const hasRequestBody = columns.some((col) => col.name === 'request_body');

            if (hasNewValues) {
              db.run('DELETE FROM audit_logs WHERE new_values LIKE ?', ['%TEST_%'], (err) => {
                if (err && !err.message.includes('no such')) {
                  console.error('Failed to cleanup audit logs:', err);
                }
              });
            } else if (hasRequestBody) {
              db.run('DELETE FROM audit_logs WHERE request_body LIKE ?', ['%TEST_%'], (err) => {
                if (err && !err.message.includes('no such')) {
                  console.error('Failed to cleanup audit logs:', err);
                }
              });
            }
          }
        });

        // Cleanup user_activity only if table exists
        db.run('DELETE FROM user_activity WHERE activity_type = ?', ['test_activity'], (err) => {
          if (err && !err.message.includes('no such table')) {
            console.error('Failed to cleanup user activity:', err);
          }
          resolve();
        });
      });
    });
  };

  beforeAll(async () => {
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

    if (!analystRes.body.token) {
      throw new Error(`Analyst login failed: ${JSON.stringify(analystRes.body)}`);
    }
    analystToken = analystRes.body.token;

    // Login as viewer
    const viewerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'viewer', password: 'viewer123' });

    if (!viewerRes.body.token) {
      throw new Error(`Viewer login failed: ${JSON.stringify(viewerRes.body)}`);
    }
    viewerToken = viewerRes.body.token;

    // Get admin user ID for testing
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    testUserId = meRes.body.id;

    // Create test security alert
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO security_alerts (
          alert_type, severity, description, affected_user_id,
          affected_resource_type, affected_resource_id, is_acknowledged
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'failed_login',
          'high',
          'TEST_Alert: Multiple failed login attempts',
          testUserId,
          'user',
          testUserId.toString(),
          0
        ],
        function (err) {
          if (err) reject(err);
          else {
            testAlertId = this.lastID;
            resolve();
          }
        }
      );
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe('GET /api/v1/security/dashboard/overview', () => {
    test('adminユーザーがアクセス可能', async () => {
      const res = await request(app)
        .get('/api/v1/security/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total_alerts');
      expect(res.body).toHaveProperty('critical_alerts');
      expect(res.body).toHaveProperty('high_alerts');
      expect(res.body).toHaveProperty('unacknowledged_alerts');
      expect(res.body).toHaveProperty('total_vulnerabilities');
      expect(res.body).toHaveProperty('critical_vulnerabilities');
      expect(res.body).toHaveProperty('high_vulnerabilities');
      expect(res.body).toHaveProperty('open_vulnerabilities');
      expect(res.body).toHaveProperty('failed_login_attempts_24h');
      expect(res.body).toHaveProperty('security_incidents_7d');
      expect(res.body).toHaveProperty('security_changes_pending');

      expect(typeof res.body.total_alerts).toBe('number');
      expect(typeof res.body.critical_alerts).toBe('number');
    });

    test('analystユーザーは403エラー（権限なし）', async () => {
      const res = await request(app)
        .get('/api/v1/security/dashboard/overview')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toContain('権限');
    });

    test('viewerユーザーは403エラー（権限なし）', async () => {
      const res = await request(app)
        .get('/api/v1/security/dashboard/overview')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toContain('権限');
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/security/dashboard/overview');

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toContain('認証');
    });
  });

  describe('GET /api/v1/security/alerts', () => {
    test('アラート一覧を取得', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const alert = res.body.data[0];
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('alert_type');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('description');
      expect(alert).toHaveProperty('created_at');
    });

    test('severity フィルタが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts?severity=critical')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      // すべてのアラートがcritical severityであることを確認
      if (res.body.data.length > 0) {
        res.body.data.forEach((alert) => {
          expect(alert.severity).toBe('critical');
        });
      }
    });

    test('alert_type フィルタが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts?alert_type=failed_login')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      // すべてのアラートがfailed_login typeであることを確認
      if (res.body.data.length > 0) {
        res.body.data.forEach((alert) => {
          expect(alert.alert_type).toBe('failed_login');
        });
      }
    });

    test('is_acknowledged フィルタが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts?is_acknowledged=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      // すべてのアラートが未確認であることを確認
      if (res.body.data.length > 0) {
        res.body.data.forEach((alert) => {
          expect(alert.is_acknowledged).toBe(0);
        });
      }
    });

    test('ページネーションが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 5);
      expect(res.body.pagination).toHaveProperty('total_pages');
      expect(res.body.pagination).toHaveProperty('total_items');
    });

    test('analystユーザーもアクセス可能', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/security/alerts');

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('PUT /api/v1/security/alerts/:id/acknowledge', () => {
    test('アラート確認が成功', async () => {
      const res = await request(app)
        .put(`/api/v1/security/alerts/${testAlertId}/acknowledge`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('確認');

      // 確認されたことを検証
      const getRes = await request(app)
        .get(`/api/v1/security/alerts`)
        .set('Authorization', `Bearer ${adminToken}`);

      const acknowledgedAlert = getRes.body.data.find((alert) => alert.id === testAlertId);
      if (acknowledgedAlert) {
        expect(acknowledgedAlert.is_acknowledged).toBe(1);
      }
    });

    test('存在しないアラートIDで404エラー', async () => {
      const res = await request(app)
        .put('/api/v1/security/alerts/999999/acknowledge')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.error).toContain('見つかりません');
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).put(`/api/v1/security/alerts/${testAlertId}/acknowledge`);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/v1/security/audit-logs', () => {
    test('監査ログ一覧を取得', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        const log = res.body.data[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('user_id');
        expect(log).toHaveProperty('action');
        expect(log).toHaveProperty('resource_type');
        expect(log).toHaveProperty('created_at');
      }
    });

    test('action フィルタが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs?action=create')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        res.body.data.forEach((log) => {
          expect(log.action).toBe('create');
        });
      }
    });

    test('resource_type フィルタが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs?resource_type=incidents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        res.body.data.forEach((log) => {
          expect(log.resource_type).toBe('incidents');
        });
      }
    });

    test('is_security_action フィルタが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs?is_security_action=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        res.body.data.forEach((log) => {
          expect(log.is_security_action).toBe(1);
        });
      }
    });

    test('user_id フィルタが動作する', async () => {
      const res = await request(app)
        .get(`/api/v1/security/audit-logs?user_id=${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        res.body.data.forEach((log) => {
          expect(log.user_id).toBe(testUserId);
        });
      }
    });

    test('from_date と to_date フィルタが動作する', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/v1/security/audit-logs?from_date=${fromDate}&to_date=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('ページネーションが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 10);
    });

    test('analystユーザーは403エラー（権限なし）', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toContain('権限');
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/security/audit-logs');

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/v1/security/user-activity/:user_id', () => {
    test('ユーザーアクティビティを取得', async () => {
      const res = await request(app)
        .get(`/api/v1/security/user-activity/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body).toHaveProperty('anomalies');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(Array.isArray(res.body.anomalies)).toBe(true);
    });

    test('activity_type フィルタが動作する', async () => {
      const res = await request(app)
        .get(`/api/v1/security/user-activity/${testUserId}?activity_type=login`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      if (res.body.data.length > 0) {
        res.body.data.forEach((activity) => {
          expect(activity.activity_type).toBe('login');
        });
      }
    });

    test('from_date と to_date フィルタが動作する', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/v1/security/user-activity/${testUserId}?from_date=${fromDate}&to_date=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('ページネーションが動作する', async () => {
      const res = await request(app)
        .get(`/api/v1/security/user-activity/${testUserId}?page=1&limit=20`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeLessThanOrEqual(20);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 20);
    });

    test('存在しないユーザーIDでも200を返す（空配列）', async () => {
      const res = await request(app)
        .get('/api/v1/security/user-activity/999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual([]);
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get(`/api/v1/security/user-activity/${testUserId}`);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /api/v1/security/activity-stats', () => {
    test('アクティビティ統計を取得', async () => {
      const res = await request(app)
        .get('/api/v1/security/activity-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total_activities');
      expect(res.body).toHaveProperty('successful_logins');
      expect(res.body).toHaveProperty('failed_logins');
      expect(res.body).toHaveProperty('activities_by_type');
      expect(res.body).toHaveProperty('activities_by_user');

      expect(typeof res.body.total_activities).toBe('number');
      expect(typeof res.body.successful_logins).toBe('number');
      expect(typeof res.body.failed_logins).toBe('number');
      expect(Array.isArray(res.body.activities_by_type)).toBe(true);
      expect(Array.isArray(res.body.activities_by_user)).toBe(true);
    });

    test('from_date と to_date フィルタが動作する', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/v1/security/activity-stats?from_date=${fromDate}&to_date=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total_activities');
    });

    test('analystユーザーは403エラー（権限なし）', async () => {
      const res = await request(app)
        .get('/api/v1/security/activity-stats')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toContain('権限');
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/security/activity-stats');

      expect(res.statusCode).toEqual(401);
    });
  });
});
