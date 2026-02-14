/**
 * Register Route Tests
 * ユーザー登録ルートのユニットテスト
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../../services/authService', () => ({
  register: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../middleware/rateLimiter', () => ({
  registerLimiter: (req, res, next) => next()
}));

jest.mock('../../../middleware/validation', () => ({
  validate: (req, res, next) => next(),
  authValidation: {
    register: (req, res, next) => next()
  }
}));

const authService = require('../../../services/authService');
const registerRoutes = require('../../../routes/auth/register');

const app = express();
app.use(express.json());
app.use('/auth', registerRoutes);

describe('Register Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register user successfully', async () => {
      authService.register.mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'new@test.com',
        role: 'viewer',
        full_name: 'New User'
      });

      const response = await request(app).post('/auth/register').send({
        username: 'newuser',
        email: 'new@test.com',
        password: 'password123',
        full_name: 'New User'
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('ユーザーが正常に作成されました');
      expect(response.body.user.username).toBe('newuser');
    });

    it('should return 409 when username/email already exists', async () => {
      authService.register.mockRejectedValue(new Error('Username or email already exists'));

      const response = await request(app).post('/auth/register').send({
        username: 'existing',
        email: 'exists@test.com',
        password: 'password123'
      });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('ユーザー名またはメールアドレスが既に使用されています');
    });

    it('should return 500 on internal error', async () => {
      authService.register.mockRejectedValue(new Error('Internal error'));

      const response = await request(app).post('/auth/register').send({
        username: 'newuser',
        email: 'new@test.com',
        password: 'password123'
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });
});
