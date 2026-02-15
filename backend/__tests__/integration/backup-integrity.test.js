/**
 * Backup Integrity Tests
 * バックアップファイルの解凍・整合性チェックテスト
 *
 * テスト対象:
 * - gzip 圧縮バックアップの解凍
 * - 破損ファイルの検出
 * - SQLite PRAGMA integrity_check
 * - SHA256 チェックサム検証
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// テスト用一時ディレクトリ
const TEST_DIR = path.join(__dirname, '..', '..', '__test_backup_integrity__');

/**
 * sqlite3 DB を Promise でラップして開く
 * @param {string} dbPath
 * @param {number} mode - sqlite3.OPEN_READONLY etc
 * @returns {Promise<sqlite3.Database>}
 */
// eslint-disable-next-line no-bitwise
function openDatabase(dbPath, mode = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, mode, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

/**
 * sqlite3 DB で exec を Promise でラップ
 */
function dbExec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * sqlite3 DB で all を Promise でラップ
 */
function dbAll(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * sqlite3 DB で get を Promise でラップ
 */
function dbGet(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * sqlite3 DB で close を Promise でラップ
 */
function dbClose(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * sqlite3 DB で run を Promise でラップ
 */
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

/**
 * テスト用の有効な SQLite データベースを作成
 * @param {string} dbPath - 出力先パス
 */
async function createTestDatabase(dbPath) {
  const db = await openDatabase(dbPath);
  await dbExec(
    db,
    `
    CREATE TABLE IF NOT EXISTS test_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO test_data (name, value) VALUES ('key1', 'value1');
    INSERT INTO test_data (name, value) VALUES ('key2', 'value2');
    INSERT INTO test_data (name, value) VALUES ('key3', 'value3');
  `
  );
  await dbClose(db);
}

/**
 * ファイルの SHA256 チェックサムを計算
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function calculateChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * PRAGMA integrity_check を実行して結果を返す
 * @param {string} dbPath
 * @returns {Promise<string>} integrity_check の結果
 */
async function runIntegrityCheck(dbPath) {
  const db = await openDatabase(dbPath, sqlite3.OPEN_READONLY);
  const result = await dbAll(db, 'PRAGMA integrity_check;');
  await dbClose(db);
  return result;
}

describe('Backup Integrity Tests', () => {
  beforeAll(async () => {
    await fsp.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fsp.rm(TEST_DIR, { recursive: true, force: true });
  });

  // ===== 解凍テスト =====
  describe('解凍テスト', () => {
    const dbPath = path.join(TEST_DIR, 'decompress-test.db');
    const gzPath = path.join(TEST_DIR, 'decompress-test.db.gz');
    const restoredPath = path.join(TEST_DIR, 'decompress-restored.db');

    beforeAll(async () => {
      await createTestDatabase(dbPath);
      const dbContent = await fsp.readFile(dbPath);
      const compressed = await gzip(dbContent);
      await fsp.writeFile(gzPath, compressed);
    });

    afterAll(async () => {
      for (const f of [dbPath, gzPath, restoredPath]) {
        try {
          await fsp.unlink(f);
        } catch {
          /* ignore */
        }
      }
    });

    test('正常なバックアップファイルを解凍できる', async () => {
      const compressed = await fsp.readFile(gzPath);
      const decompressed = await gunzip(compressed);

      await fsp.writeFile(restoredPath, decompressed);

      // ファイルが存在することを確認
      const exists = fs.existsSync(restoredPath);
      expect(exists).toBe(true);

      // ファイルサイズが 0 より大きいことを確認
      const stats = await fsp.stat(restoredPath);
      expect(stats.size).toBeGreaterThan(0);

      // 元のファイルと解凍後のファイルのチェックサムが一致
      const originalChecksum = await calculateChecksum(dbPath);
      const restoredChecksum = await calculateChecksum(restoredPath);
      expect(restoredChecksum).toBe(originalChecksum);
    });

    test('解凍後のファイルサイズが元のファイルと一致する', async () => {
      const compressed = await fsp.readFile(gzPath);
      const decompressed = await gunzip(compressed);

      const originalSize = (await fsp.stat(dbPath)).size;
      expect(decompressed.length).toBe(originalSize);
    });

    test('gzip 圧縮によりファイルサイズが縮小される', async () => {
      const originalSize = (await fsp.stat(dbPath)).size;
      const compressedSize = (await fsp.stat(gzPath)).size;

      expect(compressedSize).toBeLessThan(originalSize);
    });

    test('破損したバックアップファイルは解凍エラーになる', async () => {
      const corruptedPath = path.join(TEST_DIR, 'corrupted.db.gz');
      const validCompressed = await fsp.readFile(gzPath);

      // ヘッダーは保持しつつ中身を破壊
      const corrupted = Buffer.from(validCompressed);
      for (let i = 10; i < Math.min(corrupted.length, 50); i++) {
        corrupted[i] = 0xff;
      }
      await fsp.writeFile(corruptedPath, corrupted);

      const corruptedData = await fsp.readFile(corruptedPath);
      await expect(gunzip(corruptedData)).rejects.toThrow();

      await fsp.unlink(corruptedPath);
    });

    test('空のファイルは解凍エラーになる', async () => {
      const emptyPath = path.join(TEST_DIR, 'empty.db.gz');
      await fsp.writeFile(emptyPath, Buffer.alloc(0));

      const emptyData = await fsp.readFile(emptyPath);
      await expect(gunzip(emptyData)).rejects.toThrow();

      await fsp.unlink(emptyPath);
    });

    test('gzip ヘッダーのみのファイルは解凍エラーになる', async () => {
      const headerOnlyPath = path.join(TEST_DIR, 'header-only.db.gz');
      await fsp.writeFile(headerOnlyPath, Buffer.from([0x1f, 0x8b, 0x08]));

      const headerOnlyData = await fsp.readFile(headerOnlyPath);
      await expect(gunzip(headerOnlyData)).rejects.toThrow();

      await fsp.unlink(headerOnlyPath);
    });

    test('非 gzip 形式のバイナリデータは解凍エラーになる', async () => {
      const randomPath = path.join(TEST_DIR, 'random.db.gz');
      const randomData = crypto.randomBytes(1024);
      await fsp.writeFile(randomPath, randomData);

      const data = await fsp.readFile(randomPath);
      await expect(gunzip(data)).rejects.toThrow();

      await fsp.unlink(randomPath);
    });
  });

  // ===== 整合性チェック =====
  describe('整合性チェック', () => {
    const integrityDbPath = path.join(TEST_DIR, 'integrity-test.db');

    afterEach(async () => {
      try {
        await fsp.unlink(integrityDbPath);
      } catch {
        /* ignore */
      }
    });

    test('解凍後の DB ファイルに対して PRAGMA integrity_check を実行', async () => {
      await createTestDatabase(integrityDbPath);

      const dbContent = await fsp.readFile(integrityDbPath);
      const compressed = await gzip(dbContent);
      const decompressed = await gunzip(compressed);

      const restoredDbPath = path.join(TEST_DIR, 'integrity-restored.db');
      await fsp.writeFile(restoredDbPath, decompressed);

      const result = await runIntegrityCheck(restoredDbPath);

      expect(result).toHaveLength(1);
      expect(result[0].integrity_check).toBe('ok');

      await fsp.unlink(restoredDbPath);
    });

    test('正常な DB は PRAGMA integrity_check が ok を返す', async () => {
      await createTestDatabase(integrityDbPath);

      const result = await runIntegrityCheck(integrityDbPath);

      expect(result).toHaveLength(1);
      expect(result[0].integrity_check).toBe('ok');
    });

    test('破損した DB ファイルは integrity_check でエラーが検出される', async () => {
      await createTestDatabase(integrityDbPath);

      const dbContent = await fsp.readFile(integrityDbPath);
      const corrupted = Buffer.from(dbContent);

      // SQLite ヘッダーの後ろ（ページデータ領域）を破壊
      if (corrupted.length > 200) {
        for (let i = 100; i < 200; i++) {
          corrupted[i] = 0x00;
        }
      }
      await fsp.writeFile(integrityDbPath, corrupted);

      let integrityFailed = false;
      try {
        const result = await runIntegrityCheck(integrityDbPath);
        if (result.length > 0 && result[0].integrity_check !== 'ok') {
          integrityFailed = true;
        }
      } catch {
        integrityFailed = true;
      }

      expect(integrityFailed).toBe(true);
    });

    test('空ファイルにはユーザーテーブルが存在しない', async () => {
      await fsp.writeFile(integrityDbPath, Buffer.alloc(0));

      // sqlite3 は空ファイルを新規 DB として扱うため open は成功する
      // しかしユーザーデータのテーブルは存在しないことを確認
      const db = await openDatabase(integrityDbPath, sqlite3.OPEN_READONLY);
      const tables = await dbAll(db, "SELECT name FROM sqlite_master WHERE type='table';");
      await dbClose(db);

      expect(tables).toHaveLength(0);
    });

    test('ランダムバイナリデータは SQLite として正常に使えない', async () => {
      const randomData = crypto.randomBytes(4096);
      await fsp.writeFile(integrityDbPath, randomData);

      let errorOccurred = false;
      try {
        const db = await openDatabase(integrityDbPath, sqlite3.OPEN_READONLY);
        // ランダムデータの場合、テーブルクエリでエラーになる
        await dbAll(db, 'SELECT * FROM sqlite_master;');
        await dbClose(db);
      } catch {
        errorOccurred = true;
      }

      expect(errorOccurred).toBe(true);
    });
  });

  // ===== チェックサム検証 =====
  describe('チェックサム検証', () => {
    const checksumDbPath = path.join(TEST_DIR, 'checksum-test.db');

    afterEach(async () => {
      try {
        await fsp.unlink(checksumDbPath);
      } catch {
        /* ignore */
      }
    });

    test('SHA256 チェックサムが正しく計算される', async () => {
      await createTestDatabase(checksumDbPath);

      const checksum = await calculateChecksum(checksumDbPath);
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    test('同一ファイルからは同じチェックサムが得られる', async () => {
      await createTestDatabase(checksumDbPath);

      const checksum1 = await calculateChecksum(checksumDbPath);
      const checksum2 = await calculateChecksum(checksumDbPath);

      expect(checksum1).toBe(checksum2);
    });

    test('ファイル変更後はチェックサムが変わる', async () => {
      await createTestDatabase(checksumDbPath);
      const originalChecksum = await calculateChecksum(checksumDbPath);

      // DB にデータを追加して変更
      const db = await openDatabase(checksumDbPath);
      await dbRun(db, 'INSERT INTO test_data (name, value) VALUES (?, ?)', ['key4', 'value4']);
      await dbClose(db);

      const modifiedChecksum = await calculateChecksum(checksumDbPath);
      expect(modifiedChecksum).not.toBe(originalChecksum);
    });

    test('圧縮前後でチェックサムが保持される（解凍後に一致する）', async () => {
      await createTestDatabase(checksumDbPath);
      const originalChecksum = await calculateChecksum(checksumDbPath);

      const content = await fsp.readFile(checksumDbPath);
      const compressed = await gzip(content);
      const decompressed = await gunzip(compressed);

      const restoredPath = path.join(TEST_DIR, 'checksum-restored.db');
      await fsp.writeFile(restoredPath, decompressed);

      const restoredChecksum = await calculateChecksum(restoredPath);
      expect(restoredChecksum).toBe(originalChecksum);

      await fsp.unlink(restoredPath);
    });

    test('チェックサム不一致で改ざんを検出できる', async () => {
      await createTestDatabase(checksumDbPath);
      const originalChecksum = await calculateChecksum(checksumDbPath);

      const content = await fsp.readFile(checksumDbPath);
      const tampered = Buffer.from(content);
      if (tampered.length > 10) {
        // eslint-disable-next-line no-bitwise
        tampered[tampered.length - 5] ^= 0xff;
      }

      const tamperedPath = path.join(TEST_DIR, 'tampered.db');
      await fsp.writeFile(tamperedPath, tampered);

      const tamperedChecksum = await calculateChecksum(tamperedPath);
      expect(tamperedChecksum).not.toBe(originalChecksum);

      await fsp.unlink(tamperedPath);
    });
  });

  // ===== エンドツーエンド バックアップ・解凍・検証フロー =====
  describe('バックアップ・解凍・検証 統合フロー', () => {
    test('DB作成 -> 圧縮 -> チェックサム記録 -> 解凍 -> チェックサム検証 -> integrity_check', async () => {
      const flowDbPath = path.join(TEST_DIR, 'flow-test.db');
      const flowGzPath = path.join(TEST_DIR, 'flow-test.db.gz');
      const flowRestoredPath = path.join(TEST_DIR, 'flow-restored.db');

      try {
        // Step 1: テスト用 DB 作成
        await createTestDatabase(flowDbPath);

        // Step 2: チェックサム計算
        const originalChecksum = await calculateChecksum(flowDbPath);
        expect(originalChecksum).toMatch(/^[a-f0-9]{64}$/);

        // Step 3: gzip 圧縮
        const dbContent = await fsp.readFile(flowDbPath);
        const compressed = await gzip(dbContent);
        await fsp.writeFile(flowGzPath, compressed);

        // Step 4: 圧縮ファイルが存在し、元より小さいことを確認
        const compressedStats = await fsp.stat(flowGzPath);
        expect(compressedStats.size).toBeGreaterThan(0);
        expect(compressedStats.size).toBeLessThan(dbContent.length);

        // Step 5: 解凍
        const compressedData = await fsp.readFile(flowGzPath);
        const decompressed = await gunzip(compressedData);
        await fsp.writeFile(flowRestoredPath, decompressed);

        // Step 6: チェックサム検証
        const restoredChecksum = await calculateChecksum(flowRestoredPath);
        expect(restoredChecksum).toBe(originalChecksum);

        // Step 7: PRAGMA integrity_check
        const integrityResult = await runIntegrityCheck(flowRestoredPath);
        expect(integrityResult).toHaveLength(1);
        expect(integrityResult[0].integrity_check).toBe('ok');

        // Step 8: 解凍後の DB からデータが読めることを確認
        const db = await openDatabase(flowRestoredPath, sqlite3.OPEN_READONLY);
        const rows = await dbAll(db, 'SELECT * FROM test_data ORDER BY id');
        await dbClose(db);
        expect(rows).toHaveLength(3);
        expect(rows[0].name).toBe('key1');
      } finally {
        for (const f of [flowDbPath, flowGzPath, flowRestoredPath]) {
          try {
            await fsp.unlink(f);
          } catch {
            /* ignore */
          }
        }
      }
    });

    test('大きなデータベースでも圧縮・解凍・検証が正常に動作する', async () => {
      const largeDbPath = path.join(TEST_DIR, 'large-test.db');
      const largeGzPath = path.join(TEST_DIR, 'large-test.db.gz');
      const largeRestoredPath = path.join(TEST_DIR, 'large-restored.db');

      try {
        // 大きめの DB を作成（1000 行）
        const db = await openDatabase(largeDbPath);
        await dbExec(
          db,
          `
          CREATE TABLE IF NOT EXISTS large_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            data BLOB,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `
        );

        // トランザクションで一括挿入
        await dbExec(db, 'BEGIN TRANSACTION;');
        for (let i = 0; i < 1000; i++) {
          await dbRun(db, 'INSERT INTO large_data (name, description, data) VALUES (?, ?, ?)', [
            `item_${i}`,
            `Description for item ${i} with some padding text to increase size`,
            crypto.randomBytes(256)
          ]);
        }
        await dbExec(db, 'COMMIT;');
        await dbClose(db);

        // 圧縮
        const content = await fsp.readFile(largeDbPath);
        const compressed = await gzip(content);
        await fsp.writeFile(largeGzPath, compressed);

        // チェックサム
        const originalChecksum = await calculateChecksum(largeDbPath);

        // 解凍
        const compressedData = await fsp.readFile(largeGzPath);
        const decompressed = await gunzip(compressedData);
        await fsp.writeFile(largeRestoredPath, decompressed);

        // チェックサム検証
        const restoredChecksum = await calculateChecksum(largeRestoredPath);
        expect(restoredChecksum).toBe(originalChecksum);

        // integrity_check
        const integrityResult = await runIntegrityCheck(largeRestoredPath);
        expect(integrityResult).toHaveLength(1);
        expect(integrityResult[0].integrity_check).toBe('ok');

        // データ件数確認
        const db2 = await openDatabase(largeRestoredPath, sqlite3.OPEN_READONLY);
        const count = await dbGet(db2, 'SELECT COUNT(*) as cnt FROM large_data');
        await dbClose(db2);
        expect(count.cnt).toBe(1000);
      } finally {
        for (const f of [largeDbPath, largeGzPath, largeRestoredPath]) {
          try {
            await fsp.unlink(f);
          } catch {
            /* ignore */
          }
        }
      }
    });
  });
});
