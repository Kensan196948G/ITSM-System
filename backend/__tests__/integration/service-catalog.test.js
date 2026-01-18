const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('Service Catalog API Integration Tests', () => {
  let authToken;
  let adminToken;
  let testCategoryId;
  let testServiceId;

  beforeAll(async () => {
    await dbReady;
    // Login as admin
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = res.body.token;
    adminToken = res.body.token;
  });

  describe('GET /api/v1/service-catalog/categories', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/service-catalog/categories');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでカテゴリ一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/categories')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('非アクティブカテゴリも含めて取得', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/categories?include_inactive=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/service-catalog/categories', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app)
        .post('/api/v1/service-catalog/categories')
        .send({ name: 'Test Category' });
      expect(res.statusCode).toEqual(401);
    });

    it('adminでカテゴリ作成（201）', async () => {
      const res = await request(app)
        .post('/api/v1/service-catalog/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'テストカテゴリ',
          description: 'テスト用カテゴリ',
          icon: 'fa-test',
          color: 'primary',
          sort_order: 99
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      testCategoryId = res.body.data.id;
    });

    it('名前なしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/service-catalog/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'テスト'
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /api/v1/service-catalog/categories/:id', () => {
    it('存在するカテゴリを取得（200）', async () => {
      if (!testCategoryId) return;

      const res = await request(app)
        .get(`/api/v1/service-catalog/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('name', 'テストカテゴリ');
      expect(res.body.data).toHaveProperty('services');
    });

    it('存在しないカテゴリで404エラー', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/categories/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('PUT /api/v1/service-catalog/categories/:id', () => {
    it('adminでカテゴリ更新（200）', async () => {
      if (!testCategoryId) return;

      const res = await request(app)
        .put(`/api/v1/service-catalog/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'テストカテゴリ（更新）',
          description: '更新されたテストカテゴリ'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/service-catalog/services', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/service-catalog/services');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでサービス一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/services')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('カテゴリでフィルタリング', async () => {
      if (!testCategoryId) return;

      const res = await request(app)
        .get(`/api/v1/service-catalog/services?category_id=${testCategoryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('ステータスでフィルタリング', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/services?status=active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('検索クエリでフィルタリング', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/services?search=インシデント')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('POST /api/v1/service-catalog/services', () => {
    it('admin/managerでサービス作成（201）', async () => {
      const res = await request(app)
        .post('/api/v1/service-catalog/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category_id: testCategoryId,
          name: 'テストサービス',
          description: 'テスト用サービス',
          icon: 'fa-test',
          status: 'active',
          service_level: 'Gold',
          estimated_hours: 4
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      testServiceId = res.body.data.id;
    });

    it('名前なしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/service-catalog/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          description: 'テスト'
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('GET /api/v1/service-catalog/services/:id', () => {
    it('存在するサービスを取得（200）', async () => {
      if (!testServiceId) return;

      const res = await request(app)
        .get(`/api/v1/service-catalog/services/${testServiceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('name', 'テストサービス');
    });

    it('存在しないサービスで404エラー', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/services/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('PUT /api/v1/service-catalog/services/:id', () => {
    it('admin/managerでサービス更新（200）', async () => {
      if (!testServiceId) return;

      const res = await request(app)
        .put(`/api/v1/service-catalog/services/${testServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'テストサービス（更新）',
          description: '更新されたテストサービス',
          service_level: 'Silver'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/service-catalog/statistics', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/service-catalog/statistics');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありで統計情報取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/service-catalog/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('categories');
      expect(res.body.data).toHaveProperty('overall');
      expect(res.body.data).toHaveProperty('service_levels');
    });
  });

  describe('DELETE /api/v1/service-catalog/services/:id', () => {
    it('adminでサービス削除（200）', async () => {
      if (!testServiceId) return;

      const res = await request(app)
        .delete(`/api/v1/service-catalog/services/${testServiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/v1/service-catalog/categories/:id', () => {
    it('adminでカテゴリ削除（200）', async () => {
      if (!testCategoryId) return;

      const res = await request(app)
        .delete(`/api/v1/service-catalog/categories/${testCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
