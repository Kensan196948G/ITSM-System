/**
 * Scheduler Service
 * 定期タスク実行サービス（node-cron使用）
 * スケジュールレポート生成機能を含む
 */

const fs = require('fs');
const cron = require('node-cron');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');
const { generateReport, cleanupOldReports } = require('./pdfReportService');
const backupService = require('./backupService');

// knexは遅延ロード（テスト環境でのteardown問題回避）
let knex = null;
function getKnex() {
  if (!knex) {
    // eslint-disable-next-line global-require
    knex = require('../knex');
  }
  return knex;
}

// スケジュールされたジョブを保持
const scheduledJobs = {};

// カスタムスケジュールレポートジョブを保持
const customReportJobs = {};

/**
 * 達成率に応じた色コードを取得
 * @param {number} rate - 達成率
 * @returns {string} CSSカラーコード
 */
function getComplianceColor(rate) {
  if (rate >= 90) return '#16a34a';
  if (rate >= 70) return '#f59e0b';
  return '#dc2626';
}

/**
 * SLAレポート生成用のデータを取得
 * @param {Object} db - データベース接続
 * @param {string} fromDate - 開始日
 * @param {string} toDate - 終了日
 * @returns {Promise<Object>} レポートデータ
 */
async function generateSlaReportData(db, fromDate, toDate) {
  // Note: Date range filtering could be used for incremental reports
  // For now, we fetch all agreements for comprehensive status reporting
  const allAgreements = await db('sla_agreements')
    .where('created_at', '>=', fromDate)
    .orWhere('created_at', '<=', toDate)
    .orWhereNull('created_at')
    .select('*');

  const statusCounts = {
    met: allAgreements.filter((a) => a.status === 'Met').length,
    atRisk: allAgreements.filter((a) => a.status === 'At-Risk').length,
    violated: allAgreements.filter((a) => a.status === 'Violated' || a.status === 'Breached').length
  };

  const total = allAgreements.length;
  const complianceRate = total > 0 ? Math.round((statusCounts.met / total) * 100) : 0;

  // サービス別集計
  const byService = {};
  allAgreements.forEach((sla) => {
    if (!byService[sla.service_name]) {
      byService[sla.service_name] = {
        service_name: sla.service_name,
        count: 0,
        met: 0,
        atRisk: 0,
        violated: 0,
        totalRate: 0
      };
    }
    byService[sla.service_name].count += 1;
    if (sla.status === 'Met') {
      byService[sla.service_name].met += 1;
    } else if (sla.status === 'At-Risk') {
      byService[sla.service_name].atRisk += 1;
    } else {
      byService[sla.service_name].violated += 1;
    }
    byService[sla.service_name].totalRate += sla.achievement_rate || 0;
  });

  // 平均達成率計算
  Object.values(byService).forEach((service) => {
    service.avg_achievement = service.count > 0 ? Math.round(service.totalRate / service.count) : 0;
    delete service.totalRate;
  });

  return {
    report_generated_at: new Date().toISOString(),
    date_range: { from: fromDate, to: toDate },
    summary: {
      total_slas: total,
      met: statusCounts.met,
      at_risk: statusCounts.atRisk,
      violated: statusCounts.violated,
      compliance_rate: complianceRate
    },
    by_service: Object.values(byService),
    critical_violations: allAgreements.filter(
      (a) => (a.status === 'Violated' || a.status === 'Breached') && (a.achievement_rate || 0) < 70
    )
  };
}

/**
 * SLAレポートメールを送信
 * @param {Object} db - データベース接続
 * @param {string} reportType - レポートタイプ（weekly/monthly）
 * @returns {Promise<void>}
 */
async function sendSlaReportEmail(db, reportType) {
  const recipientEmail = process.env.SLA_REPORT_EMAIL || process.env.SLA_ALERT_EMAIL;
  if (!recipientEmail) {
    logger.info('[Scheduler] SLA_REPORT_EMAIL not configured, skipping report email');
    return;
  }

  const now = new Date();
  let fromDate;
  let periodLabel;

  if (reportType === 'weekly') {
    fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 7);
    periodLabel = '週次';
  } else {
    fromDate = new Date(now);
    fromDate.setMonth(fromDate.getMonth() - 1);
    periodLabel = '月次';
  }

  const fromDateStr = fromDate.toISOString().split('T')[0];
  const toDateStr = now.toISOString().split('T')[0];

  try {
    const reportData = await generateSlaReportData(db, fromDateStr, toDateStr);

    const subject = `【ITSM-Sec Nexus】SLA ${periodLabel}レポート (${fromDateStr} - ${toDateStr})`;

    // サービス別サマリー生成
    const servicesSummary = reportData.by_service
      .map(
        (s) =>
          `  - ${s.service_name}: 達成率 ${s.avg_achievement}% (達成${s.met}/リスク${s.atRisk}/違反${s.violated})`
      )
      .join('\n');

    // 違反SLA一覧
    const violationsList =
      reportData.critical_violations.length > 0
        ? reportData.critical_violations
            .map((v) => `  - ${v.service_name}: ${v.metric_name} (達成率: ${v.achievement_rate}%)`)
            .join('\n')
        : '  なし';

    const text = `
===================================
SLA ${periodLabel}レポート
===================================

期間: ${fromDateStr} ～ ${toDateStr}
生成日時: ${reportData.report_generated_at}

■ サマリー
-----------------------------------
総SLA契約数: ${reportData.summary.total_slas}
達成: ${reportData.summary.met}
リスク: ${reportData.summary.at_risk}
違反: ${reportData.summary.violated}
全体達成率: ${reportData.summary.compliance_rate}%

■ サービス別状況
-----------------------------------
${servicesSummary || '  データなし'}

■ 重要な違反（達成率70%未満）
-----------------------------------
${violationsList}

-----------------------------------
このレポートは自動生成されました。
ITSM-Sec Nexus
https://${process.env.SYSTEM_IP || 'localhost'}:5050
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .summary-item { background: white; padding: 12px; border-radius: 8px; text-align: center; }
    .summary-value { font-size: 24px; font-weight: bold; }
    .met { color: #16a34a; }
    .at-risk { color: #f59e0b; }
    .violated { color: #dc2626; }
    .section { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .section h3 { margin-top: 0; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">SLA ${periodLabel}レポート</h1>
      <p style="margin: 8px 0 0;">期間: ${fromDateStr} ～ ${toDateStr}</p>
    </div>
    <div class="content">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${reportData.summary.total_slas}</div>
          <div>総契約数</div>
        </div>
        <div class="summary-item">
          <div class="summary-value met">${reportData.summary.met}</div>
          <div>達成</div>
        </div>
        <div class="summary-item">
          <div class="summary-value at-risk">${reportData.summary.at_risk}</div>
          <div>リスク</div>
        </div>
        <div class="summary-item">
          <div class="summary-value violated">${reportData.summary.violated}</div>
          <div>違反</div>
        </div>
      </div>

      <div class="section">
        <h3>全体SLA達成率</h3>
        <div style="font-size: 48px; font-weight: bold; text-align: center; color: ${getComplianceColor(reportData.summary.compliance_rate)};">
          ${reportData.summary.compliance_rate}%
        </div>
      </div>

      <div class="section">
        <h3>サービス別状況</h3>
        <table>
          <thead>
            <tr><th>サービス名</th><th>達成率</th><th>達成</th><th>リスク</th><th>違反</th></tr>
          </thead>
          <tbody>
            ${reportData.by_service
              .map(
                (s) => `
              <tr>
                <td>${s.service_name}</td>
                <td>${s.avg_achievement}%</td>
                <td class="met">${s.met}</td>
                <td class="at-risk">${s.atRisk}</td>
                <td class="violated">${s.violated}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      ${
        reportData.critical_violations.length > 0
          ? `
      <div class="section" style="border-left: 4px solid #dc2626;">
        <h3 style="color: #dc2626;">重要な違反（要対応）</h3>
        <ul>
          ${reportData.critical_violations.map((v) => `<li><strong>${v.service_name}</strong>: ${v.metric_name} (達成率: ${v.achievement_rate}%)</li>`).join('')}
        </ul>
      </div>
      `
          : ''
      }
    </div>
    <div class="footer">
      <p>このレポートは自動生成されました。</p>
      <p>ITSM-Sec Nexus | <a href="https://${process.env.SYSTEM_IP || 'localhost'}:5050">ダッシュボードを開く</a></p>
    </div>
  </div>
</body>
</html>
`;

    await sendEmail({
      to: recipientEmail,
      subject,
      text,
      html
    });

    logger.info(`[Scheduler] SLA ${reportType} report sent to ${recipientEmail}`);
  } catch (error) {
    logger.error(`[Scheduler] Failed to send SLA ${reportType} report:`, error);
  }
}

/**
 * スケジューラを初期化
 * @param {Object} db - データベース接続
 */
function initializeScheduler(db) {
  const isEnabled = process.env.SCHEDULER_ENABLED !== 'false';

  if (!isEnabled) {
    logger.info('[Scheduler] Scheduler is disabled');
    return;
  }

  logger.info('[Scheduler] Initializing scheduled jobs...');

  // knexインスタンスを遅延取得
  const knexInstance = getKnex();

  // BackupServiceにKnexインスタンスを注入
  backupService.setDatabase(knexInstance);

  // ===== Phase 9.2: 監視ジョブ =====
  // eslint-disable-next-line global-require
  const monitoringService = require('./monitoringService');
  // eslint-disable-next-line global-require
  const alertService = require('./alertService');

  // MonitoringServiceとAlertServiceにKnexインスタンスを注入
  monitoringService.setDatabase(knexInstance);
  alertService.setDatabase(knexInstance);

  // メトリクススナップショット保存（5分ごと）
  const metricsSnapshotSchedule = process.env.METRICS_SNAPSHOT_CRON || '*/5 * * * *';
  if (cron.validate(metricsSnapshotSchedule)) {
    scheduledJobs.metricsSnapshot = cron.schedule(
      metricsSnapshotSchedule,
      async () => {
        logger.info('[Scheduler] Running metrics snapshot job');
        try {
          await monitoringService.saveMetricsSnapshot();
          logger.info('[Scheduler] Metrics snapshot saved successfully');
        } catch (error) {
          logger.error('[Scheduler] Metrics snapshot failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Metrics snapshot scheduled: ${metricsSnapshotSchedule}`);
  }

  // アラート評価（1分ごと）
  const alertEvaluationSchedule = process.env.ALERT_EVALUATION_CRON || '* * * * *';
  if (cron.validate(alertEvaluationSchedule)) {
    scheduledJobs.alertEvaluation = cron.schedule(
      alertEvaluationSchedule,
      async () => {
        try {
          await alertService.evaluateAllRules();
        } catch (error) {
          logger.error('[Scheduler] Alert evaluation failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Alert evaluation scheduled: ${alertEvaluationSchedule}`);
  }

  // 古いメトリクス削除（毎日01:00）
  const metricsCleanupSchedule = process.env.METRICS_CLEANUP_CRON || '0 1 * * *';
  if (cron.validate(metricsCleanupSchedule)) {
    scheduledJobs.metricsCleanup = cron.schedule(
      metricsCleanupSchedule,
      async () => {
        logger.info('[Scheduler] Running metrics cleanup job');
        try {
          const retentionDays = parseInt(process.env.METRICS_RETENTION_DAYS || '30', 10);
          const deleted = await monitoringService.cleanOldMetrics(retentionDays);
          logger.info(`[Scheduler] Metrics cleanup completed: ${deleted} records deleted`);
        } catch (error) {
          logger.error('[Scheduler] Metrics cleanup failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Metrics cleanup scheduled: ${metricsCleanupSchedule}`);
  }

  // エラー検知・自動修復（5分ごと）
  const autoFixSchedule = process.env.AUTO_FIX_CRON || '*/5 * * * *';
  if (cron.validate(autoFixSchedule)) {
    scheduledJobs.autoFix = cron.schedule(
      autoFixSchedule,
      async () => {
        logger.info('[Scheduler] Running auto-fix job');
        try {
          // eslint-disable-next-line global-require
          const autoFixService = require('./autoFixService');
          await autoFixService.runAutoFix();
          logger.info('[Scheduler] Auto-fix completed successfully');
        } catch (error) {
          logger.error('[Scheduler] Auto-fix failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Auto-fix scheduled: ${autoFixSchedule}`);
  }

  // ===== バックアップジョブ =====

  // 日次バックアップ（毎日 02:00）
  const dailyBackupSchedule = process.env.BACKUP_DAILY_CRON || '0 2 * * *';
  if (cron.validate(dailyBackupSchedule)) {
    scheduledJobs.dailyBackup = cron.schedule(
      dailyBackupSchedule,
      async () => {
        logger.info('[Scheduler] Running daily backup job');
        try {
          await backupService.createBackup('daily', null, 'Scheduled daily backup');
          logger.info('[Scheduler] Daily backup completed successfully');
        } catch (error) {
          logger.error('[Scheduler] Daily backup failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Daily backup scheduled: ${dailyBackupSchedule}`);
  }

  // 週次バックアップ（毎週日曜日 03:00）
  const weeklyBackupSchedule = process.env.BACKUP_WEEKLY_CRON || '0 3 * * 0';
  if (cron.validate(weeklyBackupSchedule)) {
    scheduledJobs.weeklyBackup = cron.schedule(
      weeklyBackupSchedule,
      async () => {
        logger.info('[Scheduler] Running weekly backup job');
        try {
          await backupService.createBackup('weekly', null, 'Scheduled weekly backup');
          logger.info('[Scheduler] Weekly backup completed successfully');
        } catch (error) {
          logger.error('[Scheduler] Weekly backup failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Weekly backup scheduled: ${weeklyBackupSchedule}`);
  }

  // 月次バックアップ（毎月1日 04:00）
  const monthlyBackupSchedule = process.env.BACKUP_MONTHLY_CRON || '0 4 1 * *';
  if (cron.validate(monthlyBackupSchedule)) {
    scheduledJobs.monthlyBackup = cron.schedule(
      monthlyBackupSchedule,
      async () => {
        logger.info('[Scheduler] Running monthly backup job');
        try {
          await backupService.createBackup('monthly', null, 'Scheduled monthly backup');
          logger.info('[Scheduler] Monthly backup completed successfully');
        } catch (error) {
          logger.error('[Scheduler] Monthly backup failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Monthly backup scheduled: ${monthlyBackupSchedule}`);
  }

  // 整合性チェック（毎週土曜日 01:00）
  const integrityCheckSchedule = process.env.BACKUP_INTEGRITY_CHECK_CRON || '0 1 * * 6';
  if (cron.validate(integrityCheckSchedule)) {
    scheduledJobs.integrityCheck = cron.schedule(
      integrityCheckSchedule,
      async () => {
        logger.info('[Scheduler] Running backup integrity check job');
        try {
          const result = await backupService.checkIntegrity();
          logger.info(
            `[Scheduler] Integrity check completed: ${result.passed}/${result.total_checks} passed`
          );

          // 失敗があればメール通知
          if (result.failed > 0) {
            const failedChecks = result.checks.filter((c) => c.status === 'fail');
            const subject = `⚠️ Backup Integrity Check Failed (${result.failed} failures)`;
            const text = `Backup integrity check found ${result.failed} failures:\n\n${failedChecks.map((c) => `- ${c.backup_id}: ${c.error_message}`).join('\n')}`;

            if (process.env.BACKUP_ALERT_EMAIL) {
              await sendEmail({
                to: process.env.BACKUP_ALERT_EMAIL,
                subject,
                text,
                html: `<p>${text.replace(/\n/g, '<br>')}</p>`
              }).catch((err) =>
                logger.error('[Scheduler] Failed to send integrity check alert:', err)
              );
            }
          }
        } catch (error) {
          logger.error('[Scheduler] Integrity check failed:', error.message);
        }
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Backup integrity check scheduled: ${integrityCheckSchedule}`);
  }

  // ===== SLAレポートジョブ =====

  // 週次SLAレポート（毎週月曜日 9:00）
  const weeklySchedule = process.env.SLA_WEEKLY_REPORT_CRON || '0 9 * * 1';
  if (cron.validate(weeklySchedule)) {
    scheduledJobs.weeklyReport = cron.schedule(
      weeklySchedule,
      async () => {
        logger.info('[Scheduler] Running weekly SLA report job');
        await sendSlaReportEmail(db, 'weekly');
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Weekly SLA report scheduled: ${weeklySchedule}`);
  }

  // 月次SLAレポート（毎月1日 9:00）
  const monthlySchedule = process.env.SLA_MONTHLY_REPORT_CRON || '0 9 1 * *';
  if (cron.validate(monthlySchedule)) {
    scheduledJobs.monthlyReport = cron.schedule(
      monthlySchedule,
      async () => {
        logger.info('[Scheduler] Running monthly SLA report job');
        await sendSlaReportEmail(db, 'monthly');
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    logger.info(`[Scheduler] Monthly SLA report scheduled: ${monthlySchedule}`);
  }

  logger.info('[Scheduler] Scheduler initialized successfully');
}

/**
 * スケジューラを停止
 */
function stopScheduler() {
  logger.info('[Scheduler] Stopping scheduled jobs...');
  Object.values(scheduledJobs).forEach((job) => {
    if (job && typeof job.stop === 'function') {
      job.stop();
    }
  });
  logger.info('[Scheduler] All scheduled jobs stopped');
}

/**
 * 手動でレポートを送信（テスト用/オンデマンド）
 * @param {Object} db - データベース接続
 * @param {string} reportType - レポートタイプ（weekly/monthly）
 * @returns {Promise<Object>} 実行結果
 */
async function triggerReportNow(db, reportType) {
  logger.info(`[Scheduler] Manually triggering ${reportType} SLA report`);
  await sendSlaReportEmail(db, reportType);
  return { success: true, message: `${reportType} report sent` };
}

/**
 * スケジュールタイプからcron式を生成
 * @param {string} scheduleType - スケジュールタイプ (daily/weekly/monthly)
 * @returns {string} cron式
 */
function getCronExpression(scheduleType) {
  switch (scheduleType) {
    case 'daily':
      return '0 9 * * *'; // 毎日9:00
    case 'weekly':
      return '0 9 * * 1'; // 毎週月曜9:00
    case 'monthly':
      return '0 9 1 * *'; // 毎月1日9:00
    default:
      return '0 9 * * 1'; // デフォルト: 週次
  }
}

/**
 * 次回実行日時を計算
 * @param {string} scheduleType - スケジュールタイプ
 * @returns {Date} 次回実行日時
 */
function calculateNextRunAt(scheduleType) {
  const now = new Date();
  const next = new Date(now);

  switch (scheduleType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      break;
    case 'weekly':
      // 次の月曜日
      next.setDate(next.getDate() + ((1 + 7 - next.getDay()) % 7 || 7));
      next.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      // 来月1日
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(9, 0, 0, 0);
      break;
    default:
      next.setDate(next.getDate() + 7);
      next.setHours(9, 0, 0, 0);
  }

  return next;
}

/**
 * 期間の開始日を計算
 * @param {string} scheduleType - スケジュールタイプ
 * @returns {string} 開始日 (YYYY-MM-DD)
 */
function calculateFromDate(scheduleType) {
  const now = new Date();
  const from = new Date(now);

  switch (scheduleType) {
    case 'daily':
      from.setDate(from.getDate() - 1);
      break;
    case 'weekly':
      from.setDate(from.getDate() - 7);
      break;
    case 'monthly':
      from.setMonth(from.getMonth() - 1);
      break;
    default:
      from.setDate(from.getDate() - 7);
  }

  return from.toISOString().split('T')[0];
}

/**
 * レポートメールを送信
 * @param {Array<string>} recipients - 送信先メールアドレス
 * @param {Object} schedule - スケジュール設定
 * @param {Object} result - 生成結果
 */
async function sendReportEmail(recipients, schedule, result) {
  const periodLabels = {
    daily: '日次',
    weekly: '週次',
    monthly: '月次'
  };
  const periodLabel = periodLabels[schedule.schedule_type] || '';

  const reportTypeLabels = {
    incident_summary: 'インシデントサマリー',
    sla_compliance: 'SLAコンプライアンス',
    security_overview: 'セキュリティ概要'
  };
  const typeLabel = reportTypeLabels[schedule.report_type] || schedule.report_type;

  const subject = `【ITSM-Sec Nexus】${typeLabel}${periodLabel}レポート`;

  // PDFファイルを添付
  const attachments = [];
  if (result.filePath && fs.existsSync(result.filePath)) {
    attachments.push({
      filename: result.fileName,
      path: result.filePath
    });
  }

  const text = `
${schedule.name}

レポートタイプ: ${typeLabel}
期間: ${periodLabel}
生成日時: ${new Date().toISOString()}

添付ファイルをご確認ください。

---
ITSM-Sec Nexus
https://${process.env.SYSTEM_IP || 'localhost'}:5050
`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px; }
    .info { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
    .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${schedule.name}</h1>
      <p style="margin: 8px 0 0;">${typeLabel} ${periodLabel}レポート</p>
    </div>
    <div class="content">
      <div class="info">
        <p><strong>レポートタイプ:</strong> ${typeLabel}</p>
        <p><strong>期間:</strong> ${periodLabel}</p>
        <p><strong>生成日時:</strong> ${new Date().toLocaleString('ja-JP')}</p>
      </div>
      <p>添付のPDFファイルをご確認ください。</p>
    </div>
    <div class="footer">
      <p>このレポートは自動生成されました。</p>
      <p>ITSM-Sec Nexus | <a href="https://${process.env.SYSTEM_IP || 'localhost'}:5050">ダッシュボードを開く</a></p>
    </div>
  </div>
</body>
</html>
`;

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendEmail({
          to: recipient,
          subject,
          text,
          html,
          attachments
        });
        logger.info(`[Scheduler] Report email sent to ${recipient}`);
      } catch (emailError) {
        logger.error(`[Scheduler] Failed to send email to ${recipient}:`, emailError);
      }
    })
  );
}

/**
 * スケジュールレポートを実行
 * @param {Object} db - Knexデータベース接続
 * @param {Object} schedule - スケジュール設定
 * @returns {Promise<Object>} 実行結果
 */
async function executeScheduledReport(db, schedule) {
  logger.info(`[Scheduler] Executing scheduled report: ${schedule.name} (${schedule.report_type})`);

  const fromDate = calculateFromDate(schedule.schedule_type);
  const toDate = new Date().toISOString().split('T')[0];

  // 履歴レコード作成
  const historyId = `HIS-${Date.now()}`;
  await db('report_history').insert({
    history_id: historyId,
    scheduled_report_id: schedule.id,
    report_type: schedule.report_type,
    report_name: schedule.name,
    format: schedule.format || 'pdf',
    status: 'generating',
    parameters: JSON.stringify({ fromDate, toDate }),
    started_at: new Date().toISOString()
  });

  try {
    // レポート生成
    const result = await generateReport(db, schedule.report_type, {
      fromDate,
      toDate
    });

    // 履歴更新
    await db('report_history').where('history_id', historyId).update({
      status: 'completed',
      file_path: result.filePath,
      file_size: result.fileSize,
      completed_at: new Date().toISOString()
    });

    // スケジュール更新
    const nextRunAt = calculateNextRunAt(schedule.schedule_type);
    await db('scheduled_reports').where('id', schedule.id).update({
      last_run_at: new Date().toISOString(),
      next_run_at: nextRunAt.toISOString()
    });

    // メール送信
    if (schedule.send_email && schedule.recipients) {
      const recipients = JSON.parse(schedule.recipients);
      if (recipients.length > 0) {
        await sendReportEmail(recipients, schedule, result);
      }
    }

    logger.info(`[Scheduler] Report generated successfully: ${result.fileName}`);
    return { success: true, historyId, result };
  } catch (error) {
    logger.error(`[Scheduler] Report generation failed:`, error);

    // 履歴更新（失敗）
    await db('report_history').where('history_id', historyId).update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString()
    });

    return { success: false, historyId, error: error.message };
  }
}

/**
 * スケジュールレポートジョブを登録
 * @param {Object} db - Knexデータベース接続
 * @param {Object} schedule - スケジュール設定
 */
function registerScheduledReportJob(db, schedule) {
  const cronExpression = schedule.cron_expression || getCronExpression(schedule.schedule_type);

  if (!cron.validate(cronExpression)) {
    logger.error(`[Scheduler] Invalid cron expression for ${schedule.name}: ${cronExpression}`);
    return;
  }

  // 既存のジョブがあれば停止
  if (customReportJobs[schedule.id]) {
    customReportJobs[schedule.id].stop();
  }

  customReportJobs[schedule.id] = cron.schedule(
    cronExpression,
    async () => {
      await executeScheduledReport(db, schedule);
    },
    { timezone: process.env.TZ || 'Asia/Tokyo' }
  );

  logger.info(`[Scheduler] Registered report job: ${schedule.name} (${cronExpression})`);
}

/**
 * スケジュールレポートジョブを解除
 * @param {number} scheduleId - スケジュールID
 */
function unregisterScheduledReportJob(scheduleId) {
  if (customReportJobs[scheduleId]) {
    customReportJobs[scheduleId].stop();
    delete customReportJobs[scheduleId];
    logger.info(`[Scheduler] Unregistered report job: ${scheduleId}`);
  }
}

/**
 * 全てのアクティブなスケジュールレポートを読み込み
 * @param {Object} db - Knexデータベース接続
 */
async function loadScheduledReports(db) {
  try {
    const schedules = await db('scheduled_reports').where('is_active', true).select('*');

    schedules.forEach((schedule) => {
      registerScheduledReportJob(db, schedule);
    });

    logger.info(`[Scheduler] Loaded ${schedules.length} scheduled reports`);
  } catch (error) {
    logger.error('[Scheduler] Failed to load scheduled reports:', error);
  }
}

/**
 * スケジュールレポートを作成
 * @param {Object} db - Knexデータベース接続
 * @param {Object} data - スケジュール設定データ
 * @returns {Promise<Object>} 作成されたスケジュール
 */
async function createScheduledReport(db, data) {
  const reportId = `SCH-${Date.now()}`;
  const cronExpression = data.cron_expression || getCronExpression(data.schedule_type);
  const nextRunAt = calculateNextRunAt(data.schedule_type);

  const [id] = await db('scheduled_reports').insert({
    report_id: reportId,
    name: data.name,
    report_type: data.report_type,
    schedule_type: data.schedule_type,
    cron_expression: cronExpression,
    format: data.format || 'pdf',
    recipients: JSON.stringify(data.recipients || []),
    filters: data.filters ? JSON.stringify(data.filters) : null,
    is_active: data.is_active !== false,
    send_email: data.send_email !== false,
    created_by: data.created_by,
    next_run_at: nextRunAt.toISOString()
  });

  const schedule = await db('scheduled_reports').where('id', id).first();

  // ジョブを登録
  if (schedule.is_active) {
    registerScheduledReportJob(db, schedule);
  }

  return schedule;
}

/**
 * スケジュールレポートを更新
 * @param {Object} db - Knexデータベース接続
 * @param {number} id - スケジュールID
 * @param {Object} data - 更新データ
 * @returns {Promise<Object>} 更新されたスケジュール
 */
async function updateScheduledReport(db, id, data) {
  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (data.name) updateData.name = data.name;
  if (data.report_type) updateData.report_type = data.report_type;
  if (data.schedule_type) {
    updateData.schedule_type = data.schedule_type;
    updateData.cron_expression = data.cron_expression || getCronExpression(data.schedule_type);
    updateData.next_run_at = calculateNextRunAt(data.schedule_type).toISOString();
  }
  if (data.format) updateData.format = data.format;
  if (data.recipients !== undefined) {
    updateData.recipients = JSON.stringify(data.recipients);
  }
  if (data.filters !== undefined) {
    updateData.filters = data.filters ? JSON.stringify(data.filters) : null;
  }
  if (data.is_active !== undefined) updateData.is_active = data.is_active;
  if (data.send_email !== undefined) updateData.send_email = data.send_email;

  await db('scheduled_reports').where('id', id).update(updateData);

  const schedule = await db('scheduled_reports').where('id', id).first();

  // ジョブを再登録
  unregisterScheduledReportJob(id);
  if (schedule.is_active) {
    registerScheduledReportJob(db, schedule);
  }

  return schedule;
}

/**
 * スケジュールレポートを削除
 * @param {Object} db - Knexデータベース接続
 * @param {number} id - スケジュールID
 */
async function deleteScheduledReport(db, id) {
  unregisterScheduledReportJob(id);
  await db('scheduled_reports').where('id', id).delete();
}

/**
 * レポート履歴を取得
 * @param {Object} db - Knexデータベース接続
 * @param {Object} options - オプション
 * @returns {Promise<Array>} 履歴一覧
 */
async function getReportHistory(db, options = {}) {
  let query = db('report_history')
    .select('report_history.*', 'scheduled_reports.name as schedule_name')
    .leftJoin('scheduled_reports', 'report_history.scheduled_report_id', 'scheduled_reports.id')
    .orderBy('report_history.created_at', 'desc');

  if (options.reportType) {
    query = query.where('report_history.report_type', options.reportType);
  }
  if (options.status) {
    query = query.where('report_history.status', options.status);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  return query;
}

module.exports = {
  initializeScheduler,
  stopScheduler,
  triggerReportNow,
  generateSlaReportData,
  // スケジュールレポート関連
  loadScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  executeScheduledReport,
  registerScheduledReportJob,
  unregisterScheduledReportJob,
  getReportHistory,
  getCronExpression,
  calculateNextRunAt,
  cleanupOldReports
};
