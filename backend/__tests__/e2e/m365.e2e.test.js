const request = require('supertest');
const express = require('express');
const m365Routes = require('../../routes/m365');

// Mock Microsoft Graph Service
jest.mock('../../services/microsoftGraphService', () => ({
  MicrosoftGraphService: class {
    constructor() {
      this.config = {
        tenantId: 'test-tenant',
        clientId: 'test-client',
        clientSecret: 'test-secret'
      };
    }

    isConfigured() {
      return true;
    }

    async getUsers() {
      return [
        {
          id: 'user1',
          displayName: 'Test User 1',
          userPrincipalName: 'user1@test.com',
          mail: 'user1@test.com',
          jobTitle: 'Developer',
          department: 'Engineering'
        },
        {
          id: 'user2',
          displayName: 'Test User 2',
          userPrincipalName: 'user2@test.com',
          mail: 'user2@test.com',
          jobTitle: 'Manager',
          department: 'IT'
        }
      ];
    }

    async getUserById(id) {
      return {
        id,
        displayName: 'Test User',
        userPrincipalName: 'test@test.com',
        mail: 'test@test.com',
        jobTitle: 'Developer',
        department: 'Engineering'
      };
    }

    async syncUsersToDatabase(db) {
      // Mock sync operation
      return {
        success: true,
        synced: 2,
        created: 1,
        updated: 1
      };
    }
  }
}));

// Mock the database module
jest.mock('../../db', () => ({
  db: {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  },
  initDb: jest.fn()
}));

// Mock middleware
jest.mock('../../middleware/auth', () => ({
  authenticateJWT: (req, res, next) => {
    req.user = { username: 'testuser', role: 'admin' };
    next();
  },
  authorize: (roles) => (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: '権限がありません' });
    }
  }
}));

const { db } = require('../../db');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/v1/m365', m365Routes);

describe('Microsoft 365 Integration Routes E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/m365/users', () => {
    it('should return Microsoft 365 users', async () => {
      const response = await request(app)
        .get('/api/v1/m365/users')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('displayName');
      expect(response.body[0]).toHaveProperty('userPrincipalName');
    });

    it('should handle service errors', async () => {
      // Mock service to throw error
      const MicrosoftGraphService = require('../../services/microsoftGraphService');
      jest
        .spyOn(MicrosoftGraphService.prototype, 'getUsers')
        .mockRejectedValue(new Error('Microsoft 365 API error'));

      const response = await request(app)
        .get('/api/v1/m365/users')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Microsoft 365 API error');
    });
  });

  describe('GET /api/v1/m365/users/:id', () => {
    it('should return specific Microsoft 365 user', async () => {
      const response = await request(app)
        .get('/api/v1/m365/users/user1')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'user1');
      expect(response.body).toHaveProperty('displayName');
      expect(response.body).toHaveProperty('userPrincipalName');
    });
  });

  describe('POST /api/v1/m365/sync-users', () => {
    it('should sync Microsoft 365 users to database', async () => {
      const response = await request(app)
        .post('/api/v1/m365/sync-users')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.synced).toBe(2);
      expect(response.body.created).toBe(1);
      expect(response.body.updated).toBe(1);
    });

    it('should handle sync errors', async () => {
      // Mock service to throw error
      const MicrosoftGraphService = require('../../services/microsoftGraphService');
      jest
        .spyOn(MicrosoftGraphService.prototype, 'syncUsersToDatabase')
        .mockRejectedValue(new Error('Database sync error'));

      const response = await request(app)
        .post('/api/v1/m365/sync-users')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Database sync error');
    });
  });

  describe('GET /api/v1/m365/status', () => {
    it('should return Microsoft 365 integration status', async () => {
      const response = await request(app)
        .get('/api/v1/m365/status')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('configured');
      expect(response.body).toHaveProperty('lastSync');
      expect(response.body.configured).toBe(true);
    });
  });

  describe('GET /api/v1/m365/config', () => {
    it('should return Microsoft 365 configuration (masked)', async () => {
      const response = await request(app)
        .get('/api/v1/m365/config')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('tenantId');
      expect(response.body).toHaveProperty('clientId');
      expect(response.body).toHaveProperty('graphEndpoint');
      expect(response.body).not.toHaveProperty('clientSecret'); // Should be masked
    });
  });
});
