/**
 * db.js ユニットテスト
 * テストカバレッジ: 12.7% -> 70%+
 *
 * アプローチ:
 * 1. 実DB経由のエクスポート確認（既存テスト維持）
 * 2. jest.resetModules + jest.doMock でsqlite3/knexを完全モックし、
 *    seedInitialData() の全シード関数パスをカバー
 */

process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.MANAGER_PASSWORD = 'manager123';
process.env.ANALYST_PASSWORD = 'analyst123';
process.env.VIEWER_PASSWORD = 'viewer123';

describe('db.js - データベース初期化とエクスポート', () => {
  let dbModule;

  beforeAll(() => {
    dbModule = require('../../db');
  });

  // =====================================================================
  // エクスポート確認
  // =====================================================================
  describe('モジュールエクスポート', () => {
    it('db オブジェクトがエクスポートされる', () => {
      expect(dbModule.db).toBeDefined();
    });

    it('initDb 関数がエクスポートされる', () => {
      expect(typeof dbModule.initDb).toBe('function');
    });

    it('db が sqlite3.Database インスタンスである', () => {
      const sqlite3 = require('sqlite3').verbose();
      expect(dbModule.db).toBeInstanceOf(sqlite3.Database);
    });

    it('db.run メソッドが存在する', () => {
      expect(typeof dbModule.db.run).toBe('function');
    });

    it('db.get メソッドが存在する', () => {
      expect(typeof dbModule.db.get).toBe('function');
    });

    it('db.prepare メソッドが存在する', () => {
      expect(typeof dbModule.db.prepare).toBe('function');
    });
  });

  // =====================================================================
  // initDb() - テスト環境
  // =====================================================================
  describe('initDb() - テスト環境', () => {
    it('テスト環境でエラーなく完了する', async () => {
      await expect(dbModule.initDb()).resolves.not.toThrow();
    });

    it('複数回呼び出しても安全に動作する', async () => {
      await expect(dbModule.initDb()).resolves.not.toThrow();
      await expect(dbModule.initDb()).resolves.not.toThrow();
    });

    it('initDb() がPromiseを返す', () => {
      const result = dbModule.initDb();
      expect(result).toBeInstanceOf(Promise);
      return result;
    });
  });

  // =====================================================================
  // initDb() - エラーハンドリング (jest.resetModules + jest.doMock)
  // =====================================================================
  describe('initDb() - エラーハンドリング', () => {
    afterEach(() => {
      jest.resetModules();
    });

    it('テーブル既存エラー (already exists) を警告のみで処理する', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      jest.resetModules();
      const mockMigrateLatest = jest
        .fn()
        .mockRejectedValue(new Error('table users already exists'));
      const mockWarn = jest.fn();
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

    it('その他のDBエラーは例外をスローする', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      jest.resetModules();
      const mockMigrateLatest = jest.fn().mockRejectedValue(new Error('database is locked'));
      const mockError = jest.fn();
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
      await expect(freshDb.initDb()).rejects.toThrow('database is locked');
      expect(mockError).toHaveBeenCalledWith('[DB] Initialization error:', expect.any(Error));

      process.env.NODE_ENV = originalEnv;
    });
  });

  // =====================================================================
  // DISABLE_SEED_DATA 環境変数
  // =====================================================================
  describe('DISABLE_SEED_DATA 環境変数', () => {
    afterEach(() => {
      jest.resetModules();
    });

    it('DISABLE_SEED_DATA=true の場合、シードデータをスキップする', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.DISABLE_SEED_DATA = 'true';

      jest.resetModules();
      const mockMigrateLatest = jest.fn().mockResolvedValue([]);
      jest.doMock('../../knex', () => {
        const instance = jest.fn();
        instance.migrate = { latest: mockMigrateLatest };
        instance.destroy = jest.fn().mockResolvedValue(undefined);
        return instance;
      });
      jest.doMock('../../utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }));

      const freshDb = require('../../db');
      await expect(freshDb.initDb()).resolves.not.toThrow();
      expect(mockMigrateLatest).toHaveBeenCalled();

      delete process.env.DISABLE_SEED_DATA;
      process.env.NODE_ENV = originalEnv;
    });
  });

  // =====================================================================
  // 本番環境でのマイグレーション成功
  // =====================================================================
  describe('initDb() - 本番環境マイグレーション成功', () => {
    afterEach(() => {
      jest.resetModules();
    });

    it('本番環境でマイグレーション成功時にinfoログを出力する', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      jest.resetModules();
      const mockMigrateLatest = jest.fn().mockResolvedValue([]);
      const mockInfo = jest.fn();
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
      await expect(freshDb.initDb()).resolves.not.toThrow();
      expect(mockMigrateLatest).toHaveBeenCalled();
      expect(mockInfo).toHaveBeenCalledWith(
        expect.stringContaining('[DB] Migrations applied successfully')
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  // =====================================================================
  // DATABASE_PATH 環境変数の確認
  // =====================================================================
  describe('DATABASE_PATH 環境変数', () => {
    it('db インスタンスが正常に存在する (DATABASE_PATH設定確認)', () => {
      expect(process.env.DATABASE_PATH).toBeDefined();
      expect(dbModule.db).toBeDefined();
    });
  });
});

// =====================================================================
// seedInitialData() の全シード関数カバレッジ（完全モック版）
// =====================================================================
describe('db.js - seedInitialData() 完全モックテスト', () => {
  /**
   * sqlite3 の Database インスタンスをモックし、
   * db.get / db.prepare / stmt.run / stmt.finalize の
   * コールバック呼び出しをシミュレートする。
   *
   * count=0 を返すことで全シード関数を実行させる。
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
        // count=0 を返してシードを実行させる
        if (overrides.getHandler) {
          return overrides.getHandler(sql, cb);
        }
        cb(null, { count: 0 });
      }),
      prepare: jest.fn(() => mockStmt),
      all: jest.fn(),
      close: jest.fn()
    };

    // sqlite3 モジュール全体のモック
    const mockSqlite3 = {
      verbose: jest.fn(() => ({
        Database: jest.fn(() => mockDbInstance)
      }))
    };

    return { mockSqlite3, mockDbInstance, mockStmt };
  }

  function createMockKnex(overrides = {}) {
    const instance = jest.fn();
    instance.migrate = {
      latest: overrides.migrateLatest || jest.fn().mockResolvedValue([])
    };
    instance.destroy = jest.fn().mockResolvedValue(undefined);
    return instance;
  }

  function createMockLogger() {
    return {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };
  }

  afterEach(() => {
    jest.resetModules();
    delete process.env.DISABLE_SEED_DATA;
  });

  it('本番環境でテーブルが空の場合、全シード関数が実行される', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    const { mockSqlite3, mockDbInstance, mockStmt } = createMockSqlite3();
    const mockKnex = createMockKnex();
    const mockLogger = createMockLogger();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => mockLogger);

    const freshDb = require('../../db');
    await freshDb.initDb();

    // 12テーブル分のシードが呼ばれるため、db.get が12回呼ばれる
    expect(mockDbInstance.get).toHaveBeenCalledTimes(12);
    // 12テーブル分の prepare が呼ばれる
    expect(mockDbInstance.prepare).toHaveBeenCalledTimes(12);
    // stmt.finalize が12回呼ばれる
    expect(mockStmt.finalize).toHaveBeenCalledTimes(12);
    // stmt.run が多数回呼ばれる（各シードデータ行分）
    expect(mockStmt.run.mock.calls.length).toBeGreaterThan(20);

    // ログ確認
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[DB] Initialization complete')
    );

    process.env.NODE_ENV = originalEnv;
  });

  it('テーブルにデータがある場合、シードをスキップする', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    const { mockSqlite3, mockDbInstance, mockStmt } = createMockSqlite3({
      getHandler: (_sql, cb) => {
        // count > 0 を返してシードスキップ
        cb(null, { count: 5 });
      }
    });
    const mockKnex = createMockKnex();
    const mockLogger = createMockLogger();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => mockLogger);

    const freshDb = require('../../db');
    await freshDb.initDb();

    // db.get は呼ばれるが prepare は呼ばれない（スキップ）
    expect(mockDbInstance.get).toHaveBeenCalled();
    expect(mockDbInstance.prepare).not.toHaveBeenCalled();
    expect(mockStmt.run).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('checkAndSeed の db.get でエラーが発生した場合、resolveする', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    const { mockSqlite3, mockDbInstance } = createMockSqlite3({
      getHandler: (_sql, cb) => {
        // テーブルが存在しない場合のエラー
        cb(new Error('no such table: compliance'));
      }
    });
    const mockKnex = createMockKnex();
    const mockLogger = createMockLogger();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => mockLogger);

    const freshDb = require('../../db');
    // エラーでもresolveするはず（テーブル不在を無視）
    await expect(freshDb.initDb()).resolves.not.toThrow();
    expect(mockDbInstance.get).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('seedUsers で ADMIN_PASSWORD 未設定時にログ警告が出力される', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAdmin = process.env.ADMIN_PASSWORD;
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;

    jest.resetModules();

    // usersテーブルのみ count=0 を返す
    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];
    const { mockSqlite3, mockDbInstance } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'users') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 }); // 他テーブルはスキップ
        }
      }
    });
    const mockKnex = createMockKnex();
    const mockLogger = createMockLogger();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => mockLogger);

    const freshDb = require('../../db');
    await freshDb.initDb();

    // ADMIN_PASSWORD未設定時のログ警告
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('初回セットアップ'));
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('環境変数で明示的に設定してください')
    );

    process.env.ADMIN_PASSWORD = originalAdmin;
    process.env.NODE_ENV = originalEnv;
  });

  it('seedUsers で環境変数設定時はログ警告なし', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_PASSWORD = 'secure123';
    process.env.OPERATOR_PASSWORD = 'op123';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];
    const { mockSqlite3 } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'users') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();
    const mockLogger = createMockLogger();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => mockLogger);

    const freshDb = require('../../db');
    await freshDb.initDb();

    // ADMIN_PASSWORD設定時は初回セットアップ警告なし
    const warnCalls = mockLogger.warn.mock.calls.map((c) => c[0]);
    const setupWarnings = warnCalls.filter(
      (msg) => typeof msg === 'string' && msg.includes('初回セットアップ')
    );
    expect(setupWarnings).toHaveLength(0);

    process.env.NODE_ENV = originalEnv;
  });

  it('テスト環境でknex usersテーブル確認でエラーが発生した場合、シードが続行される', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';

    const { mockSqlite3 } = createMockSqlite3();

    // knex('users').count().first() がエラーをスローするモック
    const mockKnex = jest.fn(() => ({
      count: jest.fn().mockReturnValue({
        first: jest.fn().mockRejectedValue(new Error('no such table: users'))
      })
    }));
    mockKnex.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnex.destroy = jest.fn().mockResolvedValue(undefined);

    const mockLogger = createMockLogger();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => mockLogger);

    const freshDb = require('../../db');
    // エラーでもseedInitialData()に進むはず
    await expect(freshDb.initDb()).resolves.not.toThrow();

    process.env.NODE_ENV = 'test';
  });

  it('テスト環境でknex usersテーブルにデータがある場合、早期リターンする', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';

    const { mockSqlite3, mockDbInstance } = createMockSqlite3();

    // knex('users').count().first() がデータありを返す
    const mockKnex = jest.fn(() => ({
      count: jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue({ count: 5 })
      })
    }));
    mockKnex.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnex.destroy = jest.fn().mockResolvedValue(undefined);

    const mockLogger = createMockLogger();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => mockLogger);

    const freshDb = require('../../db');
    await freshDb.initDb();

    // 早期リターンのため db.get (seedInitialData内) は呼ばれない
    expect(mockDbInstance.get).not.toHaveBeenCalled();
  });

  it('DATABASE_PATH 未設定時はデフォルトパスが使用される', async () => {
    const originalPath = process.env.DATABASE_PATH;
    delete process.env.DATABASE_PATH;
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    jest.resetModules();

    const { mockSqlite3 } = createMockSqlite3();

    const mockKnex = jest.fn(() => ({
      count: jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue({ count: 5 })
      })
    }));
    mockKnex.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnex.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    // DATABASE_PATHが未設定でもデフォルトで動作する
    const freshDb = require('../../db');
    expect(freshDb.db).toBeDefined();
    expect(freshDb.initDb).toBeDefined();

    process.env.DATABASE_PATH = originalPath;
    process.env.NODE_ENV = originalEnv;
  });

  it('busyTimeout がテスト環境では 30000ms になる', async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';

    const { mockSqlite3, mockDbInstance } = createMockSqlite3();

    const mockKnex = jest.fn(() => ({
      count: jest.fn().mockReturnValue({
        first: jest.fn().mockResolvedValue({ count: 5 })
      })
    }));
    mockKnex.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnex.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    require('../../db');

    // db.run が PRAGMA busy_timeout = 30000 で呼ばれたか確認
    expect(mockDbInstance.run).toHaveBeenCalledWith('PRAGMA busy_timeout = 30000;');
  });

  it('非テスト環境の busyTimeout は 5000ms になる', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    const { mockSqlite3, mockDbInstance } = createMockSqlite3();
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    require('../../db');

    expect(mockDbInstance.run).toHaveBeenCalledWith('PRAGMA busy_timeout = 5000;');

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedCompliance が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'compliance') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // compliance シードは6つのCSF関数を挿入
    // stmt.run の呼び出しの中に GOVERN, IDENTIFY 等が含まれるか確認
    const runCalls = mockStmt.run.mock.calls;
    const governCall = runCalls.find((call) => call[0] && call[0][0] === 'GOVERN');
    expect(governCall).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedAssets が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'assets') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // assets は6行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(6);
    // SRV-001 が含まれるか
    const srv001Call = mockStmt.run.mock.calls.find((c) => c[0] === 'SRV-001');
    expect(srv001Call).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedIncidents が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'incidents') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // incidents は3行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(3);
    const incCall = mockStmt.run.mock.calls.find((c) => c[0] === 'INC-2025-001');
    expect(incCall).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedProblems が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'problems') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // problems は4行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(4);

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedReleases が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'releases') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // releases は3行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(3);

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedServiceRequests が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'service_requests') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // service_requests は3行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(3);

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedSla が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'sla_agreements') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // sla_agreements は4行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(4);

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedKnowledge が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'knowledge_articles') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // knowledge_articles は5行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(5);

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedCapacity が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'capacity_metrics') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // capacity_metrics は5行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(5);

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedVulnerabilities が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'vulnerabilities') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // vulnerabilities は4行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(4);

    process.env.NODE_ENV = originalEnv;
  });

  it('個別シード関数 - seedChanges が正しいデータを挿入する', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    jest.resetModules();

    let callIndex = 0;
    const tableOrder = [
      'compliance',
      'assets',
      'changes',
      'incidents',
      'users',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'vulnerabilities'
    ];

    const { mockSqlite3, mockStmt } = createMockSqlite3({
      getHandler: (sql, cb) => {
        const idx = callIndex++;
        if (idx < tableOrder.length && tableOrder[idx] === 'changes') {
          cb(null, { count: 0 });
        } else {
          cb(null, { count: 5 });
        }
      }
    });
    const mockKnex = createMockKnex();

    jest.doMock('sqlite3', () => mockSqlite3);
    jest.doMock('../../knex', () => mockKnex);
    jest.doMock('../../utils/logger', () => createMockLogger());

    const freshDb = require('../../db');
    await freshDb.initDb();

    // changes は2行挿入
    expect(mockStmt.run).toHaveBeenCalledTimes(2);

    process.env.NODE_ENV = originalEnv;
  });
});
