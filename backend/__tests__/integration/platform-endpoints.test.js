const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, dbReady } = require('../../server');

describe('Platform Endpoints Integration Tests', () => {
  let adminToken;
  let managerToken;
  let viewerToken;
  let testVulnId;

  beforeAll(async () => {
    await dbReady;

    adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });
    managerToken = jwt.sign(
      { id: 2, username: 'manager', role: 'manager' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    viewerToken = jwt.sign({ id: 3, username: 'viewer', role: 'viewer' }, process.env.JWT_SECRET, {
      expiresIn: '1h'
    });
  });

  describe('Health, metrics, and docs', () => {
    it('GET /api/v1/health returns basic status', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('status', 'OK');
      expect(res.body).toHaveProperty('version');
    });

    it('GET /api/v1/health/live returns liveness probe', async () => {
      const res = await request(app).get('/api/v1/health/live');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('type', 'liveness');
      expect(res.body).toHaveProperty('status');
    });

    it('GET /api/v1/health/ready returns readiness probe', async () => {
      const res = await request(app).get('/api/v1/health/ready');

      expect([200, 503]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('type', 'readiness');
      expect(res.body).toHaveProperty('checks');
    });

    it('GET /metrics exposes Prometheus metrics', async () => {
      const res = await request(app).get('/metrics');

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('itsm_http_requests_total');
    });

    it('GET /api-docs/swagger.json returns OpenAPI definition', async () => {
      const res = await request(app).get('/api-docs/swagger.json');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('openapi');
      expect(res.body).toHaveProperty('paths');
    });
  });

  describe('Cache and users', () => {
    it('admin can list users and cache stats are available', async () => {
      const firstRes = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(firstRes.statusCode).toEqual(200);
      expect(Array.isArray(firstRes.body)).toBe(true);

      const secondRes = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondRes.statusCode).toEqual(200);

      const cacheRes = await request(app)
        .get('/api/v1/cache/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(cacheRes.statusCode).toEqual(200);
      expect(cacheRes.body).toHaveProperty('enabled');
      expect(cacheRes.body).toHaveProperty('keys');
    });

    it('non-admin is blocked from cache stats', async () => {
      const res = await request(app)
        .get('/api/v1/cache/stats')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('viewer is blocked from user listing', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('NIST CSF and CVSS endpoints', () => {
    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Coverage Test Vulnerability',
          description: 'Created for CVSS and NIST CSF tests',
          severity: 'High',
          cvss_score: 7.5,
          affected_asset: 'SRV-001'
        });

      testVulnId = res.body.id;
    });

    it('GET /api/v1/compliance/nist-csf/progress returns progress data', async () => {
      const res = await request(app)
        .get('/api/v1/compliance/nist-csf/progress')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('IDENTIFY');
      expect(res.body).toHaveProperty('PROTECT');
    });

    it('GET /api/v1/compliance/nist-csf/report returns compliance report', async () => {
      const res = await request(app)
        .get('/api/v1/compliance/nist-csf/report')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('overall_compliance_score');
      expect(res.body).toHaveProperty('functions');
    });

    it('POST /api/v1/vulnerabilities/cvss/calculate returns CVSS score', async () => {
      const res = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', `Bearer ${adminToken}`)
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
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('baseScore');
    });

    it('PATCH /api/v1/vulnerabilities/:id/cvss updates CVSS score', async () => {
      const res = await request(app)
        .patch(`/api/v1/vulnerabilities/${testVulnId}/cvss`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cvss_score: 8.8,
          cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          severity: 'High'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('cvss_score', 8.8);
    });

    it('PATCH /api/v1/vulnerabilities/:id/nist-csf validates function values', async () => {
      const res = await request(app)
        .patch(`/api/v1/vulnerabilities/${testVulnId}/nist-csf`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          function: 'INVALID'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('valid_values');
    });
  });
});
