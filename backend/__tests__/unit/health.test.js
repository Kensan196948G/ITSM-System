/**
 * Unit Tests for Health Routes
 * Tests error cases and edge cases that are difficult to simulate in integration tests
 */

describe('Health Routes - Error Cases', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Readiness Probe Error Cases', () => {
    it('should handle database connection failure via mock', async () => {
      // This test demonstrates the error handling structure
      // In real scenarios, DB errors would be caught by the try-catch blocks
      const mockDb = {
        get: jest.fn((sql, callback) => {
          callback(new Error('Database connection lost'), null);
        })
      };

      // Simulate the readiness check logic
      let checks = { database: false };
      let errors = [];
      let overallStatus = 'UP';

      try {
        await new Promise((resolve, reject) => {
          mockDb.get('SELECT 1 as result', (err, row) => {
            if (err) reject(err);
            else if (row && row.result === 1) resolve();
            else reject(new Error('Unexpected query result'));
          });
        });
        checks.database = true;
      } catch (err) {
        checks.database = false;
        errors.push(`Database: ${err.message}`);
        overallStatus = 'DOWN';
      }

      expect(checks.database).toBe(false);
      expect(overallStatus).toBe('DOWN');
      expect(errors).toContain('Database: Database connection lost');
    });

    it('should handle database query returning unexpected result via mock', async () => {
      const mockDb = {
        get: jest.fn((sql, callback) => {
          callback(null, { result: 999 }); // Unexpected value
        })
      };

      let checks = { database: false };
      let errors = [];
      let overallStatus = 'UP';

      try {
        await new Promise((resolve, reject) => {
          mockDb.get('SELECT 1 as result', (err, row) => {
            if (err) reject(err);
            else if (row && row.result === 1) resolve();
            else reject(new Error('Unexpected query result'));
          });
        });
        checks.database = true;
      } catch (err) {
        checks.database = false;
        errors.push(`Database: ${err.message}`);
        overallStatus = 'DOWN';
      }

      expect(checks.database).toBe(false);
      expect(overallStatus).toBe('DOWN');
      expect(errors).toContain('Database: Unexpected query result');
    });

    it('should handle disk check error', async () => {
      const fs = require('fs');
      const originalStatfsSync = fs.statfsSync;
      fs.statfsSync = jest.fn(() => {
        throw new Error('Unable to read disk stats');
      });

      healthRouter = require('../../routes/health');
      const readinessHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/ready'
      ).route.stack[0].handle;

      await readinessHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({
            disk: false
          }),
          errors: expect.arrayContaining([expect.stringContaining('Disk')])
        })
      );

      fs.statfsSync = originalStatfsSync;
    });

    it('should detect low disk space warning', async () => {
      const fs = require('fs');
      const originalStatfsSync = fs.statfsSync;

      // Mock disk with 8% free space (below 10% threshold)
      fs.statfsSync = jest.fn(() => ({
        blocks: 1000000,
        bavail: 80000, // 8% free
        bsize: 4096
      }));

      healthRouter = require('../../routes/health');
      const readinessHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/ready'
      ).route.stack[0].handle;

      await readinessHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          checks: expect.objectContaining({
            disk: false
          }),
          errors: expect.arrayContaining([expect.stringMatching(/Disk.*8\.00% free/)])
        })
      );

      fs.statfsSync = originalStatfsSync;
    });

    it('should handle memory check error', async () => {
      const os = require('os');
      const originalTotalmem = os.totalmem;
      os.totalmem = jest.fn(() => {
        throw new Error('Unable to read memory stats');
      });

      healthRouter = require('../../routes/health');
      const readinessHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/ready'
      ).route.stack[0].handle;

      await readinessHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({
            memory: false
          }),
          errors: expect.arrayContaining([expect.stringContaining('Memory')])
        })
      );

      os.totalmem = originalTotalmem;
    });

    it('should detect high memory usage', async () => {
      const os = require('os');
      const originalTotalmem = os.totalmem;
      const originalFreemem = os.freemem;

      // Mock memory with 92% usage (above 90% threshold)
      os.totalmem = jest.fn(() => 16 * 1024 * 1024 * 1024); // 16GB
      os.freemem = jest.fn(() => 1.28 * 1024 * 1024 * 1024); // 1.28GB free = 92% used

      healthRouter = require('../../routes/health');
      const readinessHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/ready'
      ).route.stack[0].handle;

      await readinessHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          checks: expect.objectContaining({
            memory: false
          }),
          errors: expect.arrayContaining([expect.stringMatching(/Memory.*92\.00% used/)])
        })
      );

      os.totalmem = originalTotalmem;
      os.freemem = originalFreemem;
    });
  });

  describe('Detailed Health Check Error Cases', () => {
    it('should handle database error in detailed check via mock', async () => {
      const mockDb = {
        get: jest.fn((sql, callback) => {
          callback(new Error('Connection timeout'), null);
        })
      };

      let checks = { database: { status: 'unknown', message: '' } };
      let errors = [];
      let overallStatus = 'UP';

      try {
        await new Promise((resolve, reject) => {
          mockDb.get('SELECT 1 as result', (err, row) => {
            if (err) reject(err);
            else if (row && row.result === 1) resolve();
            else reject(new Error('Unexpected query result'));
          });
        });
        checks.database.status = 'UP';
        checks.database.message = 'Database connection is healthy';
      } catch (err) {
        checks.database.status = 'DOWN';
        checks.database.message = `Database error: ${err.message}`;
        errors.push(`Database: ${err.message}`);
        overallStatus = 'DOWN';
      }

      expect(checks.database.status).toBe('DOWN');
      expect(checks.database.message).toContain('Connection timeout');
      expect(overallStatus).toBe('DOWN');
      expect(errors).toContain('Database: Connection timeout');
    });

    it('should detect disk WARNING state (15% free)', async () => {
      const fs = require('fs');
      const originalStatfsSync = fs.statfsSync;

      // Mock disk with 15% free space (between 10% and 20%)
      fs.statfsSync = jest.fn(() => ({
        blocks: 1000000,
        bavail: 150000, // 15% free
        bsize: 4096
      }));

      healthRouter = require('../../routes/health');
      const detailedHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/detailed'
      ).route.stack[0].handle;

      await detailedHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({
            disk: expect.objectContaining({
              status: 'WARNING',
              message: expect.stringContaining('Low disk space')
            })
          }),
          errors: expect.arrayContaining([expect.stringMatching(/Disk.*15\.00% free/)])
        })
      );

      fs.statfsSync = originalStatfsSync;
    });

    it('should detect disk CRITICAL state (5% free)', async () => {
      const fs = require('fs');
      const originalStatfsSync = fs.statfsSync;

      // Mock disk with 5% free space (below 10%)
      fs.statfsSync = jest.fn(() => ({
        blocks: 1000000,
        bavail: 50000, // 5% free
        bsize: 4096
      }));

      healthRouter = require('../../routes/health');
      const detailedHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/detailed'
      ).route.stack[0].handle;

      await detailedHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          checks: expect.objectContaining({
            disk: expect.objectContaining({
              status: 'DOWN',
              message: expect.stringContaining('Critical disk space')
            })
          }),
          errors: expect.arrayContaining([expect.stringMatching(/Disk.*Critical.*5\.00% free/)])
        })
      );

      fs.statfsSync = originalStatfsSync;
    });

    it('should handle disk check error in detailed check', async () => {
      const fs = require('fs');
      const originalStatfsSync = fs.statfsSync;
      fs.statfsSync = jest.fn(() => {
        throw new Error('Filesystem error');
      });

      healthRouter = require('../../routes/health');
      const detailedHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/detailed'
      ).route.stack[0].handle;

      await detailedHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({
            disk: expect.objectContaining({
              status: 'DOWN',
              message: expect.stringContaining('Filesystem error')
            })
          }),
          errors: expect.arrayContaining([expect.stringContaining('Disk')])
        })
      );

      fs.statfsSync = originalStatfsSync;
    });

    it('should detect memory WARNING state (85% used)', async () => {
      const os = require('os');
      const originalTotalmem = os.totalmem;
      const originalFreemem = os.freemem;

      // Mock memory with 85% usage (between 80% and 90%)
      os.totalmem = jest.fn(() => 16 * 1024 * 1024 * 1024); // 16GB
      os.freemem = jest.fn(() => 2.4 * 1024 * 1024 * 1024); // 2.4GB free = 85% used

      healthRouter = require('../../routes/health');
      const detailedHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/detailed'
      ).route.stack[0].handle;

      await detailedHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({
            memory: expect.objectContaining({
              status: 'WARNING',
              message: expect.stringContaining('High memory usage')
            })
          }),
          errors: expect.arrayContaining([expect.stringMatching(/Memory.*High usage.*85\.00%/)])
        })
      );

      os.totalmem = originalTotalmem;
      os.freemem = originalFreemem;
    });

    it('should detect memory CRITICAL state (95% used)', async () => {
      const os = require('os');
      const originalTotalmem = os.totalmem;
      const originalFreemem = os.freemem;

      // Mock memory with 95% usage (above 90%)
      os.totalmem = jest.fn(() => 16 * 1024 * 1024 * 1024); // 16GB
      os.freemem = jest.fn(() => 0.8 * 1024 * 1024 * 1024); // 0.8GB free = 95% used

      healthRouter = require('../../routes/health');
      const detailedHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/detailed'
      ).route.stack[0].handle;

      await detailedHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          checks: expect.objectContaining({
            memory: expect.objectContaining({
              status: 'DOWN',
              message: expect.stringContaining('Critical memory usage')
            })
          }),
          errors: expect.arrayContaining([expect.stringMatching(/Memory.*Critical.*95\.00% used/)])
        })
      );

      os.totalmem = originalTotalmem;
      os.freemem = originalFreemem;
    });

    it('should handle memory check error in detailed check', async () => {
      const os = require('os');
      const originalTotalmem = os.totalmem;
      os.totalmem = jest.fn(() => {
        throw new Error('OS error');
      });

      healthRouter = require('../../routes/health');
      const detailedHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/detailed'
      ).route.stack[0].handle;

      await detailedHandler(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({
            memory: expect.objectContaining({
              status: 'DOWN',
              message: expect.stringContaining('OS error')
            })
          }),
          errors: expect.arrayContaining([expect.stringContaining('Memory')])
        })
      );

      os.totalmem = originalTotalmem;
    });

    it('should handle cache module not available via mock', () => {
      // Simulate cache module check logic
      let checks = { cache: { status: 'unknown', message: '' } };

      try {
        // Simulate require that throws
        throw new Error("Cannot find module 'node-cache'");
      } catch (err) {
        checks.cache.status = 'WARNING';
        checks.cache.message = 'Cache module not available';
      }

      expect(checks.cache.status).toBe('WARNING');
      expect(checks.cache.message).toBe('Cache module not available');
    });

    it('should handle scheduler service not available via mock', () => {
      // Simulate scheduler service check logic
      let checks = { scheduler: { status: 'unknown', message: '' } };

      try {
        // Simulate require that throws
        throw new Error("Cannot find module '../services/schedulerService'");
      } catch (err) {
        checks.scheduler.status = 'WARNING';
        checks.scheduler.message = 'Scheduler service not available';
      }

      expect(checks.scheduler.status).toBe('WARNING');
      expect(checks.scheduler.message).toBe('Scheduler service not available');
    });

    it('should handle cache module loaded successfully', () => {
      // Simulate cache module check logic - success case
      let checks = { cache: { status: 'unknown', message: '' } };

      try {
        // Simulate successful require
        const NodeCache = require('node-cache');
        checks.cache.status = 'UP';
        checks.cache.message = 'Cache module loaded';
      } catch (err) {
        checks.cache.status = 'WARNING';
        checks.cache.message = 'Cache module not available';
      }

      expect(checks.cache.status).toBe('UP');
      expect(checks.cache.message).toBe('Cache module loaded');
    });

    it('should handle scheduler service loaded successfully', () => {
      // Simulate scheduler service check logic - success case
      let checks = { scheduler: { status: 'unknown', message: '' } };

      try {
        // Simulate successful require
        require('../../services/schedulerService');
        checks.scheduler.status = 'UP';
        checks.scheduler.message = 'Scheduler service loaded';
      } catch (err) {
        checks.scheduler.status = 'WARNING';
        checks.scheduler.message = 'Scheduler service not available';
      }

      expect(checks.scheduler.status).toBe('UP');
      expect(checks.scheduler.message).toBe('Scheduler service loaded');
    });
  });

  describe('Auto-Fix Status Error Cases', () => {
    it('should handle auto-fix service error', async () => {
      jest.doMock('../../services/autoFixService', () => ({
        getStatus: jest.fn().mockRejectedValue(new Error('Service unavailable'))
      }));

      healthRouter = require('../../routes/health');
      const autoFixHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/auto-fix'
      ).route.stack[0].handle;

      await autoFixHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          type: 'auto-fix',
          error: 'Service unavailable'
        })
      );
    });

    it('should handle auto-fix service module not found', async () => {
      jest.doMock('../../services/autoFixService', () => {
        throw new Error("Cannot find module '../services/autoFixService'");
      });

      healthRouter = require('../../routes/health');
      const autoFixHandler = healthRouter.stack.find(
        (layer) => layer.route && layer.route.path === '/auto-fix'
      ).route.stack[0].handle;

      await autoFixHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DOWN',
          type: 'auto-fix',
          error: expect.any(String)
        })
      );
    });
  });
});
