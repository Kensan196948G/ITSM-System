/**
 * Fix Actions Service
 * 自動修復アクション実装（Tier 1）
 * Phase 9.2: 監視・ヘルスチェック強化
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

// データベース接続を外部から注入
let db = null;

/**
 * データベース接続を設定
 * @param {Object} database - Knexデータベース接続
 */
function setDatabase(database) {
  db = database;
}

/**
 * 修復アクション実行結果の型定義
 * @typedef {Object} ActionResult
 * @property {boolean} success - 成功フラグ
 * @property {string} message - 結果メッセージ
 * @property {Object} [details] - 詳細情報（オプション）
 * @property {number} [execution_time_ms] - 実行時間（ミリ秒）
 * @property {string} [output] - コマンド出力
 */

// ============================================================
// Tier 1 修復アクション（即座実行）
// ============================================================

/**
 * サービス再起動
 * systemdでサービスを再起動し、プロセスレベルの問題を解決
 *
 * @param {string|null} serviceName - サービス名（省略時は環境に応じて自動選択）
 * @returns {Promise<ActionResult>}
 */
async function serviceRestart(serviceName = null) {
  const startTime = performance.now();

  try {
    // 環境に応じたサービス名を決定
    const env = process.env.NODE_ENV || 'development';
    const service = serviceName || (env === 'production' ? 'itsm-nexus-prod' : 'itsm-nexus-dev');

    logger.info(`[FixActions] Attempting to restart service: ${service}`);

    // systemctl restart を実行
    const { stdout, stderr } = await execAsync(`sudo systemctl restart ${service}`);

    // 再起動後のステータス確認
    const { stdout: statusOutput } = await execAsync(
      `sudo systemctl is-active ${service} 2>&1 || true`
    );

    const isActive = statusOutput.trim() === 'active';
    const executionTime = Math.round(performance.now() - startTime);

    if (isActive) {
      logger.info(`[FixActions] Service restart successful: ${service}`);
      return {
        success: true,
        message: `Service ${service} restarted successfully`,
        execution_time_ms: executionTime,
        output: stdout || 'Service restarted',
        details: {
          service,
          status: 'active'
        }
      };
    }

    logger.warn(`[FixActions] Service restart completed but service not active: ${service}`);
    return {
      success: false,
      message: `Service ${service} restart completed but not active`,
      execution_time_ms: executionTime,
      output: stderr || statusOutput,
      details: {
        service,
        status: statusOutput.trim()
      }
    };
  } catch (error) {
    const executionTime = Math.round(performance.now() - startTime);
    logger.error(`[FixActions] Service restart failed: ${error.message}`);

    return {
      success: false,
      message: `Service restart failed: ${error.message}`,
      execution_time_ms: executionTime,
      details: {
        error: error.message,
        stderr: error.stderr
      }
    };
  }
}

/**
 * データベースWALチェックポイント実行
 * SQLite WAL（Write-Ahead Logging）ファイルを本体DBに統合し、
 * ディスク使用量削減とパフォーマンス改善を実現
 *
 * @param {Object} dbConnection - Knexデータベース接続（省略時はグローバルdb使用）
 * @returns {Promise<ActionResult>}
 */
async function databaseCheckpoint(dbConnection = null) {
  const startTime = performance.now();
  const connection = dbConnection || db;

  if (!connection) {
    return {
      success: false,
      message: 'Database connection not initialized',
      execution_time_ms: 0
    };
  }

  try {
    logger.info('[FixActions] Executing WAL checkpoint (TRUNCATE mode)');

    // PRAGMA wal_checkpoint(TRUNCATE) を実行
    // TRUNCATE: WALファイルを完全にクリアし、メインDBに統合
    const result = await connection.raw('PRAGMA wal_checkpoint(TRUNCATE)');

    const executionTime = Math.round(performance.now() - startTime);

    // 結果フォーマット: [busy, log_pages, checkpointed_pages]
    const checkpointResult = result && result[0] ? result[0] : {};
    const busy = checkpointResult.busy || 0;
    const logPages = checkpointResult.log || 0;
    const checkpointedPages = checkpointResult.checkpointed || 0;

    logger.info(
      `[FixActions] WAL checkpoint completed: ${checkpointedPages} pages written (${executionTime}ms)`
    );

    return {
      success: true,
      message: 'WAL checkpoint completed successfully',
      execution_time_ms: executionTime,
      details: {
        busy,
        log_pages: logPages,
        checkpointed_pages: checkpointedPages,
        mode: 'TRUNCATE'
      }
    };
  } catch (error) {
    const executionTime = Math.round(performance.now() - startTime);
    logger.error(`[FixActions] WAL checkpoint failed: ${error.message}`);

    return {
      success: false,
      message: `WAL checkpoint failed: ${error.message}`,
      execution_time_ms: executionTime,
      details: {
        error: error.message
      }
    };
  }
}

/**
 * キャッシュクリア
 * node-cacheインメモリキャッシュを全削除し、
 * メモリ使用量削減と古いデータ参照を防止
 *
 * @returns {Promise<ActionResult>}
 */
async function cacheClear() {
  const startTime = performance.now();

  try {
    logger.info('[FixActions] Clearing application cache');

    // キャッシュモジュールを動的に読み込み
    // eslint-disable-next-line global-require
    const cacheModule = require('../middleware/cache');

    if (!cacheModule || !cacheModule.cache) {
      return {
        success: false,
        message: 'Cache module not available',
        execution_time_ms: Math.round(performance.now() - startTime)
      };
    }

    // キャッシュ削除前の統計を取得
    const statsBefore = cacheModule.getCacheStats
      ? cacheModule.getCacheStats()
      : { keys: 'unknown' };

    // 全キャッシュクリア
    cacheModule.cache.flushAll();

    const executionTime = Math.round(performance.now() - startTime);

    logger.info(
      `[FixActions] Cache cleared successfully: ${statsBefore.keys} keys removed (${executionTime}ms)`
    );

    return {
      success: true,
      message: 'Cache cleared successfully',
      execution_time_ms: executionTime,
      details: {
        keys_cleared: statsBefore.keys,
        cache_enabled: cacheModule.CACHE_ENABLED
      }
    };
  } catch (error) {
    const executionTime = Math.round(performance.now() - startTime);
    logger.error(`[FixActions] Cache clear failed: ${error.message}`);

    return {
      success: false,
      message: `Cache clear failed: ${error.message}`,
      execution_time_ms: executionTime,
      details: {
        error: error.message
      }
    };
  }
}

/**
 * 管理者アラート送信
 * エラーパターン検出時に管理者に通知を送信
 * 複数チャネル対応（Email, Slack, Teams）
 *
 * @param {Object} errorData - エラー情報
 * @param {string} errorData.pattern - エラーパターン名
 * @param {string} errorData.severity - 深刻度（critical/high/medium/low）
 * @param {string} errorData.error_message - エラーメッセージ
 * @param {Object} errorData.metadata - メタデータ
 * @param {Array<Object>} [channels] - 通知チャネルリスト（省略時は環境変数から取得）
 * @returns {Promise<ActionResult>}
 */
async function alertAdmin(errorData, channels = null) {
  const startTime = performance.now();

  try {
    logger.info(`[FixActions] Sending admin alert for pattern: ${errorData.pattern}`);

    // 通知サービスを動的に読み込み
    // eslint-disable-next-line global-require
    const notificationService = require('./notificationService');

    // 通知チャネルの準備
    let notificationChannels = channels;

    // チャネルが指定されていない場合は環境変数から生成
    if (!notificationChannels) {
      notificationChannels = [];

      // Slack通知チャネル
      if (process.env.SLACK_WEBHOOK_URL) {
        notificationChannels.push({
          channel_type: 'slack',
          channel_name: 'Slack Alert',
          config: {
            webhook_url: process.env.SLACK_WEBHOOK_URL
          }
        });
      }

      // Teams通知チャネル
      if (process.env.TEAMS_WEBHOOK_URL) {
        notificationChannels.push({
          channel_type: 'teams',
          channel_name: 'Teams Alert',
          config: {
            webhook_url: process.env.TEAMS_WEBHOOK_URL
          }
        });
      }

      // メール通知チャネル
      if (process.env.ALERT_EMAIL) {
        notificationChannels.push({
          channel_type: 'email',
          channel_name: 'Email Alert',
          config: {
            email: process.env.ALERT_EMAIL
          }
        });
      }
    }

    // 通知チャネルが1つもない場合
    if (notificationChannels.length === 0) {
      logger.warn('[FixActions] No notification channels configured');
      return {
        success: false,
        message: 'No notification channels configured',
        execution_time_ms: Math.round(performance.now() - startTime),
        details: {
          channels_count: 0
        }
      };
    }

    // アラートペイロード構築
    const alertPayload = {
      id: `ALERT-${Date.now()}`,
      rule_name: `Auto-Fix Alert: ${errorData.pattern}`,
      metric_name: errorData.pattern,
      current_value: errorData.metadata?.value || 'N/A',
      threshold: errorData.metadata?.threshold || 'N/A',
      severity: errorData.severity,
      message: errorData.error_message || 'Error detected by monitoring service',
      timestamp: new Date().toISOString()
    };

    // 通知送信
    const results = await notificationService.sendAlertNotification(
      alertPayload,
      notificationChannels
    );

    const executionTime = Math.round(performance.now() - startTime);
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    logger.info(
      `[FixActions] Admin alert sent: ${successCount} success, ${failureCount} failed (${executionTime}ms)`
    );

    return {
      success: successCount > 0,
      message: `Admin alert sent to ${successCount}/${results.length} channels`,
      execution_time_ms: executionTime,
      details: {
        total_channels: results.length,
        success_count: successCount,
        failure_count: failureCount,
        results
      }
    };
  } catch (error) {
    const executionTime = Math.round(performance.now() - startTime);
    logger.error(`[FixActions] Alert admin failed: ${error.message}`);

    return {
      success: false,
      message: `Alert admin failed: ${error.message}`,
      execution_time_ms: executionTime,
      details: {
        error: error.message
      }
    };
  }
}

// ============================================================
// 統合実行関数
// ============================================================

/**
 * アクション名から対応する関数を取得
 * @param {string} actionName - アクション名
 * @returns {Function|null} アクション関数
 */
function getActionFunction(actionName) {
  const actions = {
    service_restart: serviceRestart,
    database_checkpoint: databaseCheckpoint,
    cache_clear: cacheClear,
    alert_admin: alertAdmin
  };

  return actions[actionName] || null;
}

/**
 * 修復アクションを実行（統合エントリポイント）
 *
 * @param {string} actionName - アクション名（service_restart/database_checkpoint/cache_clear/alert_admin）
 * @param {Object} context - 実行コンテキスト
 * @param {Object} [context.errorData] - エラーデータ（alert_admin用）
 * @param {string} [context.serviceName] - サービス名（service_restart用）
 * @param {Object} [context.dbConnection] - DB接続（database_checkpoint用）
 * @param {Array} [context.channels] - 通知チャネル（alert_admin用）
 * @returns {Promise<ActionResult>}
 */
async function executeAction(actionName, context = {}) {
  const actionFn = getActionFunction(actionName);

  if (!actionFn) {
    logger.error(`[FixActions] Unknown action: ${actionName}`);
    return {
      success: false,
      message: `Unknown action: ${actionName}`,
      execution_time_ms: 0
    };
  }

  logger.info(`[FixActions] Executing action: ${actionName}`);

  try {
    let result;

    // アクション別に引数を調整して実行
    switch (actionName) {
      case 'service_restart':
        result = await actionFn(context.serviceName);
        break;

      case 'database_checkpoint':
        result = await actionFn(context.dbConnection);
        break;

      case 'cache_clear':
        result = await actionFn();
        break;

      case 'alert_admin':
        result = await actionFn(context.errorData, context.channels);
        break;

      default:
        result = await actionFn(context);
    }

    return result;
  } catch (error) {
    logger.error(`[FixActions] Action execution failed: ${error.message}`);
    return {
      success: false,
      message: `Action execution failed: ${error.message}`,
      execution_time_ms: 0,
      details: {
        error: error.message
      }
    };
  }
}

// ============================================================
// エクスポート
// ============================================================

module.exports = {
  // データベース設定
  setDatabase,

  // 個別アクション（Tier 1）
  serviceRestart,
  databaseCheckpoint,
  cacheClear,
  alertAdmin,

  // 統合実行
  executeAction,
  getActionFunction
};
