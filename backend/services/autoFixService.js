/**
 * Auto-Fix Service
 * 自動修復コアサービス
 * Phase 9.2: 監視・ヘルスチェック強化
 *
 * 5つのエラー検知ソースを統合し、パターンマッチング、
 * クールダウン管理、自動修復実行を提供
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { db: sqliteDb } = require('../db');

// 依存サービス
const errorPatterns = require('./errorPatterns');
const fixActions = require('./fixActions');

// データベース接続（外部注入）
let db = null;

// クールダウンキャッシュ（メモリ）
const cooldownCache = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5分

// プロセスイベントエラーキャッシュ
const processErrors = [];
const MAX_PROCESS_ERRORS = 100;

/**
 * データベース接続を設定
 * @param {Object} database - Knexデータベース接続
 */
function setDatabase(database) {
  db = database;
  fixActions.setDatabase(database);
}

// ============================================================
// 1. エラー検知（5ソース統合）
// ============================================================

/**
 * ソース1: Morganログファイル解析
 * HTTP 4xx/5xxエラーを検出
 * @param {string} logPath - ログファイルパス
 * @returns {Promise<Array>} エラー配列
 */
async function scanLogs(logPath) {
  const errors = [];

  try {
    // ログファイルの存在確認
    await fs.access(logPath);

    const fileStream = await fs.open(logPath, 'r');
    const rl = readline.createInterface({
      input: fileStream.createReadStream(),
      crlfDelay: Infinity
    });

    // 最新100行のみ解析（パフォーマンス最適化）
    const recentLines = [];
    for await (const line of rl) {
      recentLines.push(line);
      if (recentLines.length > 100) {
        recentLines.shift();
      }
    }

    // エラーパターンマッチング
    for (const line of recentLines) {
      // HTTP 4xx/5xxエラーの検出
      if (/\s[45]\d{2}\s/.test(line)) {
        errors.push({
          source: 'morgan_logs',
          message: line.substring(0, 500),
          timestamp: new Date().toISOString(),
          severity: /\s5\d{2}\s/.test(line) ? 'critical' : 'warning'
        });
      }

      // Node.js例外の検出
      if (/Error:|Exception:|Uncaught/i.test(line)) {
        errors.push({
          source: 'morgan_logs',
          message: line.substring(0, 500),
          timestamp: new Date().toISOString(),
          severity: 'high'
        });
      }
    }

    await fileStream.close();
  } catch (error) {
    console.error(`[AutoFix] Error scanning logs: ${error.message}`);
  }

  return errors;
}

/**
 * ソース2: Health.jsエンドポイント詳細チェック
 * データベース、ディスク、メモリの健全性を確認
 * @returns {Promise<Array>} エラー配列
 */
async function checkHealthEndpoint() {
  const errors = [];

  try {
    // データベース接続確認
    await new Promise((resolve, reject) => {
      sqliteDb.get('SELECT 1 as result', (err, row) => {
        if (err) reject(err);
        else if (row && row.result === 1) resolve();
        else reject(new Error('Unexpected query result'));
      });
    });
  } catch (error) {
    errors.push({
      source: 'health_check',
      message: `Database connection failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      metadata: { check: 'database' }
    });
  }

  // ディスク容量確認
  try {
    const dbDir = path.dirname(process.env.DATABASE_PATH || './backend/itsm_nexus.db');
    const stats = await fs.statfs(dbDir);
    const freeSpacePercent = (stats.bavail / stats.blocks) * 100;

    if (freeSpacePercent < 10) {
      errors.push({
        source: 'health_check',
        message: `disk usage 90%: Critical disk space: ${freeSpacePercent.toFixed(2)}% free`,
        timestamp: new Date().toISOString(),
        severity: 'critical',
        metadata: { check: 'disk', free_percent: freeSpacePercent }
      });
    }
  } catch (error) {
    errors.push({
      source: 'health_check',
      message: `Disk check failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      severity: 'high',
      metadata: { check: 'disk' }
    });
  }

  // メモリ使用率確認
  try {
    // eslint-disable-next-line global-require
    const os = require('os');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPercent = ((totalMem - freeMem) / totalMem) * 100;

    if (usedMemPercent > 90) {
      errors.push({
        source: 'health_check',
        message: `memory usage 90%: Critical memory usage: ${usedMemPercent.toFixed(2)}% used`,
        timestamp: new Date().toISOString(),
        severity: 'critical',
        metadata: { check: 'memory', usage_percent: usedMemPercent }
      });
    }
  } catch (error) {
    errors.push({
      source: 'health_check',
      message: `Memory check failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      severity: 'high',
      metadata: { check: 'memory' }
    });
  }

  return errors;
}

/**
 * ソース3: monitoringServiceメトリクス
 * システムメトリクスを取得して閾値超過を検出
 * @returns {Promise<Array>} エラー配列
 */
async function checkMetrics() {
  const errors = [];

  try {
    // eslint-disable-next-line global-require
    const monitoringService = require('./monitoringService');
    const metrics = await monitoringService.getSystemMetrics();

    // CPU閾値超過
    if (metrics.metrics.cpu.threshold_status === 'critical') {
      errors.push({
        source: 'monitoring_metrics',
        message: `CPU usage critical: ${metrics.metrics.cpu.usage_percent}% used`,
        timestamp: new Date().toISOString(),
        severity: 'critical',
        metadata: {
          metric: 'cpu',
          value: metrics.metrics.cpu.usage_percent,
          threshold: 90
        }
      });
    }

    // メモリ閾値超過
    if (metrics.metrics.memory.threshold_status === 'critical') {
      errors.push({
        source: 'monitoring_metrics',
        message: `memory usage 90%: Memory usage critical: ${metrics.metrics.memory.usage_percent}% used`,
        timestamp: new Date().toISOString(),
        severity: 'critical',
        metadata: {
          metric: 'memory',
          value: metrics.metrics.memory.usage_percent,
          threshold: 90
        }
      });
    }

    // ディスク閾値超過
    if (metrics.metrics.disk.threshold_status === 'critical') {
      errors.push({
        source: 'monitoring_metrics',
        message: `disk usage 90%: Disk usage critical: ${metrics.metrics.disk.usage_percent}% used`,
        timestamp: new Date().toISOString(),
        severity: 'critical',
        metadata: {
          metric: 'disk',
          value: metrics.metrics.disk.usage_percent,
          threshold: 90
        }
      });
    }
  } catch (error) {
    console.error(`[AutoFix] Error checking metrics: ${error.message}`);
  }

  return errors;
}

/**
 * ソース4: alertService（firing状態のcriticalアラート）
 * アクティブなアラートを取得
 * @returns {Promise<Array>} エラー配列
 */
async function checkActiveAlerts() {
  const errors = [];

  try {
    // eslint-disable-next-line global-require
    const alertService = require('./alertService');
    const alerts = await alertService.getActiveAlerts();

    for (const alert of alerts) {
      if (alert.severity === 'critical' && alert.status === 'firing') {
        errors.push({
          source: 'alert_service',
          message: `Alert firing: ${alert.rule_name} - ${alert.message}`,
          timestamp: alert.timestamp,
          severity: 'critical',
          metadata: {
            alert_id: alert.id,
            metric_name: alert.metric_name,
            current_value: alert.current_value,
            threshold: alert.threshold
          }
        });
      }
    }
  } catch (error) {
    console.error(`[AutoFix] Error checking active alerts: ${error.message}`);
  }

  return errors;
}

/**
 * ソース5: プロセスイベント監視
 * uncaughtException、unhandledRejectionをキャプチャ
 */
function initProcessErrorListener() {
  // uncaughtExceptionハンドラー
  process.on('uncaughtException', (error, origin) => {
    const errorObj = {
      source: 'process_event',
      message: `Uncaught Exception: ${error.message}`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      metadata: {
        origin,
        stack: error.stack
      }
    };

    processErrors.push(errorObj);

    // キャッシュサイズ制限
    if (processErrors.length > MAX_PROCESS_ERRORS) {
      processErrors.shift();
    }

    console.error(`[AutoFix] Uncaught Exception captured: ${error.message}`);
  });

  // unhandledRejectionハンドラー
  process.on('unhandledRejection', (reason, promise) => {
    const errorObj = {
      source: 'process_event',
      message: `Unhandled Rejection: ${reason}`,
      timestamp: new Date().toISOString(),
      severity: 'high',
      metadata: {
        promise: promise.toString(),
        reason: reason.toString()
      }
    };

    processErrors.push(errorObj);

    // キャッシュサイズ制限
    if (processErrors.length > MAX_PROCESS_ERRORS) {
      processErrors.shift();
    }

    console.error(`[AutoFix] Unhandled Rejection captured: ${reason}`);
  });

  console.log('[AutoFix] Process error listeners initialized');
}

/**
 * エラー検知（5ソース統合）
 * @returns {Promise<Array>} 検出されたエラー配列
 */
async function detectErrors() {
  console.log('[AutoFix] Starting error detection from 5 sources');

  const logPath = process.env.LOG_FILE_PATH || '/mnt/LinuxHDD/ITSM-System/logs/backend-dev.log';

  // 5ソースから並列でエラーを収集
  const [logErrors, healthErrors, metricsErrors, alertErrors] = await Promise.all([
    scanLogs(logPath),
    checkHealthEndpoint(),
    checkMetrics(),
    checkActiveAlerts()
  ]);

  // プロセスイベントエラーを追加
  const allErrors = [
    ...logErrors,
    ...healthErrors,
    ...metricsErrors,
    ...alertErrors,
    ...processErrors
  ];

  console.log(`[AutoFix] Detected ${allErrors.length} errors from 5 sources`);

  // プロセスエラーキャッシュをクリア
  processErrors.length = 0;

  return allErrors;
}

// ============================================================
// 2. パターンマッチング
// ============================================================

/**
 * エラーをパターンとマッチング
 * @param {Object} error - エラーオブジェクト
 * @returns {Promise<Object|null>} マッチしたパターン情報、マッチしない場合はnull
 */
async function matchPattern(error) {
  if (!error || !error.message) {
    return null;
  }

  const matched = errorPatterns.matchError(error.message);

  if (!matched) {
    return null;
  }

  // エラーオブジェクトにパターン情報を追加
  return {
    ...error,
    pattern_id: matched.pattern_id,
    pattern_name: matched.pattern_name,
    severity: matched.severity,
    auto_fix: matched.auto_fix,
    actions: matched.actions,
    cooldown_seconds: matched.cooldown_seconds
  };
}

// ============================================================
// 3. クールダウン管理
// ============================================================

/**
 * エラーハッシュを生成
 * @param {string} message - エラーメッセージ
 * @param {string} patternId - パターンID
 * @returns {string} SHA256ハッシュ
 */
function generateErrorHash(message, patternId) {
  const combined = `${patternId}:${message.substring(0, 200)}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
}

/**
 * クールダウン状態を確認
 * @param {string} errorHash - エラーハッシュ
 * @returns {Promise<Object>} クールダウン状態
 */
async function checkCooldown(errorHash) {
  // メモリキャッシュ確認（高速）
  if (cooldownCache.has(errorHash)) {
    const lastFixed = cooldownCache.get(errorHash);
    const elapsed = Date.now() - lastFixed;

    if (elapsed < COOLDOWN_MS) {
      return {
        inCooldown: true,
        remainingMs: COOLDOWN_MS - elapsed,
        source: 'memory'
      };
    }

    // 期限切れのエントリを削除
    cooldownCache.delete(errorHash);
  }

  // データベース確認（冗長性）
  if (!db) {
    return { inCooldown: false };
  }

  try {
    const now = new Date().toISOString();
    const cooldown = await db('auto_fix_cooldowns')
      .where('error_hash', errorHash)
      .where('expires_at', '>', now)
      .first();

    if (cooldown) {
      const expiresAt = new Date(cooldown.expires_at);
      const remainingMs = expiresAt.getTime() - Date.now();

      // メモリキャッシュにも追加
      cooldownCache.set(errorHash, Date.now() - (COOLDOWN_MS - remainingMs));

      return {
        inCooldown: true,
        remainingMs,
        source: 'database'
      };
    }

    return { inCooldown: false };
  } catch (error) {
    console.error(`[AutoFix] Error checking cooldown: ${error.message}`);
    return { inCooldown: false };
  }
}

/**
 * クールダウンを記録
 * @param {string} errorHash - エラーハッシュ
 * @param {string} patternId - パターンID
 * @param {number} cooldownSeconds - クールダウン秒数
 * @returns {Promise<void>}
 */
async function recordCooldown(errorHash, patternId, cooldownSeconds = 300) {
  // メモリキャッシュに記録
  cooldownCache.set(errorHash, Date.now());

  // データベースに記録
  if (!db) return;

  try {
    const expiresAt = new Date(Date.now() + cooldownSeconds * 1000).toISOString();

    await db('auto_fix_cooldowns').insert({
      error_hash: errorHash,
      pattern_id: patternId,
      expires_at: expiresAt
    });

    console.log(`[AutoFix] Cooldown recorded: ${patternId} for ${cooldownSeconds}s`);
  } catch (error) {
    console.error(`[AutoFix] Error recording cooldown: ${error.message}`);
  }
}

// ============================================================
// 4. 修復アクション実行
// ============================================================

/**
 * 修復アクションを実行
 * @param {Object} error - マッチしたエラーオブジェクト
 * @returns {Promise<Array>} アクション実行結果配列
 */
async function executeFixAction(error) {
  const results = [];

  console.log(`[AutoFix] Executing fix actions for: ${error.pattern_id}`);

  for (const actionName of error.actions) {
    try {
      // アクション実行コンテキスト構築
      const context = {
        error,
        errorData: {
          pattern: error.pattern_id,
          severity: error.severity,
          error_message: error.message,
          metadata: error.metadata || {}
        },
        db
      };

      // eslint-disable-next-line no-await-in-loop
      const result = await fixActions.executeAction(actionName, context);

      results.push({
        action: actionName,
        ...result
      });

      console.log(
        `[AutoFix] Action ${actionName}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.execution_time_ms}ms)`
      );
    } catch (err) {
      console.error(`[AutoFix] Action ${actionName} threw error: ${err.message}`);
      results.push({
        action: actionName,
        success: false,
        message: `Action threw error: ${error.message}`,
        execution_time_ms: 0
      });
    }
  }

  return results;
}

// ============================================================
// 5. 履歴記録
// ============================================================

/**
 * 修復履歴をデータベースに記録
 * @param {Object} error - エラーオブジェクト
 * @param {Array} results - アクション実行結果配列
 * @returns {Promise<number|null>} 挿入ID
 */
async function recordHistory(error, results) {
  if (!db) {
    console.warn('[AutoFix] Database not initialized, skipping history record');
    return null;
  }

  try {
    const status = results.every((r) => r.success) ? 'success' : 'failure';
    const totalExecutionTime = results.reduce((sum, r) => sum + (r.execution_time_ms || 0), 0);

    const [id] = await db('auto_fix_history').insert({
      error_pattern: error.pattern_id,
      severity: error.severity,
      fix_action: JSON.stringify(results.map((r) => r.action)),
      status,
      error_message: error.message.substring(0, 500),
      execution_time_ms: totalExecutionTime,
      created_at: new Date().toISOString()
    });

    console.log(`[AutoFix] History recorded: ID ${id}, Status: ${status}`);
    return id;
  } catch (error) {
    console.error(`[AutoFix] Error recording history: ${error.message}`);
    return null;
  }
}

// ============================================================
// 6. ステータス取得
// ============================================================

/**
 * 自動修復システムのステータスを取得
 * @returns {Promise<Object>} ステータス情報
 */
async function getStatus() {
  const status = {
    enabled: process.env.AUTO_FIX_ENABLED === 'true',
    total_runs: 0,
    success_runs: 0,
    success_rate: 0,
    active_cooldowns: cooldownCache.size,
    last_run: null,
    uptime_seconds: process.uptime()
  };

  if (!db) {
    return status;
  }

  try {
    // 総実行回数
    const [totalResult] = await db('auto_fix_history').count('* as count');
    status.total_runs = totalResult.count;

    // 成功回数
    const [successResult] = await db('auto_fix_history')
      .where('status', 'success')
      .count('* as count');
    status.success_runs = successResult.count;

    // 成功率
    if (status.total_runs > 0) {
      status.success_rate = parseFloat((status.success_runs / status.total_runs).toFixed(4));
    }

    // 最終実行時刻
    const lastRun = await db('auto_fix_history').orderBy('created_at', 'desc').first();

    if (lastRun) {
      status.last_run = lastRun.created_at;
    }
  } catch (error) {
    console.error(`[AutoFix] Error getting status: ${error.message}`);
  }

  return status;
}

// ============================================================
// 7. メインオーケストレーション
// ============================================================

/**
 * 自動修復サイクルを実行
 * @returns {Promise<Object>} 実行結果サマリー
 */
async function runAutoFix() {
  const startTime = Date.now();
  console.log('[AutoFix] ========================================');
  console.log('[AutoFix] Starting auto-fix cycle');
  console.log('[AutoFix] ========================================');

  const summary = {
    started_at: new Date().toISOString(),
    errors_detected: 0,
    errors_matched: 0,
    errors_fixed: 0,
    errors_skipped_cooldown: 0,
    errors_failed: 0,
    execution_time_ms: 0
  };

  try {
    // 1. エラー検知
    const errors = await detectErrors();
    summary.errors_detected = errors.length;

    if (errors.length === 0) {
      console.log('[AutoFix] No errors detected');
      summary.execution_time_ms = Date.now() - startTime;
      return summary;
    }

    // 2. パターンマッチング
    const matchedErrors = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const error of errors) {
      // eslint-disable-next-line no-await-in-loop
      const matched = await matchPattern(error);
      if (matched && matched.auto_fix) {
        matchedErrors.push(matched);
      }
    }

    summary.errors_matched = matchedErrors.length;
    console.log(`[AutoFix] Matched ${matchedErrors.length} auto-fixable errors`);

    if (matchedErrors.length === 0) {
      console.log('[AutoFix] No auto-fixable errors found');
      summary.execution_time_ms = Date.now() - startTime;
      return summary;
    }

    // 3. クールダウンチェック & 修復実行
    for (const error of matchedErrors) {
      const errorHash = generateErrorHash(error.message, error.pattern_id);
      const cooldownStatus = await checkCooldown(errorHash);

      if (cooldownStatus.inCooldown) {
        console.log(
          `[AutoFix] Skipping ${error.pattern_id}: In cooldown (${Math.round(cooldownStatus.remainingMs / 1000)}s remaining)`
        );
        summary.errors_skipped_cooldown += 1;
        continue;
      }

      // 修復アクション実行
      console.log(`[AutoFix] Processing: ${error.pattern_id}`);
      const results = await executeFixAction(error);

      // 履歴記録
      await recordHistory(error, results);

      // クールダウン記録
      await recordCooldown(errorHash, error.pattern_id, error.cooldown_seconds);

      // 結果集計
      if (results.every((r) => r.success)) {
        summary.errors_fixed += 1;
      } else {
        summary.errors_failed += 1;
      }
    }
  } catch (error) {
    console.error(`[AutoFix] Error during auto-fix cycle: ${error.message}`);
  }

  summary.execution_time_ms = Date.now() - startTime;

  console.log('[AutoFix] ========================================');
  console.log('[AutoFix] Auto-fix cycle completed');
  console.log(`[AutoFix] Detected: ${summary.errors_detected}`);
  console.log(`[AutoFix] Matched: ${summary.errors_matched}`);
  console.log(`[AutoFix] Fixed: ${summary.errors_fixed}`);
  console.log(`[AutoFix] Skipped (cooldown): ${summary.errors_skipped_cooldown}`);
  console.log(`[AutoFix] Failed: ${summary.errors_failed}`);
  console.log(`[AutoFix] Execution time: ${summary.execution_time_ms}ms`);
  console.log('[AutoFix] ========================================');

  return summary;
}

// ============================================================
// 8. 履歴取得
// ============================================================

/**
 * 自動修復履歴を取得
 * @param {Object} filters - フィルタ条件
 * @param {string} [filters.pattern] - パターンID
 * @param {string} [filters.severity] - Severityレベル
 * @param {string} [filters.status] - ステータス（success/failure）
 * @param {Object} pagination - ページネーション
 * @param {number} [pagination.limit=50] - 取得件数
 * @param {number} [pagination.offset=0] - オフセット
 * @returns {Promise<Object>} 履歴データと総件数
 */
async function getHistory(filters = {}, pagination = { limit: 50, offset: 0 }) {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    let query = db('auto_fix_history');

    // フィルタ適用
    if (filters.pattern) {
      query = query.where('error_pattern', filters.pattern);
    }

    if (filters.severity) {
      query = query.where('severity', filters.severity);
    }

    if (filters.status) {
      query = query.where('status', filters.status);
    }

    // 総件数取得
    const [totalResult] = await query.clone().count('* as count');
    const total = totalResult.count;

    // ページネーション適用
    const history = await query
      .limit(pagination.limit)
      .offset(pagination.offset)
      .orderBy('created_at', 'desc');

    return {
      total,
      history,
      filters,
      pagination
    };
  } catch (error) {
    console.error(`[AutoFix] Error getting history: ${error.message}`);
    throw error;
  }
}

// ============================================================
// 初期化・ユーティリティ
// ============================================================

/**
 * 期限切れクールダウンをクリーンアップ
 * @returns {Promise<number>} 削除件数
 */
async function cleanupExpiredCooldowns() {
  if (!db) return 0;

  try {
    const now = new Date().toISOString();
    const deleted = await db('auto_fix_cooldowns').where('expires_at', '<=', now).delete();

    console.log(`[AutoFix] Cleaned up ${deleted} expired cooldowns`);
    return deleted;
  } catch (error) {
    console.error(`[AutoFix] Error cleaning up cooldowns: ${error.message}`);
    return 0;
  }
}

// ============================================================
// エクスポート
// ============================================================

module.exports = {
  // データベース設定
  setDatabase,

  // 主要メソッド（8つ）
  detectErrors,
  matchPattern,
  checkCooldown,
  executeFixAction,
  recordHistory,
  getStatus,
  runAutoFix,
  getHistory,

  // ユーティリティ
  initProcessErrorListener,
  cleanupExpiredCooldowns,
  generateErrorHash,
  recordCooldown,

  // 内部公開（テスト用）
  scanLogs,
  checkHealthEndpoint,
  checkMetrics,
  checkActiveAlerts
};
