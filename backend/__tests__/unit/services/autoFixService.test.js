/**
 * Auto-Fix Service Unit Tests
 * autoFixService.js のユニットテスト
 * Branch カバレッジ向上: 各関数の true/false 分岐を網羅
 */

// ============================================================
// モック設定 (require より先に定義する必要がある)
// ============================================================

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    open: jest.fn(),
    statfs: jest.fn()
  }
}));

jest.mock('readline', () => ({
  createInterface: jest.fn()
}));

jest.mock('../../../db', () => ({
  db: {
    get: jest.fn()
  }
}));

jest.mock('../../../services/errorPatterns', () => ({
  matchError: jest.fn()
}));

jest.mock('../../../services/fixActions', () => ({
  setDatabase: jest.fn(),
  executeAction: jest.fn()
}));

jest.mock('../../../services/monitoringService', () => ({
  getSystemMetrics: jest.fn()
}));

jest.mock('../../../services/alertService', () => ({
  getActiveAlerts: jest.fn()
}));

// ============================================================
// テスト対象モジュール読み込み
// ============================================================

const autoFixService = require('../../../services/autoFixService');

// ============================================================
// テストユーティリティ
// ============================================================

/**
 * readline の非同期イテラブルモックを作成
 * for await (const line of rl) で動作する
 */
function createMockReadlineInterface(lines) {
  const mockClose = jest.fn().mockResolvedValue(undefined);
  const rl = {
    async *[Symbol.asyncIterator] () {
      for (const line of lines) {
        yield line;
      }
    }
  };
  return { rl, close: mockClose };
}

/**
 * knex スタイルのクエリチェーンモックを作成
 * clone() が別の count 専用オブジェクトを返す
 */
function createKnexChain(resolvedRows = [], countValue = 0) {
  const cloneChain = {
    count: jest.fn().mockResolvedValue([{ count: countValue }])
  };
  const chain = {
    where: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnValue(cloneChain),
    count: jest.fn().mockResolvedValue([{ count: countValue }]),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue(resolvedRows),
    first: jest.fn().mockResolvedValue(resolvedRows[0] || null),
    insert: jest.fn().mockResolvedValue([1]),
    delete: jest.fn().mockResolvedValue(0)
  };
  return chain;
}

// ============================================================
// テストスイート
// ============================================================

describe('AutoFix Service', () => {
  let fsPromises;
  let readline;
  let sqliteDb;
  let errorPatterns;
  let fixActions;
  let monitoringService;
  let alertService;
  let logger;

  beforeEach(() => {
    jest.clearAllMocks();
    // モジュール参照を再取得
    fsPromises = require('fs').promises;
    readline = require('readline');
    sqliteDb = require('../../../db').db;
    errorPatterns = require('../../../services/errorPatterns');
    fixActions = require('../../../services/fixActions');
    monitoringService = require('../../../services/monitoringService');
    alertService = require('../../../services/alertService');
    logger = require('../../../utils/logger');

    // デフォルトモック設定
    autoFixService.setDatabase(null);
  });

  // ============================================================
  // setDatabase
  // ============================================================

  describe('setDatabase', () => {
    it('should set db and delegate to fixActions.setDatabase', () => {
      const mockDb = { select: jest.fn() };
      expect(() => autoFixService.setDatabase(mockDb)).not.toThrow();
      expect(fixActions.setDatabase).toHaveBeenCalledWith(mockDb);
    });

    it('should accept null without throwing', () => {
      expect(() => autoFixService.setDatabase(null)).not.toThrow();
      expect(fixActions.setDatabase).toHaveBeenCalledWith(null);
    });
  });

  // ============================================================
  // generateErrorHash
  // ============================================================

  describe('generateErrorHash', () => {
    it('should return a 64-char SHA256 hex string', () => {
      const hash = autoFixService.generateErrorHash('test error message', 'pattern_001');
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic for the same inputs', () => {
      const hash1 = autoFixService.generateErrorHash('same message', 'p1');
      const hash2 = autoFixService.generateErrorHash('same message', 'p1');
      expect(hash1).toBe(hash2);
    });

    it('should differ when message differs', () => {
      const hash1 = autoFixService.generateErrorHash('message_a', 'p1');
      const hash2 = autoFixService.generateErrorHash('message_b', 'p1');
      expect(hash1).not.toBe(hash2);
    });

    it('should differ when patternId differs', () => {
      const hash1 = autoFixService.generateErrorHash('same', 'pattern_x');
      const hash2 = autoFixService.generateErrorHash('same', 'pattern_y');
      expect(hash1).not.toBe(hash2);
    });

    it('should truncate message to 200 chars for hashing (long messages produce same hash)', () => {
      const base = 'A'.repeat(250);
      // 200文字目以降が異なっても同じハッシュになる
      const hash1 = autoFixService.generateErrorHash(`${base  }X`, 'p1');
      const hash2 = autoFixService.generateErrorHash(`${base  }Y`, 'p1');
      expect(hash1).toBe(hash2);
    });
  });

  // ============================================================
  // scanLogs
  // ============================================================

  describe('scanLogs', () => {
    it('should return empty array when log file access fails', async () => {
      const accessError = new Error('File not found');
      fsPromises.access.mockRejectedValue(accessError);

      const result = await autoFixService.scanLogs('/nonexistent/path.log');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return empty array when no error lines found (2xx responses only)', async () => {
      fsPromises.access.mockResolvedValue(undefined);
      const mockClose = jest.fn().mockResolvedValue(undefined);
      const mockFileHandle = {
        createReadStream: jest.fn(),
        close: mockClose
      };
      fsPromises.open.mockResolvedValue(mockFileHandle);

      const { rl } = createMockReadlineInterface([
        '::1 - - "GET /api/health HTTP/1.1" 200 45',
        '::1 - - "GET /api/status HTTP/1.1" 302 0',
        '::1 - - "POST /api/login HTTP/1.1" 201 89'
      ]);
      readline.createInterface.mockReturnValue(rl);

      const result = await autoFixService.scanLogs('/test/app.log');
      expect(result).toEqual([]);
    });

    it('should detect HTTP 5xx errors with critical severity', async () => {
      fsPromises.access.mockResolvedValue(undefined);
      const mockFileHandle = {
        createReadStream: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.open.mockResolvedValue(mockFileHandle);

      const { rl } = createMockReadlineInterface([
        '::1 - admin [2026-01-01] "GET /api/tickets HTTP/1.1" 500 123',
        '::1 - - "GET /api/health HTTP/1.1" 200 45'
      ]);
      readline.createInterface.mockReturnValue(rl);

      const result = await autoFixService.scanLogs('/test/app.log');

      const httpErrors = result.filter((e) => e.source === 'morgan_logs');
      expect(httpErrors.length).toBeGreaterThanOrEqual(1);
      const fiveHundredError = httpErrors.find((e) => e.severity === 'critical');
      expect(fiveHundredError).toBeTruthy();
    });

    it('should detect HTTP 4xx errors with warning severity', async () => {
      fsPromises.access.mockResolvedValue(undefined);
      const mockFileHandle = {
        createReadStream: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.open.mockResolvedValue(mockFileHandle);

      const { rl } = createMockReadlineInterface([
        '::1 - - "GET /api/secure HTTP/1.1" 401 89',
        '::1 - - "DELETE /api/resource HTTP/1.1" 403 56'
      ]);
      readline.createInterface.mockReturnValue(rl);

      const result = await autoFixService.scanLogs('/test/app.log');

      const warningErrors = result.filter((e) => e.severity === 'warning');
      expect(warningErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect Node.js Error/Exception patterns with high severity', async () => {
      fsPromises.access.mockResolvedValue(undefined);
      const mockFileHandle = {
        createReadStream: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.open.mockResolvedValue(mockFileHandle);

      const { rl } = createMockReadlineInterface([
        '2026-01-01T12:00:00 Error: ENOENT: no such file',
        '2026-01-01T12:01:00 Uncaught TypeError at app.js:100'
      ]);
      readline.createInterface.mockReturnValue(rl);

      const result = await autoFixService.scanLogs('/test/app.log');

      const highErrors = result.filter((e) => e.severity === 'high');
      expect(highErrors.length).toBeGreaterThanOrEqual(1);
    });

    it('should keep only last 100 lines (circular buffer)', async () => {
      fsPromises.access.mockResolvedValue(undefined);
      const mockFileHandle = {
        createReadStream: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined)
      };
      fsPromises.open.mockResolvedValue(mockFileHandle);

      // 120行を生成（最初の20行は 500 エラー、残り 100 行は正常）
      const lines = [];
      for (let i = 0; i < 20; i++) {
        lines.push(`line ${i} "GET /api HTTP/1.1" 500 100`);
      }
      for (let i = 20; i < 120; i++) {
        lines.push(`line ${i} "GET /api HTTP/1.1" 200 45`);
      }

      const { rl } = createMockReadlineInterface(lines);
      readline.createInterface.mockReturnValue(rl);

      const result = await autoFixService.scanLogs('/test/app.log');
      // 最初の20行（500エラー）はバッファから除外される
      expect(result).toEqual([]);
    });
  });

  // ============================================================
  // checkHealthEndpoint
  // ============================================================

  describe('checkHealthEndpoint', () => {
    it('should return empty array when DB query succeeds and disk has sufficient space', async () => {
      sqliteDb.get.mockImplementation((_sql, cb) => cb(null, { result: 1 }));
      fsPromises.statfs.mockResolvedValue({ bavail: 90, blocks: 100 }); // 90% free

      const result = await autoFixService.checkHealthEndpoint();

      // DB と disk チェックは通過。memory は OS 依存だが配列が返ること
      expect(Array.isArray(result)).toBe(true);
      const dbErrors = result.filter((e) => e.metadata && e.metadata.check === 'database');
      const diskErrors = result.filter((e) => e.metadata && e.metadata.check === 'disk');
      expect(dbErrors).toHaveLength(0);
      expect(diskErrors).toHaveLength(0);
    });

    it('should push critical error when DB callback returns error', async () => {
      sqliteDb.get.mockImplementation((_sql, cb) => cb(new Error('DB connection failed')));
      fsPromises.statfs.mockResolvedValue({ bavail: 50, blocks: 100 });

      const result = await autoFixService.checkHealthEndpoint();

      const dbError = result.find((e) => e.metadata && e.metadata.check === 'database');
      expect(dbError).toBeTruthy();
      expect(dbError.severity).toBe('critical');
      expect(dbError.message).toContain('Database connection failed');
    });

    it('should push critical error when DB query returns unexpected result (row.result !== 1)', async () => {
      // row は存在するが result !== 1
      sqliteDb.get.mockImplementation((_sql, cb) => cb(null, { result: 0 }));
      fsPromises.statfs.mockResolvedValue({ bavail: 50, blocks: 100 });

      const result = await autoFixService.checkHealthEndpoint();

      const dbError = result.find((e) => e.metadata && e.metadata.check === 'database');
      expect(dbError).toBeTruthy();
      expect(dbError.message).toContain('Unexpected query result');
    });

    it('should push critical error when disk free space is below 10%', async () => {
      sqliteDb.get.mockImplementation((_sql, cb) => cb(null, { result: 1 }));
      // bavail/blocks = 5% → critical
      fsPromises.statfs.mockResolvedValue({ bavail: 5, blocks: 100 });

      const result = await autoFixService.checkHealthEndpoint();

      const diskError = result.find((e) => e.metadata && e.metadata.check === 'disk');
      expect(diskError).toBeTruthy();
      expect(diskError.severity).toBe('critical');
      expect(diskError.message).toContain('disk usage 90%');
    });

    it('should push high error when statfs throws', async () => {
      sqliteDb.get.mockImplementation((_sql, cb) => cb(null, { result: 1 }));
      fsPromises.statfs.mockRejectedValue(new Error('statfs not supported on this platform'));

      const result = await autoFixService.checkHealthEndpoint();

      const diskError = result.find((e) => e.metadata && e.metadata.check === 'disk');
      expect(diskError).toBeTruthy();
      expect(diskError.severity).toBe('high');
    });
  });

  // ============================================================
  // checkMetrics
  // ============================================================

  describe('checkMetrics', () => {
    it('should return empty array when all metrics are normal', async () => {
      monitoringService.getSystemMetrics.mockResolvedValue({
        metrics: {
          cpu: { threshold_status: 'normal', usage_percent: 20 },
          memory: { threshold_status: 'normal', usage_percent: 40 },
          disk: { threshold_status: 'normal', usage_percent: 60 }
        }
      });

      const result = await autoFixService.checkMetrics();
      expect(result).toEqual([]);
    });

    it('should push critical error for CPU threshold_status === critical', async () => {
      monitoringService.getSystemMetrics.mockResolvedValue({
        metrics: {
          cpu: { threshold_status: 'critical', usage_percent: 95 },
          memory: { threshold_status: 'normal', usage_percent: 40 },
          disk: { threshold_status: 'normal', usage_percent: 60 }
        }
      });

      const result = await autoFixService.checkMetrics();

      const cpuError = result.find((e) => e.metadata && e.metadata.metric === 'cpu');
      expect(cpuError).toBeTruthy();
      expect(cpuError.severity).toBe('critical');
      expect(cpuError.metadata.value).toBe(95);
    });

    it('should push critical error for memory threshold_status === critical', async () => {
      monitoringService.getSystemMetrics.mockResolvedValue({
        metrics: {
          cpu: { threshold_status: 'normal', usage_percent: 30 },
          memory: { threshold_status: 'critical', usage_percent: 92 },
          disk: { threshold_status: 'normal', usage_percent: 60 }
        }
      });

      const result = await autoFixService.checkMetrics();

      const memError = result.find((e) => e.metadata && e.metadata.metric === 'memory');
      expect(memError).toBeTruthy();
      expect(memError.severity).toBe('critical');
      expect(memError.message).toContain('memory usage 90%');
    });

    it('should push critical error for disk threshold_status === critical', async () => {
      monitoringService.getSystemMetrics.mockResolvedValue({
        metrics: {
          cpu: { threshold_status: 'normal', usage_percent: 20 },
          memory: { threshold_status: 'normal', usage_percent: 40 },
          disk: { threshold_status: 'critical', usage_percent: 93 }
        }
      });

      const result = await autoFixService.checkMetrics();

      const diskError = result.find((e) => e.metadata && e.metadata.metric === 'disk');
      expect(diskError).toBeTruthy();
      expect(diskError.metadata.metric).toBe('disk');
    });

    it('should detect all three metrics critical simultaneously', async () => {
      monitoringService.getSystemMetrics.mockResolvedValue({
        metrics: {
          cpu: { threshold_status: 'critical', usage_percent: 98 },
          memory: { threshold_status: 'critical', usage_percent: 97 },
          disk: { threshold_status: 'critical', usage_percent: 96 }
        }
      });

      const result = await autoFixService.checkMetrics();
      expect(result).toHaveLength(3);
    });

    it('should return empty array and log error when getSystemMetrics throws', async () => {
      monitoringService.getSystemMetrics.mockRejectedValue(
        new Error('Metrics service unavailable')
      );

      const result = await autoFixService.checkMetrics();
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================
  // checkActiveAlerts
  // ============================================================

  describe('checkActiveAlerts', () => {
    it('should return empty array when no alerts', async () => {
      alertService.getActiveAlerts.mockResolvedValue([]);

      const result = await autoFixService.checkActiveAlerts();
      expect(result).toEqual([]);
    });

    it('should include critical firing alerts in result', async () => {
      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'critical',
          status: 'firing',
          rule_name: 'HighCPU',
          message: 'CPU 95%',
          timestamp: new Date().toISOString(),
          metric_name: 'cpu',
          current_value: 95,
          threshold: 90
        }
      ]);

      const result = await autoFixService.checkActiveAlerts();
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('alert_service');
      expect(result[0].severity).toBe('critical');
      expect(result[0].metadata.alert_id).toBe(1);
    });

    it('should skip non-critical alerts (severity !== critical)', async () => {
      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'high',
          status: 'firing',
          rule_name: 'Rule',
          message: 'msg',
          timestamp: ''
        }
      ]);

      const result = await autoFixService.checkActiveAlerts();
      expect(result).toEqual([]);
    });

    it('should skip critical alerts that are not firing (status !== firing)', async () => {
      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'critical',
          status: 'resolved',
          rule_name: 'Rule',
          message: 'msg',
          timestamp: ''
        }
      ]);

      const result = await autoFixService.checkActiveAlerts();
      expect(result).toEqual([]);
    });

    it('should handle alertService exception gracefully', async () => {
      alertService.getActiveAlerts.mockRejectedValue(new Error('Alert service down'));

      const result = await autoFixService.checkActiveAlerts();
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================
  // matchPattern
  // ============================================================

  describe('matchPattern', () => {
    it('should return null for null error', async () => {
      const result = await autoFixService.matchPattern(null);
      expect(result).toBeNull();
    });

    it('should return null for undefined error', async () => {
      const result = await autoFixService.matchPattern(undefined);
      expect(result).toBeNull();
    });

    it('should return null when error has no message property', async () => {
      const result = await autoFixService.matchPattern({ source: 'test', severity: 'critical' });
      expect(result).toBeNull();
    });

    it('should return null when no pattern matches', async () => {
      errorPatterns.matchError.mockReturnValue(null);

      const result = await autoFixService.matchPattern({ message: 'unknown error type' });
      expect(result).toBeNull();
      expect(errorPatterns.matchError).toHaveBeenCalledWith('unknown error type');
    });

    it('should return enriched error object when pattern matches', async () => {
      errorPatterns.matchError.mockReturnValue({
        pattern_id: 'cpu_spike',
        pattern_name: 'CPU Spike',
        severity: 'critical',
        auto_fix: true,
        actions: ['service_restart', 'alert_admin'],
        cooldown_seconds: 300
      });

      const error = { message: 'CPU critical: 95% usage', source: 'monitoring_metrics' };
      const result = await autoFixService.matchPattern(error);

      expect(result).toBeTruthy();
      expect(result.pattern_id).toBe('cpu_spike');
      expect(result.auto_fix).toBe(true);
      expect(result.actions).toEqual(['service_restart', 'alert_admin']);
      expect(result.cooldown_seconds).toBe(300);
      // 元のフィールドも維持される
      expect(result.source).toBe('monitoring_metrics');
    });

    it('should return enriched error with auto_fix: false pattern', async () => {
      errorPatterns.matchError.mockReturnValue({
        pattern_id: 'manual_only',
        pattern_name: 'Manual Fix Required',
        severity: 'high',
        auto_fix: false,
        actions: [],
        cooldown_seconds: 600
      });

      const result = await autoFixService.matchPattern({ message: 'manual fix needed' });
      expect(result.auto_fix).toBe(false);
    });
  });

  // ============================================================
  // checkCooldown & recordCooldown（メモリキャッシュ統合テスト）
  // ============================================================

  describe('checkCooldown', () => {
    it('should return inCooldown: false when cache is empty and db is null', async () => {
      const result = await autoFixService.checkCooldown('nonexistent-hash-xyz');
      expect(result.inCooldown).toBe(false);
    });

    it('should return inCooldown: true from memory when hash is cached (recordCooldown → checkCooldown)', async () => {
      // recordCooldown でキャッシュに登録（db は null でも memory には登録される）
      await autoFixService.recordCooldown('cached-hash-001', 'cpu_spike', 300);

      const result = await autoFixService.checkCooldown('cached-hash-001');
      expect(result.inCooldown).toBe(true);
      expect(result.source).toBe('memory');
      expect(result.remainingMs).toBeGreaterThan(0);
    });

    it('should return inCooldown: false when db is null and hash not in cache', async () => {
      const result = await autoFixService.checkCooldown('fresh-unique-hash-abc');
      expect(result.inCooldown).toBe(false);
    });

    it('should return inCooldown: true from database when db has active cooldown record', async () => {
      const futureExpiry = new Date(Date.now() + 60000).toISOString();
      const mockChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          error_hash: 'db-hash-002',
          expires_at: futureExpiry
        })
      };
      const mockDb = jest.fn(() => mockChain);
      autoFixService.setDatabase(mockDb);

      const result = await autoFixService.checkCooldown('db-hash-002');
      expect(result.inCooldown).toBe(true);
      expect(result.source).toBe('database');
      expect(result.remainingMs).toBeGreaterThan(0);
    });

    it('should return inCooldown: false when db has no matching record', async () => {
      const mockChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null)
      };
      const mockDb = jest.fn(() => mockChain);
      autoFixService.setDatabase(mockDb);

      const result = await autoFixService.checkCooldown('no-match-hash-003');
      expect(result.inCooldown).toBe(false);
    });

    it('should return inCooldown: false when db query throws error', async () => {
      const mockChain = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockRejectedValue(new Error('DB error'))
      };
      const mockDb = jest.fn(() => mockChain);
      autoFixService.setDatabase(mockDb);

      const result = await autoFixService.checkCooldown('error-hash-004');
      expect(result.inCooldown).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('recordCooldown', () => {
    it('should not throw when db is null (only updates memory cache)', async () => {
      autoFixService.setDatabase(null);
      await expect(
        autoFixService.recordCooldown('hash-005', 'pattern_id', 300)
      ).resolves.not.toThrow();
    });

    it('should insert cooldown record into db when db is set', async () => {
      const mockInsert = jest.fn().mockResolvedValue([1]);
      const mockDb = jest.fn(() => ({ insert: mockInsert }));
      autoFixService.setDatabase(mockDb);

      await autoFixService.recordCooldown('hash-006', 'cpu_spike', 60);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          error_hash: 'hash-006',
          error_pattern: 'cpu_spike'
        })
      );
    });

    it('should use default cooldown of 300s when not specified', async () => {
      const mockInsert = jest.fn().mockResolvedValue([1]);
      const mockDb = jest.fn(() => ({ insert: mockInsert }));
      autoFixService.setDatabase(mockDb);

      await autoFixService.recordCooldown('hash-007', 'p1');

      const callArg = mockInsert.mock.calls[0][0];
      const expiresAt = new Date(callArg.expires_at);
      const lastFixedAt = new Date(callArg.last_fixed_at);
      const diff = expiresAt.getTime() - lastFixedAt.getTime();
      expect(diff).toBeCloseTo(300000, -3); // 約 300 秒 ±1秒
    });

    it('should handle db insert error gracefully', async () => {
      const mockDb = jest.fn(() => ({
        insert: jest.fn().mockRejectedValue(new Error('Insert failed'))
      }));
      autoFixService.setDatabase(mockDb);

      await expect(autoFixService.recordCooldown('hash-008', 'p1', 300)).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================
  // executeFixAction
  // ============================================================

  describe('executeFixAction', () => {
    it('should execute all actions and return results array', async () => {
      fixActions.executeAction.mockResolvedValue({
        success: true,
        message: 'Action completed',
        execution_time_ms: 100
      });

      const error = {
        pattern_id: 'high_error_rate',
        severity: 'critical',
        message: 'Error rate 95%',
        actions: ['alert_admin', 'database_checkpoint'],
        metadata: { value: 95 }
      };

      const results = await autoFixService.executeFixAction(error);

      expect(results).toHaveLength(2);
      expect(results[0].action).toBe('alert_admin');
      expect(results[0].success).toBe(true);
      expect(results[1].action).toBe('database_checkpoint');
    });

    it('should handle thrown error from fixActions.executeAction gracefully', async () => {
      fixActions.executeAction.mockRejectedValue(new Error('Action threw exception'));

      const error = {
        pattern_id: 'test_pattern',
        severity: 'high',
        message: 'Test error message',
        actions: ['service_restart'],
        metadata: {}
      };

      const results = await autoFixService.executeFixAction(error);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].execution_time_ms).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should process multiple actions sequentially', async () => {
      const callOrder = [];
      fixActions.executeAction
        .mockImplementationOnce(async (name) => {
          callOrder.push(name);
          return { success: true, message: 'first', execution_time_ms: 10 };
        })
        .mockImplementationOnce(async (name) => {
          callOrder.push(name);
          return { success: true, message: 'second', execution_time_ms: 20 };
        });

      const error = {
        pattern_id: 'p1',
        severity: 'critical',
        message: 'error',
        actions: ['action_a', 'action_b'],
        metadata: {}
      };

      await autoFixService.executeFixAction(error);
      expect(callOrder).toEqual(['action_a', 'action_b']);
    });
  });

  // ============================================================
  // recordHistory
  // ============================================================

  describe('recordHistory', () => {
    it('should return null and warn when db is not initialized', async () => {
      autoFixService.setDatabase(null);

      const result = await autoFixService.recordHistory(
        { pattern_id: 'p1', severity: 'critical', message: 'msg' },
        []
      );

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should record success history when all actions succeeded', async () => {
      const mockInsert = jest.fn().mockResolvedValue([42]);
      const mockDb = jest.fn(() => ({ insert: mockInsert }));
      autoFixService.setDatabase(mockDb);

      const error = {
        pattern_id: 'cpu_spike',
        severity: 'critical',
        message: 'CPU 95%',
        metadata: {}
      };
      const results = [
        { action: 'alert_admin', success: true, message: 'OK', execution_time_ms: 100 },
        { action: 'service_restart', success: true, message: 'Restarted', execution_time_ms: 200 }
      ];

      const id = await autoFixService.recordHistory(error, results);

      expect(id).toBe(42);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', execution_time_ms: 300 })
      );
    });

    it('should record failure history when any action failed', async () => {
      const mockInsert = jest.fn().mockResolvedValue([99]);
      const mockDb = jest.fn(() => ({ insert: mockInsert }));
      autoFixService.setDatabase(mockDb);

      const error = { pattern_id: 'p1', severity: 'high', message: 'err', metadata: {} };
      const results = [
        { action: 'a1', success: true, execution_time_ms: 50 },
        { action: 'a2', success: false, execution_time_ms: 0 }
      ];

      const id = await autoFixService.recordHistory(error, results);

      expect(id).toBe(99);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ status: 'failure' }));
    });

    it('should truncate error_message to 500 chars', async () => {
      const mockInsert = jest.fn().mockResolvedValue([1]);
      const mockDb = jest.fn(() => ({ insert: mockInsert }));
      autoFixService.setDatabase(mockDb);

      const longMessage = 'A'.repeat(600);
      const error = { pattern_id: 'p1', severity: 'critical', message: longMessage };

      await autoFixService.recordHistory(error, [{ success: true, execution_time_ms: 10 }]);

      const callArg = mockInsert.mock.calls[0][0];
      expect(callArg.error_message).toHaveLength(500);
    });

    it('should return null on db insert error', async () => {
      const mockDb = jest.fn(() => ({
        insert: jest.fn().mockRejectedValue(new Error('Insert error'))
      }));
      autoFixService.setDatabase(mockDb);

      const result = await autoFixService.recordHistory(
        { pattern_id: 'p1', severity: 'critical', message: 'err' },
        []
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getStatus
  // ============================================================

  describe('getStatus', () => {
    it('should return default status with total_runs=0 when db is null', async () => {
      autoFixService.setDatabase(null);

      const status = await autoFixService.getStatus();

      expect(status).toHaveProperty('enabled');
      expect(status.total_runs).toBe(0);
      expect(status.success_runs).toBe(0);
      expect(status.success_rate).toBe(0);
      expect(status).toHaveProperty('active_cooldowns');
      expect(status.last_run).toBeNull();
    });

    it('should return status with DB stats when db is set and has records', async () => {
      let callIndex = 0;
      const mockDb = jest.fn().mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // 第1呼び出し: count('* as count') → totalResult
          return { count: jest.fn().mockResolvedValue([{ count: 10 }]) };
        } if (callIndex === 2) {
          // 第2呼び出し: where('status','success').count(...)
          return {
            where: jest.fn().mockReturnValue({
              count: jest.fn().mockResolvedValue([{ count: 8 }])
            })
          };
        } 
          // 第3呼び出し: orderBy('created_at','desc').first()
          return {
            orderBy: jest.fn().mockReturnValue({
              first: jest.fn().mockResolvedValue({ created_at: '2026-01-01T00:00:00.000Z' })
            })
          };
        
      });
      autoFixService.setDatabase(mockDb);

      const status = await autoFixService.getStatus();

      expect(status.total_runs).toBe(10);
      expect(status.success_runs).toBe(8);
      expect(status.success_rate).toBeCloseTo(0.8, 4);
      expect(status.last_run).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should have success_rate = 0 when total_runs = 0 from DB', async () => {
      let callIndex = 0;
      const mockDb = jest.fn().mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return { count: jest.fn().mockResolvedValue([{ count: 0 }]) };
        } if (callIndex === 2) {
          return {
            where: jest.fn().mockReturnValue({
              count: jest.fn().mockResolvedValue([{ count: 0 }])
            })
          };
        } 
          return {
            orderBy: jest.fn().mockReturnValue({
              first: jest.fn().mockResolvedValue(null) // last_run が null のケース
            })
          };
        
      });
      autoFixService.setDatabase(mockDb);

      const status = await autoFixService.getStatus();
      expect(status.success_rate).toBe(0);
      expect(status.last_run).toBeNull();
    });

    it('should handle db query error gracefully and return partial status', async () => {
      const mockDb = jest.fn(() => ({
        count: jest.fn().mockRejectedValue(new Error('Query failed')),
        where: jest.fn().mockReturnThis()
      }));
      autoFixService.setDatabase(mockDb);

      const status = await autoFixService.getStatus();
      expect(status).toHaveProperty('enabled');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getHistory
  // ============================================================

  describe('getHistory', () => {
    it('should throw Error when db is not initialized', async () => {
      autoFixService.setDatabase(null);

      await expect(autoFixService.getHistory()).rejects.toThrow('Database not initialized');
    });

    it('should return paginated history without filters', async () => {
      const mockRecords = [
        { id: 1, error_pattern: 'cpu_spike', status: 'success', created_at: '2026-01-01' }
      ];
      const chain = createKnexChain(mockRecords, 1);
      const mockDb = jest.fn().mockReturnValue(chain);
      autoFixService.setDatabase(mockDb);

      const result = await autoFixService.getHistory({}, { limit: 10, offset: 0 });

      expect(result).toHaveProperty('history');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('filters');
      expect(result).toHaveProperty('pagination');
    });

    it('should apply pattern filter when filters.pattern is set', async () => {
      const chain = createKnexChain([], 0);
      const mockDb = jest.fn().mockReturnValue(chain);
      autoFixService.setDatabase(mockDb);

      await autoFixService.getHistory({ pattern: 'cpu_spike' }, { limit: 10, offset: 0 });

      expect(chain.where).toHaveBeenCalledWith('error_pattern', 'cpu_spike');
    });

    it('should apply severity filter when filters.severity is set', async () => {
      const chain = createKnexChain([], 0);
      const mockDb = jest.fn().mockReturnValue(chain);
      autoFixService.setDatabase(mockDb);

      await autoFixService.getHistory({ severity: 'critical' }, { limit: 10, offset: 0 });

      expect(chain.where).toHaveBeenCalledWith('severity', 'critical');
    });

    it('should apply status filter when filters.status is set', async () => {
      const chain = createKnexChain([], 0);
      const mockDb = jest.fn().mockReturnValue(chain);
      autoFixService.setDatabase(mockDb);

      await autoFixService.getHistory({ status: 'success' }, { limit: 5, offset: 0 });

      expect(chain.where).toHaveBeenCalledWith('status', 'success');
    });

    it('should apply all three filters simultaneously', async () => {
      const chain = createKnexChain([], 0);
      const mockDb = jest.fn().mockReturnValue(chain);
      autoFixService.setDatabase(mockDb);

      await autoFixService.getHistory(
        { pattern: 'mem_leak', severity: 'high', status: 'failure' },
        { limit: 20, offset: 10 }
      );

      expect(chain.where).toHaveBeenCalledWith('error_pattern', 'mem_leak');
      expect(chain.where).toHaveBeenCalledWith('severity', 'high');
      expect(chain.where).toHaveBeenCalledWith('status', 'failure');
      expect(chain.limit).toHaveBeenCalledWith(20);
      expect(chain.offset).toHaveBeenCalledWith(10);
    });

    it('should rethrow db errors', async () => {
      const cloneChain = {
        count: jest.fn().mockRejectedValue(new Error('DB query error'))
      };
      const chain = {
        where: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnValue(cloneChain)
      };
      const mockDb = jest.fn().mockReturnValue(chain);
      autoFixService.setDatabase(mockDb);

      await expect(autoFixService.getHistory()).rejects.toThrow('DB query error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================
  // cleanupExpiredCooldowns
  // ============================================================

  describe('cleanupExpiredCooldowns', () => {
    it('should return 0 when db is null', async () => {
      autoFixService.setDatabase(null);

      const result = await autoFixService.cleanupExpiredCooldowns();
      expect(result).toBe(0);
    });

    it('should delete expired cooldown records and return count', async () => {
      const mockDelete = jest.fn().mockResolvedValue(3);
      const mockDb = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        delete: mockDelete
      }));
      autoFixService.setDatabase(mockDb);

      const result = await autoFixService.cleanupExpiredCooldowns();
      expect(result).toBe(3);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('3'));
    });

    it('should return 0 on db error', async () => {
      const mockDb = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockRejectedValue(new Error('Delete failed'))
      }));
      autoFixService.setDatabase(mockDb);

      const result = await autoFixService.cleanupExpiredCooldowns();
      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // ============================================================
  // runAutoFix（メインオーケストレーション）
  // ============================================================

  describe('runAutoFix', () => {
    /**
     * runAutoFix の内部で detectErrors() が呼ばれる。
     * detectErrors は scanLogs, checkHealthEndpoint, checkMetrics, checkActiveAlerts を並列実行する。
     * デフォルトで全ソースがエラーなし状態にセットアップする。
     */
    beforeEach(() => {
      // scanLogs: ファイルアクセスエラー（ENOENT は無視され空配列を返す）
      const accessError = new Error('File not found');
      accessError.code = 'ENOENT';
      fsPromises.access.mockRejectedValue(accessError);

      // checkHealthEndpoint: DB正常, disk 十分な空き
      sqliteDb.get.mockImplementation((_sql, cb) => cb(null, { result: 1 }));
      fsPromises.statfs.mockResolvedValue({ bavail: 50, blocks: 100 });

      // checkMetrics: 全て正常
      monitoringService.getSystemMetrics.mockResolvedValue({
        metrics: {
          cpu: { threshold_status: 'normal', usage_percent: 20 },
          memory: { threshold_status: 'normal', usage_percent: 40 },
          disk: { threshold_status: 'normal', usage_percent: 60 }
        }
      });

      // checkActiveAlerts: アラートなし
      alertService.getActiveAlerts.mockResolvedValue([]);
    });

    it('should return summary with errors_detected=0 when no errors from any source', async () => {
      const summary = await autoFixService.runAutoFix();

      expect(summary).toHaveProperty('errors_detected', 0);
      expect(summary).toHaveProperty('errors_matched', 0);
      expect(summary).toHaveProperty('errors_fixed', 0);
      expect(summary).toHaveProperty('execution_time_ms');
      expect(summary.execution_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('should return errors_detected > 0 but errors_matched=0 when no patterns match', async () => {
      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'critical',
          status: 'firing',
          rule_name: 'UnknownRule',
          message: 'Unrecognized error pattern',
          timestamp: new Date().toISOString()
        }
      ]);
      // パターンマッチしない
      errorPatterns.matchError.mockReturnValue(null);

      const summary = await autoFixService.runAutoFix();

      expect(summary.errors_detected).toBeGreaterThanOrEqual(1);
      expect(summary.errors_matched).toBe(0);
    });

    it('should skip auto-fix when pattern matched but auto_fix = false', async () => {
      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'critical',
          status: 'firing',
          rule_name: 'ManualOnly',
          message: 'Manual intervention required',
          timestamp: new Date().toISOString()
        }
      ]);
      errorPatterns.matchError.mockReturnValue({
        pattern_id: 'manual_pattern',
        pattern_name: 'Manual Pattern',
        severity: 'critical',
        auto_fix: false,
        actions: [],
        cooldown_seconds: 600
      });

      const summary = await autoFixService.runAutoFix();

      expect(summary.errors_matched).toBe(0);
      expect(summary.errors_fixed).toBe(0);
    });

    it('should execute fix and increment errors_fixed on success', async () => {
      autoFixService.setDatabase(null); // db なし（履歴記録はスキップ）

      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'critical',
          status: 'firing',
          rule_name: 'HighCPU',
          message: 'CPU 95% usage',
          timestamp: new Date().toISOString(),
          metric_name: 'cpu',
          current_value: 95,
          threshold: 90
        }
      ]);
      errorPatterns.matchError.mockReturnValue({
        pattern_id: 'cpu_spike',
        pattern_name: 'CPU Spike',
        severity: 'critical',
        auto_fix: true,
        actions: ['alert_admin'],
        cooldown_seconds: 300
      });
      fixActions.executeAction.mockResolvedValue({
        success: true,
        message: 'Alert sent',
        execution_time_ms: 50
      });

      const summary = await autoFixService.runAutoFix();

      expect(summary.errors_detected).toBeGreaterThanOrEqual(1);
      expect(summary.errors_matched).toBe(1);
      expect(summary.errors_fixed).toBe(1);
    });

    it('should increment errors_failed when action fails', async () => {
      autoFixService.setDatabase(null);

      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'critical',
          status: 'firing',
          rule_name: 'Failure',
          message: 'Service down',
          timestamp: new Date().toISOString()
        }
      ]);
      errorPatterns.matchError.mockReturnValue({
        pattern_id: 'service_down',
        severity: 'critical',
        auto_fix: true,
        actions: ['service_restart'],
        cooldown_seconds: 300
      });
      fixActions.executeAction.mockResolvedValue({
        success: false,
        message: 'Restart failed',
        execution_time_ms: 100
      });

      const summary = await autoFixService.runAutoFix();

      expect(summary.errors_failed).toBe(1);
      expect(summary.errors_fixed).toBe(0);
    });

    it('should increment errors_skipped_cooldown for duplicate errors within cooldown', async () => {
      // checkActiveAlerts は message を "Alert firing: {rule_name} - {message}" 形式に変換する
      // runAutoFix が generateErrorHash に渡すのは変換後のメッセージなので、それに合わせてハッシュを生成する
      const ruleName = 'DupAlert';
      const alertMsg = 'CPU 95% usage - duplicate';
      const actualMessage = `Alert firing: ${ruleName} - ${alertMsg}`;
      const patternId = 'cpu_spike_dup';
      const hash = autoFixService.generateErrorHash(actualMessage, patternId);
      await autoFixService.recordCooldown(hash, patternId, 300);

      alertService.getActiveAlerts.mockResolvedValue([
        {
          id: 1,
          severity: 'critical',
          status: 'firing',
          rule_name: ruleName,
          message: alertMsg,
          timestamp: new Date().toISOString()
        }
      ]);
      errorPatterns.matchError.mockReturnValue({
        pattern_id: patternId,
        severity: 'critical',
        auto_fix: true,
        actions: ['alert_admin'],
        cooldown_seconds: 300
      });

      const summary = await autoFixService.runAutoFix();

      expect(summary.errors_skipped_cooldown).toBe(1);
      expect(summary.errors_fixed).toBe(0);
    });
  });

  // ============================================================
  // initProcessErrorListener
  // ============================================================

  describe('initProcessErrorListener', () => {
    it('should register process event listeners without throwing', () => {
      expect(() => autoFixService.initProcessErrorListener()).not.toThrow();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Process error listeners initialized')
      );
    });
  });
});
