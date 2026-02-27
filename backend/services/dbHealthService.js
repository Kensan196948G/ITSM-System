/**
 * Database Health Service
 * データベース本体の整合性チェックとヘルスモニタリング
 */

const path = require('path');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');
const { runIntegrityCheck } = require('./backupService');

/**
 * データベースの整合性チェックを実行
 * @returns {Promise<Object>} { status, details, timestamp }
 */
async function checkDatabaseIntegrity() {
  const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../itsm_nexus.db');

  try {
    const isOk = await runIntegrityCheck(dbPath);

    if (isOk) {
      logger.info('[DB Health] Integrity check passed');
      return {
        status: 'ok',
        details: 'Database integrity verified',
        timestamp: new Date().toISOString()
      };
    }

    logger.error('[DB Health] Integrity check failed');

    // アラートメール送信
    const alertEmail = process.env.DB_HEALTH_ALERT_EMAIL;
    if (alertEmail) {
      try {
        await sendEmail({
          to: alertEmail,
          subject: '【緊急】データベース整合性チェック失敗',
          text: `データベースの整合性チェックが失敗しました。

発生時刻: ${new Date().toISOString()}
DBパス: ${dbPath}

速やかにデータベースのバックアップとリストアを検討してください。`
        });
        logger.info(`[DB Health] Alert email sent to ${alertEmail}`);
      } catch (emailError) {
        logger.error(`[DB Health] Failed to send alert email: ${emailError.message}`);
      }
    }

    return {
      status: 'failed',
      details: 'Integrity check failed',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('[DB Health] Integrity check error:', error);
    return {
      status: 'error',
      details: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  checkDatabaseIntegrity
};
