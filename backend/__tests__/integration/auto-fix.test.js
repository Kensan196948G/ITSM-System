/**
 * Auto-Fix API Integration Tests
 * Phase 9.2: 自動修復API管理
 */

const crypto = require('crypto');
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

// Mock fs operations to prevent actual file operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    ...jest.requireActual('fs').promises,
    access: jest.fn().mockResolvedValue(undefined),
    open: jest.fn().mockResolvedValue({
      createReadStream: jest.fn().mockReturnValue({
        // eslint-disable-next-line object-shorthand, func-names
        [Symbol.asyncIterator]: async function* () {
          yield 'Test log line with 500 error';
          yield 'Test log line with 404 error';
        }
      }),
      close: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

describe('Auto-Fix API Integration Tests', () => {
  let authToken;
  let managerToken;
  let analystToken;
  let testPatternId;
  let testErrorHash;

  // Helper function - defined before use
  async function createTestData() {
    // Create test pattern ID (from errorPatterns service)
    testPatternId = 'PORT_IN_USE';

    // Create test error hash
    testErrorHash = crypto
      .createHash('sha256')
      .update(`Test error message${testPatternId}`)
      .digest('hex');

    // Insert cooldown record for reset test
    await knex('auto_fix_cooldowns')
      .insert({
        error_hash: testErrorHash,
        error_pattern: testPatternId,
        last_fixed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 300000).toISOString(),
        created_at: new Date().toISOString()
      })
      .onConflict('error_hash')
      .ignore();
  }

  beforeAll(async () => {
    await dbReady;

    // Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = adminRes.body.token;

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

    // Create test data
    await createTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await knex('auto_fix_cooldowns').del();
    await knex('auto_fix_history').del();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================================
  // POST /api/v1/auto-fix/scan
  // ===================================
  describe('POST /api/v1/auto-fix/scan', () => {
    it('管理者がエラー検知を実行できる', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/scan')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Error detection completed');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('total_detected');
      expect(res.body.data).toHaveProperty('matched_patterns');
      expect(res.body.data).toHaveProperty('auto_fixable');
      expect(res.body.data).toHaveProperty('errors');
      expect(Array.isArray(res.body.data.errors)).toBe(true);
    });

    it('マネージャーは権限不足で403エラー', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/scan')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body).toHaveProperty('error');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).post('/api/v1/auto-fix/scan');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
    });

    it('検出されたエラーにパターンマッチング情報が含まれる', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/scan')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      if (res.body.data.errors.length > 0) {
        const error = res.body.data.errors[0];
        expect(error).toHaveProperty('pattern_id');
        expect(error).toHaveProperty('pattern_name');
        expect(error).toHaveProperty('auto_fix');
      }
    });
  });

  // ===================================
  // POST /api/v1/auto-fix/execute
  // ===================================
  describe('POST /api/v1/auto-fix/execute', () => {
    it('管理者が修復アクションを実行できる', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pattern_id: 'PORT_IN_USE',
          action: 'restart_service',
          error_message: 'Port 5000 is already in use'
        });

      // If there's an error, log it for debugging
      if (res.statusCode !== 200) {
        console.log('Execute error:', res.body);
      }

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Fix action executed');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('pattern_id', 'PORT_IN_USE');
      expect(res.body.data).toHaveProperty('action', 'restart_service');
      expect(res.body.data).toHaveProperty('results');
    });

    it('必須フィールドなしで400エラー（pattern_id欠如）', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'restart_service'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body.message).toContain('pattern_id');
    });

    it('必須フィールドなしで400エラー（action欠如）', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/execute')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          pattern_id: 'PORT_IN_USE'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body.message).toContain('action');
    });

    it('マネージャーは権限不足で403エラー', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/execute')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          pattern_id: 'PORT_IN_USE',
          action: 'restart_service'
        });

      expect(res.statusCode).toEqual(403);
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).post('/api/v1/auto-fix/execute').send({
        pattern_id: 'PORT_IN_USE',
        action: 'restart_service'
      });

      expect(res.statusCode).toEqual(401);
    });
  });

  // ===================================
  // GET /api/v1/auto-fix/history
  // ===================================
  describe('GET /api/v1/auto-fix/history', () => {
    it('管理者が履歴を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Auto-fix history retrieved successfully');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('history');
      expect(res.body.data).toHaveProperty('total');
      expect(Array.isArray(res.body.data.history)).toBe(true);
    });

    it('マネージャーも履歴を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/history')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('history');
    });

    it('フィルター条件で履歴を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/history')
        .query({
          pattern: 'PORT_IN_USE',
          severity: 'high',
          status: 'success'
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('history');
    });

    it('ページネーションパラメータで履歴を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/history')
        .query({
          limit: 10,
          offset: 0
        })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('history');
      expect(res.body.data.history.length).toBeLessThanOrEqual(10);
    });

    it('limit超過で400エラー（200超）', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/history')
        .query({ limit: 250 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body.message).toContain('200');
    });

    it('limit無効で400エラー（1未満）', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/history')
        .query({ limit: 0 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body.message).toContain('at least 1');
    });

    it('offset無効で400エラー（負数）', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/history')
        .query({ offset: -1 })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body.message).toContain('cannot be negative');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/auto-fix/history');

      expect(res.statusCode).toEqual(401);
    });
  });

  // ===================================
  // GET /api/v1/auto-fix/status
  // ===================================
  describe('GET /api/v1/auto-fix/status', () => {
    it('管理者がステータスを取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Auto-fix status retrieved successfully');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('enabled');
      expect(res.body.data).toHaveProperty('total_runs');
      expect(res.body.data).toHaveProperty('success_runs');
      expect(res.body.data).toHaveProperty('success_rate');
      expect(res.body.data).toHaveProperty('active_cooldowns');
      expect(res.body.data).toHaveProperty('uptime_seconds');
    });

    it('マネージャーもステータスを取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/status')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('enabled');
    });

    it('アナリストもステータスを取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/status')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('enabled');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/auto-fix/status');

      expect(res.statusCode).toEqual(401);
    });

    it('ステータスに統計情報が含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/auto-fix/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toHaveProperty('total_runs');
      expect(res.body.data).toHaveProperty('success_runs');
      expect(res.body.data).toHaveProperty('success_rate');
      expect(typeof res.body.data.total_runs).toBe('number');
      expect(typeof res.body.data.success_rate).toBe('number');
    });
  });

  // ===================================
  // POST /api/v1/auto-fix/cooldown/reset
  // ===================================
  describe('POST /api/v1/auto-fix/cooldown/reset', () => {
    it('管理者がクールダウンをリセットできる', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/cooldown/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          error_hash: testErrorHash
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Cooldown reset successfully');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('error_hash', testErrorHash);
      expect(res.body.data).toHaveProperty('deleted_count');

      // Restore test data for other tests
      await knex('auto_fix_cooldowns').insert({
        error_hash: testErrorHash,
        error_pattern: testPatternId,
        last_fixed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 300000).toISOString(),
        created_at: new Date().toISOString()
      });
    });

    it('必須フィールドなしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/cooldown/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body.message).toContain('error_hash');
    });

    it('無効なSHA256形式で400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/cooldown/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          error_hash: 'invalid_hash'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error', 'Validation error');
      expect(res.body.message).toContain('SHA256');
    });

    it('存在しないハッシュで404エラー', async () => {
      const nonExistentHash = crypto
        .createHash('sha256')
        .update('non_existent_error')
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/auto-fix/cooldown/reset')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          error_hash: nonExistentHash
        });

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Cooldown not found');
    });

    it('マネージャーは権限不足で403エラー', async () => {
      const res = await request(app)
        .post('/api/v1/auto-fix/cooldown/reset')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          error_hash: testErrorHash
        });

      expect(res.statusCode).toEqual(403);
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).post('/api/v1/auto-fix/cooldown/reset').send({
        error_hash: testErrorHash
      });

      expect(res.statusCode).toEqual(401);
    });
  });
});
