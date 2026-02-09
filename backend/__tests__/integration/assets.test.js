const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('Assets API Integration Tests', () => {
  let authToken;
  const testAssetTag = `TEST-${Date.now()}`;

  beforeAll(async () => {
    await dbReady;
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = res.body.token;
  }, 90000);

  describe('GET /api/v1/assets', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/assets');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありで資産一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ページネーションが正しく機能する', async () => {
      const res = await request(app)
        .get('/api/v1/assets?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 5);
    });
  });

  describe('POST /api/v1/assets', () => {
    it('有効なデータで資産作成（201）', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_tag: testAssetTag,
          name: 'Test Server',
          type: 'Server',
          status: 'Operational',
          criticality: 4
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('asset_tag', testAssetTag);
      expect(res.body).toHaveProperty('message');
    });

    it('asset_tagなしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Asset',
          type: 'Server',
          status: 'Operational'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('名前なしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_tag: 'TEST-999',
          type: 'Server',
          status: 'Operational'
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('PUT /api/v1/assets/:asset_tag', () => {
    it('有効なデータで資産更新（200）', async () => {
      const updateAssetTag = `UPDATE-${Date.now()}`;

      // Create a new asset first
      await request(app).post('/api/v1/assets').set('Authorization', `Bearer ${authToken}`).send({
        asset_tag: updateAssetTag,
        name: 'Update Test Asset',
        type: 'Network',
        status: 'Operational',
        criticality: 3
      });

      const res = await request(app)
        .put(`/api/v1/assets/${updateAssetTag}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Asset Name',
          type: 'Server',
          status: 'Maintenance',
          criticality: 5
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
    });

    it('存在しない資産タグで404エラー', async () => {
      const res = await request(app)
        .put('/api/v1/assets/NONEXISTENT-TAG-99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Non-existent Update'
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /api/v1/assets/:asset_tag', () => {
    it('admin権限で資産削除可能（200）', async () => {
      const deleteAssetTag = `DELETE-${Date.now()}`;

      // Create an asset for deletion
      await request(app).post('/api/v1/assets').set('Authorization', `Bearer ${authToken}`).send({
        asset_tag: deleteAssetTag,
        name: 'Delete Test Asset',
        type: 'Endpoint',
        status: 'Retired',
        criticality: 1
      });

      const res = await request(app)
        .delete(`/api/v1/assets/${deleteAssetTag}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
    });

    it('存在しない資産タグで404エラー', async () => {
      const res = await request(app)
        .delete('/api/v1/assets/NONEXISTENT-TAG-99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
