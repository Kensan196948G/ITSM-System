/**
 * Notification Service
 * 通知機能（Email, Slack, Microsoft Teams）の統合サービス
 */

const axios = require('axios');
const { sendSlaViolationAlert } = require('./emailService');

// 通知チャネルの種類
const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  SLACK: 'slack',
  TEAMS: 'teams'
};

// 通知タイプ
const NOTIFICATION_TYPES = {
  INCIDENT_CREATED: 'incident_created',
  INCIDENT_UPDATED: 'incident_updated',
  INCIDENT_RESOLVED: 'incident_resolved',
  SLA_VIOLATION: 'sla_violation',
  SLA_AT_RISK: 'sla_at_risk',
  VULNERABILITY_DETECTED: 'vulnerability_detected',
  CHANGE_APPROVED: 'change_approved',
  CHANGE_REJECTED: 'change_rejected'
};

// 優先度の色マッピング（Slack/Teams用）
const PRIORITY_COLORS = {
  critical: '#FF0000',
  high: '#FF6600',
  medium: '#FFCC00',
  low: '#00CC00'
};

// ステータスの色マッピング
const STATUS_COLORS = {
  open: '#3498db',
  in_progress: '#f39c12',
  resolved: '#27ae60',
  closed: '#95a5a6',
  violated: '#e74c3c',
  at_risk: '#f39c12',
  met: '#27ae60'
};

/**
 * 優先度に対応する色を取得
 * @param {string} priority - 優先度文字列
 * @returns {string} 色コード
 */
function getPriorityColor(priority) {
  if (!priority) return '#CCCCCC';
  const normalizedPriority = priority.toLowerCase();
  return PRIORITY_COLORS[normalizedPriority] || '#CCCCCC';
}

/**
 * 日付を整形して文字列で返す
 * @param {Date|string} date - 日付オブジェクトまたは日付文字列
 * @returns {string} 整形された日付文字列
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Slack Webhookに通知を送信
 * @param {string} webhookUrl - Slack Webhook URL
 * @param {Object} payload - 通知ペイロード
 * @returns {Promise<Object>} 送信結果
 */
async function sendSlackNotification(webhookUrl, payload) {
  if (!webhookUrl) {
    console.warn('[NotificationService] Slack Webhook URL is not configured');
    return { success: false, error: 'Slack Webhook URL is not configured' };
  }

  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('[NotificationService] Slack notification sent successfully');
    return {
      success: true,
      statusCode: response.status
    };
  } catch (error) {
    console.error('[NotificationService] Slack notification error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Microsoft Teams Webhookに通知を送信（Adaptive Card形式）
 * @param {string} webhookUrl - Teams Webhook URL
 * @param {Object} card - Adaptive Card
 * @returns {Promise<Object>} 送信結果
 */
async function sendTeamsNotification(webhookUrl, card) {
  if (!webhookUrl) {
    console.warn('[NotificationService] Teams Webhook URL is not configured');
    return { success: false, error: 'Teams Webhook URL is not configured' };
  }

  try {
    const response = await axios.post(webhookUrl, card, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('[NotificationService] Teams notification sent successfully');
    return {
      success: true,
      statusCode: response.status
    };
  } catch (error) {
    console.error('[NotificationService] Teams notification error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * インシデント用のSlackメッセージを構築
 * @param {Object} incident - インシデント情報
 * @param {string} action - 'created' | 'updated' | 'resolved'
 * @returns {Object} Slack Block Kit ペイロード
 */
function buildSlackIncidentMessage(incident, action) {
  const actionText = {
    created: ':rotating_light: 新規インシデント作成',
    updated: ':pencil2: インシデント更新',
    resolved: ':white_check_mark: インシデント解決'
  };

  const color = PRIORITY_COLORS[incident.priority?.toLowerCase()] || '#808080';
  const systemUrl =
    process.env.SYSTEM_URL || `https://${process.env.SYSTEM_IP || 'localhost'}:5050`;

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: actionText[action] || 'インシデント通知',
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*チケットID:*\n${incident.ticket_id}`
              },
              {
                type: 'mrkdwn',
                text: `*優先度:*\n${incident.priority || 'N/A'}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*タイトル:*\n${incident.title || 'N/A'}`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*ステータス:*\n${incident.status || 'N/A'}`
              },
              {
                type: 'mrkdwn',
                text: `*セキュリティインシデント:*\n${incident.is_security_incident ? 'はい' : 'いいえ'}`
              }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '詳細を表示'
                },
                url: `${systemUrl}/#/incidents/${incident.id}`
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * SLA違反用のSlackメッセージを構築
 * @param {Object} sla - SLA情報
 * @returns {Object} Slack Block Kit ペイロード
 */
function buildSlackSlaViolationMessage(sla) {
  const color = sla.status === 'Violated' ? '#FF0000' : '#FF6600';
  const systemUrl =
    process.env.SYSTEM_URL || `https://${process.env.SYSTEM_IP || 'localhost'}:5050`;
  const emoji = sla.status === 'Violated' ? ':warning:' : ':clock3:';

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${emoji} SLA${sla.status === 'Violated' ? '違反' : 'リスク'}アラート`,
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*サービス名:*\n${sla.service_name}`
              },
              {
                type: 'mrkdwn',
                text: `*メトリクス:*\n${sla.metric_name}`
              }
            ]
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*目標値:*\n${sla.target_value}`
              },
              {
                type: 'mrkdwn',
                text: `*実績値:*\n${sla.actual_value}`
              }
            ]
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*達成率:*\n${sla.achievement_rate}%`
              },
              {
                type: 'mrkdwn',
                text: `*ステータス:*\n${sla.status}`
              }
            ]
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `早急な対応をお願いします。`
              }
            ]
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'SLAダッシュボードを開く'
                },
                url: `${systemUrl}/#/sla`
              }
            ]
          }
        ]
      }
    ]
  };
}

/**
 * インシデント用のTeams Adaptive Cardを構築
 * @param {Object} incident - インシデント情報
 * @param {string} action - 'created' | 'updated' | 'resolved'
 * @returns {Object} Adaptive Card
 */
function buildTeamsIncidentCard(incident, action) {
  const actionText = {
    created: '新規インシデント作成',
    updated: 'インシデント更新',
    resolved: 'インシデント解決'
  };

  // Adaptive Cardでは直接color属性は使用しないが、将来の拡張用にコメントとして残す
  // PRIORITY_COLORS[incident.priority?.toLowerCase()] || '#808080';
  const systemUrl =
    process.env.SYSTEM_URL || `https://${process.env.SYSTEM_IP || 'localhost'}:5050`;

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: 'emphasis',
              items: [
                {
                  type: 'TextBlock',
                  text: actionText[action] || 'インシデント通知',
                  weight: 'Bolder',
                  size: 'Large',
                  color: 'Attention'
                }
              ]
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'チケットID',
                  value: incident.ticket_id
                },
                {
                  title: 'タイトル',
                  value: incident.title || 'N/A'
                },
                {
                  title: '優先度',
                  value: incident.priority || 'N/A'
                },
                {
                  title: 'ステータス',
                  value: incident.status || 'N/A'
                },
                {
                  title: 'セキュリティインシデント',
                  value: incident.is_security_incident ? 'はい' : 'いいえ'
                }
              ]
            },
            {
              type: 'TextBlock',
              text: incident.description || '',
              wrap: true,
              maxLines: 3
            }
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: '詳細を表示',
              url: `${systemUrl}/#/incidents/${incident.id}`
            }
          ]
        }
      }
    ]
  };
}

/**
 * SLA違反用のTeams Adaptive Cardを構築
 * @param {Object} sla - SLA情報
 * @returns {Object} Adaptive Card
 */
function buildTeamsSlaViolationCard(sla) {
  const systemUrl =
    process.env.SYSTEM_URL || `https://${process.env.SYSTEM_IP || 'localhost'}:5050`;
  const isViolated = sla.status === 'Violated';

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: 'attention',
              items: [
                {
                  type: 'TextBlock',
                  text: `SLA${isViolated ? '違反' : 'リスク'}アラート`,
                  weight: 'Bolder',
                  size: 'Large',
                  color: isViolated ? 'Attention' : 'Warning'
                }
              ]
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'サービス名',
                  value: sla.service_name
                },
                {
                  title: 'メトリクス',
                  value: sla.metric_name
                },
                {
                  title: '目標値',
                  value: sla.target_value
                },
                {
                  title: '実績値',
                  value: sla.actual_value
                },
                {
                  title: '達成率',
                  value: `${sla.achievement_rate}%`
                },
                {
                  title: 'ステータス',
                  value: sla.status
                }
              ]
            },
            {
              type: 'TextBlock',
              text: '早急な対応をお願いします。',
              wrap: true,
              color: 'Attention'
            }
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'SLAダッシュボードを開く',
              url: `${systemUrl}/#/sla`
            }
          ]
        }
      }
    ]
  };
}

/**
 * 通知ログをデータベースに保存
 * @param {Object} db - データベース接続
 * @param {Object} logData - ログデータ
 * @returns {Promise<number>} 挿入されたログID
 */
async function saveNotificationLog(db, logData) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO notification_logs (
        notification_type,
        channel,
        recipient,
        subject,
        message,
        status,
        error_message,
        related_entity_type,
        related_entity_id,
        sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    db.run(
      sql,
      [
        logData.notification_type,
        logData.channel,
        logData.recipient || null,
        logData.subject || null,
        logData.message || null,
        logData.status,
        logData.error_message || null,
        logData.related_entity_type || null,
        logData.related_entity_id || null
      ],
      function (err) {
        if (err) {
          console.error('[NotificationService] Error saving notification log:', err);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

/**
 * 有効な通知チャネルを取得
 * @param {Object} db - データベース接続
 * @param {string} notificationType - 通知タイプ
 * @returns {Promise<Array>} 有効なチャネルリスト
 */
async function getActiveNotificationChannels(db, notificationType) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM notification_channels
      WHERE is_active = 1
        AND (notification_types IS NULL OR notification_types LIKE ?)
    `;

    db.all(sql, [`%${notificationType}%`], (err, rows) => {
      if (err) {
        console.error('[NotificationService] Error fetching notification channels:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

/**
 * インシデント通知を送信
 * @param {Object} db - データベース接続
 * @param {Object} incident - インシデント情報
 * @param {string} action - 'created' | 'updated' | 'resolved'
 * @returns {Promise<Object>} 送信結果のサマリー
 */
async function notifyIncident(db, incident, action) {
  const notificationType = `incident_${action}`;
  const results = {
    email: null,
    slack: null,
    teams: null
  };

  try {
    // 有効なチャネルを取得
    const channels = await getActiveNotificationChannels(db, notificationType);

    // 環境変数からの設定も確認
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;

    // Slack通知
    if (slackWebhookUrl || channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.SLACK)) {
      const channel = channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.SLACK);
      const webhookUrl = channel?.webhook_url || slackWebhookUrl;

      if (webhookUrl) {
        const message = buildSlackIncidentMessage(incident, action);
        results.slack = await sendSlackNotification(webhookUrl, message);

        await saveNotificationLog(db, {
          notification_type: notificationType,
          channel: NOTIFICATION_CHANNELS.SLACK,
          subject: `インシデント${action}: ${incident.ticket_id}`,
          message: JSON.stringify(message),
          status: results.slack.success ? 'sent' : 'failed',
          error_message: results.slack.error,
          related_entity_type: 'incident',
          related_entity_id: incident.id
        });
      }
    }

    // Teams通知
    if (teamsWebhookUrl || channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.TEAMS)) {
      const channel = channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.TEAMS);
      const webhookUrl = channel?.webhook_url || teamsWebhookUrl;

      if (webhookUrl) {
        const card = buildTeamsIncidentCard(incident, action);
        results.teams = await sendTeamsNotification(webhookUrl, card);

        await saveNotificationLog(db, {
          notification_type: notificationType,
          channel: NOTIFICATION_CHANNELS.TEAMS,
          subject: `インシデント${action}: ${incident.ticket_id}`,
          message: JSON.stringify(card),
          status: results.teams.success ? 'sent' : 'failed',
          error_message: results.teams.error,
          related_entity_type: 'incident',
          related_entity_id: incident.id
        });
      }
    }

    console.log(
      `[NotificationService] Incident notification sent for ${incident.ticket_id}:`,
      results
    );
    return results;
  } catch (error) {
    console.error('[NotificationService] Error sending incident notification:', error);
    throw error;
  }
}

/**
 * SLA違反/リスク通知を送信
 * @param {Object} db - データベース接続
 * @param {Object} sla - SLA情報
 * @param {string} alertType - 'violation' | 'at_risk'
 * @returns {Promise<Object>} 送信結果のサマリー
 */
async function notifySlaAlert(db, sla, alertType = 'violation') {
  const notificationType =
    alertType === 'violation' ? NOTIFICATION_TYPES.SLA_VIOLATION : NOTIFICATION_TYPES.SLA_AT_RISK;
  const results = {
    email: null,
    slack: null,
    teams: null
  };

  try {
    // 有効なチャネルを取得
    const channels = await getActiveNotificationChannels(db, notificationType);

    // 環境変数からの設定も確認
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;
    const alertEmail = process.env.SLA_ALERT_EMAIL;

    // Email通知
    if (alertEmail || channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.EMAIL)) {
      const channel = channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.EMAIL);
      const email = channel?.config?.email || alertEmail;

      if (email) {
        try {
          results.email = await sendSlaViolationAlert(email, sla);
          await saveNotificationLog(db, {
            notification_type: notificationType,
            channel: NOTIFICATION_CHANNELS.EMAIL,
            recipient: email,
            subject: `SLA${alertType === 'violation' ? '違反' : 'リスク'}: ${sla.service_name}`,
            status: 'sent',
            related_entity_type: 'sla',
            related_entity_id: sla.id
          });
        } catch (emailError) {
          results.email = { success: false, error: emailError.message };
          await saveNotificationLog(db, {
            notification_type: notificationType,
            channel: NOTIFICATION_CHANNELS.EMAIL,
            recipient: email,
            subject: `SLA${alertType === 'violation' ? '違反' : 'リスク'}: ${sla.service_name}`,
            status: 'failed',
            error_message: emailError.message,
            related_entity_type: 'sla',
            related_entity_id: sla.id
          });
        }
      }
    }

    // Slack通知
    if (slackWebhookUrl || channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.SLACK)) {
      const channel = channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.SLACK);
      const webhookUrl = channel?.webhook_url || slackWebhookUrl;

      if (webhookUrl) {
        const message = buildSlackSlaViolationMessage(sla);
        results.slack = await sendSlackNotification(webhookUrl, message);

        await saveNotificationLog(db, {
          notification_type: notificationType,
          channel: NOTIFICATION_CHANNELS.SLACK,
          subject: `SLA${alertType === 'violation' ? '違反' : 'リスク'}: ${sla.service_name}`,
          message: JSON.stringify(message),
          status: results.slack.success ? 'sent' : 'failed',
          error_message: results.slack.error,
          related_entity_type: 'sla',
          related_entity_id: sla.id
        });
      }
    }

    // Teams通知
    if (teamsWebhookUrl || channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.TEAMS)) {
      const channel = channels.find((c) => c.channel_type === NOTIFICATION_CHANNELS.TEAMS);
      const webhookUrl = channel?.webhook_url || teamsWebhookUrl;

      if (webhookUrl) {
        const card = buildTeamsSlaViolationCard(sla);
        results.teams = await sendTeamsNotification(webhookUrl, card);

        await saveNotificationLog(db, {
          notification_type: notificationType,
          channel: NOTIFICATION_CHANNELS.TEAMS,
          subject: `SLA${alertType === 'violation' ? '違反' : 'リスク'}: ${sla.service_name}`,
          message: JSON.stringify(card),
          status: results.teams.success ? 'sent' : 'failed',
          error_message: results.teams.error,
          related_entity_type: 'sla',
          related_entity_id: sla.id
        });
      }
    }

    console.log(
      `[NotificationService] SLA alert notification sent for ${sla.service_name}:`,
      results
    );
    return results;
  } catch (error) {
    console.error('[NotificationService] Error sending SLA alert notification:', error);
    throw error;
  }
}

/**
 * テスト通知を送信
 * @param {string} channel - 'slack' | 'teams'
 * @param {string} webhookUrl - Webhook URL
 * @returns {Promise<Object>} 送信結果
 */
async function sendTestNotification(channel, webhookUrl) {
  const systemUrl =
    process.env.SYSTEM_URL || `https://${process.env.SYSTEM_IP || 'localhost'}:5050`;

  if (channel === NOTIFICATION_CHANNELS.SLACK) {
    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: ':white_check_mark: ITSM-Sec Nexus テスト通知',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Slack Webhook連携のテストに成功しました。'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `送信元: ${systemUrl}`
            }
          ]
        }
      ]
    };
    return sendSlackNotification(webhookUrl, payload);
  }

  if (channel === NOTIFICATION_CHANNELS.TEAMS) {
    const card = {
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: [
              {
                type: 'TextBlock',
                text: 'ITSM-Sec Nexus テスト通知',
                weight: 'Bolder',
                size: 'Large',
                color: 'Good'
              },
              {
                type: 'TextBlock',
                text: 'Microsoft Teams Webhook連携のテストに成功しました。',
                wrap: true
              },
              {
                type: 'TextBlock',
                text: `送信元: ${systemUrl}`,
                size: 'Small',
                color: 'Default'
              }
            ]
          }
        }
      ]
    };
    return sendTeamsNotification(webhookUrl, card);
  }

  return { success: false, error: 'Unknown channel type' };
}

/**
 * Webhook通知を送信
 * @param {string} url - Webhook URL
 * @param {Object} payload - 送信ペイロード
 * @param {Object} headers - カスタムヘッダー
 * @returns {Promise<Object>} 送信結果
 */
async function sendWebhookNotification(url, payload, headers = {}) {
  if (!url) {
    console.warn('[NotificationService] Webhook URL is not configured');
    return { success: false, error: 'Webhook URL is not configured' };
  }

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 10000
    });

    console.log('[NotificationService] Webhook notification sent successfully');
    return {
      success: true,
      statusCode: response.status
    };
  } catch (error) {
    console.error('[NotificationService] Webhook notification error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * アラート通知を送信（マルチチャネル）
 * @param {Object} alert - アラート情報
 * @param {Array<Object>} channels - 通知チャネルリスト
 * @returns {Promise<Array>} 送信結果
 */
async function sendAlertNotification(alert, channels) {
  const results = [];

  // 通知は順序依存のため、ループ内でawaitを使用
  // eslint-disable-next-line no-restricted-syntax
  for (const channel of channels) {
    try {
      const config =
        typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config;

      if (channel.channel_type === 'slack') {
        const payload = {
          text: `[${alert.severity.toUpperCase()}] ${alert.rule_name}`,
          attachments: [
            {
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              fields: [
                { title: 'メトリクス', value: alert.metric_name, short: true },
                { title: '現在値', value: String(alert.current_value), short: true },
                { title: '閾値', value: String(alert.threshold), short: true },
                { title: '重要度', value: alert.severity, short: true }
              ],
              text: alert.message
            }
          ]
        };

        // eslint-disable-next-line no-await-in-loop
        const result = await sendSlackNotification(config.webhook_url, payload);
        results.push({ channel: channel.channel_name, ...result });
      } else if (channel.channel_type === 'webhook') {
        // eslint-disable-next-line no-await-in-loop
        const result = await sendWebhookNotification(
          config.webhook_url,
          {
            alert_id: alert.id,
            rule_name: alert.rule_name,
            metric_name: alert.metric_name,
            current_value: alert.current_value,
            threshold: alert.threshold,
            severity: alert.severity,
            message: alert.message,
            timestamp: new Date().toISOString()
          },
          config.custom_headers || {}
        );
        results.push({ channel: channel.channel_name, ...result });
      }
    } catch (error) {
      console.error(`[NotificationService] Error sending to ${channel.channel_name}:`, error);
      results.push({
        channel: channel.channel_name,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 通知チャネルのテスト送信
 * @param {Object} channel - 通知チャネル
 * @returns {Promise<Object>} 送信結果
 */
async function testNotificationChannel(channel) {
  const config = typeof channel.config === 'string' ? JSON.parse(channel.config) : channel.config;

  if (channel.channel_type === 'slack') {
    return sendTestNotification('slack', config.webhook_url);
  }

  if (channel.channel_type === 'webhook') {
    return sendWebhookNotification(
      config.webhook_url,
      {
        test: true,
        message: 'ITSM-Sec Nexus Webhook Test',
        timestamp: new Date().toISOString()
      },
      config.custom_headers || {}
    );
  }

  return { success: false, error: 'Unknown channel type' };
}

module.exports = {
  // 定数
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  PRIORITY_COLORS,
  STATUS_COLORS,

  // 低レベル関数
  sendSlackNotification,
  sendTeamsNotification,
  sendWebhookNotification,

  // メッセージビルダー
  buildSlackIncidentMessage,
  buildSlackSlaViolationMessage,
  buildTeamsIncidentCard,
  buildTeamsSlaViolationCard,

  // 高レベル関数
  notifyIncident,
  notifySlaAlert,
  sendTestNotification,
  sendAlertNotification,
  testNotificationChannel,

  // ユーティリティ
  saveNotificationLog,
  getActiveNotificationChannels,
  getPriorityColor,
  formatDateTime,

  // エイリアス（テスト互換性のため）
  notifySlaViolation: notifySlaAlert
};
