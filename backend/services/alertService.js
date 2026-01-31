/**
 * Alert Service
 * アラートルール評価エンジン
 * Phase 9.2: 監視・ヘルスチェック強化
 */

const monitoringService = require('./monitoringService');

// データベース接続を外部から注入
let db = null;

/**
 * データベース接続を設定
 * @param {Object} database - Knexデータベース接続
 */
function setDatabase(database) {
  db = database;
  monitoringService.setDatabase(database);
}

/**
 * メトリクスの現在値を取得
 * @param {string} metricName - メトリクス名
 * @returns {Promise<number>} メトリクス値
 */
async function getCurrentMetricValue(metricName) {
  if (!db) throw new Error('Database not initialized');

  // システムメトリクスから取得を試みる
  const systemMetrics = await monitoringService.getSystemMetrics();
  const businessMetrics = await monitoringService.getBusinessMetrics();

  // CPU使用率
  if (metricName === 'itsm_cpu_usage_percent') {
    return systemMetrics.metrics.cpu.usage_percent;
  }

  // メモリ使用率
  if (metricName === 'itsm_memory_usage_percent') {
    return systemMetrics.metrics.memory.usage_percent;
  }

  // ディスク使用率
  if (metricName === 'itsm_disk_usage_percent') {
    return systemMetrics.metrics.disk.usage_percent;
  }

  // SLA達成率
  if (metricName === 'itsm_sla_compliance_rate') {
    return businessMetrics.metrics.sla_compliance.current_rate;
  }

  // アクティブユーザー数
  if (metricName === 'itsm_active_users_total') {
    return systemMetrics.metrics.active_users.current;
  }

  // オープンインシデント数
  if (metricName === 'itsm_incidents_open') {
    return businessMetrics.metrics.incidents_open.total;
  }

  // メトリクス履歴から最新値を取得
  const [latestMetric] = await db('metric_history')
    .where('metric_name', metricName)
    .orderBy('timestamp', 'desc')
    .limit(1);

  return latestMetric ? latestMetric.metric_value : 0;
}

/**
 * 条件を評価
 * @param {number} currentValue - 現在値
 * @param {string} condition - 条件演算子
 * @param {number} threshold - 閾値
 * @returns {boolean} 条件を満たすか
 */
function evaluateCondition(currentValue, condition, threshold) {
  switch (condition) {
    case '>':
      return currentValue > threshold;
    case '<':
      return currentValue < threshold;
    case '>=':
      return currentValue >= threshold;
    case '<=':
      return currentValue <= threshold;
    case '==':
      return currentValue === threshold;
    case '!=':
      return currentValue !== threshold;
    default:
      return false;
  }
}

/**
 * アラート通知を送信
 * @param {number} alertId - アラートID
 * @param {Object} channel - 通知チャネル
 * @param {Object} alertData - アラートデータ
 * @returns {Promise<void>}
 */
async function sendAlertNotification(alertId, channel, alertData) {
  if (!db) throw new Error('Database not initialized');

  // 遅延ロードでモジュールを読み込む
  // eslint-disable-next-line global-require
  const notificationServiceLocal = require('./notificationService');
  // eslint-disable-next-line global-require
  const emailServiceLocal = require('./emailService');

  const subject = `[${alertData.severity.toUpperCase()}] ${alertData.rule_name}`;
  const messageText = alertData.message;

  let status = 'sent';
  let errorMessage = null;

  try {
    const config = JSON.parse(channel.config);

    if (channel.channel_type === 'slack') {
      const payload = {
        text: subject,
        attachments: [
          {
            color: alertData.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'メトリクス', value: alertData.metric_name, short: true },
              { title: '現在値', value: String(alertData.current_value), short: true },
              { title: '閾値', value: String(alertData.threshold), short: true },
              { title: '重要度', value: alertData.severity, short: true }
            ],
            text: messageText
          }
        ]
      };

      const result = await notificationServiceLocal.sendSlackNotification(
        config.webhook_url,
        payload
      );
      if (!result.success) {
        status = 'failed';
        errorMessage = result.error;
      }
    } else if (channel.channel_type === 'webhook') {
      const result = await notificationServiceLocal.sendWebhookNotification(
        config.webhook_url,
        {
          alert_id: alertId,
          rule_name: alertData.rule_name,
          metric_name: alertData.metric_name,
          current_value: alertData.current_value,
          threshold: alertData.threshold,
          severity: alertData.severity,
          message: alertData.message,
          timestamp: new Date().toISOString()
        },
        config.custom_headers || {}
      );
      if (!result.success) {
        status = 'failed';
        errorMessage = result.error;
      }
    } else if (channel.channel_type === 'email') {
      const { sendEmail } = emailServiceLocal;
      await sendEmail({
        to: config.recipients.join(','),
        subject,
        text: messageText,
        html: `<h3>${subject}</h3><p>${messageText}</p>`
      });
    }
  } catch (error) {
    status = 'failed';
    errorMessage = error.message;
    console.error('[AlertService] Notification error:', error);
  }

  // 通知履歴を保存
  await db('alert_notification_history').insert({
    channel_id: channel.id,
    alert_id: alertId,
    subject,
    message: messageText,
    status,
    error_message: errorMessage,
    sent_at: new Date().toISOString()
  });
}

/**
 * アラートを発火
 * @param {Object} rule - アラートルール
 * @param {number} currentValue - 現在値
 * @returns {Promise<number>} アラートID
 */
async function fireAlert(rule, currentValue) {
  if (!db) throw new Error('Database not initialized');

  const message = `${rule.metric_name} が閾値を超えました: 現在値=${currentValue}, 閾値=${rule.threshold}`;

  const [alertId] = await db('alert_history').insert({
    rule_id: rule.id,
    rule_name: rule.rule_name,
    metric_name: rule.metric_name,
    current_value: currentValue,
    threshold: rule.threshold,
    severity: rule.severity,
    status: 'firing',
    message,
    created_at: new Date().toISOString()
  });

  console.log(`[AlertService] Alert fired: ${rule.rule_name} (ID: ${alertId})`);

  // 通知チャネルへの送信
  if (rule.notification_channels) {
    try {
      const channels = JSON.parse(rule.notification_channels);
      // 通知は順序依存のため、ループ内でawaitを使用
      // eslint-disable-next-line no-restricted-syntax
      for (const channelName of channels) {
        // eslint-disable-next-line no-await-in-loop
        const [channel] = await db('alert_notification_channels')
          .where('channel_name', channelName)
          .where('enabled', 1)
          .limit(1);

        if (channel) {
          // eslint-disable-next-line no-await-in-loop
          await sendAlertNotification(alertId, channel, {
            rule_name: rule.rule_name,
            metric_name: rule.metric_name,
            current_value: currentValue,
            threshold: rule.threshold,
            severity: rule.severity,
            message
          });
        }
      }
    } catch (error) {
      console.error('[AlertService] Error sending alert notifications:', error);
    }
  }

  return alertId;
}

/**
 * 単一ルールを評価
 * @param {Object} rule - アラートルール
 * @returns {Promise<Object>} 評価結果
 */
async function evaluateRule(rule) {
  if (!db) throw new Error('Database not initialized');

  try {
    const currentValue = await getCurrentMetricValue(rule.metric_name);
    const isFiring = evaluateCondition(currentValue, rule.condition, rule.threshold);

    return {
      ruleId: rule.id,
      ruleName: rule.rule_name,
      metricName: rule.metric_name,
      currentValue,
      threshold: rule.threshold,
      condition: rule.condition,
      severity: rule.severity,
      isFiring,
      evaluatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[AlertService] Error evaluating rule ${rule.rule_name}:`, error);
    return {
      ruleId: rule.id,
      ruleName: rule.rule_name,
      isFiring: false,
      error: error.message
    };
  }
}

/**
 * 全アラートルールを評価
 * @returns {Promise<Array>} 評価結果リスト
 */
async function evaluateAllRules() {
  if (!db) throw new Error('Database not initialized');

  const rules = await db('alert_rules').where('enabled', 1);

  const evaluations = [];
  // 順序依存のため、ループ内でawaitを使用
  // eslint-disable-next-line no-restricted-syntax
  for (const rule of rules) {
    // eslint-disable-next-line no-await-in-loop
    const evaluation = await evaluateRule(rule);
    evaluations.push(evaluation);

    // ルールが発火した場合
    if (evaluation.isFiring) {
      // 既存のアラートをチェック
      // eslint-disable-next-line no-await-in-loop
      const [existingAlert] = await db('alert_history')
        .where('rule_id', rule.id)
        .where('status', 'firing')
        .orderBy('created_at', 'desc')
        .limit(1);

      // 既に発火中のアラートがない場合は新規作成
      if (!existingAlert) {
        // eslint-disable-next-line no-await-in-loop
        await fireAlert(rule, evaluation.currentValue);
      }
    } else {
      // ルールが発火していない場合、既存のアラートを自動解決
      // eslint-disable-next-line no-await-in-loop
      await db('alert_history').where('rule_id', rule.id).where('status', 'firing').update({
        status: 'resolved',
        resolved_at: new Date().toISOString()
      });
    }
  }

  console.log(`[AlertService] Evaluated ${evaluations.length} rules`);
  return evaluations;
}

/**
 * アラートを確認
 * @param {number} alertId - アラートID
 * @param {number} userId - 確認ユーザーID
 * @returns {Promise<void>}
 */
async function acknowledgeAlert(alertId, userId) {
  if (!db) throw new Error('Database not initialized');

  await db('alert_history').where('id', alertId).update({
    status: 'acknowledged',
    acknowledged_by: userId,
    acknowledged_at: new Date().toISOString()
  });

  console.log(`[AlertService] Alert ${alertId} acknowledged by user ${userId}`);
}

/**
 * アラートを解決
 * @param {number} alertId - アラートID
 * @returns {Promise<void>}
 */
async function resolveAlert(alertId) {
  if (!db) throw new Error('Database not initialized');

  await db('alert_history').where('id', alertId).update({
    status: 'resolved',
    resolved_at: new Date().toISOString()
  });

  console.log(`[AlertService] Alert ${alertId} resolved`);
}

/**
 * アクティブなアラート一覧を取得
 * @returns {Promise<Array>} アクティブなアラート
 */
async function getActiveAlerts() {
  if (!db) throw new Error('Database not initialized');

  const alerts = await db('alert_history')
    .whereIn('status', ['firing', 'acknowledged'])
    .orderBy('created_at', 'desc');

  return alerts;
}

/**
 * アラート履歴を取得
 * @param {Object} filters - フィルタ条件
 * @param {Object} pagination - ページネーション
 * @returns {Promise<Object>} アラート履歴
 */
async function getAlertHistory(filters = {}, pagination = {}) {
  if (!db) throw new Error('Database not initialized');

  const { severity, status, startDate, endDate } = filters;
  const { limit = 50, offset = 0 } = pagination;

  let query = db('alert_history').orderBy('created_at', 'desc');

  if (severity) {
    query = query.where('severity', severity);
  }
  if (status) {
    query = query.where('status', status);
  }
  if (startDate) {
    query = query.where('created_at', '>=', startDate);
  }
  if (endDate) {
    query = query.where('created_at', '<=', endDate);
  }

  const totalQuery = query.clone();
  const [total] = await totalQuery.count('* as count');

  const alerts = await query.limit(limit).offset(offset);

  return {
    total: total.count,
    alerts
  };
}

module.exports = {
  setDatabase,
  evaluateAllRules,
  evaluateRule,
  fireAlert,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts,
  getAlertHistory
};
