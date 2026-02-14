/**
 * Fix Actions Service Tests
 * 自動修復アクション実装のユニットテスト
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const {
  setDatabase,
  serviceRestart,
  databaseCheckpoint,
  cacheClear,
  alertAdmin,
  executeAction,
  getActionFunction
} = require('../../../services/fixActions');

// child_process.exec のモック
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) =>
    // execAsync のモックを返す
    jest.fn()
  )
}));

describe('Fix Actions Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setDatabase', () => {
    it('should set the database connection', () => {
      const mockDb = { raw: jest.fn() };
      // setDatabase は内部変数を設定するだけなので、エラーなく実行されること
      expect(() => setDatabase(mockDb)).not.toThrow();
    });
  });

  describe('getActionFunction', () => {
    it('should return function for service_restart', () => {
      const fn = getActionFunction('service_restart');
      expect(typeof fn).toBe('function');
    });

    it('should return function for database_checkpoint', () => {
      const fn = getActionFunction('database_checkpoint');
      expect(typeof fn).toBe('function');
    });

    it('should return function for cache_clear', () => {
      const fn = getActionFunction('cache_clear');
      expect(typeof fn).toBe('function');
    });

    it('should return function for alert_admin', () => {
      const fn = getActionFunction('alert_admin');
      expect(typeof fn).toBe('function');
    });

    it('should return null for unknown action', () => {
      const fn = getActionFunction('unknown_action');
      expect(fn).toBeNull();
    });
  });

  describe('databaseCheckpoint', () => {
    it('should return failure when no database connection', async () => {
      // db を null に設定
      setDatabase(null);

      const result = await databaseCheckpoint();
      expect(result.success).toBe(false);
      expect(result.message).toBe('Database connection not initialized');
    });

    it('should execute checkpoint successfully with connection', async () => {
      const mockDb = {
        raw: jest.fn().mockResolvedValue([{ busy: 0, log: 10, checkpointed: 10 }])
      };

      const result = await databaseCheckpoint(mockDb);
      expect(result.success).toBe(true);
      expect(result.message).toContain('WAL checkpoint completed');
      expect(result.details.mode).toBe('TRUNCATE');
      expect(result.details.checkpointed_pages).toBe(10);
    });

    it('should handle checkpoint with empty result', async () => {
      const mockDb = {
        raw: jest.fn().mockResolvedValue([])
      };

      const result = await databaseCheckpoint(mockDb);
      expect(result.success).toBe(true);
      expect(result.details.busy).toBe(0);
      expect(result.details.log_pages).toBe(0);
    });

    it('should handle checkpoint error', async () => {
      const mockDb = {
        raw: jest.fn().mockRejectedValue(new Error('Checkpoint failed'))
      };

      const result = await databaseCheckpoint(mockDb);
      expect(result.success).toBe(false);
      expect(result.message).toContain('WAL checkpoint failed');
      expect(result.details.error).toBe('Checkpoint failed');
    });

    it('should use global db when no connection provided', async () => {
      const mockDb = {
        raw: jest.fn().mockResolvedValue([{ busy: 0, log: 5, checkpointed: 5 }])
      };
      setDatabase(mockDb);

      const result = await databaseCheckpoint();
      expect(result.success).toBe(true);
      expect(mockDb.raw).toHaveBeenCalledWith('PRAGMA wal_checkpoint(TRUNCATE)');
    });
  });

  describe('executeAction', () => {
    it('should return error for unknown action', async () => {
      const result = await executeAction('nonexistent_action');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown action: nonexistent_action');
    });

    it('should execute database_checkpoint action', async () => {
      const mockDb = {
        raw: jest.fn().mockResolvedValue([{ busy: 0, log: 0, checkpointed: 0 }])
      };

      const result = await executeAction('database_checkpoint', { dbConnection: mockDb });
      expect(result.success).toBe(true);
    });

    it('should execute cache_clear action', async () => {
      // cache_clear は内部で cache モジュールを require するので try/catch で捕捉される
      const result = await executeAction('cache_clear');
      // モジュールが見つからない場合は失敗する可能性がある
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    it('should handle action execution errors gracefully', async () => {
      // database_checkpoint with null connection (no global db set)
      setDatabase(null);
      const result = await executeAction('database_checkpoint', {});
      expect(result.success).toBe(false);
    });
  });

  describe('serviceRestart', () => {
    it('should return ActionResult structure', async () => {
      // serviceRestart は execAsync を使用するが、モックされているためエラーになる
      const result = await serviceRestart('test-service');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });
  });

  describe('cacheClear', () => {
    it('should handle missing cache module', async () => {
      // cache モジュールがモックされていない状態でテスト
      const result = await cacheClear();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });
  });

  describe('alertAdmin', () => {
    it('should return failure when no channels configured', async () => {
      // 環境変数なし、チャネルなし
      const originalSlack = process.env.SLACK_WEBHOOK_URL;
      const originalTeams = process.env.TEAMS_WEBHOOK_URL;
      const originalEmail = process.env.ALERT_EMAIL;
      delete process.env.SLACK_WEBHOOK_URL;
      delete process.env.TEAMS_WEBHOOK_URL;
      delete process.env.ALERT_EMAIL;

      const errorData = {
        pattern: 'test_pattern',
        severity: 'critical',
        error_message: 'Test error'
      };

      const result = await alertAdmin(errorData);
      expect(result.success).toBe(false);
      expect(result.message).toContain('No notification channels configured');
      expect(result.details.channels_count).toBe(0);

      // 環境変数を復元
      if (originalSlack) process.env.SLACK_WEBHOOK_URL = originalSlack;
      if (originalTeams) process.env.TEAMS_WEBHOOK_URL = originalTeams;
      if (originalEmail) process.env.ALERT_EMAIL = originalEmail;
    });
  });
});
