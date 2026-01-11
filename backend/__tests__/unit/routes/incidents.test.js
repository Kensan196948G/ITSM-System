const request = require('supertest');
const express = require('express');
const incidentsRoutes = require('../../../routes/incidents');

// Mock the database module
jest.mock('../../../db', () => ({
  db: {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn()
  },
  initDb: jest.fn()
}));

// Mock middleware
jest.mock('../../../middleware/auth', () => ({
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

jest.mock('../../../middleware/cache', () => ({
  cacheMiddleware: (req, res, next) => next(),
  invalidateCacheMiddleware: () => (req, res, next) => next()
}));

jest.mock('../../../middleware/validation', () => ({
  incidentValidation: {
    create: (req, res, next) => next(),
    update: (req, res, next) => next()
  },
  validate: (req, res, next) => next()
}));

jest.mock('../../../middleware/auditLog', () => (req, res, next) => next());

jest.mock('../../../services/notificationService', () => ({
  notifyIncident: jest.fn().mockResolvedValue()
}));

jest.mock('../../../middleware/pagination', () => ({
  parsePaginationParams: () => ({ page: 1, limit: 20, offset: 0 }),
  buildPaginationSQL: (sql, params) => sql,
  createPaginationMeta: (total, page, limit) => ({ total, page, limit })
}));

const { db } = require('../../../db');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/v1/incidents', incidentsRoutes);

describe('Incidents Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/incidents', () => {
    it('should return list of incidents with pagination', async () => {
      const mockIncidents = [
        { ticket_id: 'INC-123456', title: 'Test Incident 1', priority: 'High', status: 'New' },
        {
          ticket_id: 'INC-123457',
          title: 'Test Incident 2',
          priority: 'Medium',
          status: 'In Progress'
        }
      ];

      db.get.mockResolvedValue({ total: 2 });
      db.all.mockResolvedValue(mockIncidents);

      const response = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockIncidents);
      expect(response.body.pagination).toBeDefined();
    });

    it('should handle database error', async () => {
      db.get.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Database error');
    });
  });

  describe('GET /api/v1/incidents/:id', () => {
    it('should return incident details', async () => {
      const mockIncident = {
        ticket_id: 'INC-123456',
        title: 'Test Incident',
        priority: 'High',
        status: 'New',
        description: 'Test description'
      };

      db.get.mockResolvedValue(mockIncident);

      const response = await request(app)
        .get('/api/v1/incidents/INC-123456')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockIncident);
    });

    it('should return 404 if incident not found', async () => {
      db.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/incidents/INC-999999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('インシデントが見つかりません');
    });
  });

  describe('POST /api/v1/incidents', () => {
    it('should create new incident', async () => {
      const newIncident = {
        title: 'New Incident',
        priority: 'High',
        description: 'Test description'
      };

      db.run.mockImplementation(function () {
        this.lastID = 1;
        return Promise.resolve();
      });

      const response = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken')
        .send(newIncident);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('インシデントが正常に作成されました');
      expect(response.body.id).toMatch(/^INC-/);
      expect(response.body.created_by).toBe('testuser');
    });

    it('should handle database error on create', async () => {
      const newIncident = {
        title: 'New Incident',
        priority: 'High'
      };

      db.run.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken')
        .send(newIncident);

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Database error');
    });
  });
});
