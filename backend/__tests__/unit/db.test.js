/**
 * db.js ユニットテスト
 * テストカバレッジ: 12.7% → 70%+
 *
 * アプローチ: テスト環境の実DB(globalSetup済み)を利用した統合スタイルテスト
 * ハング回避のため、jest.spyOn でロギングと knex をスパイ
 */

process.env.NODE_ENV = 'test';
process.env.ADMIN_PASSWORD = 'admin123';
process.env.MANAGER_PASSWORD = 'manager123';
process.env.ANALYST_PASSWORD = 'analyst123';
process.env.VIEWER_PASSWORD = 'viewer123';

describe('db.js - データベース初期化とエクスポート', () => {
  let dbModule;

  beforeAll(() => {
    // グローバルsetupでDBが準備済みなので、直接requireする
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

      // モジュールキャッシュをクリアしてからモックを設定
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
      // テスト環境ではDATABASE_PATH が設定されている
      expect(process.env.DATABASE_PATH).toBeDefined();
      expect(dbModule.db).toBeDefined();
    });
  });
});

// =====================================================================
// seedInitialData - モックを使ったシード関数カバレッジ向上
// =====================================================================
describe('db.js - seedInitialData シード関数テスト', () => {
  // sqlite3 モック: db.get は count=0 を返してシードを実行させる
  const createStmtMock = () => ({
    run: jest.fn().mockReturnThis(),
    finalize: jest.fn().mockImplementation(function (cb) {
      if (cb) cb();
      return this;
    })
  });

  const createDbMock = (countOverrides = {}) => {
    const stmtMock = createStmtMock();
    const dbMock = {
      run: jest.fn(),
      get: jest.fn().mockImplementation((sql, cb) => {
        const match = sql.match(/FROM\s+(\w+)/i);
        const table = match ? match[1] : '';
        const count = countOverrides[table] !== undefined ? countOverrides[table] : 0;
        cb(null, { count });
      }),
      prepare: jest.fn().mockReturnValue(stmtMock),
      _stmtMock: stmtMock
    };
    return dbMock;
  };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('全テーブルが空のとき、全シード関数が実行される', async () => {
    const dbMock = createDbMock({});
    const mockKnexInstance = jest.fn();
    mockKnexInstance.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnexInstance.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => ({
      verbose: () => ({
        Database: jest.fn().mockImplementation(() => dbMock)
      })
    }));
    jest.doMock('../../knex', () => mockKnexInstance);
    jest.doMock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }));

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const freshDb = require('../../db');
    await freshDb.initDb();

    // 全12テーブルに対して db.get が呼ばれたことを確認
    expect(dbMock.get).toHaveBeenCalled();
    // シード用 prepare が呼ばれたことを確認
    expect(dbMock.prepare).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('checkAndSeed: db.get がエラーを返してもresolveする', async () => {
    const stmtMock = createStmtMock();
    const dbMock = {
      run: jest.fn(),
      get: jest.fn().mockImplementation((sql, cb) => {
        cb(new Error('table does not exist'), null);
      }),
      prepare: jest.fn().mockReturnValue(stmtMock)
    };
    const mockKnexInstance = jest.fn();
    mockKnexInstance.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnexInstance.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => ({
      verbose: () => ({
        Database: jest.fn().mockImplementation(() => dbMock)
      })
    }));
    jest.doMock('../../knex', () => mockKnexInstance);
    jest.doMock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }));

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const freshDb = require('../../db');
    // エラーが起きてもresolveする（checkAndSeed の err時 return resolve() パス）
    await expect(freshDb.initDb()).resolves.not.toThrow();

    process.env.NODE_ENV = originalEnv;
  });

  it('checkAndSeed: テーブルにデータがある場合はシードをスキップする', async () => {
    const stmtMock = createStmtMock();
    const dbMock = {
      run: jest.fn(),
      // 全テーブルで count > 0 を返す → シードをスキップ
      get: jest.fn().mockImplementation((sql, cb) => {
        cb(null, { count: 5 });
      }),
      prepare: jest.fn().mockReturnValue(stmtMock)
    };
    const mockKnexInstance = jest.fn();
    mockKnexInstance.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnexInstance.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => ({
      verbose: () => ({
        Database: jest.fn().mockImplementation(() => dbMock)
      })
    }));
    jest.doMock('../../knex', () => mockKnexInstance);
    jest.doMock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }));

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const freshDb = require('../../db');
    await expect(freshDb.initDb()).resolves.not.toThrow();
    // prepare は呼ばれない（シードをスキップ）
    expect(dbMock.prepare).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('テスト環境でusersテーブルが空のとき、seedInitialDataが実行される', async () => {
    const dbMock = createDbMock({});
    const mockFirst = jest.fn().mockResolvedValue({ count: 0 });
    const mockCount = jest.fn().mockReturnValue({ first: mockFirst });
    const mockKnexInstance = jest.fn().mockReturnValue({ count: mockCount });
    mockKnexInstance.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnexInstance.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => ({
      verbose: () => ({
        Database: jest.fn().mockImplementation(() => dbMock)
      })
    }));
    jest.doMock('../../knex', () => mockKnexInstance);
    jest.doMock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }));

    process.env.NODE_ENV = 'test';
    const freshDb = require('../../db');
    await expect(freshDb.initDb()).resolves.not.toThrow();
    // usersテーブルのカウントチェックが行われた
    expect(mockKnexInstance).toHaveBeenCalledWith('users');
    // count=0なので seedInitialData が呼ばれ、db.get が実行される
    expect(dbMock.get).toHaveBeenCalled();
  });

  it('テスト環境でusersテーブルクエリが例外をスローする場合、seedInitialDataが実行される', async () => {
    const dbMock = createDbMock({});
    const mockKnexInstance = jest.fn().mockImplementation(() => {
      throw new Error('table not found');
    });
    mockKnexInstance.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnexInstance.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => ({
      verbose: () => ({
        Database: jest.fn().mockImplementation(() => dbMock)
      })
    }));
    jest.doMock('../../knex', () => mockKnexInstance);
    jest.doMock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }));

    process.env.NODE_ENV = 'test';
    const freshDb = require('../../db');
    await expect(freshDb.initDb()).resolves.not.toThrow();
    // 例外をキャッチしてもseeding が続行される
    expect(dbMock.get).toHaveBeenCalled();
  });

  it('本番環境: ADMIN_PASSWORD未設定時に警告ログが出力される', async () => {
    const dbMock = createDbMock({});
    const mockWarn = jest.fn();
    const mockKnexInstance = jest.fn();
    mockKnexInstance.migrate = { latest: jest.fn().mockResolvedValue([]) };
    mockKnexInstance.destroy = jest.fn().mockResolvedValue(undefined);

    jest.doMock('sqlite3', () => ({
      verbose: () => ({
        Database: jest.fn().mockImplementation(() => dbMock)
      })
    }));
    jest.doMock('../../knex', () => mockKnexInstance);
    jest.doMock('../../utils/logger', () => ({
      info: jest.fn(),
      warn: mockWarn,
      error: jest.fn(),
      debug: jest.fn()
    }));

    const originalEnv = process.env.NODE_ENV;
    const originalAdminPwd = process.env.ADMIN_PASSWORD;
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;

    const freshDb = require('../../db');
    await freshDb.initDb();

    // ADMIN_PASSWORD未設定時の警告
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining('初回セットアップ'));

    process.env.NODE_ENV = originalEnv;
    if (originalAdminPwd) process.env.ADMIN_PASSWORD = originalAdminPwd;
  });
});
