/**
 * Notifications Route Unit Tests
 * 通知設定ルートのユニットテスト
 */

const request = require('supertest');
const express = require('express');

// Mock the database module
jest.mock('../../../db', () => ({
  db: {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn()
  },
  initDb: jest.fn()
}));

// Mock middleware
jest.mock('../../../middleware/auth', () => ({
  authenticateJWT: (req, res, next) => {
    req.user = { username: 'admin', role: 'admin' };
    next();
  },
  authorize: (roles) => (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: '権限がありません' });
    }
  }
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../services/notificationService', () => ({
  NOTIFICATION_CHANNELS: { EMAIL: 'email', SLACK: 'slack', TEAMS: 'teams' },
  NOTIFICATION_TYPES: { INCIDENT: 'incident', CHANGE: 'change' },
  sendTestNotification: jest.fn()
}));

const { db } = require('../../../db');
const { sendTestNotification } = require('../../../services/notificationService');
const notificationsRoutes = require('../../../routes/notifications');

const app = express();
app.use(express.json());
app.use('/api/v1/notifications', notificationsRoutes);

describe('Notifications Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/notifications', () => {
    it('should return list of notification channels', async () => {
      const mockChannels = [
        {
          id: 1,
          name: 'Slack Channel',
          channel_type: 'slack',
          webhook_url: 'https://hooks.slack.com/services/T123/B456/abcdef',
          config: '{"key":"value"}',
          notification_types: 'incident,change',
          is_active: 1,
          created_by: 'admin',
          created_at: '2025-01-01',
          updated_at: '2025-01-01'
        }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockChannels);
      });

      const response = await request(app).get('/api/v1/notifications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      // webhook_url should be masked
      expect(response.body.data[0].webhook_url).toContain('...');
    });

    it('should handle "no such table" error gracefully', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('no such table: notification_channels'));
      });

      const response = await request(app).get('/api/v1/notifications');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should re-throw non-table errors', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Connection refused'));
      });

      const response = await request(app).get('/api/v1/notifications');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should handle null webhook_url and config', async () => {
      const mockChannels = [
        {
          id: 1,
          name: 'Email Channel',
          channel_type: 'email',
          webhook_url: null,
          config: null,
          notification_types: 'incident',
          is_active: 1,
          created_by: 'admin',
          created_at: '2025-01-01',
          updated_at: '2025-01-01'
        }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockChannels);
      });

      const response = await request(app).get('/api/v1/notifications');

      expect(response.status).toBe(200);
      expect(response.body.data[0].webhook_url).toBeNull();
      expect(response.body.data[0].config).toBeNull();
    });
  });

  describe('GET /api/v1/notifications/logs', () => {
    it('should return notification logs', async () => {
      const mockLogs = [{ id: 1, channel: 'slack', status: 'sent' }];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockLogs);
      });
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { total: 1 });
      });

      const response = await request(app).get('/api/v1/notifications/logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter logs by channel', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('channel = ?');
        callback(null, []);
      });
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { total: 0 });
      });

      const response = await request(app).get('/api/v1/notifications/logs?channel=slack');

      expect(response.status).toBe(200);
    });

    it('should filter logs by status', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('status = ?');
        callback(null, []);
      });
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { total: 0 });
      });

      const response = await request(app).get('/api/v1/notifications/logs?status=sent');

      expect(response.status).toBe(200);
    });

    it('should filter logs by notification_type', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('notification_type = ?');
        callback(null, []);
      });
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { total: 0 });
      });

      const response = await request(app).get(
        '/api/v1/notifications/logs?notification_type=incident'
      );

      expect(response.status).toBe(200);
    });

    it('should handle "no such table" error for logs', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('no such table: notification_logs'));
      });

      const response = await request(app).get('/api/v1/notifications/logs');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('should re-throw non-table errors for logs', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Disk full'));
      });

      const response = await request(app).get('/api/v1/notifications/logs');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/notifications/stats', () => {
    it('should return notification stats', async () => {
      // 4 sequential dbAll/dbGet calls
      let callCount = 0;
      db.all.mockImplementation((sql, params, callback) => {
        callCount++;
        callback(null, []);
      });
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('COUNT(*)') && sql.includes('notification_logs')) {
          callback(null, { total: 5, sent: 3, failed: 2 });
        } else {
          callback(null, { count: 2 });
        }
      });

      const response = await request(app).get('/api/v1/notifications/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should handle "no such table" error for stats', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('no such table: notification_logs'));
      });

      const response = await request(app).get('/api/v1/notifications/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should re-throw non-table errors for stats', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Permission denied'));
      });

      const response = await request(app).get('/api/v1/notifications/stats');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/notifications/channels', () => {
    it('should return available channel types', async () => {
      const response = await request(app).get('/api/v1/notifications/channels');

      expect(response.status).toBe(200);
      expect(response.body.channels).toHaveLength(4);
      expect(response.body.channels.map((c) => c.id)).toEqual(
        expect.arrayContaining(['email', 'slack', 'teams', 'webhook'])
      );
    });
  });

  describe('GET /api/v1/notifications/:id', () => {
    it('should return channel details', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          id: 1,
          name: 'Test',
          webhook_url: 'https://example.com/webhook',
          config: '{"key":"val"}'
        });
      });

      const response = await request(app).get('/api/v1/notifications/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.config).toEqual({ key: 'val' });
    });

    it('should return 404 when channel not found', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/v1/notifications/999');

      expect(response.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/notifications/1');

      expect(response.status).toBe(500);
    });

    it('should handle null config and webhook_url in detail', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          id: 1,
          name: 'Email',
          webhook_url: null,
          config: null
        });
      });

      const response = await request(app).get('/api/v1/notifications/1');

      expect(response.status).toBe(200);
      expect(response.body.data.config).toBeNull();
    });
  });

  describe('POST /api/v1/notifications', () => {
    it('should create a new notification channel', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/notifications')
        .send({
          name: 'New Slack',
          channel_type: 'slack',
          webhook_url: 'https://hooks.slack.com/test',
          config: { key: 'value' },
          notification_types: ['incident', 'change'],
          is_active: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/notifications')
        .send({ channel_type: 'slack' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });

    it('should return 400 when channel_type is missing', async () => {
      const response = await request(app).post('/api/v1/notifications').send({ name: 'Test' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid channel_type', async () => {
      const response = await request(app)
        .post('/api/v1/notifications')
        .send({ name: 'Test', channel_type: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('channel_type');
    });

    it('should return 400 when slack channel has no webhook_url', async () => {
      const response = await request(app)
        .post('/api/v1/notifications')
        .send({ name: 'Slack', channel_type: 'slack' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Webhook URL');
    });

    it('should return 400 when teams channel has no webhook_url', async () => {
      const response = await request(app)
        .post('/api/v1/notifications')
        .send({ name: 'Teams', channel_type: 'teams' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Webhook URL');
    });

    it('should create email channel without webhook_url', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/notifications')
        .send({ name: 'Email', channel_type: 'email' });

      expect(response.status).toBe(201);
    });

    it('should handle database error on create', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Insert error'));
      });

      const response = await request(app).post('/api/v1/notifications').send({
        name: 'Test',
        channel_type: 'email'
      });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/v1/notifications/:id', () => {
    it('should update notification channel', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, name: 'Old Name' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/notifications/1')
        .send({
          name: 'Updated',
          channel_type: 'slack',
          webhook_url: 'https://new.url',
          config: { new: true },
          notification_types: ['incident'],
          is_active: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 when channel not found for update', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/v1/notifications/999')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should handle database error on update', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).put('/api/v1/notifications/1').send({ name: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/v1/notifications/:id', () => {
    it('should delete notification channel', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, name: 'To Delete' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app).delete('/api/v1/notifications/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 when channel not found for delete', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).delete('/api/v1/notifications/999');

      expect(response.status).toBe(404);
    });

    it('should handle database error on delete', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).delete('/api/v1/notifications/1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/notifications/:id/test', () => {
    it('should send test notification', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, channel_type: 'slack', webhook_url: 'https://test.url' });
      });
      sendTestNotification.mockResolvedValue({ success: true });

      const response = await request(app).post('/api/v1/notifications/1/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 404 when channel not found for test', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).post('/api/v1/notifications/999/test');

      expect(response.status).toBe(404);
    });

    it('should return 400 for email channel test', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, channel_type: 'email', webhook_url: null });
      });

      const response = await request(app).post('/api/v1/notifications/1/test');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('メールチャネル');
    });

    it('should handle test notification failure', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, channel_type: 'slack', webhook_url: 'https://test.url' });
      });
      sendTestNotification.mockResolvedValue({ success: false, error: 'Connection failed' });

      const response = await request(app).post('/api/v1/notifications/1/test');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Connection failed');
    });

    it('should handle exception in test notification', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).post('/api/v1/notifications/1/test');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/notifications/test/webhook', () => {
    it('should test webhook URL', async () => {
      sendTestNotification.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/v1/notifications/test/webhook')
        .send({ channel_type: 'slack', webhook_url: 'https://hooks.slack.com/test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 when channel_type is missing', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/test/webhook')
        .send({ webhook_url: 'https://test.url' });

      expect(response.status).toBe(400);
    });

    it('should return 400 when webhook_url is missing', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/test/webhook')
        .send({ channel_type: 'slack' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid channel_type', async () => {
      const response = await request(app)
        .post('/api/v1/notifications/test/webhook')
        .send({ channel_type: 'email', webhook_url: 'https://test.url' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('slackまたはteams');
    });

    it('should handle test webhook failure', async () => {
      sendTestNotification.mockResolvedValue({ success: false, error: 'Timeout' });

      const response = await request(app)
        .post('/api/v1/notifications/test/webhook')
        .send({ channel_type: 'teams', webhook_url: 'https://teams.url' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Timeout');
    });

    it('should handle exception in webhook test', async () => {
      sendTestNotification.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/v1/notifications/test/webhook')
        .send({ channel_type: 'slack', webhook_url: 'https://hooks.slack.com/test' });

      expect(response.status).toBe(500);
    });
  });
});
