const request = require('supertest');
const { app, dbReady } = require('../../server');
const { db } = require('../../db');
const emailService = require('../../services/emailService');

// Mock emailService
jest.mock('../../services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  getTransporter: jest.fn()
}));

describe('Password Reset API Integration Tests', () => {
  const testUser = {
    username: `reset_test_${Date.now()}`,
    email: `reset_${Date.now()}@example.com`,
    password: 'OriginalPassword123!'
  };
  let resetToken = '';

  beforeAll(async () => {
    // Wait for database initialization to complete
    await dbReady;

    // Create a dedicated test user
    await request(app).post('/api/v1/auth/register').send({
      username: testUser.username,
      email: testUser.email,
      password: testUser.password,
      role: 'viewer'
    });
  }, 90000);

  describe('POST /api/v1/auth/forgot-password', () => {
    it('登録済みのメールアドレスでリセット要求成功', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUser.email });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('リンクを送信しました');
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        testUser.email,
        expect.any(String),
        expect.any(String)
      );

      // トークンをDBから取得
      return new Promise((resolve) => {
        db.get(
          'SELECT token FROM password_reset_tokens WHERE email = ? ORDER BY created_at DESC',
          [testUser.email],
          (err, row) => {
            resetToken = row.token;
            resolve();
          }
        );
      });
    });

    it('未登録のメールアドレスでも同じメッセージを返す（セキュリティ）', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('リンクを送信しました');
    });

    it('無効なメール形式で400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(res.statusCode).toEqual(400);
    });

    it('アカウントが無効なユーザーでも同じメッセージを返す', async () => {
      // Create an inactive user directly in DB
      await new Promise((resolve) => {
        db.run(
          'INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
          ['inactive_user', 'inactive@example.com', 'hash', 'viewer', 0],
          resolve
        );
      });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'inactive@example.com' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('リンクを送信しました');
    });
  });

  describe('GET /api/v1/auth/verify-reset-token/:token', () => {
    it('有効なトークンの検証成功', async () => {
      const res = await request(app).get(`/api/v1/auth/verify-reset-token/${resetToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.email).toBe(testUser.email);
    });

    it('存在しないトークンで400エラー', async () => {
      const res = await request(app).get('/api/v1/auth/verify-reset-token/non-existent-token');

      expect(res.statusCode).toEqual(400);
      expect(res.body.valid).toBe(false);
    });

    it('期限切れのトークンで400エラー', async () => {
      // Create an expired token directly in DB
      const expiredToken = 'expired-token-123';
      const pastDate = new Date(Date.now() - 1000).toISOString();
      await new Promise((resolve) => {
        db.run(
          'INSERT INTO password_reset_tokens (user_id, token, email, expires_at, used) VALUES (?, ?, ?, ?, ?)',
          [1, expiredToken, testUser.email, pastDate, 0],
          resolve
        );
      });

      const res = await request(app).get(`/api/v1/auth/verify-reset-token/${expiredToken}`);
      expect(res.statusCode).toEqual(400);
      expect(res.body.valid).toBe(false);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('新しいパスワードでリセット成功', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        token: resetToken,
        new_password: 'NewSecurePassword123!'
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('正常にリセットされました');

      // ログインできるか確認
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        username: testUser.username,
        password: 'NewSecurePassword123!'
      });

      expect(loginRes.statusCode).toEqual(200);
    });

    it('使用済みトークンで再度リセットを試みると400エラー', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        token: resetToken,
        new_password: 'AnotherPassword123!'
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('無効、期限切れ、または既に使用');
    });

    it('短すぎるパスワードで400エラー', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        token: resetToken,
        new_password: 'short'
      });

      expect(res.statusCode).toEqual(400);
    });
  });
});
