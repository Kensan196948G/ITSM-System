const request = require('supertest');
const app = require('../../server');

describe('Vulnerabilities API Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = adminRes.body.token;
  });

  describe('GET /api/v1/vulnerabilities', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/vulnerabilities');
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
    });

    it('認証ありで脆弱性一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ページネーションが正しく機能する', async () => {
      const res = await request(app)
        .get('/api/v1/vulnerabilities?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('取得した脆弱性に必要なフィールドが含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      if (res.body.data.length > 0) {
        const vuln = res.body.data[0];
        expect(vuln).toHaveProperty('vulnerability_id');
        expect(vuln).toHaveProperty('title');
        expect(vuln).toHaveProperty('severity');
        expect(vuln).toHaveProperty('status');
      }
    });
  });

  describe('POST /api/v1/vulnerabilities', () => {
    it('有効なデータで脆弱性作成（201）', async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Vulnerability - SQL Injection',
          description: 'SQL injection vulnerability in login form',
          severity: 'High',
          cvss_score: 8.5,
          affected_asset: 'WEB-001',
          status: 'Open',
          detection_date: new Date().toISOString().split('T')[0]
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('message');
    });

    it('タイトルなしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Missing title',
          severity: 'High'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('CVSSスコアが有効範囲内であれば作成可能', async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Valid CVSS Test',
          severity: 'High',
          cvss_score: 9.8
        });

      expect(res.statusCode).toEqual(201);
    });
  });

  describe('PUT /api/v1/vulnerabilities/:id', () => {
    it('有効なデータで脆弱性更新（200）', async () => {
      // Create a vulnerability first to ensure we have a valid ID
      const createRes = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Update Test Vulnerability',
          severity: 'Medium',
          cvss_score: 5.0,
          status: 'Open'
        });

      const vulnId = createRes.body.id;

      const res = await request(app)
        .put(`/api/v1/vulnerabilities/${vulnId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Vulnerability Title',
          severity: 'Critical',
          cvss_score: 9.8,
          status: 'In Progress'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
    });

    it('存在しない脆弱性IDで404エラー', async () => {
      const res = await request(app)
        .put('/api/v1/vulnerabilities/VULN-99999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Non-existent Update',
          severity: 'Low'
        });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('DELETE /api/v1/vulnerabilities/:id', () => {
    let deleteTestVulnId;

    beforeAll(async () => {
      // Create a vulnerability for deletion test
      const res = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Delete Test Vulnerability',
          severity: 'Low',
          cvss_score: 2.0,
          status: 'Open'
        });
      deleteTestVulnId = res.body.vulnerability_id;
    });

    it('manager以上で脆弱性削除可能（200）', async () => {
      if (!deleteTestVulnId) return;

      const res = await request(app)
        .delete(`/api/v1/vulnerabilities/${deleteTestVulnId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
    });

    it('存在しない脆弱性IDで404エラー', async () => {
      const res = await request(app)
        .delete('/api/v1/vulnerabilities/VULN-99999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /api/v1/vulnerabilities/cvss/calculate', () => {
    it('有効なメトリクスでCVSSスコア計算（200）', async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metrics: {
            attackVector: 'N',
            attackComplexity: 'L',
            privilegesRequired: 'N',
            userInteraction: 'N',
            scope: 'U',
            confidentialityImpact: 'H',
            integrityImpact: 'H',
            availabilityImpact: 'H'
          }
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('baseScore');
      expect(res.body).toHaveProperty('severity');
      expect(res.body).toHaveProperty('vectorString');
      expect(res.body.baseScore).toBeGreaterThanOrEqual(0);
      expect(res.body.baseScore).toBeLessThanOrEqual(10);
    });

    it('metricsオブジェクトなしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attackVector: 'N'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('必須メトリクスが不足で400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metrics: {
            attackVector: 'N'
            // Missing other required metrics
          }
        });

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('Vulnerability List Features', () => {
    it('脆弱性一覧取得が正しく動作', async () => {
      const res = await request(app)
        .get('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ページネーションパラメータを受け付ける', async () => {
      const res = await request(app)
        .get('/api/v1/vulnerabilities?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.pagination).toHaveProperty('page');
      expect(res.body.pagination).toHaveProperty('limit');
    });
  });
});
