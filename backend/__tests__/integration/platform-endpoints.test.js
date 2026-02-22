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
  }, 90000);

  describe('Health, metrics, and docs', () => {
    describe('Basic Health Check (/health)', () => {
      it('GET /api/v1/health returns basic status', async () => {
        const res = await request(app).get('/api/v1/health');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('status', 'OK');
        expect(res.body).toHaveProperty('version');
      });

      it('GET /api/v1/health includes timestamp', async () => {
        const res = await request(app).get('/api/v1/health');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('timestamp');
        expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      });

      it('GET /api/v1/health returns version 1.0.0', async () => {
        const res = await request(app).get('/api/v1/health');

        expect(res.statusCode).toEqual(200);
        expect(res.body.version).toBe('1.0.0');
      });
    });

    describe('Liveness Probe (/health/live)', () => {
      it('GET /api/v1/health/live returns liveness probe', async () => {
        const res = await request(app).get('/api/v1/health/live');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('type', 'liveness');
        expect(res.body).toHaveProperty('status');
      });

      it('GET /api/v1/health/live returns UP status', async () => {
        const res = await request(app).get('/api/v1/health/live');

        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('UP');
      });

      it('GET /api/v1/health/live includes timestamp', async () => {
        const res = await request(app).get('/api/v1/health/live');

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('timestamp');
        expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      });

      it('GET /api/v1/health/live has type liveness', async () => {
        const res = await request(app).get('/api/v1/health/live');

        expect(res.statusCode).toEqual(200);
        expect(res.body.type).toBe('liveness');
      });
    });

    describe('Readiness Probe (/health/ready)', () => {
      it('GET /api/v1/health/ready returns readiness probe', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('type', 'readiness');
        expect(res.body).toHaveProperty('checks');
      });

      it('GET /api/v1/health/ready includes database check', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks).toHaveProperty('database');
        expect(typeof res.body.checks.database).toBe('boolean');
      });

      it('GET /api/v1/health/ready includes disk check', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks).toHaveProperty('disk');
        expect(typeof res.body.checks.disk).toBe('boolean');
      });

      it('GET /api/v1/health/ready includes memory check', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks).toHaveProperty('memory');
        expect(typeof res.body.checks.memory).toBe('boolean');
      });

      it('GET /api/v1/health/ready includes version and uptime', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('version', '1.0.0');
        expect(res.body).toHaveProperty('uptime');
        expect(typeof res.body.uptime).toBe('number');
      });

      it('GET /api/v1/health/ready includes timestamp', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('timestamp');
        expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      });

      it('GET /api/v1/health/ready returns UP status when all checks pass', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        // In test environment, all checks should normally pass
        if (res.statusCode === 200) {
          expect(res.body.status).toBe('UP');
          expect(res.body.checks.database).toBe(true);
          expect(res.body.checks.disk).toBe(true);
          expect(res.body.checks.memory).toBe(true);
        }
      });

      it('GET /api/v1/health/ready includes errors array when checks fail', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        if (res.statusCode === 503) {
          expect(res.body).toHaveProperty('errors');
          expect(Array.isArray(res.body.errors)).toBe(true);
          expect(res.body.errors.length).toBeGreaterThan(0);
        }
      });

      it('GET /api/v1/health/ready has type readiness', async () => {
        const res = await request(app).get('/api/v1/health/ready');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.type).toBe('readiness');
      });
    });

    describe('Detailed Health Check (/health/detailed)', () => {
      it('GET /api/v1/health/detailed returns detailed status', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('type', 'detailed');
        expect(res.body).toHaveProperty('checks');
      });

      it('GET /api/v1/health/detailed includes all five checks', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks).toHaveProperty('database');
        expect(res.body.checks).toHaveProperty('disk');
        expect(res.body.checks).toHaveProperty('memory');
        expect(res.body.checks).toHaveProperty('cache');
        expect(res.body.checks).toHaveProperty('scheduler');
      });

      it('GET /api/v1/health/detailed database check has status and message', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks.database).toHaveProperty('status');
        expect(res.body.checks.database).toHaveProperty('message');
        expect(['UP', 'DOWN', 'WARNING']).toContain(res.body.checks.database.status);
      });

      it('GET /api/v1/health/detailed disk check has status and message', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks.disk).toHaveProperty('status');
        expect(res.body.checks.disk).toHaveProperty('message');
        expect(['UP', 'DOWN', 'WARNING']).toContain(res.body.checks.disk.status);
      });

      it('GET /api/v1/health/detailed memory check has status and message', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks.memory).toHaveProperty('status');
        expect(res.body.checks.memory).toHaveProperty('message');
        expect(['UP', 'DOWN', 'WARNING']).toContain(res.body.checks.memory.status);
      });

      it('GET /api/v1/health/detailed cache check has status and message', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks.cache).toHaveProperty('status');
        expect(res.body.checks.cache).toHaveProperty('message');
        expect(['UP', 'DOWN', 'WARNING']).toContain(res.body.checks.cache.status);
      });

      it('GET /api/v1/health/detailed scheduler check has status and message', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.checks.scheduler).toHaveProperty('status');
        expect(res.body.checks.scheduler).toHaveProperty('message');
        expect(['UP', 'DOWN', 'WARNING']).toContain(res.body.checks.scheduler.status);
      });

      it('GET /api/v1/health/detailed includes version and uptime', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('version', '1.0.0');
        expect(res.body).toHaveProperty('uptime');
        expect(typeof res.body.uptime).toBe('number');
      });

      it('GET /api/v1/health/detailed includes timestamp', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('timestamp');
        expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      });

      it('GET /api/v1/health/detailed disk check shows percentage in message', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        if (res.body.checks.disk.status === 'UP') {
          expect(res.body.checks.disk.message).toMatch(/\d+\.\d+% free/);
          expect(res.body.checks.disk.message).toMatch(/\d+\.\d+ GB/);
        }
      });

      it('GET /api/v1/health/detailed memory check shows percentage in message', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        if (res.body.checks.memory.status === 'UP') {
          expect(res.body.checks.memory.message).toMatch(/\d+\.\d+% used/);
          expect(res.body.checks.memory.message).toMatch(/\d+ MB free/);
        }
      });

      it('GET /api/v1/health/detailed includes errors array when checks fail', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        if (res.statusCode === 503) {
          expect(res.body).toHaveProperty('errors');
          expect(Array.isArray(res.body.errors)).toBe(true);
          expect(res.body.errors.length).toBeGreaterThan(0);
        }
      });

      it('GET /api/v1/health/detailed has type detailed', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.type).toBe('detailed');
      });

      it('GET /api/v1/health/detailed returns 200 when all critical checks pass', async () => {
        const res = await request(app).get('/api/v1/health/detailed');

        if (res.statusCode === 200) {
          expect(res.body.status).toBe('UP');
          expect(['UP', 'WARNING']).toContain(res.body.checks.database.status);
        }
      });
    });

    describe('Auto-Fix Status (/health/auto-fix)', () => {
      it('GET /api/v1/health/auto-fix returns status', async () => {
        const res = await request(app).get('/api/v1/health/auto-fix');

        // Auto-fix service may not be available in all environments
        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('type', 'auto-fix');
        expect(res.body).toHaveProperty('timestamp');
      });

      it('GET /api/v1/health/auto-fix includes timestamp', async () => {
        const res = await request(app).get('/api/v1/health/auto-fix');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body).toHaveProperty('timestamp');
        expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      });

      it('GET /api/v1/health/auto-fix has type auto-fix', async () => {
        const res = await request(app).get('/api/v1/health/auto-fix');

        expect([200, 503]).toContain(res.statusCode);
        expect(res.body.type).toBe('auto-fix');
      });

      it('GET /api/v1/health/auto-fix returns UP status when service is available', async () => {
        const res = await request(app).get('/api/v1/health/auto-fix');

        if (res.statusCode === 200) {
          expect(res.body.status).toBe('UP');
        }
      });

      it('GET /api/v1/health/auto-fix returns DOWN status when service is unavailable', async () => {
        const res = await request(app).get('/api/v1/health/auto-fix');

        if (res.statusCode === 503) {
          expect(res.body.status).toBe('DOWN');
          expect(res.body).toHaveProperty('error');
        }
      });

      it('GET /api/v1/health/auto-fix includes error message when service fails', async () => {
        const res = await request(app).get('/api/v1/health/auto-fix');

        if (res.statusCode === 503) {
          expect(res.body).toHaveProperty('error');
          expect(typeof res.body.error).toBe('string');
        }
      });

      it('GET /api/v1/health/auto-fix works multiple times consistently', async () => {
        const res1 = await request(app).get('/api/v1/health/auto-fix');
        const res2 = await request(app).get('/api/v1/health/auto-fix');

        expect(res1.statusCode).toBe(res2.statusCode);
        expect(res1.body.status).toBe(res2.body.status);
      });
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
