/**
 * Unit Tests for User Activity Tracking Middleware
 * Tests login, logout, password change, TOTP enablement tracking,
 * anomaly detection, and activity retrieval functionality
 */

const {
  trackLogin,
  trackLogout,
  trackPasswordChange,
  trackTotpEnabled,
  isAnomalousActivity,
  getRecentActivity,
  getActivityStats
} = require('../../../middleware/userActivity');
const { db } = require('../../../db');

// Mock database
jest.mock('../../../db', () => ({
  db: {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  }
}));

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-session-uuid-1234')
}));

describe('User Activity Middleware Unit Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Spy on console methods to suppress output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('trackLogin', () => {
    it('should track successful login with session_id', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 123 }, null);
      });

      const result = await trackLogin(1, '127.0.0.1', 'Mozilla/5.0', true);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity'),
        [1, 'login', '127.0.0.1', 'Mozilla/5.0', 1, null, 'test-session-uuid-1234'],
        expect.any(Function)
      );
      expect(result).toEqual({ id: 123, session_id: 'test-session-uuid-1234' });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('login tracked for user_id=1')
      );
    });

    it('should track failed login without session_id', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 124 }, null);
      });

      const result = await trackLogin(2, '192.168.1.1', 'Chrome', false, 'Invalid password');

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity'),
        [2, 'failed_login', '192.168.1.1', 'Chrome', 0, 'Invalid password', null],
        expect.any(Function)
      );
      expect(result).toEqual({ id: 124, session_id: null });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('failed_login tracked for user_id=2')
      );
    });

    it('should handle database error on login tracking', async () => {
      const dbError = new Error('Database connection error');
      db.run.mockImplementation((sql, params, callback) => {
        callback(dbError);
      });

      await expect(trackLogin(1, '127.0.0.1', 'Mozilla', true)).rejects.toThrow(
        'Database connection error'
      );
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error tracking login:',
        dbError
      );
    });

    it('should track failed login without failure_reason', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 125 }, null);
      });

      const result = await trackLogin(3, '10.0.0.1', 'Safari', false);

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity'),
        [3, 'failed_login', '10.0.0.1', 'Safari', 0, null, null],
        expect.any(Function)
      );
      expect(result.session_id).toBeNull();
    });
  });

  describe('trackLogout', () => {
    it('should track user logout successfully', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 200 }, null);
      });

      const result = await trackLogout(5, '172.16.0.1', 'Firefox/100.0');

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity'),
        [5, 'logout', '172.16.0.1', 'Firefox/100.0', 1, null],
        expect.any(Function)
      );
      expect(result).toEqual({ id: 200 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('logout tracked for user_id=5')
      );
    });

    it('should handle database error on logout tracking', async () => {
      const dbError = new Error('Connection timeout');
      db.run.mockImplementation((sql, params, callback) => {
        callback(dbError);
      });

      await expect(trackLogout(6, '127.0.0.1', 'Chrome')).rejects.toThrow('Connection timeout');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error tracking logout:',
        dbError
      );
    });
  });

  describe('trackPasswordChange', () => {
    it('should track password change successfully', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 300 }, null);
      });

      const result = await trackPasswordChange(10, '192.168.0.10', 'Edge/120.0');

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity'),
        [10, 'password_change', '192.168.0.10', 'Edge/120.0', 1, null],
        expect.any(Function)
      );
      expect(result).toEqual({ id: 300 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('password_change tracked for user_id=10')
      );
    });

    it('should handle database error on password change tracking', async () => {
      const dbError = new Error('Write failed');
      db.run.mockImplementation((sql, params, callback) => {
        callback(dbError);
      });

      await expect(trackPasswordChange(11, '10.0.0.5', 'Safari')).rejects.toThrow('Write failed');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error tracking password change:',
        dbError
      );
    });
  });

  describe('trackTotpEnabled', () => {
    it('should track TOTP enablement successfully', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 400 }, null);
      });

      const result = await trackTotpEnabled(15, '172.20.0.1', 'Opera/90.0');

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity'),
        [15, 'totp_enabled', '172.20.0.1', 'Opera/90.0', 1, null],
        expect.any(Function)
      );
      expect(result).toEqual({ id: 400 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('totp_enabled tracked for user_id=15')
      );
    });

    it('should handle database error on TOTP tracking', async () => {
      const dbError = new Error('Insert failed');
      db.run.mockImplementation((sql, params, callback) => {
        callback(dbError);
      });

      await expect(trackTotpEnabled(16, '10.1.1.1', 'Chrome')).rejects.toThrow('Insert failed');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error tracking TOTP enablement:',
        dbError
      );
    });
  });

  describe('isAnomalousActivity', () => {
    it('should detect anomaly when multiple sessions created in 5 minutes', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        // First query: session count > 3
        if (sql.includes('session_count')) {
          callback(null, { session_count: 5 });
        }
      });

      const result = await isAnomalousActivity(20);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ANOMALY DETECTED: user_id=20 created 5 sessions')
      );
    });

    it('should detect anomaly when multiple IP addresses used in 30 minutes', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          // No session anomaly
          callback(null, { session_count: 2 });
        } else if (sql.includes('ip_count')) {
          // IP anomaly: more than 4 IPs
          callback(null, { ip_count: 6 });
        }
      });

      const result = await isAnomalousActivity(21);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ANOMALY DETECTED: user_id=21 used 6 different IPs')
      );
    });

    it('should detect anomaly when multiple failed logins in 10 minutes', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          callback(null, { session_count: 1 });
        } else if (sql.includes('ip_count')) {
          callback(null, { ip_count: 2 });
        } else if (sql.includes('failed_count')) {
          // Failed login anomaly: more than 5
          callback(null, { failed_count: 8 });
        }
      });

      const result = await isAnomalousActivity(22);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('ANOMALY DETECTED: user_id=22 had 8 failed logins')
      );
    });

    it('should return false when no anomaly detected', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          callback(null, { session_count: 2 });
        } else if (sql.includes('ip_count')) {
          callback(null, { ip_count: 3 });
        } else if (sql.includes('failed_count')) {
          callback(null, { failed_count: 2 });
        }
      });

      const result = await isAnomalousActivity(23);

      expect(result).toBe(false);
    });

    it('should handle database error on session check', async () => {
      const dbError = new Error('Query failed');
      db.get.mockImplementation((sql, params, callback) => {
        callback(dbError, null);
      });

      await expect(isAnomalousActivity(24)).rejects.toThrow('Query failed');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error checking multiple sessions:',
        dbError
      );
    });

    it('should handle database error on IP check', async () => {
      const dbError = new Error('IP query failed');
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          callback(null, { session_count: 1 });
        } else if (sql.includes('ip_count')) {
          callback(dbError, null);
        }
      });

      await expect(isAnomalousActivity(25)).rejects.toThrow('IP query failed');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error checking IP changes:',
        dbError
      );
    });

    it('should handle database error on failed login check', async () => {
      const dbError = new Error('Failed login query error');
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          callback(null, { session_count: 1 });
        } else if (sql.includes('ip_count')) {
          callback(null, { ip_count: 2 });
        } else if (sql.includes('failed_count')) {
          callback(dbError, null);
        }
      });

      await expect(isAnomalousActivity(26)).rejects.toThrow('Failed login query error');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error checking failed logins:',
        dbError
      );
    });

    it('should handle null session row', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          callback(null, null);
        } else if (sql.includes('ip_count')) {
          callback(null, { ip_count: 1 });
        } else if (sql.includes('failed_count')) {
          callback(null, { failed_count: 0 });
        }
      });

      const result = await isAnomalousActivity(27);

      expect(result).toBe(false);
    });

    it('should handle null ip row', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          callback(null, { session_count: 1 });
        } else if (sql.includes('ip_count')) {
          callback(null, null);
        } else if (sql.includes('failed_count')) {
          callback(null, { failed_count: 0 });
        }
      });

      const result = await isAnomalousActivity(28);

      expect(result).toBe(false);
    });

    it('should handle null failed row', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('session_count')) {
          callback(null, { session_count: 1 });
        } else if (sql.includes('ip_count')) {
          callback(null, { ip_count: 2 });
        } else if (sql.includes('failed_count')) {
          callback(null, null);
        }
      });

      const result = await isAnomalousActivity(29);

      expect(result).toBe(false);
    });
  });

  describe('getRecentActivity', () => {
    it('should retrieve recent activity with default limit', async () => {
      const mockActivities = [
        {
          id: 1,
          activity_type: 'login',
          ip_address: '127.0.0.1',
          user_agent: 'Chrome',
          success: 1,
          failure_reason: null,
          session_id: 'session-123',
          created_at: '2026-02-02 10:00:00'
        },
        {
          id: 2,
          activity_type: 'logout',
          ip_address: '127.0.0.1',
          user_agent: 'Chrome',
          success: 1,
          failure_reason: null,
          session_id: null,
          created_at: '2026-02-02 11:00:00'
        }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockActivities);
      });

      const result = await getRecentActivity(30);

      expect(db.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, activity_type'),
        [30, 50],
        expect.any(Function)
      );
      expect(result).toEqual(mockActivities);
    });

    it('should retrieve recent activity with custom limit', async () => {
      const mockActivities = [
        {
          id: 3,
          activity_type: 'password_change',
          ip_address: '192.168.1.1',
          user_agent: 'Firefox',
          success: 1,
          failure_reason: null,
          session_id: null,
          created_at: '2026-02-02 09:00:00'
        }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockActivities);
      });

      const result = await getRecentActivity(31, 10);

      expect(db.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, activity_type'),
        [31, 10],
        expect.any(Function)
      );
      expect(result).toEqual(mockActivities);
    });

    it('should return empty array when no activities found', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await getRecentActivity(32);

      expect(result).toEqual([]);
    });

    it('should handle database error when fetching activities', async () => {
      const dbError = new Error('Select failed');
      db.all.mockImplementation((sql, params, callback) => {
        callback(dbError, null);
      });

      await expect(getRecentActivity(33)).rejects.toThrow('Select failed');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error fetching recent activity:',
        dbError
      );
    });
  });

  describe('getActivityStats', () => {
    it('should retrieve activity statistics with default period', async () => {
      const mockStats = [
        {
          activity_type: 'login',
          count: 15,
          unique_ips: 3,
          last_occurrence: '2026-02-02 12:00:00'
        },
        {
          activity_type: 'logout',
          count: 12,
          unique_ips: 2,
          last_occurrence: '2026-02-02 11:30:00'
        }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockStats);
      });

      const result = await getActivityStats(40);

      expect(db.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [40],
        expect.any(Function)
      );
      expect(result).toEqual({
        user_id: 40,
        period_days: 30,
        activities: mockStats,
        total_events: 27 // 15 + 12
      });
    });

    it('should retrieve activity statistics with custom period', async () => {
      const mockStats = [
        {
          activity_type: 'password_change',
          count: 2,
          unique_ips: 1,
          last_occurrence: '2026-02-01 10:00:00'
        }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockStats);
      });

      const result = await getActivityStats(41, 7);

      expect(db.all).toHaveBeenCalledWith(
        expect.stringContaining('datetime(\'now\', \'-7 days\')'),
        [41],
        expect.any(Function)
      );
      expect(result).toEqual({
        user_id: 41,
        period_days: 7,
        activities: mockStats,
        total_events: 2
      });
    });

    it('should return zero total_events when no activities found', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await getActivityStats(42);

      expect(result).toEqual({
        user_id: 42,
        period_days: 30,
        activities: [],
        total_events: 0
      });
    });

    it('should return zero total_events for empty array', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await getActivityStats(43);

      expect(result).toEqual({
        user_id: 43,
        period_days: 30,
        activities: [],
        total_events: 0
      });
    });

    it('should handle database error when fetching stats', async () => {
      const dbError = new Error('Stats query failed');
      db.all.mockImplementation((sql, params, callback) => {
        callback(dbError, null);
      });

      await expect(getActivityStats(44)).rejects.toThrow('Stats query failed');
      expect(console.error).toHaveBeenCalledWith(
        '[UserActivity] Error fetching activity stats:',
        dbError
      );
    });

    it('should calculate correct total_events with multiple activity types', async () => {
      const mockStats = [
        { activity_type: 'login', count: 100, unique_ips: 5, last_occurrence: '2026-02-02' },
        { activity_type: 'logout', count: 95, unique_ips: 4, last_occurrence: '2026-02-02' },
        { activity_type: 'failed_login', count: 10, unique_ips: 2, last_occurrence: '2026-02-01' },
        { activity_type: 'password_change', count: 3, unique_ips: 1, last_occurrence: '2026-01-30' }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockStats);
      });

      const result = await getActivityStats(45);

      expect(result.total_events).toBe(208); // 100 + 95 + 10 + 3
    });
  });
});
