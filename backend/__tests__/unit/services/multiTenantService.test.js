/**
 * Multi-Tenant Service Unit Tests
 */

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
};

jest.mock('../../../db', () => ({
  db: mockDb
}));

describe('Multi-Tenant Service Unit Tests', () => {
  let multiTenantService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    multiTenantService = require('../../../services/multiTenantService');
  });

  describe('createTenant', () => {
    it('should create a new tenant', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null); // No existing tenant
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const tenantData = {
        tenantId: 'test-tenant',
        name: 'Test Tenant',
        description: 'Test Description',
        adminUsername: 'admin',
        domain: 'test.example.com',
        settings: { key: 'value' }
      };

      const tenant = await multiTenantService.createTenant(tenantData);

      expect(tenant.id).toBe('test-tenant');
      expect(tenant.name).toBe('Test Tenant');
      expect(tenant.status).toBe('active');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenants'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should reject duplicate tenant ID', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { tenant_id: 'existing' }); // Existing tenant
      });

      await expect(
        multiTenantService.createTenant({ tenantId: 'existing', name: 'Test' })
      ).rejects.toThrow('Tenant ID already exists');
    });

    it('should reject missing tenant ID', async () => {
      await expect(multiTenantService.createTenant({ name: 'Test' })).rejects.toThrow(
        'Tenant ID and name are required'
      );
    });

    it('should reject missing name', async () => {
      await expect(multiTenantService.createTenant({ tenantId: 'test' })).rejects.toThrow(
        'Tenant ID and name are required'
      );
    });
  });

  describe('getTenantById', () => {
    it('should return tenant from database', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          tenant_id: 'test',
          name: 'Test Tenant',
          description: 'Description',
          admin_username: 'admin',
          domain: 'test.com',
          settings: '{"key":"value"}',
          created_at: '2024-01-01T00:00:00Z',
          status: 'active'
        });
      });

      const tenant = await multiTenantService.getTenantById('test');

      expect(tenant.id).toBe('test');
      expect(tenant.name).toBe('Test Tenant');
      expect(tenant.settings).toEqual({ key: 'value' });
    });

    it('should return null when tenant not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const tenant = await multiTenantService.getTenantById('nonexistent');

      expect(tenant).toBeNull();
    });

    it('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      await expect(multiTenantService.getTenantById('test')).rejects.toThrow('DB error');
    });
  });

  describe('resolveTenant', () => {
    it('should resolve tenant from header', async () => {
      const req = {
        headers: { 'x-tenant-id': 'header-tenant' },
        subdomains: [],
        hostname: 'example.com'
      };

      const tenantId = await multiTenantService.resolveTenant(req);

      expect(tenantId).toBe('header-tenant');
    });

    it('should resolve tenant from subdomain', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          tenant_id: 'subdomain-tenant',
          name: 'Subdomain',
          domain: 'sub.example.com',
          settings: '{}',
          status: 'active'
        });
      });

      const req = {
        headers: {},
        subdomains: ['sub'],
        hostname: 'example.com',
        user: null
      };

      const tenantId = await multiTenantService.resolveTenant(req);

      expect(tenantId).toBe('subdomain-tenant');
    });

    it('should resolve tenant from JWT token', async () => {
      const req = {
        headers: {},
        subdomains: [],
        hostname: 'example.com',
        user: { tenantId: 'jwt-tenant' }
      };

      const tenantId = await multiTenantService.resolveTenant(req);

      expect(tenantId).toBe('jwt-tenant');
    });

    it('should default to "default" tenant', async () => {
      const req = {
        headers: {},
        subdomains: [],
        hostname: 'example.com',
        user: null
      };

      const tenantId = await multiTenantService.resolveTenant(req);

      expect(tenantId).toBe('default');
    });
  });

  describe('getTenantByDomain', () => {
    it('should return tenant by domain', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          tenant_id: 'domain-tenant',
          name: 'Domain Tenant',
          domain: 'test.com',
          settings: '{}',
          created_at: '2024-01-01',
          status: 'active'
        });
      });

      const tenant = await multiTenantService.getTenantByDomain('test.com');

      expect(tenant.id).toBe('domain-tenant');
    });

    it('should return null when domain not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const tenant = await multiTenantService.getTenantByDomain('nonexistent.com');

      expect(tenant).toBeNull();
    });
  });

  describe('assignUserToTenant', () => {
    it('should assign user to tenant', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await multiTenantService.assignUserToTenant('testuser', 'tenant1', 'admin');

      expect(result).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO user_tenants'),
        expect.arrayContaining(['testuser', 'tenant1', 'admin']),
        expect.any(Function)
      );
    });

    it('should use default role "user"', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      await multiTenantService.assignUserToTenant('testuser', 'tenant1');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['testuser', 'tenant1', 'user']),
        expect.any(Function)
      );
    });
  });

  describe('getUserTenants', () => {
    it('should return user tenants', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { tenant_id: 't1', role: 'admin', name: 'Tenant 1', domain: 't1.com' },
          { tenant_id: 't2', role: 'user', name: 'Tenant 2', domain: 't2.com' }
        ]);
      });

      const tenants = await multiTenantService.getUserTenants('testuser');

      expect(tenants).toHaveLength(2);
      expect(tenants[0].tenant_id).toBe('t1');
    });

    it('should return empty array when no tenants', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const tenants = await multiTenantService.getUserTenants('testuser');

      expect(tenants).toEqual([]);
    });
  });

  describe('getTenantUsers', () => {
    it('should return tenant users', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { username: 'user1', email: 'user1@test.com', role: 'admin', assigned_at: '2024-01-01' },
          { username: 'user2', email: 'user2@test.com', role: 'user', assigned_at: '2024-01-02' }
        ]);
      });

      const users = await multiTenantService.getTenantUsers('tenant1');

      expect(users).toHaveLength(2);
      expect(users[0].username).toBe('user1');
    });

    it('should return empty array when no users', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const users = await multiTenantService.getTenantUsers('tenant1');

      expect(users).toEqual([]);
    });
  });

  describe('createTenantSchema', () => {
    it('should create tenant-specific tables', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      await multiTenantService.createTenantSchema('test');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS test_incidents'),
        expect.any(Array),
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS test_assets'),
        expect.any(Array),
        expect.any(Function)
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS test_audit_logs'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should handle schema creation errors', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Schema error'));
      });

      await expect(multiTenantService.createTenantSchema('test')).rejects.toThrow('Schema error');
    });
  });

  describe('updateTenantSettings', () => {
    it('should update tenant settings', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await multiTenantService.updateTenantSettings('test', { key: 'newvalue' });

      expect(result).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenants SET settings'),
        expect.arrayContaining([JSON.stringify({ key: 'newvalue' })]),
        expect.any(Function)
      );
    });
  });

  describe('deactivateTenant', () => {
    it('should deactivate tenant', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await multiTenantService.deactivateTenant('test');

      expect(result).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenants SET status = "inactive"'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('getTenantStats', () => {
    it('should return tenant statistics', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ username: 'u1' }, { username: 'u2' }]);
      });
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { count: 10 }); // incidents
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { count: 5 }); // assets
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { count: 20 }); // audit logs
        });

      const stats = await multiTenantService.getTenantStats('test');

      expect(stats.users).toBe(2);
      expect(stats.incidents).toBe(10);
      expect(stats.assets).toBe(5);
      expect(stats.auditLogs).toBe(20);
    });
  });

  describe('getAllTenants', () => {
    it('should return all tenants', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { tenant_id: 't1', name: 'Tenant 1', domain: 't1.com', status: 'active' },
          { tenant_id: 't2', name: 'Tenant 2', domain: 't2.com', status: 'inactive' }
        ]);
      });

      const tenants = await multiTenantService.getAllTenants();

      expect(tenants).toHaveLength(2);
    });

    it('should return empty array when no tenants', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const tenants = await multiTenantService.getAllTenants();

      expect(tenants).toEqual([]);
    });
  });

  describe('tenantMiddleware', () => {
    it('should add tenant to request', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, {
          tenant_id: 'test',
          name: 'Test',
          settings: '{}',
          status: 'active'
        });
      });

      const middleware = multiTenantService.tenantMiddleware();
      const req = { headers: { 'x-tenant-id': 'test' }, subdomains: [] };
      const res = {};
      const next = jest.fn();

      await middleware(req, res, next);

      expect(req.tenantId).toBe('test');
      expect(req.tenant).toBeTruthy();
      expect(next).toHaveBeenCalled();
    });

    it('should return 404 for non-existent tenant', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const middleware = multiTenantService.tenantMiddleware();
      const req = { headers: { 'x-tenant-id': 'nonexistent' }, subdomains: [] };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Tenant not found' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow default tenant without database check', async () => {
      const middleware = multiTenantService.tenantMiddleware();
      const req = { headers: {}, subdomains: [], user: null, hostname: 'test.com' };
      const res = {};
      const next = jest.fn();

      await middleware(req, res, next);

      expect(req.tenantId).toBe('default');
      expect(next).toHaveBeenCalled();
    });

    it('should handle middleware errors', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      const middleware = multiTenantService.tenantMiddleware();
      const req = { headers: { 'x-tenant-id': 'test' }, subdomains: [] };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
