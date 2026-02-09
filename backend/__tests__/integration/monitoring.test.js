/**
 * Monitoring API Integration Tests
 * Phase 9.2: 監視・ヘルスチェック強化
 */

const request = require('supertest');
const { app, dbReady } = require('../../server');
const knex = require('../../knex');

// Mock notification services to prevent actual sending
jest.mock('../../services/notificationService', () => ({
  sendSlackNotification: jest.fn().mockResolvedValue({ success: true }),
  sendWebhookNotification: jest.fn().mockResolvedValue({ success: true }),
  testNotificationChannel: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

describe('Monitoring API Integration Tests', () => {
  let authToken;
  let managerToken;
  let analystToken;
  let viewerToken;
  let adminUserId;
  let testAlertRuleId;
  let testNotificationChannelId;

  async function createTestData() {
    // Create test alert rules
    const [ruleId1] = await knex('alert_rules').insert({
      rule_name: 'CPU High Usage',
      metric_name: 'itsm_cpu_usage_percent',
      condition: '>',
      threshold: 80,
      duration: 300,
      severity: 'warning',
      enabled: 1,
      notification_channels: JSON.stringify(['test-channel']),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    testAlertRuleId = ruleId1;

    await knex('alert_rules').insert({
      rule_name: 'Memory Critical',
      metric_name: 'itsm_memory_usage_percent',
      condition: '>',
      threshold: 90,
      duration: 60,
      severity: 'critical',
      enabled: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await knex('alert_rules').insert({
      rule_name: 'Disk Space Warning',
      metric_name: 'itsm_disk_usage_percent',
      condition: '>',
      threshold: 85,
      severity: 'warning',
      enabled: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Create test alerts
    await knex('alert_history').insert({
      rule_id: ruleId1,
      rule_name: 'CPU High Usage',
      metric_name: 'itsm_cpu_usage_percent',
      current_value: 85.5,
      threshold: 80,
      severity: 'warning',
      status: 'firing',
      message: 'CPU usage is above threshold',
      created_at: new Date().toISOString()
    });

    await knex('alert_history').insert({
      rule_id: ruleId1,
      rule_name: 'CPU High Usage',
      metric_name: 'itsm_cpu_usage_percent',
      current_value: 82.3,
      threshold: 80,
      severity: 'warning',
      status: 'resolved',
      message: 'CPU usage was above threshold',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      resolved_at: new Date().toISOString()
    });

    // Create test notification channel
    const crypto = require('crypto');
    const key = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY || '0'.repeat(64), 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(
      JSON.stringify({ webhook_url: 'https://hooks.slack.com/test' }),
      'utf8',
      'hex'
    );
    encrypted += cipher.final('hex');
    const encryptedConfig = `${iv.toString('hex')}:${encrypted}`;

    const [channelId] = await knex('alert_notification_channels').insert({
      channel_name: 'test-channel',
      channel_type: 'slack',
      config: encryptedConfig,
      enabled: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    testNotificationChannelId = channelId;

    // Create test metric history
    const now = new Date().toISOString();
    await knex('metric_history').insert([
      {
        metric_name: 'itsm_cpu_usage_percent',
        metric_value: 45.5,
        labels: null,
        timestamp: now
      },
      {
        metric_name: 'itsm_memory_usage_percent',
        metric_value: 60.2,
        labels: null,
        timestamp: now
      },
      {
        metric_name: 'itsm_disk_usage_percent',
        metric_value: 75.3,
        labels: null,
        timestamp: now
      }
    ]);
  }

  beforeAll(async () => {
    await dbReady;

    // Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = adminRes.body.token;

    // Get admin user ID
    const adminUser = await knex('users').where('username', 'admin').first();
    adminUserId = adminUser.id;

    // Manager login
    const managerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'manager', password: 'manager123' });
    managerToken = managerRes.body.token;

    // Analyst login
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });
    analystToken = analystRes.body.token;

    // Viewer login
    const viewerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'viewer', password: 'viewer123' });
    viewerToken = viewerRes.body.token;

    // Create test data
    await createTestData();
  }, 90000);

  afterAll(async () => {
    // Cleanup test data
    await knex('alert_notification_history').del();
    await knex('alert_history').del();
    await knex('alert_rules').del();
    await knex('alert_notification_channels').del();
    await knex('metric_history').del();
  }, 90000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================================
  // メトリクスエンドポイント (8件)
  // ===================================

  describe('GET /api/v1/monitoring/metrics/system', () => {
    it('should get system metrics successfully (200)', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/metrics/system')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.data).toHaveProperty('metrics');
      expect(res.body.data.metrics).toHaveProperty('cpu');
      expect(res.body.data.metrics).toHaveProperty('memory');
      expect(res.body.data.metrics).toHaveProperty('disk');
      expect(res.body.data.metrics).toHaveProperty('uptime');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/v1/monitoring/metrics/system');

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 403 for viewer role', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/metrics/system')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should allow analyst role to view system metrics', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/metrics/system')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/monitoring/metrics/business', () => {
    it('should get business metrics successfully (200)', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/metrics/business')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('metrics');
      expect(res.body.data.metrics).toHaveProperty('sla_compliance');
      expect(res.body.data.metrics).toHaveProperty('incidents_open');
    });

    it('should validate business metrics data format', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/metrics/business')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.metrics.sla_compliance).toHaveProperty('current_rate');
      expect(res.body.data.metrics.incidents_open).toHaveProperty('total');
      expect(res.body.data.metrics.incidents_open).toHaveProperty('by_priority');
    });
  });

  describe('GET /api/v1/monitoring/metrics/history', () => {
    it('should get metrics history successfully (200)', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/metrics/history')
        .query({ metric_name: 'itsm_cpu_usage_percent' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('history');
      expect(Array.isArray(res.body.data.history)).toBe(true);
    });

    it('should return 400 without metric_name', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/metrics/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('should filter history by time range', async () => {
      const startTime = new Date(Date.now() - 3600000).toISOString();
      const endTime = new Date().toISOString();

      const res = await request(app)
        .get('/api/v1/monitoring/metrics/history')
        .query({
          metric_name: 'itsm_cpu_usage_percent',
          start_time: startTime,
          end_time: endTime
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/v1/monitoring/metrics/custom', () => {
    it('should register custom metric successfully (201)', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/metrics/custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metric_name: 'custom_api_latency',
          metric_value: 45.5,
          labels: { endpoint: '/api/v1/incidents' }
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body.data).toHaveProperty('metric_name', 'custom_api_latency');
      expect(res.body.data).toHaveProperty('metric_value', 45.5);
    });

    it('should return 400 for invalid metric data', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/metrics/custom')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metric_name: 'test_metric',
          metric_value: 'not_a_number'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  // ===================================
  // アラートルール管理 (12件)
  // ===================================

  describe('GET /api/v1/monitoring/alert-rules', () => {
    it('should list all alert rules (200)', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('rules');
      expect(Array.isArray(res.body.data.rules)).toBe(true);
      expect(res.body.data.rules.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.total).toBeGreaterThanOrEqual(res.body.data.rules.length);
    });

    it('should return 403 for analyst role', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/monitoring/alert-rules', () => {
    it('should create alert rule successfully (201)', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'Test SLA Rule',
          metric_name: 'itsm_sla_compliance_rate',
          condition: '<',
          threshold: 95,
          duration: 600,
          severity: 'critical',
          enabled: true,
          notification_channels: ['test-channel']
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body.data).toHaveProperty('rule_name', 'Test SLA Rule');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'Incomplete Rule'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('should return 400 for invalid condition', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'Invalid Condition Rule',
          metric_name: 'itsm_cpu_usage_percent',
          condition: 'INVALID',
          threshold: 80,
          severity: 'warning'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Invalid condition');
    });

    it('should return 400 for invalid severity', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'Invalid Severity Rule',
          metric_name: 'itsm_cpu_usage_percent',
          condition: '>',
          threshold: 80,
          severity: 'INVALID'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Invalid severity');
    });

    it('should return 400 for duration less than 60 seconds', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'Short Duration Rule',
          metric_name: 'itsm_cpu_usage_percent',
          condition: '>',
          threshold: 80,
          duration: 30,
          severity: 'warning'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Duration must be at least 60 seconds');
    });

    it('should return 409 for duplicate rule name', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/alert-rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rule_name: 'CPU High Usage',
          metric_name: 'itsm_cpu_usage_percent',
          condition: '>',
          threshold: 85,
          severity: 'critical'
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('Duplicate rule name');
    });
  });

  describe('GET /api/v1/monitoring/alert-rules/:id', () => {
    it('should get alert rule details (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/monitoring/alert-rules/${testAlertRuleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('id', testAlertRuleId);
      expect(res.body.data).toHaveProperty('rule_name');
    });

    it('should return 404 for non-existent rule', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alert-rules/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Rule not found');
    });
  });

  describe('PUT /api/v1/monitoring/alert-rules/:id', () => {
    it('should update alert rule successfully (200)', async () => {
      const res = await request(app)
        .put(`/api/v1/monitoring/alert-rules/${testAlertRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threshold: 85,
          enabled: false
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('threshold', 85);
      expect(res.body.data).toHaveProperty('enabled', 0);
    });

    it('should return 400 for invalid update data', async () => {
      const res = await request(app)
        .put(`/api/v1/monitoring/alert-rules/${testAlertRuleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          condition: 'INVALID'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should return 404 for non-existent rule', async () => {
      const res = await request(app)
        .put('/api/v1/monitoring/alert-rules/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          threshold: 90
        });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/monitoring/alert-rules/:id', () => {
    it('should delete alert rule successfully (200)', async () => {
      const [newRuleId] = await knex('alert_rules').insert({
        rule_name: 'Temporary Rule',
        metric_name: 'itsm_cpu_usage_percent',
        condition: '>',
        threshold: 95,
        severity: 'critical',
        enabled: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .delete(`/api/v1/monitoring/alert-rules/${newRuleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('should return 404 for non-existent rule', async () => {
      const res = await request(app)
        .delete('/api/v1/monitoring/alert-rules/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/monitoring/alert-rules/:id/test', () => {
    it('should test alert rule evaluation (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/monitoring/alert-rules/${testAlertRuleId}/test`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('ruleId', testAlertRuleId);
      expect(res.body.data).toHaveProperty('isFiring');
      expect(res.body.data).toHaveProperty('currentValue');
    });

    it('should return 404 for non-existent rule', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/alert-rules/99999/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  // ===================================
  // アラート履歴 (10件)
  // ===================================

  describe('GET /api/v1/monitoring/alerts', () => {
    it('should list all alerts (200)', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alerts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('alerts');
      expect(Array.isArray(res.body.data.alerts)).toBe(true);
    });

    it('should filter alerts by status', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alerts')
        .query({ status: 'firing' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.alerts.every((a) => a.status === 'firing')).toBe(true);
    });

    it('should filter alerts by severity', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alerts')
        .query({ severity: 'warning' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('should support pagination with limit and offset', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alerts')
        .query({ limit: 10, offset: 0 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.alerts.length).toBeLessThanOrEqual(10);
    });

    it('should filter alerts by date range', async () => {
      const startDate = new Date(Date.now() - 86400000).toISOString();
      const endDate = new Date().toISOString();

      const res = await request(app)
        .get('/api/v1/monitoring/alerts')
        .query({ start_date: startDate, end_date: endDate })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/monitoring/alerts/:id', () => {
    it('should get alert details (200)', async () => {
      const alert = await knex('alert_history').first();

      const res = await request(app)
        .get(`/api/v1/monitoring/alerts/${alert.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('id', alert.id);
      expect(res.body.data).toHaveProperty('rule_name');
      expect(res.body.data).toHaveProperty('status');
    });

    it('should return 404 for non-existent alert', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/alerts/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('Alert not found');
    });
  });

  describe('PUT /api/v1/monitoring/alerts/:id/acknowledge', () => {
    it('should acknowledge alert successfully (200)', async () => {
      const alert = await knex('alert_history').where('status', 'firing').first();

      const res = await request(app)
        .put(`/api/v1/monitoring/alerts/${alert.id}/acknowledge`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('status', 'acknowledged');
      expect(res.body.data).toHaveProperty('acknowledged_by', adminUserId);
    });

    it('should return 404 for non-existent alert', async () => {
      const res = await request(app)
        .put('/api/v1/monitoring/alerts/99999/acknowledge')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should allow manager to acknowledge alerts', async () => {
      const [alertId] = await knex('alert_history').insert({
        rule_id: testAlertRuleId,
        rule_name: 'Test Alert',
        metric_name: 'itsm_cpu_usage_percent',
        current_value: 85,
        threshold: 80,
        severity: 'warning',
        status: 'firing',
        message: 'Test alert message',
        created_at: new Date().toISOString()
      });

      const res = await request(app)
        .put(`/api/v1/monitoring/alerts/${alertId}/acknowledge`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(200);
    });
  });

  describe('PUT /api/v1/monitoring/alerts/:id/resolve', () => {
    it('should resolve alert successfully (200)', async () => {
      const [alertId] = await knex('alert_history').insert({
        rule_id: testAlertRuleId,
        rule_name: 'Test Alert 2',
        metric_name: 'itsm_cpu_usage_percent',
        current_value: 85,
        threshold: 80,
        severity: 'warning',
        status: 'acknowledged',
        message: 'Test alert message',
        created_at: new Date().toISOString()
      });

      const res = await request(app)
        .put(`/api/v1/monitoring/alerts/${alertId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('status', 'resolved');
      expect(res.body.data).toHaveProperty('resolved_at');
    });

    it('should return 404 for non-existent alert', async () => {
      const res = await request(app)
        .put('/api/v1/monitoring/alerts/99999/resolve')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  // ===================================
  // 通知チャネル管理 (10件)
  // ===================================

  describe('GET /api/v1/monitoring/notification-channels', () => {
    it('should list all notification channels (200)', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('channels');
      expect(Array.isArray(res.body.data.channels)).toBe(true);
    });

    it('should mask sensitive config data', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      if (res.body.data.channels.length > 0) {
        const channel = res.body.data.channels[0];
        if (channel.config && channel.config.webhook_url) {
          expect(channel.config.webhook_url).toContain('***');
        }
      }
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .get('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/monitoring/notification-channels', () => {
    it('should create email notification channel (201)', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channel_name: 'email-alerts',
          channel_type: 'email',
          config: {
            recipients: ['admin@example.com', 'ops@example.com']
          },
          enabled: true
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data).toHaveProperty('channel_name', 'email-alerts');
      expect(res.body.data).toHaveProperty('channel_type', 'email');
    });

    it('should create slack notification channel (201)', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channel_name: 'slack-critical',
          channel_type: 'slack',
          config: {
            webhook_url: 'https://hooks.slack.com/services/TEST123'
          },
          enabled: true
        });

      expect(res.statusCode).toBe(201);
    });

    it('should create webhook notification channel (201)', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channel_name: 'webhook-external',
          channel_type: 'webhook',
          config: {
            webhook_url: 'https://api.example.com/webhooks/alerts',
            custom_headers: {
              'X-API-Key': 'secret123'
            }
          },
          enabled: true
        });

      expect(res.statusCode).toBe(201);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channel_name: 'incomplete-channel'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('should return 400 for invalid channel type', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channel_name: 'invalid-channel',
          channel_type: 'INVALID',
          config: {}
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('Invalid channel_type');
    });

    it('should return 409 for duplicate channel name', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/notification-channels')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channel_name: 'test-channel',
          channel_type: 'slack',
          config: {
            webhook_url: 'https://hooks.slack.com/test2'
          }
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('Duplicate channel name');
    });
  });

  describe('DELETE /api/v1/monitoring/notification-channels/:id', () => {
    it('should delete notification channel successfully (200)', async () => {
      const crypto = require('crypto');
      const key = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY || '0'.repeat(64), 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(
        JSON.stringify({ webhook_url: 'https://example.com' }),
        'utf8',
        'hex'
      );
      encrypted += cipher.final('hex');
      const encryptedConfig = `${iv.toString('hex')}:${encrypted}`;

      const [channelId] = await knex('alert_notification_channels').insert({
        channel_name: 'temp-channel',
        channel_type: 'webhook',
        config: encryptedConfig,
        enabled: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .delete(`/api/v1/monitoring/notification-channels/${channelId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });

    it('should return 404 for non-existent channel', async () => {
      const res = await request(app)
        .delete('/api/v1/monitoring/notification-channels/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/monitoring/notification-channels/:id/test', () => {
    it('should test notification channel successfully (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/monitoring/notification-channels/${testNotificationChannelId}/test`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveProperty('success', true);
    });

    it('should return 404 for non-existent channel', async () => {
      const res = await request(app)
        .post('/api/v1/monitoring/notification-channels/99999/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });

    it('should save test notification to history', async () => {
      await request(app)
        .post(`/api/v1/monitoring/notification-channels/${testNotificationChannelId}/test`)
        .set('Authorization', `Bearer ${authToken}`);

      const history = await knex('alert_notification_history')
        .where('channel_id', testNotificationChannelId)
        .where('subject', 'Test Notification')
        .first();

      expect(history).toBeDefined();
      expect(history.status).toBe('sent');
    });
  });
});
