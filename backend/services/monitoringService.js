/**
 * Monitoring Service
 * メトリクス収集・履歴保存サービス
 * Phase 9.2: 監視・ヘルスチェック強化
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { register } = require('../middleware/metrics');

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
 * CPU使用率の閾値ステータスを取得
 * @param {number} percent - CPU使用率
 * @returns {string} 'normal' | 'warning' | 'critical'
 */
function getCpuThresholdStatus(percent) {
  if (percent > 90) return 'critical';
  if (percent > 80) return 'warning';
  return 'normal';
}

/**
 * メモリ使用率の閾値ステータスを取得
 * @param {number} percent - メモリ使用率
 * @returns {string} 'normal' | 'warning' | 'critical'
 */
function getMemoryThresholdStatus(percent) {
  if (percent > 90) return 'critical';
  if (percent > 80) return 'warning';
  return 'normal';
}

/**
 * ディスク使用率の閾値ステータスを取得
 * @param {number} percent - ディスク使用率
 * @returns {string} 'normal' | 'warning' | 'critical'
 */
function getDiskThresholdStatus(percent) {
  if (percent > 90) return 'critical';
  if (percent > 80) return 'warning';
  return 'normal';
}

/**
 * Prometheusメトリクスをパース
 * @param {string} metricsText - Prometheusメトリクステキスト
 * @returns {Object} パース済みメトリクス
 */
function parsePrometheusMetrics(metricsText) {
  const parsed = {};
  const lines = metricsText.split('\n');

  lines.forEach((line) => {
    // コメント行やTYPE/HELP行をスキップ
    if (line.startsWith('#') || !line.trim()) {
      return;
    }

    // メトリクス名と値を抽出
    const match = line.match(/^([a-z_]+)(?:\{([^}]*)\})?\s+([\d.eE+-]+)/);
    if (match) {
      const [, metricName, labels, value] = match;
      parsed[metricName] = parseFloat(value);

      // ラベル付きメトリクスも保存
      if (labels) {
        const labelObj = {};
        labels.split(',').forEach((pair) => {
          const [key, val] = pair.split('=');
          if (key && val) {
            labelObj[key.trim()] = val.replace(/"/g, '').trim();
          }
        });
        parsed[`${metricName}_labels`] = labelObj;
      }
    }
  });

  return parsed;
}

/**
 * CPU使用率を計算
 * @returns {number} CPU使用率(%)
 */
function calculateCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    Object.keys(cpu.times).forEach((type) => {
      totalTick += cpu.times[type];
    });
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - (100 * idle) / total;

  return parseFloat(usage.toFixed(2));
}

/**
 * ディスク使用率を取得
 * @returns {Object} ディスク情報
 */
function getDiskStats() {
  try {
    const dbPath = process.env.DATABASE_PATH || './backend/itsm_nexus.db';
    const dbDir = path.dirname(path.resolve(dbPath));
    const stats = fs.statfsSync(dbDir);

    const totalGb = (stats.blocks * stats.bsize) / 1024 / 1024 / 1024;
    const freeGb = (stats.bavail * stats.bsize) / 1024 / 1024 / 1024;
    const usedGb = totalGb - freeGb;
    const usagePercent = (usedGb / totalGb) * 100;

    return {
      totalGb: parseFloat(totalGb.toFixed(2)),
      usedGb: parseFloat(usedGb.toFixed(2)),
      freeGb: parseFloat(freeGb.toFixed(2)),
      usagePercent: parseFloat(usagePercent.toFixed(2))
    };
  } catch (error) {
    console.error('[MonitoringService] Error getting disk stats:', error);
    return {
      totalGb: 0,
      usedGb: 0,
      freeGb: 0,
      usagePercent: 0
    };
  }
}

/**
 * アップタイムをフォーマット
 * @param {number} seconds - 秒数
 * @returns {string} フォーマット済み文字列
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const remainingAfterDays = seconds % 86400;
  const hours = Math.floor(remainingAfterDays / 3600);
  const remainingAfterHours = seconds % 3600;
  const minutes = Math.floor(remainingAfterHours / 60);
  const secs = Math.floor(seconds % 60);

  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

/**
 * システムメトリクスを取得
 * @returns {Promise<Object>} システムメトリクス
 */
async function getSystemMetrics() {
  const metricsText = await register.metrics();
  const parsed = parsePrometheusMetrics(metricsText);

  // CPU使用率
  const cpuUsage = parsed.itsm_cpu_usage_percent || calculateCpuUsage();

  // メモリ使用率
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = (usedMem / totalMem) * 100;

  // ディスク使用率
  const diskStats = getDiskStats();

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      cpu: {
        usage_percent: cpuUsage,
        threshold_status: getCpuThresholdStatus(cpuUsage)
      },
      memory: {
        total_mb: Math.round(totalMem / 1024 / 1024),
        used_mb: Math.round(usedMem / 1024 / 1024),
        usage_percent: parseFloat(memUsagePercent.toFixed(2)),
        threshold_status: getMemoryThresholdStatus(memUsagePercent)
      },
      disk: {
        total_gb: diskStats.totalGb,
        used_gb: diskStats.usedGb,
        free_gb: diskStats.freeGb,
        usage_percent: diskStats.usagePercent,
        threshold_status: getDiskThresholdStatus(diskStats.usagePercent)
      },
      uptime: {
        seconds: os.uptime(),
        formatted: formatUptime(os.uptime())
      },
      active_users: {
        current: parsed.itsm_active_users_total || 0,
        trend: 'stable'
      },
      requests_per_minute: {
        current: parsed.itsm_http_requests_total || 0,
        trend: 'stable'
      }
    }
  };
}

/**
 * ビジネスメトリクスを取得
 * @returns {Promise<Object>} ビジネスメトリクス
 */
async function getBusinessMetrics() {
  if (!db) throw new Error('Database not initialized');

  // SLA達成率
  const [slaResult] = await db('sla_agreements').where('status', 'Met').count('* as count');
  const [totalSla] = await db('sla_agreements').count('* as count');
  const slaCompliance =
    totalSla.count > 0 ? parseFloat(((slaResult.count / totalSla.count) * 100).toFixed(2)) : 0;

  // オープンインシデント数(優先度別)
  const [incidentsHigh] = await db('incidents')
    .where('status', 'Open')
    .where('priority', 'High')
    .count('* as count');
  const [incidentsMedium] = await db('incidents')
    .where('status', 'Open')
    .where('priority', 'Medium')
    .count('* as count');
  const [incidentsLow] = await db('incidents')
    .where('status', 'Open')
    .where('priority', 'Low')
    .count('* as count');
  const [incidentsCritical] = await db('incidents')
    .where('status', 'Open')
    .where('priority', 'Critical')
    .count('* as count');

  const totalIncidents =
    incidentsHigh.count + incidentsMedium.count + incidentsLow.count + incidentsCritical.count;

  // セキュリティインシデント数
  const [securityIncidents] = await db('incidents')
    .where('is_security_incident', 1)
    .where('status', 'Open')
    .count('* as count');

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      sla_compliance: {
        current_rate: slaCompliance,
        history_24h: []
      },
      incidents_open: {
        total: totalIncidents,
        by_priority: {
          critical: incidentsCritical.count,
          high: incidentsHigh.count,
          medium: incidentsMedium.count,
          low: incidentsLow.count
        }
      },
      incidents_created_daily: {
        history_7d: []
      },
      security_incidents: {
        current: securityIncidents.count,
        trend: 'stable'
      },
      mttr_hours: {
        current: 0,
        trend: 'stable'
      }
    }
  };
}

/**
 * メトリクス履歴を取得
 * @param {string} metricName - メトリクス名
 * @param {string} startTime - 開始時刻
 * @param {string} endTime - 終了時刻
 * @returns {Promise<Array>} メトリクス履歴
 */
async function getMetricsHistory(metricName, startTime, endTime) {
  if (!db) throw new Error('Database not initialized');

  const query = db('metric_history').where('metric_name', metricName).orderBy('timestamp', 'desc');

  if (startTime) {
    query.where('timestamp', '>=', startTime);
  }
  if (endTime) {
    query.where('timestamp', '<=', endTime);
  }

  const rows = await query.limit(1000);

  return rows.map((row) => ({
    metric_name: row.metric_name,
    metric_value: row.metric_value,
    labels: row.labels ? JSON.parse(row.labels) : null,
    timestamp: row.timestamp
  }));
}

/**
 * メトリクススナップショットを保存
 * @returns {Promise<void>}
 */
async function saveMetricsSnapshot() {
  if (!db) throw new Error('Database not initialized');

  try {
    const metricsText = await register.metrics();
    const parsed = parsePrometheusMetrics(metricsText);
    const timestamp = new Date().toISOString();

    // 主要なメトリクスを保存
    const metricsToSave = [
      { name: 'itsm_cpu_usage_percent', value: calculateCpuUsage() },
      {
        name: 'itsm_memory_usage_percent',
        value: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },
      { name: 'itsm_disk_usage_percent', value: getDiskStats().usagePercent },
      { name: 'itsm_active_users_total', value: parsed.itsm_active_users_total || 0 },
      { name: 'itsm_http_requests_total', value: parsed.itsm_http_requests_total || 0 }
    ];

    // SLAメトリクス
    const [slaResult] = await db('sla_agreements').where('status', 'Met').count('* as count');
    const [totalSla] = await db('sla_agreements').count('* as count');
    const slaCompliance = totalSla.count > 0 ? (slaResult.count / totalSla.count) * 100 : 0;

    metricsToSave.push({
      name: 'itsm_sla_compliance_rate',
      value: slaCompliance,
      labels: { service_name: 'overall' }
    });

    // インシデントメトリクス（順序依存のため、ループ内でawaitを使用）
    const priorities = ['Critical', 'High', 'Medium', 'Low'];
    // eslint-disable-next-line no-restricted-syntax
    for (const priority of priorities) {
      // eslint-disable-next-line no-await-in-loop
      const [count] = await db('incidents')
        .where('status', 'Open')
        .where('priority', priority)
        .count('* as count');

      metricsToSave.push({
        name: 'itsm_incidents_open',
        value: count.count,
        labels: { priority: priority.toLowerCase() }
      });
    }

    // データベースに保存（順序依存のため、ループ内でawaitを使用）
    // eslint-disable-next-line no-restricted-syntax
    for (const metric of metricsToSave) {
      // eslint-disable-next-line no-await-in-loop
      await db('metric_history').insert({
        metric_name: metric.name,
        metric_value: metric.value,
        labels: metric.labels ? JSON.stringify(metric.labels) : null,
        timestamp
      });
    }

    console.log(`[MonitoringService] Saved ${metricsToSave.length} metrics to history`);
  } catch (error) {
    console.error('[MonitoringService] Error saving metrics snapshot:', error);
    throw error;
  }
}

/**
 * 古いメトリクスを削除
 * @param {number} retentionDays - 保存日数(デフォルト30日)
 * @returns {Promise<number>} 削除件数
 */
async function cleanOldMetrics(retentionDays = 30) {
  if (!db) throw new Error('Database not initialized');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const deleted = await db('metric_history')
    .where('timestamp', '<', cutoffDate.toISOString())
    .delete();

  console.log(
    `[MonitoringService] Deleted ${deleted} old metrics (older than ${retentionDays} days)`
  );
  return deleted;
}

/**
 * カスタムメトリクスを登録
 * @param {string} name - メトリクス名
 * @param {number} value - メトリクス値
 * @param {Object} labels - ラベル
 * @returns {Promise<number>} 挿入ID
 */
async function registerCustomMetric(name, value, labels = null) {
  if (!db) throw new Error('Database not initialized');

  // バリデーション
  if (!name || typeof value !== 'number') {
    throw new Error('Invalid metric name or value');
  }

  const [id] = await db('metric_history').insert({
    metric_name: name,
    metric_value: value,
    labels: labels ? JSON.stringify(labels) : null,
    timestamp: new Date().toISOString()
  });

  return id;
}

module.exports = {
  setDatabase,
  getSystemMetrics,
  getBusinessMetrics,
  getMetricsHistory,
  saveMetricsSnapshot,
  cleanOldMetrics,
  registerCustomMetric
};
