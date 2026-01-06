const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('CRUD Operations Integration Tests', () => {
  let adminToken;
  let analystToken;
  let testProblemId;
  let testReleaseId;
  let testServiceRequestId;
  let testSlaId;
  let testAssetTag;

  beforeAll(async () => {
    // Wait for database initialization to complete
    await dbReady;

    // Admin user login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminRes.body.token;

    // Analyst user login
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });
    analystToken = analystRes.body.token;
  });

  // ===== A. Problem Management =====
  describe('Problem Management (problems)', () => {
    describe('PUT /api/v1/problems/:id', () => {
      beforeAll(async () => {
        // Create a test problem
        const res = await request(app)
          .post('/api/v1/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Test Problem for PUT',
            description: 'This is a test problem for update testing',
            priority: 'Medium'
          });
        testProblemId = res.body.id;
      });

      it('should successfully update a problem (200)', async () => {
        const res = await request(app)
          .put(`/api/v1/problems/${testProblemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Problem Title',
            status: 'Analyzing',
            priority: 'High',
            root_cause: 'Root cause identified during testing'
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('更新');
        expect(res.body.changes).toBe(1);
      });

      it('should return 404 for non-existent problem ID', async () => {
        const res = await request(app)
          .put('/api/v1/problems/PRB-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'Resolved'
          });

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });

      it('should allow analyst to update problems', async () => {
        const res = await request(app)
          .put(`/api/v1/problems/${testProblemId}`)
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            status: 'Analyzing'
          });

        expect(res.statusCode).toEqual(200);
      });

      it('should update problem to Resolved status with resolved_at timestamp', async () => {
        const res = await request(app)
          .put(`/api/v1/problems/${testProblemId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'Resolved',
            root_cause: 'Issue resolved'
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('更新');
      });
    });

    describe('DELETE /api/v1/problems/:id', () => {
      let deleteProblemId;

      beforeEach(async () => {
        // Create a fresh problem for each delete test
        const res = await request(app)
          .post('/api/v1/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Problem to Delete',
            description: 'This problem will be deleted',
            priority: 'Low'
          });
        deleteProblemId = res.body.id;
      });

      it('should successfully delete a problem (200)', async () => {
        const res = await request(app)
          .delete(`/api/v1/problems/${deleteProblemId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('削除');

        // Verify deletion
        const getRes = await request(app)
          .get('/api/v1/problems')
          .set('Authorization', `Bearer ${adminToken}`);

        const deletedProblem = getRes.body.data.find((p) => p.problem_id === deleteProblemId);
        expect(deletedProblem).toBeUndefined();
      });

      it('should return 403 for analyst trying to delete (insufficient permissions)', async () => {
        const res = await request(app)
          .delete(`/api/v1/problems/${deleteProblemId}`)
          .set('Authorization', `Bearer ${analystToken}`);

        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toContain('権限');
      });

      it('should return 404 for non-existent problem ID', async () => {
        const res = await request(app)
          .delete('/api/v1/problems/PRB-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });
    });
  });

  // ===== B. Release Management =====
  describe('Release Management (releases)', () => {
    describe('PUT /api/v1/releases/:id', () => {
      beforeAll(async () => {
        // Create a test release
        const res = await request(app)
          .post('/api/v1/releases')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test Release',
            version: 'v1.0.0',
            description: 'Test release for update testing',
            target_environment: 'Staging'
          });
        testReleaseId = res.body.id;
      });

      it('should successfully update a release (200)', async () => {
        const res = await request(app)
          .put(`/api/v1/releases/${testReleaseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Updated Release Name',
            version: 'v1.1.0',
            status: 'In-Progress',
            progress: 50
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('更新');
        expect(res.body.changes).toBe(1);
      });

      it('should return 404 for non-existent release ID', async () => {
        const res = await request(app)
          .put('/api/v1/releases/REL-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'Deployed'
          });

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });

      it('should update release progress and status', async () => {
        const res = await request(app)
          .put(`/api/v1/releases/${testReleaseId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            progress: 100,
            status: 'Deployed'
          });

        expect(res.statusCode).toEqual(200);
      });
    });

    describe('DELETE /api/v1/releases/:id', () => {
      let deleteReleaseId;

      beforeEach(async () => {
        // Create a fresh release for each delete test
        const res = await request(app)
          .post('/api/v1/releases')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Release to Delete',
            version: 'v0.0.1',
            description: 'This release will be deleted'
          });
        deleteReleaseId = res.body.id;
      });

      it('should successfully delete a release (200)', async () => {
        const res = await request(app)
          .delete(`/api/v1/releases/${deleteReleaseId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('削除');
      });

      it('should return 403 for analyst trying to delete (insufficient permissions)', async () => {
        const res = await request(app)
          .delete(`/api/v1/releases/${deleteReleaseId}`)
          .set('Authorization', `Bearer ${analystToken}`);

        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toContain('権限');
      });

      it('should return 404 for non-existent release ID', async () => {
        const res = await request(app)
          .delete('/api/v1/releases/REL-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });
    });
  });

  // ===== C. Service Request Management =====
  describe('Service Request Management (service-requests)', () => {
    describe('PUT /api/v1/service-requests/:id', () => {
      beforeAll(async () => {
        // Create a test service request
        const res = await request(app)
          .post('/api/v1/service-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Test Service Request',
            description: 'Test service request for update testing',
            request_type: 'Software Install',
            priority: 'Medium'
          });
        testServiceRequestId = res.body.id;
      });

      it('should successfully update a service request (200)', async () => {
        const res = await request(app)
          .put(`/api/v1/service-requests/${testServiceRequestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Updated Service Request',
            status: 'In-Progress',
            priority: 'High'
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('更新');
        expect(res.body.changes).toBe(1);
      });

      it('should return 404 for non-existent service request ID', async () => {
        const res = await request(app)
          .put('/api/v1/service-requests/SR-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'Completed'
          });

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });

      it('should update service request to Completed status with timestamp', async () => {
        const res = await request(app)
          .put(`/api/v1/service-requests/${testServiceRequestId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'Completed'
          });

        expect(res.statusCode).toEqual(200);
      });

      it('should allow analyst to update service requests', async () => {
        // Create new request for this test
        const createRes = await request(app)
          .post('/api/v1/service-requests')
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            title: 'Analyst Test Request',
            description: 'Test for analyst update'
          });

        const res = await request(app)
          .put(`/api/v1/service-requests/${createRes.body.id}`)
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            status: 'In-Progress'
          });

        expect(res.statusCode).toEqual(200);
      });
    });

    describe('DELETE /api/v1/service-requests/:id', () => {
      let deleteRequestId;

      beforeEach(async () => {
        // Create a fresh service request for each delete test
        const res = await request(app)
          .post('/api/v1/service-requests')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Request to Delete',
            description: 'This request will be deleted'
          });
        deleteRequestId = res.body.id;
      });

      it('should successfully delete a service request (200)', async () => {
        const res = await request(app)
          .delete(`/api/v1/service-requests/${deleteRequestId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('削除');
      });

      it('should return 403 for analyst trying to delete (insufficient permissions)', async () => {
        const res = await request(app)
          .delete(`/api/v1/service-requests/${deleteRequestId}`)
          .set('Authorization', `Bearer ${analystToken}`);

        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toContain('権限');
      });

      it('should return 404 for non-existent service request ID', async () => {
        const res = await request(app)
          .delete('/api/v1/service-requests/SR-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });
    });
  });

  // ===== D. SLA Management =====
  describe('SLA Management (sla-agreements)', () => {
    describe('PUT /api/v1/sla-agreements/:id', () => {
      beforeAll(async () => {
        // Create a test SLA agreement
        const res = await request(app)
          .post('/api/v1/sla-agreements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            service_name: 'Test Service',
            metric_name: 'Test Metric',
            target_value: '99.9%'
          });
        testSlaId = res.body.sla_id;
      });

      it('should successfully update an SLA agreement (200)', async () => {
        const res = await request(app)
          .put(`/api/v1/sla-agreements/${testSlaId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            service_name: 'Updated Service',
            actual_value: '99.95%',
            achievement_rate: 100.5,
            status: 'Met'
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('更新');
        expect(res.body.changes).toBe(1);
      });

      it('should return 404 for non-existent SLA ID', async () => {
        const res = await request(app)
          .put('/api/v1/sla-agreements/SLA-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'Violated'
          });

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });

      it('should return 403 for analyst trying to update (insufficient permissions)', async () => {
        const res = await request(app)
          .put(`/api/v1/sla-agreements/${testSlaId}`)
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            status: 'At-Risk'
          });

        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toContain('権限');
      });

      it('should update SLA measurement period', async () => {
        const res = await request(app)
          .put(`/api/v1/sla-agreements/${testSlaId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            measurement_period: 'Weekly'
          });

        expect(res.statusCode).toEqual(200);
      });
    });

    describe('DELETE /api/v1/sla-agreements/:id', () => {
      let deleteSlaId;

      beforeEach(async () => {
        // Create a fresh SLA agreement for each delete test
        const res = await request(app)
          .post('/api/v1/sla-agreements')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            service_name: 'SLA to Delete',
            metric_name: 'Delete Metric',
            target_value: '100%'
          });
        deleteSlaId = res.body.sla_id;
      });

      it('should successfully delete an SLA agreement (200)', async () => {
        const res = await request(app)
          .delete(`/api/v1/sla-agreements/${deleteSlaId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('削除');
      });

      it('should return 403 for analyst trying to delete (insufficient permissions - admin only)', async () => {
        const res = await request(app)
          .delete(`/api/v1/sla-agreements/${deleteSlaId}`)
          .set('Authorization', `Bearer ${analystToken}`);

        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toContain('権限');
      });

      it('should return 404 for non-existent SLA ID', async () => {
        const res = await request(app)
          .delete('/api/v1/sla-agreements/SLA-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });
    });
  });

  // ===== E. Asset Management =====
  describe('Asset Management (assets)', () => {
    describe('PUT /api/v1/assets/:id', () => {
      beforeAll(async () => {
        // Create a test asset
        testAssetTag = `TEST-${Date.now().toString().slice(-6)}`;
        await request(app)
          .post('/api/v1/assets')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            asset_tag: testAssetTag,
            name: 'Test Asset',
            type: 'Server',
            criticality: 3,
            status: 'Operational'
          });
      });

      it('should successfully update an asset (200)', async () => {
        const res = await request(app)
          .put(`/api/v1/assets/${testAssetTag}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Updated Asset Name',
            type: 'Network',
            criticality: 5,
            status: 'Maintenance'
          });

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('更新');
        expect(res.body.changes).toBe(1);
      });

      it('should return 404 for non-existent asset tag', async () => {
        const res = await request(app)
          .put('/api/v1/assets/ASSET-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: 'Decommissioned'
          });

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });

      it('should return 403 for analyst trying to update (insufficient permissions)', async () => {
        const res = await request(app)
          .put(`/api/v1/assets/${testAssetTag}`)
          .set('Authorization', `Bearer ${analystToken}`)
          .send({
            status: 'Offline'
          });

        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toContain('権限');
      });

      it('should update asset criticality level', async () => {
        const res = await request(app)
          .put(`/api/v1/assets/${testAssetTag}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            criticality: 1
          });

        expect(res.statusCode).toEqual(200);
      });
    });

    describe('DELETE /api/v1/assets/:id', () => {
      let deleteAssetTag;

      beforeEach(async () => {
        // Create a fresh asset for each delete test
        deleteAssetTag = `DEL-${Date.now().toString().slice(-6)}`;
        await request(app)
          .post('/api/v1/assets')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            asset_tag: deleteAssetTag,
            name: 'Asset to Delete',
            type: 'Endpoint'
          });
      });

      it('should successfully delete an asset (200)', async () => {
        const res = await request(app)
          .delete(`/api/v1/assets/${deleteAssetTag}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.message).toContain('削除');
      });

      it('should return 403 for analyst trying to delete (insufficient permissions - admin only)', async () => {
        const res = await request(app)
          .delete(`/api/v1/assets/${deleteAssetTag}`)
          .set('Authorization', `Bearer ${analystToken}`);

        expect(res.statusCode).toEqual(403);
        expect(res.body.error).toContain('権限');
      });

      it('should return 404 for non-existent asset tag', async () => {
        const res = await request(app)
          .delete('/api/v1/assets/ASSET-NONEXISTENT-999')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.statusCode).toEqual(404);
        expect(res.body.error).toContain('見つかりません');
      });
    });
  });

  // ===== Authentication Tests for CRUD Operations =====
  describe('Authentication Requirements', () => {
    it('should return 401 for PUT without authentication', async () => {
      const res = await request(app).put('/api/v1/problems/PRB-123').send({ status: 'Resolved' });

      expect(res.statusCode).toEqual(401);
    });

    it('should return 401 for DELETE without authentication', async () => {
      const res = await request(app).delete('/api/v1/releases/REL-123');

      expect(res.statusCode).toEqual(401);
    });

    it('should return 403 with invalid token', async () => {
      const res = await request(app)
        .put('/api/v1/service-requests/SR-123')
        .set('Authorization', 'Bearer invalid-token')
        .send({ status: 'Completed' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toContain('無効');
    });
  });
});
