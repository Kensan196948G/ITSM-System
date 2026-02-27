const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('Authentication API Integration Tests', () => {
  beforeAll(async () => {
    await dbReady;
  }, 90000);

  describe('POST /api/v1/auth/login', () => {
    it('正しい認証情報でログイン成功（200）', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        username: 'admin',
        password: 'admin123'
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('成功');
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('admin');
    });

    it('間違ったパスワードで401エラー', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        username: 'admin',
        password: 'wrongpassword'
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toContain('間違って');
    });

    it('存在しないユーザーで401エラー', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        username: 'nonexistent',
        password: 'password'
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toContain('間違って');
    });

    it('usernameなしで400エラー（バリデーション）', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        password: 'password'
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('無効');
    });

    it('passwordなしで400エラー（バリデーション）', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        username: 'admin'
      });

      expect(res.statusCode).toEqual(400);
    });

    it('analystユーザーでログイン成功', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        username: 'analyst',
        password: 'analyst123'
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.role).toBe('analyst');
    });

    it('発行されたトークンが有効', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        username: 'admin',
        password: 'admin123'
      });

      const { token } = loginRes.body;

      // トークンを使ってAPI呼び出し
      const apiRes = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${token}`);

      expect(apiRes.statusCode).toEqual(200);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('認証ありで現在のユーザー情報取得', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        username: 'admin',
        password: 'admin123'
      });

      const { token } = loginRes.body;

      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.username).toBe('admin');
      expect(res.body.email).toBe('admin@itsm.local');
      expect(res.body.role).toBe('admin');
      expect(res.body).not.toHaveProperty('password_hash');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    const uniqueUsername = `testuser${Date.now()}`;

    it('有効なデータでユーザー登録成功（201）', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          username: uniqueUsername,
          email: `${uniqueUsername}@test.com`,
          password: 'TestPass123',
          role: 'viewer',
          full_name: 'Test User'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toContain('正常に作成');
      expect(res.body.user.username).toBe(uniqueUsername);
    });

    it('既存のユーザー名で409エラー', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        username: 'admin', // 既存ユーザー
        email: 'newemail@test.com',
        password: 'TestPass123'
      });

      expect(res.statusCode).toEqual(409);
      expect(res.body.error).toContain('既に使用');
    });

    it('無効なメール形式で400エラー', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        username: 'newuser2',
        email: 'invalid-email',
        password: 'TestPass123'
      });

      expect(res.statusCode).toEqual(400);
    });

    it('パスワード8文字未満で400エラー', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        username: 'newuser3',
        email: 'test3@test.com',
        password: 'short'
      });

      expect(res.statusCode).toEqual(400);
    });
  });
});
