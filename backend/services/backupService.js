/**
 * Backup Service
 * バックアップ・リストア機能のビジネスロジック
 * ISO 20000 & NIST CSF 2.0 準拠
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { sendBackupFailureAlert } = require('./emailService');

// データベース接続は外部から注入
let db = null;

/**
 * データベース接続を設定
 * @param {Object} database - Knexデータベース接続
 */
function setDatabase(database) {
  db = database;
}

/**
 * ユニークなバックアップIDを生成
 * @param {string} type - バックアップ種別
 * @returns {string} バックアップID（例: BKP-20260131-143025-daily）
 */
function generateBackupId(type) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  return `BKP-${timestamp}-${type}`;
}

/**
 * ユニークなチェックIDを生成
 * @param {number} sequence - シーケンス番号
 * @returns {string} チェックID（例: CHK-20260131-143025-001）
 */
function generateCheckId(sequence) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const seq = String(sequence).padStart(3, '0');
  return `CHK-${timestamp}-${seq}`;
}

/**
 * ファイルが存在するかチェック
 * @param {string} filePath - ファイルパス
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * backup.sh スクリプトを実行
 * @param {string} scriptPath - スクリプトパス
 * @param {string} type - バックアップ種別
 * @returns {Promise<Object>} { output, exitCode, duration }
 */
function runBackupScript(scriptPath, type) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    let output = '';
    let errorOutput = '';

    const child = spawn('bash', [scriptPath, type]);

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      const duration = (Date.now() - startTime) / 1000; // 秒単位

      if (code === 0) {
        resolve({
          output,
          exitCode: code,
          duration
        });
      } else {
        reject(new Error(`Backup script failed with exit code ${code}: ${errorOutput || output}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to execute backup script: ${error.message}`));
    });
  });
}

/**
 * バックアップを作成
 * @param {string} type - バックアップ種別 (daily/weekly/monthly/manual)
 * @param {number|null} userId - 実行ユーザーID（NULL=system）
 * @param {string} description - バックアップ説明
 * @returns {Promise<Object>} { backupId, status, filePath, fileSize }
 */
async function createBackup(type, userId = null, description = '') {
  if (!db) throw new Error('Database not initialized');
  if (!['daily', 'weekly', 'monthly', 'manual'].includes(type)) {
    throw new Error(`Invalid backup type: ${type}`);
  }

  const backupId = generateBackupId(type);
  const startedAt = new Date().toISOString();

  // backup_logs レコード作成（status: in_progress）
  const logId = await db('backup_logs').insert({
    backup_id: backupId,
    backup_type: type,
    status: 'in_progress',
    description: description || null,
    created_by: userId,
    started_at: startedAt,
    created_at: startedAt
  });

  try {
    // backup.sh スクリプトのパスを取得
    const scriptPath = path.resolve(__dirname, '../../scripts/Linux/operations/backup.sh');

    // ディスク容量チェック（簡易版）
    const dbPath = path.resolve(__dirname, '../itsm_nexus.db');
    const dbStats = await fs.stat(dbPath);
    // requiredSpaceは将来の拡張用に計算のみ（現時点では未使用）
    // const requiredSpace = dbStats.size * 2; // 圧縮を考慮して2倍確保

    // backup.sh 実行
    const result = await runBackupScript(scriptPath, type);

    // 完了時刻
    const completedAt = new Date().toISOString();

    // ファイルパス解析（backup.shの出力から取得）
    const filePath = result.output.trim();
    let fileSize = 0;
    let checksum = null;

    // ファイルサイズ取得
    const dbFilePath = `${filePath}.db`;
    if (filePath && (await fileExists(dbFilePath))) {
      const stats = await fs.stat(dbFilePath);
      fileSize = stats.size;

      // チェックサム取得（.sha256ファイルから）
      const checksumFile = `${filePath}.sha256`;
      if (await fileExists(checksumFile)) {
        const checksumContent = await fs.readFile(checksumFile, 'utf8');
        checksum = `sha256:${checksumContent.split(' ')[0]}`;
      }
    }

    // メタデータ作成
    const metadata = JSON.stringify({
      duration_seconds: result.duration,
      exit_code: result.exitCode,
      original_size: dbStats.size,
      compressed_size: fileSize,
      compression_ratio: fileSize > 0 ? (fileSize / dbStats.size).toFixed(3) : 0
    });

    // backup_logs 更新（status: success）
    const finalFilePath = filePath ? `${filePath}.db` : null;
    await db('backup_logs').where({ id: logId[0] }).update({
      status: 'success',
      file_path: finalFilePath,
      file_size: fileSize,
      checksum,
      metadata,
      completed_at: completedAt
    });

    return {
      backupId,
      status: 'success',
      filePath: finalFilePath,
      fileSize,
      duration: result.duration
    };
  } catch (error) {
    // エラー発生時: backup_logs 更新（status: failure）
    await db('backup_logs').where({ id: logId[0] }).update({
      status: 'failure',
      error_message: error.message,
      completed_at: new Date().toISOString()
    });

    // バックアップ失敗メール通知
    const alertEmail = process.env.BACKUP_ALERT_EMAIL;
    if (alertEmail) {
      try {
        await sendBackupFailureAlert(alertEmail, {
          backupId,
          type,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        logger.info(`[Backup] Failure alert email sent to ${alertEmail}`);
      } catch (emailError) {
        // メール送信失敗はバックアップ処理を妨げない
        logger.error(`[Backup] Failed to send failure alert email: ${emailError.message}`);
      }
    }

    throw error;
  }
}

/**
 * バックアップ一覧を取得
 * @param {Object} options - { type, status, limit, offset, sort, order }
 * @returns {Promise<Object>} { total, backups: [...] }
 */
async function listBackups(options = {}) {
  if (!db) throw new Error('Database not initialized');

  const { type, status, limit = 50, offset = 0, sort = 'created_at', order = 'desc' } = options;

  let query = db('backup_logs')
    .leftJoin('users', 'backup_logs.created_by', 'users.id')
    .select('backup_logs.*', 'users.username as created_by_username');

  // フィルタリング
  if (type) {
    query = query.where('backup_logs.backup_type', type);
  }
  if (status) {
    query = query.where('backup_logs.status', status);
  }

  // deleted は除外
  query = query.whereNot('backup_logs.status', 'deleted');

  // 総件数取得
  const countQuery = query.clone();
  const [{ count }] = await countQuery.count('* as count');

  // ソートとページネーション
  const sortColumn = ['created_at', 'started_at', 'file_size', 'backup_type'].includes(sort)
    ? `backup_logs.${sort}`
    : 'backup_logs.created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const backups = await query.orderBy(sortColumn, sortOrder).limit(limit).offset(offset);

  // メタデータをJSONパース
  backups.forEach((backup) => {
    if (backup.metadata) {
      try {
        backup.metadata = JSON.parse(backup.metadata);
      } catch (e) {
        backup.metadata = {};
      }
    }
  });

  return {
    total: count,
    backups
  };
}

/**
 * バックアップ詳細を取得
 * @param {string} backupId - バックアップID
 * @returns {Promise<Object|null>} バックアップ詳細
 */
async function getBackup(backupId) {
  if (!db) throw new Error('Database not initialized');

  const backup = await db('backup_logs')
    .leftJoin('users', 'backup_logs.created_by', 'users.id')
    .where('backup_logs.backup_id', backupId)
    .select('backup_logs.*', 'users.username as created_by_username')
    .first();

  if (!backup) {
    return null;
  }

  // メタデータをJSONパース
  if (backup.metadata) {
    try {
      backup.metadata = JSON.parse(backup.metadata);
    } catch (e) {
      backup.metadata = {};
    }
  }

  return backup;
}

/**
 * バックアップを削除
 * @param {string} backupId - バックアップID
 * @param {number} _userId - 実行ユーザーID（将来の監査ログ用）
 * @returns {Promise<Object>} { success: boolean }
 */
async function deleteBackup(backupId, _userId) {
  if (!db) throw new Error('Database not initialized');

  // バックアップ情報取得
  const backup = await getBackup(backupId);
  if (!backup) {
    throw new Error(`Backup not found: ${backupId}`);
  }

  if (backup.status === 'deleted') {
    throw new Error(`Backup already deleted: ${backupId}`);
  }

  // 最新のバックアップかチェック（削除不可）
  const latestBackup = await db('backup_logs')
    .where('backup_type', backup.backup_type)
    .where('status', 'success')
    .orderBy('created_at', 'desc')
    .first();

  if (latestBackup && latestBackup.backup_id === backupId) {
    throw new Error('Cannot delete the latest backup');
  }

  // ファイル削除
  if (backup.file_path) {
    try {
      const basePath = backup.file_path.replace(/\.db$/, '');
      const filesToDelete = [
        backup.file_path,
        `${basePath}.sql.gz`,
        `${basePath}.db-wal`,
        `${basePath}.db-shm`,
        `${basePath}.sha256`
      ];

      // ファイル削除は順序依存のため、ループ内でawaitを使用
      // eslint-disable-next-line no-restricted-syntax
      for (const file of filesToDelete) {
        // eslint-disable-next-line no-await-in-loop
        if (await fileExists(file)) {
          // eslint-disable-next-line no-await-in-loop
          await fs.unlink(file);
        }
      }
    } catch (error) {
      logger.error(`Failed to delete backup files: ${error.message}`);
      // ファイル削除失敗は警告のみ、処理は継続
    }
  }

  // backup_logs 更新（status: deleted）
  await db('backup_logs').where('backup_id', backupId).update({
    status: 'deleted'
  });

  return { success: true };
}

/**
 * SQLite整合性チェックを実行
 * @param {string} dbFilePath - チェック対象のDBファイルパス
 * @returns {Promise<boolean>} 整合性チェック結果
 */
function runIntegrityCheck(dbFilePath) {
  return new Promise((resolve, reject) => {
    const child = spawn('sqlite3', [dbFilePath, 'PRAGMA integrity_check;']);
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Integrity check process failed: ${errorOutput || output}`));
        return;
      }
      // sqlite3 の PRAGMA integrity_check は成功時に "ok" を返す
      resolve(output.trim() === 'ok');
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to run integrity check: ${error.message}`));
    });
  });
}

/**
 * リストアを実行
 * @param {string} backupId - バックアップID
 * @param {number} userId - 実行ユーザーID
 * @param {Object} options - { backup_current: boolean }
 * @returns {Promise<Object>} { status, restored_from, backup_before_restore, integrity_check }
 */
async function restoreBackup(backupId, userId, options = {}) {
  if (!db) throw new Error('Database not initialized');

  const { backup_current: shouldBackupCurrent = true } = options;

  // バックアップ情報取得
  const backup = await getBackup(backupId);
  if (!backup) {
    throw new Error(`Backup not found: ${backupId}`);
  }

  if (backup.status !== 'success') {
    throw new Error(`Backup is not available for restore. Status: ${backup.status}`);
  }

  // ファイル存在確認
  if (!backup.file_path || !(await fileExists(backup.file_path))) {
    throw new Error(`Backup file not found: ${backup.file_path}`);
  }

  const dbPath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(__dirname, '../itsm_nexus.db');

  let safetyBackupPath = null;

  // 1. リストア前の安全バックアップ作成
  if (shouldBackupCurrent && (await fileExists(dbPath))) {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const backupDir = path.resolve(__dirname, '../backups');
    safetyBackupPath = path.join(backupDir, `restore_safety_${timestamp}.db`);

    // バックアップディレクトリ作成
    await fs.mkdir(backupDir, { recursive: true });

    // 現在のDBをコピー
    await fs.copyFile(dbPath, safetyBackupPath);
    logger.info(`[Restore] Safety backup created: ${safetyBackupPath}`);
  }

  try {
    // 2. バックアップファイルのチェックサム検証（存在する場合）
    if (backup.checksum) {
      // eslint-disable-next-line no-use-before-define
      const actualChecksum = await calculateFileChecksum(backup.file_path);
      const expectedChecksum = backup.checksum.replace(/^sha256:/, '');
      if (actualChecksum !== expectedChecksum) {
        throw new Error('Backup file checksum mismatch. The file may be corrupted.');
      }
      logger.info('[Restore] Checksum verification passed');
    }

    // 3. バックアップファイルの整合性チェック（リストア前に検証）
    const backupIntegrityOk = await runIntegrityCheck(backup.file_path);
    if (!backupIntegrityOk) {
      throw new Error('Backup file integrity check failed. The backup may be corrupted.');
    }
    logger.info('[Restore] Backup file integrity check passed');

    // 4. 現在のDBファイルを差し替え
    // WAL/SHMファイルも含めて削除
    const filesToRemove = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
    await Promise.all(
      filesToRemove.map(async (file) => {
        if (await fileExists(file)) {
          await fs.unlink(file);
        }
      })
    );

    // バックアップファイルをDBパスにコピー
    await fs.copyFile(backup.file_path, dbPath);

    // WALファイルも存在すればコピー
    const backupWal = `${backup.file_path}-wal`;
    if (await fileExists(backupWal)) {
      await fs.copyFile(backupWal, `${dbPath}-wal`);
    }

    // 5. リストア後の整合性チェック
    const restoredIntegrityOk = await runIntegrityCheck(dbPath);
    if (!restoredIntegrityOk) {
      throw new Error('Restored database integrity check failed');
    }
    logger.info('[Restore] Restored database integrity check passed');

    return {
      status: 'success',
      restored_from: backupId,
      backup_before_restore: safetyBackupPath,
      integrity_check: 'passed',
      message: 'Database restored successfully. Please reload the application.'
    };
  } catch (error) {
    // 6. 失敗時はロールバック
    if (safetyBackupPath && (await fileExists(safetyBackupPath))) {
      try {
        await fs.copyFile(safetyBackupPath, dbPath);
        logger.info('[Restore] Rollback completed from safety backup');
      } catch (rollbackError) {
        logger.error(`[Restore] Rollback failed: ${rollbackError.message}`);
      }
    }
    throw error;
  }
}

/**
 * ファイルのSHA256チェックサムを計算
 * @param {string} filePath - ファイルパス
 * @returns {Promise<string>} SHA256ハッシュ（hex）
 */
async function calculateFileChecksum(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * 個別バックアップの整合性チェック実行
 * @param {Object} backup - バックアップ情報
 * @returns {Promise<Array>} チェック結果配列
 */
async function performIntegrityChecks(backup) {
  const results = [];
  let checkSequence = 1;

  // 1. ファイル存在チェック
  const fileExistsCheck = {
    check_id: generateCheckId(checkSequence),
    backup_id: backup.backup_id,
    check_type: 'file_exists',
    status: 'pass',
    error_message: null,
    details: null,
    checked_at: new Date().toISOString()
  };
  checkSequence += 1;

  if (!backup.file_path || !(await fileExists(backup.file_path))) {
    fileExistsCheck.status = 'fail';
    fileExistsCheck.error_message = 'Backup file not found';
  }
  results.push(fileExistsCheck);

  // データベースに記録
  await db('backup_integrity_checks').insert(fileExistsCheck);

  // ファイルが存在しない場合は以降のチェックをスキップ
  if (fileExistsCheck.status === 'fail') {
    return results;
  }

  // 2. チェックサムチェック
  const checksumCheck = {
    check_id: generateCheckId(checkSequence),
    backup_id: backup.backup_id,
    check_type: 'checksum',
    status: 'pass',
    error_message: null,
    details: null,
    checked_at: new Date().toISOString()
  };
  checkSequence += 1;

  if (backup.checksum) {
    try {
      const actualChecksum = await calculateFileChecksum(backup.file_path);
      const expectedChecksum = backup.checksum.replace(/^sha256:/, '');

      if (actualChecksum !== expectedChecksum) {
        checksumCheck.status = 'fail';
        checksumCheck.error_message = 'Checksum mismatch';
        checksumCheck.details = JSON.stringify({
          expected: expectedChecksum,
          actual: actualChecksum
        });
      }
    } catch (error) {
      checksumCheck.status = 'fail';
      checksumCheck.error_message = `Checksum calculation failed: ${error.message}`;
    }
  }

  results.push(checksumCheck);
  await db('backup_integrity_checks').insert(checksumCheck);

  // 3. 解凍テスト（.sql.gz ファイルのみ）
  const isGzipped =
    backup.file_path.endsWith('.sql.gz') || backup.file_path.endsWith('.gz');
  if (isGzipped) {
    const zlib = require('zlib'); // eslint-disable-line global-require
    const decompressionCheck = {
      check_id: generateCheckId(checkSequence),
      backup_id: backup.backup_id,
      check_type: 'decompression',
      status: 'pass',
      error_message: null,
      details: null,
      checked_at: new Date().toISOString()
    };
    checkSequence += 1;

    try {
      const bytesRead = await new Promise((resolve, reject) => {
        const readStream = fsSync.createReadStream(backup.file_path);
        const gunzip = zlib.createGunzip();
        let total = 0;
        gunzip.on('data', (chunk) => {
          total += chunk.length;
        });
        gunzip.on('end', () => resolve(total));
        gunzip.on('error', reject);
        readStream.on('error', reject);
        readStream.pipe(gunzip);
      });
      decompressionCheck.details = JSON.stringify({ decompressed_bytes: bytesRead });
    } catch (error) {
      decompressionCheck.status = 'fail';
      decompressionCheck.error_message = `Decompression failed: ${error.message}`;
    }

    results.push(decompressionCheck);
    await db('backup_integrity_checks').insert(decompressionCheck);
  }

  // 4. PRAGMA integrity_check（.db ファイルの SQLite 整合性検証）
  const isDbFile = backup.file_path.endsWith('.db');
  if (isDbFile) {
    const pragmaCheck = {
      check_id: generateCheckId(checkSequence),
      backup_id: backup.backup_id,
      check_type: 'pragma_integrity',
      status: 'pass',
      error_message: null,
      details: null,
      checked_at: new Date().toISOString()
    };
    checkSequence += 1;

    try {
      const integrityOk = await runIntegrityCheck(backup.file_path);
      if (!integrityOk) {
        pragmaCheck.status = 'fail';
        pragmaCheck.error_message = 'PRAGMA integrity_check failed: database may be corrupted';
      } else {
        pragmaCheck.details = JSON.stringify({ result: 'ok' });
      }
    } catch (error) {
      pragmaCheck.status = 'fail';
      pragmaCheck.error_message = `PRAGMA integrity_check error: ${error.message}`;
    }

    results.push(pragmaCheck);
    await db('backup_integrity_checks').insert(pragmaCheck);
  }

  return results;
}

/**
 * バックアップファイルの整合性チェック
 * @param {string} backupId - バックアップID（省略時は全バックアップ）
 * @returns {Promise<Object>} チェック結果
 */
async function checkIntegrity(backupId = null) {
  if (!db) throw new Error('Database not initialized');

  const checks = [];
  let backupsToCheck = [];

  if (backupId) {
    // 特定のバックアップのみチェック
    const backup = await getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    backupsToCheck = [backup];
  } else {
    // 全バックアップチェック
    const result = await listBackups({ status: 'success', limit: 1000 });
    backupsToCheck = result.backups;
  }

  // チェックは順序依存のため、ループ内でawaitを使用
  // eslint-disable-next-line no-restricted-syntax
  for (const backup of backupsToCheck) {
    // eslint-disable-next-line no-await-in-loop
    const checkResults = await performIntegrityChecks(backup);
    checks.push(...checkResults);
  }

  return {
    total_checks: checks.length,
    passed: checks.filter((c) => c.status === 'pass').length,
    failed: checks.filter((c) => c.status === 'fail').length,
    checks
  };
}

module.exports = {
  setDatabase,
  createBackup,
  listBackups,
  getBackup,
  deleteBackup,
  restoreBackup,
  checkIntegrity,
  runIntegrityCheck
};
