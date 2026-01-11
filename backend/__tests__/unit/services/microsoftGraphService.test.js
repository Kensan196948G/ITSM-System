/**
 * Microsoft Graph Service Unit Tests
 */

const https = require('https');

// Mock https module
jest.mock('https', () => ({
  request: jest.fn()
}));

describe('MicrosoftGraphService Unit Tests', () => {
  let MicrosoftGraphService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Setup environment variables
    process.env.M365_TENANT_ID = 'test-tenant-id';
    process.env.M365_CLIENT_ID = 'test-client-id';
    process.env.M365_CLIENT_SECRET = 'test-client-secret';
    process.env.M365_GRAPH_ENDPOINT = 'https://graph.microsoft.com/v1.0';

    // Mock request/response
    mockReq = {
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    };

    mockRes = {
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(
            Buffer.from(
              JSON.stringify({
                access_token: 'test-access-token',
                expires_in: 3600,
                token_type: 'Bearer'
              })
            )
          );
        } else if (event === 'end') {
          callback();
        }
      })
    };

    https.request.mockImplementation((options, callback) => {
      callback(mockRes);
      return mockReq;
    });

    MicrosoftGraphService = require('../../../services/microsoftGraphService');
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with environment variables', () => {
      const service = new MicrosoftGraphService();

      expect(service.config.tenantId).toBe('test-tenant-id');
      expect(service.config.clientId).toBe('test-client-id');
      expect(service.config.clientSecret).toBe('test-client-secret');
      expect(service.config.graphEndpoint).toBe('https://graph.microsoft.com/v1.0');
    });

    it('should detect when not configured', () => {
      delete process.env.M365_TENANT_ID;
      delete process.env.M365_CLIENT_ID;
      delete process.env.M365_CLIENT_SECRET;

      jest.resetModules();
      MicrosoftGraphService = require('../../../services/microsoftGraphService');
      const service = new MicrosoftGraphService();

      expect(service.isConfigured()).toBe(false);
    });

    it('should detect when configured', () => {
      const service = new MicrosoftGraphService();
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('should get access token successfully', async () => {
      const service = new MicrosoftGraphService();

      const token = await service.getAccessToken();

      expect(token).toBe('test-access-token');
      expect(service.accessToken).toBe('test-access-token');
      expect(service.tokenExpiry).toBeGreaterThan(Date.now());

      // Verify HTTPS request was made
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'login.microsoftonline.com',
          path: '/test-tenant-id/oauth2/v2.0/token',
          method: 'POST'
        }),
        expect.any(Function)
      );
    });

    it('should reuse cached token when valid', async () => {
      const service = new MicrosoftGraphService();

      // First call to get token
      await service.getAccessToken();

      // Second call should use cached token
      const token = await service.getAccessToken();

      expect(token).toBe('test-access-token');
      // Should only make one HTTPS request
      expect(https.request).toHaveBeenCalledTimes(1);
    });

    it('should throw error when not configured', async () => {
      delete process.env.M365_TENANT_ID;
      delete process.env.M365_CLIENT_ID;
      delete process.env.M365_CLIENT_SECRET;

      jest.resetModules();
      MicrosoftGraphService = require('../../../services/microsoftGraphService');
      const service = new MicrosoftGraphService();

      await expect(service.getAccessToken()).rejects.toThrow(
        'Microsoft 365の認証設定が不完全です。環境変数を確認してください。'
      );
    });

    it('should handle token request error', async () => {
      const service = new MicrosoftGraphService();

      // Mock request error
      mockReq.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          callback(new Error('Network error'));
        }
      });

      await expect(service.getAccessToken()).rejects.toThrow('Network error');
    });

    it('should handle invalid token response', async () => {
      const service = new MicrosoftGraphService();

      // Mock invalid response
      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(
            Buffer.from(
              JSON.stringify({
                error: 'invalid_client',
                error_description: 'Invalid client credentials'
              })
            )
          );
        } else if (event === 'end') {
          callback();
        }
      });

      await expect(service.getAccessToken()).rejects.toThrow('Invalid client credentials');
    });

    it('should handle malformed JSON response', async () => {
      const service = new MicrosoftGraphService();

      // Mock malformed JSON
      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from('invalid json'));
        } else if (event === 'end') {
          callback();
        }
      });

      await expect(service.getAccessToken()).rejects.toThrow('トークンレスポンスの解析に失敗');
    });
  });

  describe('callGraphApi', () => {
    let service;

    beforeEach(async () => {
      service = new MicrosoftGraphService();
      await service.getAccessToken(); // Get token first
    });

    it('should call Graph API successfully', async () => {
      // Mock successful API response
      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(
            Buffer.from(
              JSON.stringify({
                value: [{ id: 'user1', displayName: 'Test User' }]
              })
            )
          );
        } else if (event === 'end') {
          callback();
        }
      });

      const result = await service.callGraphApi('/users', 'GET');

      expect(result).toEqual({
        value: [{ id: 'user1', displayName: 'Test User' }]
      });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'graph.microsoft.com',
          path: '/v1.0/users',
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token'
          })
        }),
        expect.any(Function)
      );
    });

    it('should handle API errors', async () => {
      // Mock error response
      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(
            Buffer.from(
              JSON.stringify({
                error: {
                  code: 'Unauthorized',
                  message: 'Access denied'
                }
              })
            )
          );
        } else if (event === 'end') {
          callback();
        }
      });

      await expect(service.callGraphApi('/users', 'GET')).rejects.toThrow('Access denied');
    });

    it('should include request body for POST/PUT/PATCH', async () => {
      const requestBody = { displayName: 'New User' };

      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify({ id: 'new-user' })));
        } else if (event === 'end') {
          callback();
        }
      });

      await service.callGraphApi('/users', 'POST', requestBody);

      expect(mockReq.write).toHaveBeenCalledWith(JSON.stringify(requestBody));
    });
  });

  describe('getUsers', () => {
    let service;

    beforeEach(async () => {
      service = new MicrosoftGraphService();
      await service.getAccessToken();
    });

    it('should get users successfully', async () => {
      const mockUsers = {
        value: [
          { id: 'user1', displayName: 'User One', userPrincipalName: 'user1@example.com' },
          { id: 'user2', displayName: 'User Two', userPrincipalName: 'user2@example.com' }
        ]
      };

      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockUsers)));
        } else if (event === 'end') {
          callback();
        }
      });

      const users = await service.getUsers();

      expect(users).toEqual(mockUsers.value);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/v1.0/users?$select=id,displayName,userPrincipalName,mail,jobTitle,department'
        }),
        expect.any(Function)
      );
    });

    it('should handle pagination', async () => {
      const firstPage = {
        value: [{ id: 'user1', displayName: 'User One' }],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/users?$skip=1'
      };

      const secondPage = {
        value: [{ id: 'user2', displayName: 'User Two' }]
      };

      let callCount = 0;
      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callCount++;
          if (callCount === 1) {
            callback(Buffer.from(JSON.stringify(firstPage)));
          } else {
            callback(Buffer.from(JSON.stringify(secondPage)));
          }
        } else if (event === 'end') {
          callback();
        }
      });

      const users = await service.getUsers();

      expect(users).toHaveLength(2);
      expect(users[0].id).toBe('user1');
      expect(users[1].id).toBe('user2');
    });
  });

  describe('getUserById', () => {
    let service;

    beforeEach(async () => {
      service = new MicrosoftGraphService();
      await service.getAccessToken();
    });

    it('should get user by ID successfully', async () => {
      const mockUser = {
        id: 'user1',
        displayName: 'Test User',
        userPrincipalName: 'user1@example.com',
        mail: 'user1@example.com',
        jobTitle: 'Developer',
        department: 'Engineering'
      };

      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify(mockUser)));
        } else if (event === 'end') {
          callback();
        }
      });

      const user = await service.getUserById('user1');

      expect(user).toEqual(mockUser);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/v1.0/users/user1?$select=id,displayName,userPrincipalName,mail,jobTitle,department'
        }),
        expect.any(Function)
      );
    });

    it('should handle user not found', async () => {
      mockRes.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          callback(
            Buffer.from(
              JSON.stringify({
                error: {
                  code: 'Request_ResourceNotFound',
                  message: 'Resource not found'
                }
              })
            )
          );
        } else if (event === 'end') {
          callback();
        }
      });

      await expect(service.getUserById('nonexistent')).rejects.toThrow('Resource not found');
    });
  });

  describe('syncUsersToDatabase', () => {
    let service;
    let mockDb;

    beforeEach(async () => {
      service = new MicrosoftGraphService();
      await service.getAccessToken();

      mockDb = {
        run: jest.fn(),
        get: jest.fn()
      };
    });

    it('should sync users to database', async () => {
      const mockUsers = [
        {
          id: 'user1',
          displayName: 'User One',
          userPrincipalName: 'user1@example.com',
          mail: 'user1@example.com',
          jobTitle: 'Developer',
          department: 'Engineering'
        }
      ];

      // Mock getUsers to return users
      service.getUsers = jest.fn().mockResolvedValue(mockUsers);

      // Mock database operations
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null); // User doesn't exist
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await service.syncUsersToDatabase(mockDb);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);

      // Verify database was called
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO m365_users'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should handle database errors during sync', async () => {
      const mockUsers = [{ id: 'user1', displayName: 'Test User' }];
      service.getUsers = jest.fn().mockResolvedValue(mockUsers);

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Database error'), null);
      });

      await expect(service.syncUsersToDatabase(mockDb)).rejects.toThrow('Database error');
    });

    it('should handle empty users list', async () => {
      service.getUsers = jest.fn().mockResolvedValue([]);

      const result = await service.syncUsersToDatabase(mockDb);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });
  });
});
