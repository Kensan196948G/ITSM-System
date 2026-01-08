/**
 * PDF Report Service
 * PDFKitを使用したレポート生成機能
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// レポート出力ディレクトリ
const REPORTS_DIR = path.join(__dirname, '../../data/reports');

// 日本語フォントがない場合のフォールバック
const DEFAULT_FONT = 'Helvetica';

/**
 * レポート出力ディレクトリを確保
 */
function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

/**
 * 日付をフォーマット
 * @param {Date|string} date - 日付
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * 日時をフォーマット
 * @param {Date|string} date - 日時
 * @returns {string} フォーマットされた日時文字列
 */
function formatDateTime(date) {
  const d = new Date(date);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * PDFドキュメントのヘッダーを描画
 * @param {PDFDocument} doc - PDFドキュメント
 * @param {string} title - レポートタイトル
 * @param {Object} options - オプション
 */
function drawHeader(doc, title, options = {}) {
  const { subtitle, dateRange } = options;

  // ヘッダー背景
  doc.rect(0, 0, doc.page.width, 80).fill('#4f46e5');

  // タイトル
  doc.fillColor('#ffffff').fontSize(22).font(`${DEFAULT_FONT}-Bold`).text(title, 50, 25);

  // サブタイトル
  if (subtitle) {
    doc.fontSize(12).font(DEFAULT_FONT).text(subtitle, 50, 52);
  }

  // 日付範囲
  if (dateRange) {
    doc.fontSize(10).text(`Period: ${dateRange.from} - ${dateRange.to}`, doc.page.width - 200, 30, {
      align: 'right',
      width: 150
    });
  }

  // 生成日時
  doc.text(`Generated: ${formatDateTime(new Date())}`, doc.page.width - 200, 45, {
    align: 'right',
    width: 150
  });

  doc.fillColor('#000000');
  doc.y = 100;
}

/**
 * セクションヘッダーを描画
 * @param {PDFDocument} doc - PDFドキュメント
 * @param {string} title - セクションタイトル
 */
function drawSectionHeader(doc, title) {
  doc.moveDown(0.5);
  doc.rect(50, doc.y, doc.page.width - 100, 25).fill('#f1f5f9');
  doc
    .fillColor('#1e293b')
    .fontSize(14)
    .font(`${DEFAULT_FONT}-Bold`)
    .text(title, 60, doc.y + 6);
  doc.fillColor('#000000').font(DEFAULT_FONT);
  doc.y += 35;
}

/**
 * テーブルを描画
 * @param {PDFDocument} doc - PDFドキュメント
 * @param {Array<string>} headers - ヘッダー配列
 * @param {Array<Array>} rows - データ行配列
 * @param {Object} options - オプション
 */
function drawTable(doc, headers, rows, options = {}) {
  const { columnWidths, startX = 50 } = options;
  const tableWidth = doc.page.width - 100;
  const defaultColWidth = tableWidth / headers.length;

  // 列幅を計算
  const widths = columnWidths || headers.map(() => defaultColWidth);

  // ヘッダー行
  doc.rect(startX, doc.y, tableWidth, 22).fill('#e2e8f0');
  doc.fillColor('#1e293b').fontSize(10).font(`${DEFAULT_FONT}-Bold`);

  let x = startX + 5;
  headers.forEach((header, i) => {
    doc.text(header, x, doc.y + 6, { width: widths[i] - 10, ellipsis: true });
    x += widths[i];
  });

  doc.fillColor('#000000').font(DEFAULT_FONT);
  doc.y += 22;

  // データ行
  rows.forEach((row, rowIndex) => {
    // ページ境界チェック
    if (doc.y > doc.page.height - 80) {
      doc.addPage();
      doc.y = 50;
    }

    const rowHeight = 20;
    const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
    doc.rect(startX, doc.y, tableWidth, rowHeight).fill(bgColor);
    doc.fillColor('#374151').fontSize(9);

    x = startX + 5;
    row.forEach((cell, i) => {
      const cellValue = cell !== null && cell !== undefined ? String(cell) : '';
      doc.text(cellValue, x, doc.y + 5, { width: widths[i] - 10, ellipsis: true });
      x += widths[i];
    });

    doc.y += rowHeight;
  });

  doc.fillColor('#000000');
  doc.moveDown(0.5);
}

/**
 * サマリーボックスを描画
 * @param {PDFDocument} doc - PDFドキュメント
 * @param {Array<Object>} items - サマリー項目 [{label, value, color}]
 */
function drawSummaryBoxes(doc, items) {
  const boxWidth = (doc.page.width - 100 - 30) / 4;
  const boxHeight = 60;
  const startX = 50;

  items.slice(0, 4).forEach((item, i) => {
    const x = startX + i * (boxWidth + 10);
    const bgColor = item.bgColor || '#f8fafc';

    doc.rect(x, doc.y, boxWidth, boxHeight).fill(bgColor);

    // 値
    doc
      .fillColor(item.color || '#1e293b')
      .fontSize(24)
      .font(`${DEFAULT_FONT}-Bold`)
      .text(String(item.value), x + 10, doc.y + 10, {
        width: boxWidth - 20,
        align: 'center'
      });

    // ラベル
    doc
      .fillColor('#64748b')
      .fontSize(10)
      .font(DEFAULT_FONT)
      .text(item.label, x + 10, doc.y + 40, {
        width: boxWidth - 20,
        align: 'center'
      });
  });

  doc.fillColor('#000000').font(DEFAULT_FONT);
  doc.y += boxHeight + 15;
}

/**
 * フッターを描画
 * @param {PDFDocument} doc - PDFドキュメント
 */
function drawFooter(doc) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i += 1) {
    doc.switchToPage(i);
    doc
      .fillColor('#94a3b8')
      .fontSize(8)
      .text(`ITSM-Sec Nexus | Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 30, {
        align: 'center',
        width: doc.page.width - 100
      });
  }
}

/**
 * インシデントサマリーレポートを生成
 * @param {Object} db - Knexデータベース接続
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 生成結果
 */
async function generateIncidentSummaryReport(db, options = {}) {
  const { fromDate, toDate } = options;
  ensureReportsDir();

  const reportId = `RPT-INC-${Date.now()}`;
  const fileName = `incident_summary_${formatDate(new Date())}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  // データ取得
  let query = db('incidents').select('*').orderBy('created_at', 'desc');

  if (fromDate) {
    query = query.where('created_at', '>=', fromDate);
  }
  if (toDate) {
    query = query.where('created_at', '<=', toDate);
  }

  const incidents = await query;

  // 統計計算
  const stats = {
    total: incidents.length,
    open: incidents.filter((i) => !['Resolved', 'Closed'].includes(i.status)).length,
    security: incidents.filter((i) => i.is_security_incident).length,
    critical: incidents.filter((i) => i.priority === 'Critical').length
  };

  // ステータス別集計
  const byStatus = {};
  incidents.forEach((inc) => {
    const status = inc.status || 'Unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  // 優先度別集計
  const byPriority = {};
  incidents.forEach((inc) => {
    const priority = inc.priority || 'Unknown';
    byPriority[priority] = (byPriority[priority] || 0) + 1;
  });

  // PDF生成
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // ヘッダー
  drawHeader(doc, 'Incident Summary Report', {
    subtitle: 'ITSM-Sec Nexus',
    dateRange: fromDate && toDate ? { from: fromDate, to: toDate } : null
  });

  // サマリー
  drawSectionHeader(doc, 'Summary');
  drawSummaryBoxes(doc, [
    { label: 'Total Incidents', value: stats.total, color: '#1e293b' },
    { label: 'Open', value: stats.open, color: '#f59e0b', bgColor: '#fef3c7' },
    { label: 'Security', value: stats.security, color: '#dc2626', bgColor: '#fee2e2' },
    { label: 'Critical', value: stats.critical, color: '#7c3aed', bgColor: '#ede9fe' }
  ]);

  // ステータス別
  drawSectionHeader(doc, 'By Status');
  const statusRows = Object.entries(byStatus).map(([status, count]) => [
    status,
    count,
    `${Math.round((count / stats.total) * 100)}%`
  ]);
  drawTable(doc, ['Status', 'Count', 'Percentage'], statusRows, {
    columnWidths: [200, 100, 100]
  });

  // 優先度別
  drawSectionHeader(doc, 'By Priority');
  const priorityRows = Object.entries(byPriority).map(([priority, count]) => [
    priority,
    count,
    `${Math.round((count / stats.total) * 100)}%`
  ]);
  drawTable(doc, ['Priority', 'Count', 'Percentage'], priorityRows, {
    columnWidths: [200, 100, 100]
  });

  // 最近のインシデント一覧
  if (incidents.length > 0) {
    doc.addPage();
    drawSectionHeader(doc, 'Recent Incidents');
    const incidentRows = incidents
      .slice(0, 20)
      .map((inc) => [
        inc.ticket_id,
        (inc.title || '').substring(0, 40),
        inc.status,
        inc.priority,
        inc.is_security_incident ? 'Yes' : 'No',
        formatDate(inc.created_at)
      ]);
    drawTable(
      doc,
      ['Ticket ID', 'Title', 'Status', 'Priority', 'Security', 'Created'],
      incidentRows,
      {
        columnWidths: [70, 150, 70, 60, 50, 80]
      }
    );
  }

  // フッター
  drawFooter(doc);
  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const fileStats = fs.statSync(filePath);
      resolve({
        reportId,
        fileName,
        filePath,
        fileSize: fileStats.size,
        stats
      });
    });
    writeStream.on('error', reject);
  });
}

/**
 * SLAコンプライアンスレポートを生成
 * @param {Object} db - Knexデータベース接続
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 生成結果
 */
async function generateSlaComplianceReport(db, options = {}) {
  const { fromDate, toDate } = options;
  ensureReportsDir();

  const reportId = `RPT-SLA-${Date.now()}`;
  const fileName = `sla_compliance_${formatDate(new Date())}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  // データ取得
  let query = db('sla_agreements').select('*').orderBy('created_at', 'desc');

  if (fromDate) {
    query = query.where('created_at', '>=', fromDate);
  }
  if (toDate) {
    query = query.where('created_at', '<=', toDate);
  }

  const slaAgreements = await query;

  // 統計計算
  const stats = {
    total: slaAgreements.length,
    met: slaAgreements.filter((s) => s.status === 'Met').length,
    atRisk: slaAgreements.filter((s) => s.status === 'At-Risk').length,
    violated: slaAgreements.filter((s) => ['Violated', 'Breached'].includes(s.status)).length
  };

  stats.complianceRate = stats.total > 0 ? Math.round((stats.met / stats.total) * 100) : 0;

  // サービス別集計
  const byService = {};
  slaAgreements.forEach((sla) => {
    const service = sla.service_name || 'Unknown';
    if (!byService[service]) {
      byService[service] = { count: 0, met: 0, totalRate: 0 };
    }
    byService[service].count += 1;
    if (sla.status === 'Met') {
      byService[service].met += 1;
    }
    byService[service].totalRate += sla.achievement_rate || 0;
  });

  // PDF生成
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // ヘッダー
  drawHeader(doc, 'SLA Compliance Report', {
    subtitle: 'Service Level Agreement Analysis',
    dateRange: fromDate && toDate ? { from: fromDate, to: toDate } : null
  });

  // サマリー
  drawSectionHeader(doc, 'Compliance Summary');
  drawSummaryBoxes(doc, [
    { label: 'Total SLAs', value: stats.total, color: '#1e293b' },
    { label: 'Met', value: stats.met, color: '#16a34a', bgColor: '#dcfce7' },
    { label: 'At Risk', value: stats.atRisk, color: '#f59e0b', bgColor: '#fef3c7' },
    { label: 'Violated', value: stats.violated, color: '#dc2626', bgColor: '#fee2e2' }
  ]);

  // 全体達成率
  doc.moveDown(0.5);
  let rateColor = '#dc2626';
  if (stats.complianceRate >= 90) {
    rateColor = '#16a34a';
  } else if (stats.complianceRate >= 70) {
    rateColor = '#f59e0b';
  }
  doc
    .fontSize(12)
    .text('Overall Compliance Rate: ', 50, doc.y, { continued: true })
    .fillColor(rateColor)
    .font(`${DEFAULT_FONT}-Bold`)
    .text(`${stats.complianceRate}%`)
    .fillColor('#000000')
    .font(DEFAULT_FONT);
  doc.moveDown();

  // サービス別
  drawSectionHeader(doc, 'By Service');
  const serviceRows = Object.entries(byService).map(([service, data]) => {
    const avgRate = data.count > 0 ? Math.round(data.totalRate / data.count) : 0;
    const compliance = data.count > 0 ? Math.round((data.met / data.count) * 100) : 0;
    return [service, data.count, data.met, `${avgRate}%`, `${compliance}%`];
  });
  drawTable(doc, ['Service', 'Total', 'Met', 'Avg Rate', 'Compliance'], serviceRows, {
    columnWidths: [150, 60, 60, 80, 80]
  });

  // SLA詳細一覧
  if (slaAgreements.length > 0) {
    doc.addPage();
    drawSectionHeader(doc, 'SLA Details');
    const slaRows = slaAgreements
      .slice(0, 25)
      .map((sla) => [
        sla.sla_id,
        (sla.service_name || '').substring(0, 25),
        (sla.metric_name || '').substring(0, 20),
        sla.target_value,
        sla.actual_value,
        `${sla.achievement_rate || 0}%`,
        sla.status
      ]);
    drawTable(doc, ['SLA ID', 'Service', 'Metric', 'Target', 'Actual', 'Rate', 'Status'], slaRows, {
      columnWidths: [65, 90, 75, 60, 60, 45, 55]
    });
  }

  // 違反アラート
  const violations = slaAgreements.filter(
    (s) => ['Violated', 'Breached'].includes(s.status) || (s.achievement_rate || 0) < 80
  );
  if (violations.length > 0) {
    drawSectionHeader(doc, 'Critical Violations');
    const violationRows = violations.map((v) => [
      v.sla_id,
      v.service_name,
      v.metric_name,
      `${v.achievement_rate || 0}%`,
      v.status
    ]);
    drawTable(doc, ['SLA ID', 'Service', 'Metric', 'Rate', 'Status'], violationRows, {
      columnWidths: [80, 120, 120, 60, 70]
    });
  }

  // フッター
  drawFooter(doc);
  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const fileStats = fs.statSync(filePath);
      resolve({
        reportId,
        fileName,
        filePath,
        fileSize: fileStats.size,
        stats
      });
    });
    writeStream.on('error', reject);
  });
}

/**
 * セキュリティ概要レポートを生成
 * @param {Object} db - Knexデータベース接続
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 生成結果
 */
async function generateSecurityOverviewReport(db, options = {}) {
  const { fromDate, toDate } = options;
  ensureReportsDir();

  const reportId = `RPT-SEC-${Date.now()}`;
  const fileName = `security_overview_${formatDate(new Date())}.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);

  // 脆弱性データ取得
  let vulnQuery = db('vulnerabilities').select('*').orderBy('cvss_score', 'desc');
  if (fromDate) {
    vulnQuery = vulnQuery.where('created_at', '>=', fromDate);
  }
  if (toDate) {
    vulnQuery = vulnQuery.where('created_at', '<=', toDate);
  }
  const vulnerabilities = await vulnQuery;

  // セキュリティインシデント
  let incQuery = db('incidents').where('is_security_incident', true).orderBy('created_at', 'desc');
  if (fromDate) {
    incQuery = incQuery.where('created_at', '>=', fromDate);
  }
  if (toDate) {
    incQuery = incQuery.where('created_at', '<=', toDate);
  }
  const securityIncidents = await incQuery;

  // コンプライアンス
  const compliance = await db('compliance').select('*');

  // 統計計算
  const vulnStats = {
    total: vulnerabilities.length,
    critical: vulnerabilities.filter((v) => v.severity === 'Critical').length,
    high: vulnerabilities.filter((v) => v.severity === 'High').length,
    medium: vulnerabilities.filter((v) => v.severity === 'Medium').length,
    low: vulnerabilities.filter((v) => v.severity === 'Low').length,
    open: vulnerabilities.filter((v) => !['Mitigated', 'Resolved'].includes(v.status)).length
  };

  const incStats = {
    total: securityIncidents.length,
    open: securityIncidents.filter((i) => !['Resolved', 'Closed'].includes(i.status)).length
  };

  // PDF生成
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // ヘッダー
  drawHeader(doc, 'Security Overview Report', {
    subtitle: 'NIST CSF 2.0 Compliance & Vulnerability Assessment',
    dateRange: fromDate && toDate ? { from: fromDate, to: toDate } : null
  });

  // 脆弱性サマリー
  drawSectionHeader(doc, 'Vulnerability Summary');
  drawSummaryBoxes(doc, [
    { label: 'Total', value: vulnStats.total, color: '#1e293b' },
    { label: 'Critical', value: vulnStats.critical, color: '#dc2626', bgColor: '#fee2e2' },
    { label: 'High', value: vulnStats.high, color: '#f59e0b', bgColor: '#fef3c7' },
    { label: 'Open', value: vulnStats.open, color: '#7c3aed', bgColor: '#ede9fe' }
  ]);

  // 深刻度別
  drawSectionHeader(doc, 'Vulnerabilities by Severity');
  const calcPercent = (count) =>
    vulnStats.total > 0 ? `${Math.round((count / vulnStats.total) * 100)}%` : '0%';
  const severityRows = [
    ['Critical', vulnStats.critical, calcPercent(vulnStats.critical)],
    ['High', vulnStats.high, calcPercent(vulnStats.high)],
    ['Medium', vulnStats.medium, calcPercent(vulnStats.medium)],
    ['Low', vulnStats.low, calcPercent(vulnStats.low)]
  ];
  drawTable(doc, ['Severity', 'Count', 'Percentage'], severityRows, {
    columnWidths: [150, 100, 100]
  });

  // セキュリティインシデント
  drawSectionHeader(doc, 'Security Incidents');
  doc
    .fontSize(11)
    .text(`Total Security Incidents: ${incStats.total}`)
    .text(`Open Incidents: ${incStats.open}`)
    .moveDown();

  // NIST CSF コンプライアンス
  if (compliance.length > 0) {
    drawSectionHeader(doc, 'NIST CSF 2.0 Compliance');
    const getComplianceStatus = (progress) => {
      if (progress >= 80) return 'Good';
      if (progress >= 60) return 'Moderate';
      return 'Needs Attention';
    };
    const complianceRows = compliance.map((c) => [
      c.function,
      `${c.progress}%`,
      `Tier ${c.target_tier}`,
      getComplianceStatus(c.progress)
    ]);
    drawTable(doc, ['Function', 'Progress', 'Target Tier', 'Status'], complianceRows, {
      columnWidths: [100, 80, 100, 120]
    });
  }

  // 脆弱性詳細（Critical/High）
  const criticalVulns = vulnerabilities.filter((v) => ['Critical', 'High'].includes(v.severity));
  if (criticalVulns.length > 0) {
    doc.addPage();
    drawSectionHeader(doc, 'Critical & High Vulnerabilities');
    const vulnRows = criticalVulns
      .slice(0, 20)
      .map((v) => [
        v.vulnerability_id,
        (v.title || '').substring(0, 30),
        v.severity,
        v.cvss_score || '-',
        v.affected_asset || '-',
        v.status
      ]);
    drawTable(doc, ['ID', 'Title', 'Severity', 'CVSS', 'Asset', 'Status'], vulnRows, {
      columnWidths: [75, 130, 60, 45, 80, 70]
    });
  }

  // フッター
  drawFooter(doc);
  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const fileStats = fs.statSync(filePath);
      resolve({
        reportId,
        fileName,
        filePath,
        fileSize: fileStats.size,
        stats: { vulnerabilities: vulnStats, incidents: incStats }
      });
    });
    writeStream.on('error', reject);
  });
}

/**
 * レポートタイプに応じたレポートを生成
 * @param {Object} db - Knexデータベース接続
 * @param {string} reportType - レポートタイプ
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 生成結果
 */
async function generateReport(db, reportType, options = {}) {
  switch (reportType) {
    case 'incident_summary':
      return generateIncidentSummaryReport(db, options);
    case 'sla_compliance':
      return generateSlaComplianceReport(db, options);
    case 'security_overview':
      return generateSecurityOverviewReport(db, options);
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

/**
 * サポートされているレポートタイプを取得
 * @returns {Array<Object>} レポートタイプ一覧
 */
function getSupportedReportTypes() {
  return [
    {
      type: 'incident_summary',
      name: 'Incident Summary Report',
      description: 'Comprehensive summary of incidents with statistics and trends'
    },
    {
      type: 'sla_compliance',
      name: 'SLA Compliance Report',
      description: 'Service Level Agreement compliance analysis and violations'
    },
    {
      type: 'security_overview',
      name: 'Security Overview Report',
      description: 'Security posture including vulnerabilities and NIST CSF compliance'
    }
  ];
}

/**
 * 古いレポートファイルを削除
 * @param {number} daysToKeep - 保持日数
 * @returns {number} 削除したファイル数
 */
function cleanupOldReports(daysToKeep = 30) {
  ensureReportsDir();

  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  const files = fs.readdirSync(REPORTS_DIR);
  files.forEach((file) => {
    const filePath = path.join(REPORTS_DIR, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
      deletedCount += 1;
    }
  });

  console.log(`[PDFReportService] Cleaned up ${deletedCount} old report files`);
  return deletedCount;
}

module.exports = {
  generateReport,
  generateIncidentSummaryReport,
  generateSlaComplianceReport,
  generateSecurityOverviewReport,
  getSupportedReportTypes,
  cleanupOldReports,
  REPORTS_DIR
};
