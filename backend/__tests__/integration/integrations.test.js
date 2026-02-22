/**
 * Integration API Routes - Integration Tests
 *
 * Tests for external integration endpoints (Microsoft 365, ServiceNow, Custom)
 *
 * Coverage target: Branches 0% → 60%+
 */

const request = require('supertest');
const { app, dbReady } = require('../../server');
const knex = require('../../knex');

// Mock external services with manual implementation
jest.mock('../../services/microsoftGraphService', () => ({
  microsoftGraphService: {
    isConfigured: jest.fn(),
    testConnection: jest.fn(),
    getUsers: jest.fn(),
    transformUserForITSM: jest.fn(),
    createChangeRequestEvent: jest.fn()
  }
}));

jest.mock('../../services/serviceNowService', () => ({
  isConfigured: jest.fn(),
  getSyncStatus: jest.fn(),
  testConnection: jest.fn(),
  getIncidents: jest.fn(),
  getChangeRequests: jest.fn(),
  transformIncidentFromServiceNow: jest.fn(),
  transformChangeFromServiceNow: jest.fn()
}));

const { microsoftGraphService } = require('../../services/microsoftGraphService');
const serviceNowService = require('../../services/serviceNowService');

describe('Integration API Routes', () => {
  let adminToken;
  let managerToken;
  let analystToken;

  // ========================================
  // Helper Functions (defined before use to avoid no-use-before-define)
  // ========================================

  /**
   * Setup default mock implementations
   */
  function setupDefaultMocks() {
    // Microsoft Graph Service - default: not configured
    microsoftGraphService.isConfigured.mockReturnValue(false);
    microsoftGraphService.testConnection.mockRejectedValue(
      new Error('Microsoft Graph API は無効化されています')
    );
    microsoftGraphService.getUsers.mockResolvedValue([]);
    microsoftGraphService.transformUserForITSM.mockImplementation((user) => ({
      external_id: user.id,
      username: user.userPrincipalName?.split('@')[0] || 'unknown',
      email: user.mail,
      full_name: user.displayName,
      is_active: user.accountEnabled,
      department: user.department,
      job_title: user.jobTitle
    }));
    microsoftGraphService.createChangeRequestEvent.mockResolvedValue({
      id: 'mock-event-123',
      webLink: 'https://outlook.office.com/calendar/mock'
    });

    // ServiceNow Service - default: not configured
    serviceNowService.isConfigured.mockReturnValue(false);
    serviceNowService.getSyncStatus.mockReturnValue({
      configured: false,
      instanceUrl: null,
      authMethod: 'basic',
      hasCredentials: false
    });
    serviceNowService.testConnection.mockResolvedValue({
      success: false,
      message: 'Not configured'
    });
    serviceNowService.getIncidents.mockResolvedValue([]);
    serviceNowService.getChangeRequests.mockResolvedValue([]);
    serviceNowService.transformIncidentFromServiceNow.mockImplementation((incident) => ({
      external_id: incident.sys_id,
      title: incident.short_description,
      description: incident.description || incident.short_description,
      priority: incident.priority === '1' ? 'Critical' : 'High',
      status: 'Open',
      category: 'general',
      reporter: 'admin',
      assigned_to: incident.assigned_to
    }));
    serviceNowService.transformChangeFromServiceNow.mockImplementation((change) => ({
      external_id: change.sys_id,
      change_id: change.number,
      title: change.short_description,
      description: change.description || change.short_description,
      type: 'standard',
      priority: 'medium',
      status: 'Pending',
      requester: 'admin',
      impact_level: 'medium',
      risk_level: 'low'
    }));
  }

  /**
   * Setup Microsoft Graph mocks for configured state
   */
  function setupMicrosoftGraphMocks(configured = true) {
    microsoftGraphService.isConfigured.mockReturnValue(configured);

    if (configured) {
      microsoftGraphService.testConnection.mockResolvedValue({
        success: true,
        message: 'Microsoft 365 connection successful'
      });
      microsoftGraphService.getUsers.mockResolvedValue([
        {
          id: 'user-m365-001',
          displayName: 'M365 Test User',
          userPrincipalName: 'm365user@example.com',
          mail: 'm365user@example.com',
          accountEnabled: true,
          department: 'IT',
          jobTitle: 'Engineer'
        }
      ]);
    }
  }

  /**
   * Setup ServiceNow mocks for configured state
   */
  function setupServiceNowMocks(configured = true) {
    serviceNowService.isConfigured.mockReturnValue(configured);

    if (configured) {
      serviceNowService.getSyncStatus.mockReturnValue({
        configured: true,
        instanceUrl: 'https://test.service-now.com',
        authMethod: 'basic',
        hasCredentials: true
      });
      serviceNowService.testConnection.mockResolvedValue({
        success: true,
        message: 'ServiceNow connection successful'
      });
      serviceNowService.getIncidents.mockResolvedValue([
        {
          sys_id: 'snow-inc-001',
          number: 'INC0012345',
          short_description: 'ServiceNow Test Incident',
          description: 'Test Description',
          priority: '2',
          state: '1',
          assigned_to: 'admin'
        }
      ]);
      serviceNowService.getChangeRequests.mockResolvedValue([
        {
          sys_id: 'snow-chg-001',
          number: 'CHG0012345',
          short_description: 'ServiceNow Test Change',
          description: 'Test Change Description',
          priority: '3',
          state: 'pending',
          assigned_to: 'manager'
        }
      ]);
    } else {
      serviceNowService.testConnection.mockResolvedValue({
        success: false,
        message: 'Not configured'
      });
    }
  }

  // ========================================
  // Setup & Teardown
  // ========================================

  beforeAll(async () => {
    await dbReady;

    // Login as admin
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminRes.body.token;

    // Login as manager
    const managerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'manager', password: 'manager123' });
    managerToken = managerRes.body.token;

    // Login as analyst
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });
    analystToken = analystRes.body.token;

    // Note: Calendar integration tests would require test change request
    // Currently not needed for basic integration tests
  });

  afterAll(async () => {
    // Clean up test data
    await knex('integration_settings').delete();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock implementations
    setupDefaultMocks();
  });

  // ========================================
  // Test Suites
  // ========================================

  describe('Authentication & Authorization', () => {
    it('should return 401 for GET / without authentication', async () => {
      const res = await request(app).get('/api/v1/integrations');

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for GET / with analyst role (insufficient permissions)', async () => {
      const res = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 for POST / without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/integrations')
        .send({ integration: 'test', settings: {} });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 for POST / with manager role (admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ integration: 'test', settings: {} });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/integrations - List Integration Settings', () => {
    it('should return all integration settings with admin authentication', async () => {
      setupMicrosoftGraphMocks(false);
      setupServiceNowMocks(false);

      const res = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('integrations');
      expect(res.body.integrations).toHaveProperty('microsoft365');
      expect(res.body.integrations).toHaveProperty('servicenow');
      expect(res.body.integrations).toHaveProperty('custom');
      expect(res.body.integrations.microsoft365.configured).toBe(false);
      expect(res.body.integrations.servicenow.configured).toBe(false);
    });

    it('should return Microsoft 365 as configured when enabled', async () => {
      setupMicrosoftGraphMocks(true);
      setupServiceNowMocks(false);

      const res = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.integrations.microsoft365.configured).toBe(true);
    });

    it('should return ServiceNow as configured when enabled', async () => {
      setupMicrosoftGraphMocks(false);
      setupServiceNowMocks(true);

      const res = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.integrations.servicenow.configured).toBe(true);
      expect(res.body.integrations.servicenow.settings.instanceUrl).toContain('service-now.com');
    });

    it('should include custom settings from database', async () => {
      // Insert test custom setting with secret
      await knex('integration_settings').insert({
        integration_name: 'custom_api',
        setting_key: 'api_key',
        setting_value: 'secret-api-key-12345',
        is_secret: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.integrations.custom).toBeInstanceOf(Object);
      expect(Object.keys(res.body.integrations.custom).length).toBeGreaterThan(0);

      // Custom settings structure: { integration_name: { setting_key: value, ... }, ... }
      expect(res.body.integrations.custom).toHaveProperty('custom_api');
      expect(res.body.integrations.custom.custom_api).toHaveProperty('api_key');
      expect(res.body.integrations.custom.custom_api.api_key).toBe('********'); // Masked secret

      // Cleanup
      await knex('integration_settings').where('integration_name', 'custom_api').delete();
    });

    it('should include custom settings without secrets unmasked', async () => {
      // Insert test custom setting without secret
      await knex('integration_settings').insert({
        integration_name: 'custom_config',
        setting_key: 'api_url',
        setting_value: 'https://api.example.com',
        is_secret: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .get('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);

      // Custom settings structure: { integration_name: { setting_key: value, ... }, ... }
      expect(res.body.integrations.custom).toHaveProperty('custom_config');
      expect(res.body.integrations.custom.custom_config).toHaveProperty('api_url');
      expect(res.body.integrations.custom.custom_config.api_url).toBe('https://api.example.com'); // Not masked

      // Cleanup
      await knex('integration_settings').where('integration_name', 'custom_config').delete();
    });
  });

  describe('POST /api/v1/integrations - Save Integration Settings', () => {
    afterEach(async () => {
      // Clean up test settings after each test
      await knex('integration_settings')
        .whereIn('integration_name', ['test_integration', 'custom_api', 'slack'])
        .delete();
    });

    it('should return 400 if integration parameter is missing', async () => {
      const res = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ settings: { api_key: 'test' } });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('integration');
    });

    it('should return 400 if settings parameter is missing', async () => {
      const res = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ integration: 'test_integration' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('settings');
    });

    it('should save new integration settings successfully', async () => {
      const res = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          integration: 'test_integration',
          settings: {
            api_url: 'https://api.test.com',
            api_key: 'test-key-12345',
            timeout: '30'
          }
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('保存しました');

      // Verify database records
      const savedSettings = await knex('integration_settings')
        .where('integration_name', 'test_integration')
        .orderBy('setting_key');

      expect(savedSettings.length).toBe(3);

      // Check secret field detection
      const apiKeySetting = savedSettings.find((s) => s.setting_key === 'api_key');
      expect(apiKeySetting.is_secret).toBe(1); // Should be marked as secret
    });

    it('should update existing integration settings (UPSERT)', async () => {
      // First insert
      await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          integration: 'custom_api',
          settings: { api_key: 'old-key' }
        });

      // Update with new value
      const res = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          integration: 'custom_api',
          settings: { api_key: 'new-key-updated' }
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify updated value
      const updatedSetting = await knex('integration_settings')
        .where({ integration_name: 'custom_api', setting_key: 'api_key' })
        .first();

      expect(updatedSetting.setting_value).toBe('new-key-updated');
    });

    it('should detect secret fields automatically (api_key, password, client_secret)', async () => {
      const res = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          integration: 'slack',
          settings: {
            webhook_url: 'https://hooks.slack.com/services/T00/B00/XXX',
            client_secret: 'secret-12345',
            password: 'pass123',
            api_key: 'key-12345',
            username: 'slackbot' // Not a secret
          }
        });

      expect(res.statusCode).toBe(200);

      const savedSettings = await knex('integration_settings')
        .where('integration_name', 'slack')
        .orderBy('setting_key');

      // Check is_secret flags
      const secretFields = savedSettings.filter((s) => s.is_secret === 1).map((s) => s.setting_key);
      const nonSecretFields = savedSettings
        .filter((s) => s.is_secret === 0)
        .map((s) => s.setting_key);

      expect(secretFields).toContain('api_key');
      expect(secretFields).toContain('password');
      expect(secretFields).toContain('client_secret');
      expect(nonSecretFields).toContain('username');
      expect(nonSecretFields).toContain('webhook_url');
    });

    it('should return 403 for analyst role (admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/integrations')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          integration: 'test',
          settings: { key: 'value' }
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/integrations/test/microsoft365 - M365 Connection Test', () => {
    it('should test connection successfully when configured', async () => {
      microsoftGraphService.isConfigured.mockReturnValue(true);
      microsoftGraphService.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful'
      });

      const res = await request(app)
        .post('/api/v1/integrations/test/microsoft365')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('successful');
      expect(microsoftGraphService.testConnection).toHaveBeenCalled();
    });

    it('should return failure when connection test fails', async () => {
      microsoftGraphService.isConfigured.mockReturnValue(true);
      microsoftGraphService.testConnection.mockResolvedValue({
        success: false,
        message: 'Authentication failed'
      });

      const res = await request(app)
        .post('/api/v1/integrations/test/microsoft365')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('failed');
    });

    it('should handle service errors gracefully', async () => {
      microsoftGraphService.isConfigured.mockReturnValue(true);
      microsoftGraphService.testConnection.mockRejectedValue(new Error('Network timeout'));

      const res = await request(app)
        .post('/api/v1/integrations/test/microsoft365')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('should return 403 for manager role (admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/test/microsoft365')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/integrations/test/servicenow - ServiceNow Connection Test', () => {
    it('should test connection successfully when configured', async () => {
      setupServiceNowMocks(true);

      const res = await request(app)
        .post('/api/v1/integrations/test/servicenow')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(serviceNowService.testConnection).toHaveBeenCalled();
    });

    it('should return failure when connection test fails', async () => {
      serviceNowService.isConfigured.mockReturnValue(true);
      serviceNowService.testConnection.mockResolvedValue({
        success: false,
        message: 'Invalid credentials'
      });

      const res = await request(app)
        .post('/api/v1/integrations/test/servicenow')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
    });

    it('should handle service errors gracefully', async () => {
      serviceNowService.isConfigured.mockReturnValue(true);
      serviceNowService.testConnection.mockRejectedValue(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/v1/integrations/test/servicenow')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(500);
    });

    it('should return 403 for analyst role', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/test/servicenow')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/integrations/sync/microsoft365/users - M365 User Sync', () => {
    it('should return 400 if Microsoft 365 is not configured', async () => {
      setupMicrosoftGraphMocks(false);

      const res = await request(app)
        .post('/api/v1/integrations/sync/microsoft365/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activeOnly: true });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('設定されていません');
    });

    it('should sync users successfully with activeOnly=true', async () => {
      setupMicrosoftGraphMocks(true);

      const res = await request(app)
        .post('/api/v1/integrations/sync/microsoft365/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activeOnly: true });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats).toHaveProperty('processed');
      expect(microsoftGraphService.getUsers).toHaveBeenCalled();
    });

    it('should skip users with missing username or email', async () => {
      setupMicrosoftGraphMocks(true);

      microsoftGraphService.getUsers.mockResolvedValue([
        {
          id: 'user-no-username',
          displayName: 'No Username User',
          mail: 'nouser@example.com',
          accountEnabled: true
        }
      ]);
      microsoftGraphService.transformUserForITSM.mockReturnValue({
        external_id: 'user-no-username',
        username: null, // Missing username
        email: 'nouser@example.com',
        full_name: 'No Username User'
      });

      const res = await request(app)
        .post('/api/v1/integrations/sync/microsoft365/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.stats.skipped).toBeGreaterThan(0);
    });

    it('should return 403 for analyst role (admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/sync/microsoft365/users')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({});

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/integrations/sync/servicenow/incidents - ServiceNow Incident Sync', () => {
    it('should return 400 if ServiceNow is not configured', async () => {
      setupServiceNowMocks(false);

      const res = await request(app)
        .post('/api/v1/integrations/sync/servicenow/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should sync incidents successfully', async () => {
      setupServiceNowMocks(true);

      const res = await request(app)
        .post('/api/v1/integrations/sync/servicenow/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ limit: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('stats');
      expect(serviceNowService.getIncidents).toHaveBeenCalled();
    });

    it('should return 403 for analyst role', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/sync/servicenow/incidents')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({});

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/integrations/sync/servicenow/changes - ServiceNow Change Sync', () => {
    it('should return 400 if ServiceNow is not configured', async () => {
      setupServiceNowMocks(false);

      const res = await request(app)
        .post('/api/v1/integrations/sync/servicenow/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should sync change requests successfully', async () => {
      setupServiceNowMocks(true);

      const res = await request(app)
        .post('/api/v1/integrations/sync/servicenow/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ limit: 5 });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('stats');
      expect(serviceNowService.getChangeRequests).toHaveBeenCalled();
    });

    it('should return 403 for analyst role', async () => {
      const res = await request(app)
        .post('/api/v1/integrations/sync/servicenow/changes')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({});

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/integrations/m365/status - M365 Status', () => {
    it('should return M365 status successfully', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/m365/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('configured');
    });

    it('should return 403 for analyst role', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/m365/status')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/integrations/servicenow/status - ServiceNow Status', () => {
    it('should return ServiceNow status successfully', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/servicenow/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('configured');
    });

    it('should return 403 for analyst role', async () => {
      const res = await request(app)
        .get('/api/v1/integrations/servicenow/status')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
