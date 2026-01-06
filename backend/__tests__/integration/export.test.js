const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('Export API Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    await dbReady;
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = res.body.token;
  });

  describe('GET /api/v1/export/incidents', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/export/incidents');
      expect(res.statusCode).toEqual(401);
    });

    it('CSV形式でインシデントエクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/incidents?format=csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('JSON形式でインシデントエクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/incidents?format=json')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('Excel形式でインシデントエクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/incidents?format=xlsx')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    });
  });

  describe('GET /api/v1/export/vulnerabilities', () => {
    it('CSV形式で脆弱性エクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/vulnerabilities?format=csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('JSON形式で脆弱性エクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/vulnerabilities?format=json')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('GET /api/v1/export/changes', () => {
    it('CSV形式で変更管理エクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/changes?format=csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('GET /api/v1/export/assets', () => {
    it('CSV形式で資産エクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/assets?format=csv')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('Excel形式で資産エクスポート（200）', async () => {
      const res = await request(app)
        .get('/api/v1/export/assets?format=xlsx')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('Export with date filters', () => {
    it('日付フィルタ付きでエクスポート', async () => {
      const res = await request(app)
        .get('/api/v1/export/incidents?format=csv&from=2025-01-01&to=2025-12-31')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });
});
