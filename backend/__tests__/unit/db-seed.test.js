/**
 * db.js seedInitialData() テスト
 * テストカバレッジ: db.js 37% -> 70%+ を目標
 *
 * アプローチ: jest.resetModules + jest.doMock でモジュールを完全モック化し
 * seedInitialData の各シード関数パスをカバーする
 */

process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.MANAGER_PASSWORD = 'manager123';
process.env.ANALYST_PASSWORD = 'analyst123';
process.env.VIEWER_PASSWORD = 'viewer123';
process.env.OPERATOR_PASSWORD = 'operator123';
process.env.DATABASE_PATH = './backend/test_itsm.db';

/**
 * sqlite3 Database のモックを構築するヘルパー
 */
function createMockSqlite3(overrides = {}) {
  const mockStmt = {
    run: jest.fn(),
    finalize: jest.fn((cb) => {
      if (cb) cb();
    })
  };

  const mockDbInstance = {
    run: jest.fn(),
    get: jest.fn((sql, cb) => {
      if (overrides.getHandler) return overrides.getHandler(sql, cb);
      cb(null, { count: 0 });
    }),
    prepare: jest.fn(() => mockStmt),
    all: jest.fn(),
    close: jest.fn()
  };

  const DatabaseConstructor = jest.fn(() => mockDbInstance);

  const mockSqlite3 = {
    verbose: jest.fn(() => ({
      Database: DatabaseConstructor
    }))
  };

  return { mockSqlite3, mockDbInstance, mockStmt, DatabaseConstructor };
}

function createMockDeps(mockSqlite3) {
  jest.doMock('sqlite3', () => mockSqlite3);
  jest.doMock('../../knex', () => {
    const instance = jest.fn();
    instance.migrate = { latest: jest.fn().mockResolvedValue([]) };
    instance.destroy = jest.fn().mockResolvedValue(undefined);
    return instance;
  });
  jest.doMock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }));
}

describe('db.js - seedInitialData() 完全モックテスト', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  describe('全テーブル空の場合 - 全シード関数実行', () => {
    it('全12テーブルのシードが実行される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockDbInstance, mockStmt } = createMockSqlite3();
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockDbInstance.get).toHaveBeenCalled();
      expect(mockDbInstance.prepare).toHaveBeenCalled();
      expect(mockStmt.finalize).toHaveBeenCalled();
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('seedCompliance: 6件のコンプライアンスデータが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('compliance')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const complianceRuns = mockStmt.run.mock.calls.filter((call) => {
        const firstArg = Array.isArray(call[0]) ? call[0][0] : call[0];
        return ['GOVERN', 'IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'].includes(firstArg);
      });
      expect(complianceRuns.length).toBe(6);
    });

    it('seedAssets: 6件のアセットデータが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('assets')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const assetRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].match(/^(SRV|NET|CLD|PC)-/)
      );
      expect(assetRuns.length).toBe(6);
    });

    it('seedChanges: 2件の変更データが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('changes')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const changeRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('RFC-')
      );
      expect(changeRuns.length).toBe(2);
    });

    it('seedIncidents: 3件のインシデントデータが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('incidents')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const incidentRuns = mockStmt.run.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' && (call[0].startsWith('INC-') || call[0].startsWith('SEC-'))
      );
      expect(incidentRuns.length).toBe(3);
    });

    it('seedUsers: 5件のユーザーデータが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('users')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const userRuns = mockStmt.run.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          ['admin', 'manager', 'analyst', 'operator', 'viewer'].includes(call[0])
      );
      expect(userRuns.length).toBe(5);
    });

    it('seedProblems: 4件の問題データが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('problems')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const problemRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('PRB-')
      );
      expect(problemRuns.length).toBe(4);
    });

    it('seedReleases: 3件のリリースデータが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('releases')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const releaseRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('REL-')
      );
      expect(releaseRuns.length).toBe(3);
    });

    it('seedServiceRequests: 3件のサービスリクエストデータが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('service_requests')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const srRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('SR-')
      );
      expect(srRuns.length).toBe(3);
    });

    it('seedSla: 4件のSLAデータが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('sla_agreements')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const slaRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('SLA-')
      );
      expect(slaRuns.length).toBe(4);
    });

    it('seedKnowledge: 5件のナレッジ記事が挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('knowledge_articles')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const kbRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('KB-')
      );
      expect(kbRuns.length).toBe(5);
    });

    it('seedCapacity: 5件のキャパシティメトリクスが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('capacity_metrics')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const capRuns = mockStmt.run.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].startsWith('CAP-')
      );
      expect(capRuns.length).toBe(5);
    });

    it('seedVulnerabilities: 4件の脆弱性データが挿入される', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('vulnerabilities')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      const vulnRuns = mockStmt.run.mock.calls.filter(
        (call) =>
          typeof call[0] === 'string' && (call[0].startsWith('CVE-') || call[0].startsWith('VULN-'))
      );
      expect(vulnRuns.length).toBe(4);
    });
  });

  describe('全テーブル非空の場合 - シードスキップ', () => {
    it('データが存在する場合はシードをスキップする', async () => {
      jest.resetModules();
      const { mockSqlite3, mockStmt } = createMockSqlite3({
        getHandler: (sql, cb) => {
          cb(null, { count: 5 });
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockStmt.run).not.toHaveBeenCalled();
    });
  });

  describe('checkAndSeed エラーハンドリング', () => {
    it('db.get でエラーが発生した場合は resolve で処理される', async () => {
      jest.resetModules();
      const { mockSqlite3 } = createMockSqlite3({
        getHandler: (sql, cb) => {
          cb(new Error('no such table: compliance'));
        }
      });
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await expect(freshDb.initDb()).resolves.not.toThrow();
    });
  });

  describe('DISABLE_SEED_DATA 環境変数', () => {
    it('DISABLE_SEED_DATA=true の場合、seedInitialData が早期リターンする', async () => {
      jest.resetModules();
      const originalDisable = process.env.DISABLE_SEED_DATA;
      process.env.DISABLE_SEED_DATA = 'true';

      const { mockSqlite3, mockDbInstance } = createMockSqlite3();
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockDbInstance.get).not.toHaveBeenCalled();

      if (originalDisable === undefined) {
        delete process.env.DISABLE_SEED_DATA;
      } else {
        process.env.DISABLE_SEED_DATA = originalDisable;
      }
    });
  });

  describe('seedUsers パスワードログ出力', () => {
    it('非テスト環境でADMIN_PASSWORD未設定時に警告ログが出力される', async () => {
      jest.resetModules();
      const originalEnv = process.env.NODE_ENV;
      const originalAdminPw = process.env.ADMIN_PASSWORD;
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_PASSWORD;

      const { mockSqlite3 } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('users')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });

      const mockWarn = jest.fn();
      jest.doMock('sqlite3', () => mockSqlite3);
      jest.doMock('../../knex', () => {
        const instance = jest.fn();
        instance.migrate = { latest: jest.fn().mockResolvedValue([]) };
        instance.destroy = jest.fn().mockResolvedValue(undefined);
        return instance;
      });
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: mockWarn,
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD'));

      process.env.NODE_ENV = originalEnv;
      if (originalAdminPw === undefined) {
        delete process.env.ADMIN_PASSWORD;
      } else {
        process.env.ADMIN_PASSWORD = originalAdminPw;
      }
    });

    it('ADMIN_PASSWORD設定時はパスワード警告が出力されない', async () => {
      jest.resetModules();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_PASSWORD = 'test-admin-password';

      const { mockSqlite3 } = createMockSqlite3({
        getHandler: (sql, cb) => {
          if (sql.includes('users')) {
            cb(null, { count: 0 });
          } else {
            cb(null, { count: 1 });
          }
        }
      });

      const mockWarn = jest.fn();
      jest.doMock('sqlite3', () => mockSqlite3);
      jest.doMock('../../knex', () => {
        const instance = jest.fn();
        instance.migrate = { latest: jest.fn().mockResolvedValue([]) };
        instance.destroy = jest.fn().mockResolvedValue(undefined);
        return instance;
      });
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: mockWarn,
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await freshDb.initDb();

      const adminWarnCalls = mockWarn.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('ADMIN_PASSWORD')
      );
      expect(adminWarnCalls.length).toBe(0);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('テスト環境の knex users チェック', () => {
    it('テスト環境で users テーブルにデータがある場合は早期リターン', async () => {
      jest.resetModules();
      process.env.NODE_ENV = 'test';

      const { mockSqlite3, mockDbInstance } = createMockSqlite3();

      jest.doMock('sqlite3', () => mockSqlite3);

      const mockKnex = jest.fn();
      mockKnex.migrate = { latest: jest.fn().mockResolvedValue([]) };
      mockKnex.destroy = jest.fn().mockResolvedValue(undefined);
      const mockFirst = jest.fn().mockResolvedValue({ count: 5 });
      const mockCount = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ count: mockCount });

      jest.doMock('../../knex', () => mockKnex);
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockKnex).toHaveBeenCalledWith('users');
      expect(mockDbInstance.get).not.toHaveBeenCalled();
    });

    it('テスト環境で knex がエラーを返した場合はシードを続行', async () => {
      jest.resetModules();
      process.env.NODE_ENV = 'test';

      const { mockSqlite3, mockDbInstance } = createMockSqlite3();

      jest.doMock('sqlite3', () => mockSqlite3);

      const mockKnex = jest.fn();
      mockKnex.migrate = { latest: jest.fn().mockResolvedValue([]) };
      mockKnex.destroy = jest.fn().mockResolvedValue(undefined);
      const mockFirst = jest.fn().mockRejectedValue(new Error('no such table: users'));
      const mockCount = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ count: mockCount });

      jest.doMock('../../knex', () => mockKnex);
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockDbInstance.get).toHaveBeenCalled();
    });

    it('テスト環境で users count が 0 の場合はシードを実行', async () => {
      jest.resetModules();
      process.env.NODE_ENV = 'test';

      const { mockSqlite3, mockDbInstance } = createMockSqlite3();

      jest.doMock('sqlite3', () => mockSqlite3);

      const mockKnex = jest.fn();
      mockKnex.migrate = { latest: jest.fn().mockResolvedValue([]) };
      mockKnex.destroy = jest.fn().mockResolvedValue(undefined);
      const mockFirst = jest.fn().mockResolvedValue({ count: 0 });
      const mockCount = jest.fn().mockReturnValue({ first: mockFirst });
      mockKnex.mockReturnValue({ count: mockCount });

      jest.doMock('../../knex', () => mockKnex);
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockDbInstance.get).toHaveBeenCalled();
    });
  });

  describe('DATABASE_PATH と busyTimeout', () => {
    it('DATABASE_PATH 未設定時はデフォルトパスを使用', async () => {
      jest.resetModules();
      const originalPath = process.env.DATABASE_PATH;
      delete process.env.DATABASE_PATH;

      const { mockSqlite3, DatabaseConstructor } = createMockSqlite3();
      createMockDeps(mockSqlite3);

      const freshDb = require('../../db');

      expect(DatabaseConstructor).toHaveBeenCalled();
      const calledPath = DatabaseConstructor.mock.calls[0][0];
      expect(calledPath).toContain('itsm_nexus.db');
      expect(freshDb.db).toBeDefined();

      if (originalPath === undefined) {
        delete process.env.DATABASE_PATH;
      } else {
        process.env.DATABASE_PATH = originalPath;
      }
    });

    it('テスト環境では busyTimeout が 30000ms に設定される', async () => {
      jest.resetModules();
      process.env.NODE_ENV = 'test';

      const { mockSqlite3, mockDbInstance } = createMockSqlite3();
      createMockDeps(mockSqlite3);

      require('../../db');

      expect(mockDbInstance.run).toHaveBeenCalledWith('PRAGMA busy_timeout = 30000;');
    });

    it('本番環境では busyTimeout が 5000ms に設定される', async () => {
      jest.resetModules();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { mockSqlite3, mockDbInstance } = createMockSqlite3();
      createMockDeps(mockSqlite3);

      require('../../db');

      expect(mockDbInstance.run).toHaveBeenCalledWith('PRAGMA busy_timeout = 5000;');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('initDb() 本番環境', () => {
    it('本番環境で migrate.latest が呼ばれ、完了ログが出力される', async () => {
      jest.resetModules();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { mockSqlite3 } = createMockSqlite3({
        getHandler: (sql, cb) => {
          cb(null, { count: 5 });
        }
      });

      const mockMigrateLatest = jest.fn().mockResolvedValue([]);
      const mockInfo = jest.fn();

      jest.doMock('sqlite3', () => mockSqlite3);
      jest.doMock('../../knex', () => {
        const instance = jest.fn();
        instance.migrate = { latest: mockMigrateLatest };
        instance.destroy = jest.fn().mockResolvedValue(undefined);
        return instance;
      });
      jest.doMock('../../utils/logger', () => ({
        info: mockInfo,
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await freshDb.initDb();

      expect(mockMigrateLatest).toHaveBeenCalled();
      expect(mockInfo).toHaveBeenCalledWith('[DB] Migrations applied successfully');
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('[DB] Initializing database'));
      expect(mockInfo).toHaveBeenCalledWith('[DB] Initialization complete');

      process.env.NODE_ENV = originalEnv;
    });

    it('already exists エラーは警告ログで処理される', async () => {
      jest.resetModules();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { mockSqlite3 } = createMockSqlite3();
      const mockMigrateLatest = jest
        .fn()
        .mockRejectedValue(new Error('table users already exists'));
      const mockWarn = jest.fn();

      jest.doMock('sqlite3', () => mockSqlite3);
      jest.doMock('../../knex', () => {
        const instance = jest.fn();
        instance.migrate = { latest: mockMigrateLatest };
        instance.destroy = jest.fn().mockResolvedValue(undefined);
        return instance;
      });
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: mockWarn,
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await expect(freshDb.initDb()).resolves.not.toThrow();
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('[DB] Warning: Some tables already exist')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('その他のDBエラーは再スローされる', async () => {
      jest.resetModules();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { mockSqlite3 } = createMockSqlite3();
      const mockMigrateLatest = jest.fn().mockRejectedValue(new Error('disk I/O error'));
      const mockError = jest.fn();

      jest.doMock('sqlite3', () => mockSqlite3);
      jest.doMock('../../knex', () => {
        const instance = jest.fn();
        instance.migrate = { latest: mockMigrateLatest };
        instance.destroy = jest.fn().mockResolvedValue(undefined);
        return instance;
      });
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: mockError,
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await expect(freshDb.initDb()).rejects.toThrow('disk I/O error');
      expect(mockError).toHaveBeenCalledWith('[DB] Initialization error:', expect.any(Error));

      process.env.NODE_ENV = originalEnv;
    });
  });
});
