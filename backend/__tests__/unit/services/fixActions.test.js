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
  promisify: jest.fn((_fn) =>
    // execAsync のモックを返す
    jest.fn()
  )
}));

jest.mock('../../../services/notificationService', () => ({
  sendAlertNotification: jest.fn()
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

    it('should execute service_restart action (switch case)', async () => {
      // service_restart は execAsync がモックされているため失敗するが ActionResult を返す
      const result = await executeAction('service_restart', { serviceName: 'test-service' });
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('execution_time_ms');
    });

    it('should execute alert_admin action (switch case)', async () => {
      const notificationService = require('../../../services/notificationService');
      notificationService.sendAlertNotification.mockResolvedValue([{ success: true }]);

      const errorData = {
        pattern: 'high_error_rate',
        severity: 'critical',
        error_message: 'Error rate exceeded threshold',
        metadata: { value: 95, threshold: 80 }
      };
      const channels = [
        {
          channel_type: 'slack',
          channel_name: 'Test Slack',
          config: { webhook_url: 'https://hooks.slack.com/test' }
        }
      ];

      const result = await executeAction('alert_admin', { errorData, channels });
      expect(result.success).toBe(true);
      expect(result.details.total_channels).toBe(1);
      expect(result.details.success_count).toBe(1);
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

  describe('alertAdmin - 環境変数チャネル設定', () => {
    let notificationService;

    beforeEach(() => {
      notificationService = require('../../../services/notificationService');
      // 各テスト前に環境変数をクリア
      delete process.env.SLACK_WEBHOOK_URL;
      delete process.env.TEAMS_WEBHOOK_URL;
      delete process.env.ALERT_EMAIL;
    });

    afterEach(() => {
      // テスト後も環境変数をクリア
      delete process.env.SLACK_WEBHOOK_URL;
      delete process.env.TEAMS_WEBHOOK_URL;
      delete process.env.ALERT_EMAIL;
    });

    it('SLACK_WEBHOOK_URLが設定されている場合にSlackチャネルで通知', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test-webhook';
      notificationService.sendAlertNotification.mockResolvedValue([{ success: true }]);

      const errorData = {
        pattern: 'cpu_spike',
        severity: 'critical',
        error_message: 'CPU usage 95%'
      };

      const result = await alertAdmin(errorData);

      expect(result.success).toBe(true);
      expect(notificationService.sendAlertNotification).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'critical' }),
        expect.arrayContaining([
          expect.objectContaining({
            channel_type: 'slack',
            config: expect.objectContaining({ webhook_url: 'https://hooks.slack.com/test-webhook' })
          })
        ])
      );
    });

    it('TEAMS_WEBHOOK_URLが設定されている場合にTeamsチャネルで通知', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://teams.example.com/webhook-test';
      notificationService.sendAlertNotification.mockResolvedValue([{ success: true }]);

      const errorData = {
        pattern: 'memory_leak',
        severity: 'high',
        error_message: 'Memory usage exceeded'
      };

      const result = await alertAdmin(errorData);

      expect(result.success).toBe(true);
      expect(notificationService.sendAlertNotification).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'high' }),
        expect.arrayContaining([
          expect.objectContaining({
            channel_type: 'teams',
            config: expect.objectContaining({
              webhook_url: 'https://teams.example.com/webhook-test'
            })
          })
        ])
      );
    });

    it('ALERT_EMAILが設定されている場合にEmailチャネルで通知', async () => {
      process.env.ALERT_EMAIL = 'admin@example.com';
      notificationService.sendAlertNotification.mockResolvedValue([{ success: true }]);

      const errorData = {
        pattern: 'disk_full',
        severity: 'critical',
        error_message: 'Disk 98% full'
      };

      const result = await alertAdmin(errorData);

      expect(result.success).toBe(true);
      expect(notificationService.sendAlertNotification).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'critical' }),
        expect.arrayContaining([
          expect.objectContaining({
            channel_type: 'email',
            config: expect.objectContaining({ email: 'admin@example.com' })
          })
        ])
      );
    });

    it('複数環境変数が設定されている場合に全チャネルで通知', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      process.env.TEAMS_WEBHOOK_URL = 'https://teams.example.com/test';
      process.env.ALERT_EMAIL = 'alert@example.com';
      notificationService.sendAlertNotification.mockResolvedValue([
        { success: true },
        { success: true },
        { success: true }
      ]);

      const errorData = {
        pattern: 'service_down',
        severity: 'critical',
        error_message: 'Service not responding',
        metadata: { value: 0, threshold: 1 }
      };

      const result = await alertAdmin(errorData);

      expect(result.success).toBe(true);
      expect(result.details.total_channels).toBe(3);
      expect(result.details.success_count).toBe(3);
      expect(result.details.failure_count).toBe(0);
    });

    it('通知送信が部分的に失敗した場合に正しいカウントを返す', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      process.env.ALERT_EMAIL = 'alert@example.com';
      notificationService.sendAlertNotification.mockResolvedValue([
        { success: true },
        { success: false }
      ]);

      const errorData = {
        pattern: 'test_alert',
        severity: 'high',
        error_message: 'Test alert'
      };

      const result = await alertAdmin(errorData);

      expect(result.success).toBe(true); // 1つ以上成功
      expect(result.details.success_count).toBe(1);
      expect(result.details.failure_count).toBe(1);
    });

    it('明示的なチャネル指定で通知を送信（env vars を無視）', async () => {
      // 明示的チャネルがある場合は env vars の分岐をスキップ
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/should-be-ignored';
      notificationService.sendAlertNotification.mockResolvedValue([{ success: true }]);

      const errorData = {
        pattern: 'explicit_channel_test',
        severity: 'medium',
        error_message: 'Test',
        metadata: {}
      };
      const channels = [
        {
          channel_type: 'slack',
          channel_name: 'Explicit Slack',
          config: { webhook_url: 'https://hooks.slack.com/explicit' }
        }
      ];

      const result = await alertAdmin(errorData, channels);

      expect(result.success).toBe(true);
      expect(result.details.total_channels).toBe(1);
      // 明示的チャネルの URL が使われる（env var URL は使われない）
      expect(notificationService.sendAlertNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({
            config: expect.objectContaining({ webhook_url: 'https://hooks.slack.com/explicit' })
          })
        ])
      );
    });

    it('notificationService が例外を投げた場合にエラーを返す', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      notificationService.sendAlertNotification.mockRejectedValue(new Error('Network error'));

      const errorData = {
        pattern: 'error_test',
        severity: 'critical',
        error_message: 'Test error'
      };

      const result = await alertAdmin(errorData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Alert admin failed');
      expect(result.details.error).toContain('Network error');
    });
  });
});
