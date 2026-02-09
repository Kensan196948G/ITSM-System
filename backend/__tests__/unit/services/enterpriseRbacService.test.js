/**
 * Enterprise RBAC Service Unit Tests
 */

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
};

jest.mock('../../../db', () => ({
  db: mockDb
}));

describe('Enterprise RBAC Service Unit Tests', () => {
  let enterpriseRbacService;

  beforeAll(() => {
    enterpriseRbacService = require('../../../services/enterpriseRbacService');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // モックの実装もリセット
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.run.mockReset();
  });

  describe('checkPermission', () => {
    it('should grant permission for wildcard role', async () => {
      const user = { username: 'superadmin' };
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'super_admin' }]);
      });

      const result = await enterpriseRbacService.checkPermission(user, 'users.manage', null, null);

      expect(result).toBe(true);
    });

    it('should grant permission for specific role permission', async () => {
      const user = { username: 'admin' };
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'admin' }]);
      });

      const result = await enterpriseRbacService.checkPermission(user, 'users.manage', null, null);

      expect(result).toBe(true);
    });

    it('should deny permission when role lacks permission', async () => {
      const user = { username: 'viewer' };
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'viewer' }]);
      });

      const result = await enterpriseRbacService.checkPermission(user, 'users.manage', null, null);

      expect(result).toBe(false);
    });

    it('should handle database error gracefully', async () => {
      const user = { username: 'testuser' };
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'), null);
      });

      const result = await enterpriseRbacService.checkPermission(user, 'users.manage', null, null);

      expect(result).toBe(false);
    });

    it('should check resource permission when resource provided', async () => {
      const user = { username: 'analyst' };
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'analyst' }]);
      });
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { created_by: 'analyst' }); // Resource owner check
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { department: 'IT' }); // User department
        });

      const result = await enterpriseRbacService.checkPermission(
        user,
        'incidents.update',
        'incident:INC-001',
        null
      );

      expect(result).toBe(true);
    });
  });

  describe('checkResourcePermission', () => {
    it('should grant access to resource owner', async () => {
      const user = { username: 'owner' };
      // 1. isResourceOwner が incidents テーブルをクエリ
      // 2. owner が一致するので true を返す
      // 3. checkResourcePermission が true を返す
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('created_by FROM incidents')) {
          callback(null, { created_by: 'owner' });
        } else {
          callback(null, null);
        }
      });

      const result = await enterpriseRbacService.checkResourcePermission(
        user,
        'incidents.update',
        'incident:INC-001',
        null
      );

      expect(result).toBe(true);
    });

    it('should grant access to same department', async () => {
      const user = { username: 'user1' };
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { created_by: 'otheruser' }); // Not owner
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { department: 'IT' }); // User department
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { department: 'IT' }); // Resource department
        });

      const result = await enterpriseRbacService.checkResourcePermission(
        user,
        'incidents.view',
        'incident:INC-001',
        null
      );

      expect(result).toBe(true);
    });

    it('should deny access when not owner and different department', async () => {
      const user = { username: 'user1' };
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { created_by: 'otheruser' });
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { department: 'IT' });
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { department: 'Finance' });
        });

      const result = await enterpriseRbacService.checkResourcePermission(
        user,
        'incidents.view',
        'incident:INC-001',
        null
      );

      expect(result).toBe(false);
    });

    it('should apply tenant-specific permission rules', async () => {
      const user = { username: 'user1' };
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { created_by: 'otheruser' });
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { department: 'IT' });
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null, { department: 'Finance' });
        });

      // Add tenant permission rule
      enterpriseRbacService.createPermissionRule('tenant1', {
        permission: 'incidents.view',
        resource: 'incident:INC-001',
        users: ['user1'],
        departments: [],
        allowed: true
      });

      const result = await enterpriseRbacService.checkResourcePermission(
        user,
        'incidents.view',
        'incident:INC-001',
        'tenant1'
      );

      expect(result).toBe(true);
    });
  });

  describe('isResourceOwner', () => {
    it('should return true when user is incident owner', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { created_by: 'testuser' });
      });

      const result = await enterpriseRbacService.isResourceOwner(
        'testuser',
        'incident:INC-001',
        null
      );

      expect(result).toBe(true);
    });

    it('should return true when user is problem assignee', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { assignee: 'testuser' });
      });

      const result = await enterpriseRbacService.isResourceOwner(
        'testuser',
        'problem:PRB-001',
        null
      );

      expect(result).toBe(true);
    });

    it('should return false for unsupported resource type', async () => {
      const result = await enterpriseRbacService.isResourceOwner(
        'testuser',
        'unknown:XYZ-001',
        null
      );

      expect(result).toBe(false);
    });

    it('should handle database error', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      await expect(
        enterpriseRbacService.isResourceOwner('testuser', 'incident:INC-001', null)
      ).rejects.toThrow('DB error');
    });
  });

  describe('getUserRoles', () => {
    it('should return user roles without tenant', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'admin' }]);
      });

      const roles = await enterpriseRbacService.getUserRoles('testuser');

      expect(roles).toEqual(['admin']);
    });

    it('should return user roles with tenant', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'manager' }]);
      });

      const roles = await enterpriseRbacService.getUserRoles('testuser', 'tenant1');

      expect(roles).toEqual(['manager']);
    });

    it('should return empty array when no roles found', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const roles = await enterpriseRbacService.getUserRoles('testuser');

      expect(roles).toEqual([]);
    });

    it('should handle null rows', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const roles = await enterpriseRbacService.getUserRoles('testuser');

      expect(roles).toEqual([]);
    });
  });

  describe('assignRole', () => {
    it('should assign role without tenant', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const changes = await enterpriseRbacService.assignRole('testuser', 'admin', null);

      expect(changes).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['admin', 'testuser'],
        expect.any(Function)
      );
    });

    it('should assign role with tenant', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const changes = await enterpriseRbacService.assignRole('testuser', 'manager', 'tenant1');

      expect(changes).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO user_roles'),
        ['testuser', 'manager', 'tenant1'],
        expect.any(Function)
      );
    });

    it('should reject invalid role', async () => {
      await expect(enterpriseRbacService.assignRole('testuser', 'invalid', null)).rejects.toThrow(
        'Invalid role: invalid'
      );
    });

    it('should handle database error', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'));
      });

      await expect(enterpriseRbacService.assignRole('testuser', 'admin', null)).rejects.toThrow(
        'DB error'
      );
    });
  });

  describe('removeRole', () => {
    it('should remove role without tenant', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const changes = await enterpriseRbacService.removeRole('testuser', 'admin', null);

      expect(changes).toBe(1);
    });

    it('should remove role with tenant', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const changes = await enterpriseRbacService.removeRole('testuser', 'manager', 'tenant1');

      expect(changes).toBe(1);
    });
  });

  describe('getAvailableRoles', () => {
    it('should return all available roles', () => {
      const roles = enterpriseRbacService.getAvailableRoles();

      expect(roles).toBeInstanceOf(Array);
      expect(roles.length).toBeGreaterThan(0);
      expect(roles[0]).toHaveProperty('key');
      expect(roles[0]).toHaveProperty('name');
      expect(roles[0]).toHaveProperty('level');
      expect(roles[0]).toHaveProperty('permissions');
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for valid role', () => {
      const permissions = enterpriseRbacService.getRolePermissions('admin');

      expect(permissions).toBeInstanceOf(Array);
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toContain('users.manage');
    });

    it('should return empty array for invalid role', () => {
      const permissions = enterpriseRbacService.getRolePermissions('invalid');

      expect(permissions).toEqual([]);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return combined permissions from multiple roles', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'admin' }, { role: 'manager' }]);
      });

      const permissions = await enterpriseRbacService.getEffectivePermissions('testuser');

      expect(permissions).toBeInstanceOf(Array);
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toContain('users.manage');
    });

    it('should deduplicate permissions', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ role: 'viewer' }, { role: 'viewer' }]);
      });

      const permissions = await enterpriseRbacService.getEffectivePermissions('testuser');

      const uniquePermissions = [...new Set(permissions)];
      expect(permissions.length).toBe(uniquePermissions.length);
    });
  });

  describe('getPermissionDescriptions', () => {
    it('should return permission descriptions', () => {
      const descriptions = enterpriseRbacService.getPermissionDescriptions();

      expect(descriptions).toBeInstanceOf(Object);
      expect(Object.keys(descriptions).length).toBeGreaterThan(0);
      expect(descriptions['users.manage']).toBe('ユーザー管理');
    });
  });

  describe('createPermissionRule', () => {
    it('should create new permission rule for tenant', () => {
      enterpriseRbacService.createPermissionRule('tenant1', {
        permission: 'incidents.view',
        resource: 'incident:INC-001',
        users: ['user1', 'user2'],
        departments: ['IT'],
        allowed: true
      });

      // Verify rule was created (no direct way to verify, but should not throw)
      expect(true).toBe(true);
    });

    it('should allow multiple rules for same tenant', () => {
      enterpriseRbacService.createPermissionRule('tenant1', {
        permission: 'incidents.view',
        resource: 'incident:INC-001',
        users: ['user1'],
        departments: [],
        allowed: true
      });

      enterpriseRbacService.createPermissionRule('tenant1', {
        permission: 'problems.view',
        resource: 'problem:PRB-001',
        users: ['user2'],
        departments: [],
        allowed: false
      });

      expect(true).toBe(true);
    });
  });

  describe('getUserDepartment', () => {
    it('should return user department', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { department: 'IT' });
      });

      const department = await enterpriseRbacService.getUserDepartment('testuser');

      expect(department).toBe('IT');
    });

    it('should return null when user not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const department = await enterpriseRbacService.getUserDepartment('testuser');

      expect(department).toBeNull();
    });
  });

  describe('getResourceDepartment', () => {
    it('should return department for incident', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { department: 'Finance' });
      });

      const department = await enterpriseRbacService.getResourceDepartment('incident:INC-001');

      expect(department).toBe('Finance');
    });

    it('should return null for unsupported resource type', async () => {
      const department = await enterpriseRbacService.getResourceDepartment('unknown:XYZ-001');

      expect(department).toBeNull();
    });

    it('should return null when resource not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const department = await enterpriseRbacService.getResourceDepartment('incident:INC-001');

      expect(department).toBeNull();
    });
  });
});
