/**
 * Scheduler Service
 * 定期タスク実行サービス（node-cron使用）
 */

const cron = require('node-cron');
const { sendEmail } = require('./emailService');

// スケジュールされたジョブを保持
const scheduledJobs = {};

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
    console.log('[Scheduler] SLA_REPORT_EMAIL not configured, skipping report email');
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

    console.log(`[Scheduler] SLA ${reportType} report sent to ${recipientEmail}`);
  } catch (error) {
    console.error(`[Scheduler] Failed to send SLA ${reportType} report:`, error);
  }
}

/**
 * スケジューラを初期化
 * @param {Object} db - データベース接続
 */
function initializeScheduler(db) {
  const isEnabled = process.env.SCHEDULER_ENABLED !== 'false';

  if (!isEnabled) {
    console.log('[Scheduler] Scheduler is disabled');
    return;
  }

  console.log('[Scheduler] Initializing scheduled jobs...');

  // 週次SLAレポート（毎週月曜日 9:00）
  const weeklySchedule = process.env.SLA_WEEKLY_REPORT_CRON || '0 9 * * 1';
  if (cron.validate(weeklySchedule)) {
    scheduledJobs.weeklyReport = cron.schedule(
      weeklySchedule,
      async () => {
        console.log('[Scheduler] Running weekly SLA report job');
        await sendSlaReportEmail(db, 'weekly');
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    console.log(`[Scheduler] Weekly SLA report scheduled: ${weeklySchedule}`);
  }

  // 月次SLAレポート（毎月1日 9:00）
  const monthlySchedule = process.env.SLA_MONTHLY_REPORT_CRON || '0 9 1 * *';
  if (cron.validate(monthlySchedule)) {
    scheduledJobs.monthlyReport = cron.schedule(
      monthlySchedule,
      async () => {
        console.log('[Scheduler] Running monthly SLA report job');
        await sendSlaReportEmail(db, 'monthly');
      },
      { timezone: process.env.TZ || 'Asia/Tokyo' }
    );
    console.log(`[Scheduler] Monthly SLA report scheduled: ${monthlySchedule}`);
  }

  console.log('[Scheduler] Scheduler initialized successfully');
}

/**
 * スケジューラを停止
 */
function stopScheduler() {
  console.log('[Scheduler] Stopping scheduled jobs...');
  Object.values(scheduledJobs).forEach((job) => {
    if (job && typeof job.stop === 'function') {
      job.stop();
    }
  });
  console.log('[Scheduler] All scheduled jobs stopped');
}

/**
 * 手動でレポートを送信（テスト用/オンデマンド）
 * @param {Object} db - データベース接続
 * @param {string} reportType - レポートタイプ（weekly/monthly）
 * @returns {Promise<Object>} 実行結果
 */
async function triggerReportNow(db, reportType) {
  console.log(`[Scheduler] Manually triggering ${reportType} SLA report`);
  await sendSlaReportEmail(db, reportType);
  return { success: true, message: `${reportType} report sent` };
}

module.exports = {
  initializeScheduler,
  stopScheduler,
  triggerReportNow,
  generateSlaReportData
};
