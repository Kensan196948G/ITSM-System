/**
 * Monitoring API Routes
 * メトリクス・アラート・通知チャネル管理API
 * Phase 9.2: 監視・ヘルスチェック強化
 */

const crypto = require('crypto');
const express = require('express');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const knex = require('../knex');
const monitoringService = require('../services/monitoringService');
const alertService = require('../services/alertService');
const notificationService = require('../services/notificationService');

// サービスにKnexインスタンスを注入
monitoringService.setDatabase(knex);
alertService.setDatabase(knex);

// ===================================
// メトリクス関連エンドポイント
// ===================================

/**
 * @swagger
 * /monitoring/metrics/system:
 *   get:
 *     summary: システムメトリクス取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: システムメトリクス
 */
router.get(
  '/metrics/system',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  asyncHandler(async (req, res) => {
    const metrics = await monitoringService.getSystemMetrics();

    res.json({
      message: 'System metrics retrieved successfully',
      data: metrics
    });
  })
);

/**
 * @swagger
 * /monitoring/metrics/business:
 *   get:
 *     summary: ビジネスメトリクス取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ビジネスメトリクス
 */
router.get(
  '/metrics/business',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  asyncHandler(async (req, res) => {
    const metrics = await monitoringService.getBusinessMetrics();

    res.json({
      message: 'Business metrics retrieved successfully',
      data: metrics
    });
  })
);

/**
 * @swagger
 * /monitoring/metrics/history:
 *   get:
 *     summary: メトリクス履歴取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: metric_name
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: start_time
 *         in: query
 *         schema:
 *           type: string
 *       - name: end_time
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: メトリクス履歴
 */
router.get(
  '/metrics/history',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  asyncHandler(async (req, res) => {
    const { metric_name, start_time, end_time } = req.query;

    if (!metric_name) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'metric_name is required'
      });
    }

    const history = await monitoringService.getMetricsHistory(metric_name, start_time, end_time);

    res.json({
      message: 'Metrics history retrieved successfully',
      data: {
        metric_name,
        count: history.length,
        history
      }
    });
  })
);

/**
 * @swagger
 * /monitoring/metrics/custom:
 *   post:
 *     summary: カスタムメトリクス登録
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metric_name
 *               - metric_value
 *             properties:
 *               metric_name:
 *                 type: string
 *               metric_value:
 *                 type: number
 *               labels:
 *                 type: object
 *     responses:
 *       201:
 *         description: カスタムメトリクス登録成功
 */
router.post(
  '/metrics/custom',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { metric_name, metric_value, labels } = req.body;

    if (!metric_name || typeof metric_value !== 'number') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'metric_name and metric_value (number) are required'
      });
    }

    const id = await monitoringService.registerCustomMetric(metric_name, metric_value, labels);

    res.status(201).json({
      message: 'Custom metric registered successfully',
      data: { id, metric_name, metric_value, labels }
    });
  })
);

// ===================================
// アラートルール管理エンドポイント
// ===================================

/**
 * @swagger
 * /monitoring/alert-rules:
 *   get:
 *     summary: アラートルール一覧取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: アラートルール一覧
 */
router.get(
  '/alert-rules',
  authenticateJWT,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const rules = await knex('alert_rules').orderBy('created_at', 'desc');

    // notification_channelsをJSONパース
    rules.forEach((rule) => {
      if (rule.notification_channels) {
        try {
          rule.notification_channels = JSON.parse(rule.notification_channels);
        } catch (e) {
          rule.notification_channels = [];
        }
      }
    });

    res.json({
      message: 'Alert rules retrieved successfully',
      data: {
        total: rules.length,
        rules
      }
    });
  })
);

/**
 * @swagger
 * /monitoring/alert-rules:
 *   post:
 *     summary: アラートルール作成
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rule_name
 *               - metric_name
 *               - condition
 *               - threshold
 *               - severity
 *             properties:
 *               rule_name:
 *                 type: string
 *               metric_name:
 *                 type: string
 *               condition:
 *                 type: string
 *                 enum: ['>', '<', '>=', '<=', '==', '!=']
 *               threshold:
 *                 type: number
 *               duration:
 *                 type: integer
 *               severity:
 *                 type: string
 *                 enum: ['critical', 'warning', 'info']
 *               enabled:
 *                 type: boolean
 *               notification_channels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: アラートルール作成成功
 */
router.post(
  '/alert-rules',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const {
      rule_name,
      metric_name,
      condition,
      threshold,
      duration,
      severity,
      enabled = true,
      notification_channels = []
    } = req.body;

    // バリデーション
    if (!rule_name || !metric_name || !condition || threshold === undefined || !severity) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Required fields: rule_name, metric_name, condition, threshold, severity'
      });
    }

    if (!['>', '<', '>=', '<=', '==', '!='].includes(condition)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid condition. Must be one of: >, <, >=, <=, ==, !='
      });
    }

    if (!['critical', 'warning', 'info'].includes(severity)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid severity. Must be one of: critical, warning, info'
      });
    }

    if (duration && duration < 60) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Duration must be at least 60 seconds'
      });
    }

    // 重複チェック
    const existing = await knex('alert_rules').where('rule_name', rule_name).first();
    if (existing) {
      return res.status(409).json({
        error: 'Duplicate rule name',
        message: `Alert rule with name '${rule_name}' already exists`
      });
    }

    const [id] = await knex('alert_rules').insert({
      rule_name,
      metric_name,
      condition,
      threshold,
      duration: duration || null,
      severity,
      enabled: enabled ? 1 : 0,
      notification_channels: JSON.stringify(notification_channels),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const newRule = await knex('alert_rules').where('id', id).first();

    res.status(201).json({
      message: 'Alert rule created successfully',
      data: newRule
    });
  })
);

/**
 * @swagger
 * /monitoring/alert-rules/:id:
 *   get:
 *     summary: アラートルール詳細取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: アラートルール詳細
 */
router.get(
  '/alert-rules/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await knex('alert_rules').where('id', id).first();

    if (!rule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `Alert rule with ID ${id} does not exist`
      });
    }

    // notification_channelsをJSONパース
    if (rule.notification_channels) {
      try {
        rule.notification_channels = JSON.parse(rule.notification_channels);
      } catch (e) {
        rule.notification_channels = [];
      }
    }

    res.json({
      message: 'Alert rule retrieved successfully',
      data: rule
    });
  })
);

/**
 * @swagger
 * /monitoring/alert-rules/:id:
 *   put:
 *     summary: アラートルール更新
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: アラートルール更新成功
 */
router.put(
  '/alert-rules/:id',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const rule = await knex('alert_rules').where('id', id).first();

    if (!rule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `Alert rule with ID ${id} does not exist`
      });
    }

    // バリデーション
    if (updates.condition && !['>', '<', '>=', '<=', '==', '!='].includes(updates.condition)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid condition'
      });
    }

    if (updates.severity && !['critical', 'warning', 'info'].includes(updates.severity)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid severity'
      });
    }

    const updateData = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (updates.notification_channels) {
      updateData.notification_channels = JSON.stringify(updates.notification_channels);
    }

    if (updates.enabled !== undefined) {
      updateData.enabled = updates.enabled ? 1 : 0;
    }

    delete updateData.id;
    delete updateData.created_at;

    await knex('alert_rules').where('id', id).update(updateData);

    const updatedRule = await knex('alert_rules').where('id', id).first();

    res.json({
      message: 'Alert rule updated successfully',
      data: updatedRule
    });
  })
);

/**
 * @swagger
 * /monitoring/alert-rules/:id:
 *   delete:
 *     summary: アラートルール削除
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: アラートルール削除成功
 */
router.delete(
  '/alert-rules/:id',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await knex('alert_rules').where('id', id).first();

    if (!rule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `Alert rule with ID ${id} does not exist`
      });
    }

    await knex('alert_rules').where('id', id).delete();

    res.json({
      message: 'Alert rule deleted successfully'
    });
  })
);

/**
 * @swagger
 * /monitoring/alert-rules/:id/test:
 *   post:
 *     summary: アラートルールテスト評価
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: テスト評価結果
 */
router.post(
  '/alert-rules/:id/test',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rule = await knex('alert_rules').where('id', id).first();

    if (!rule) {
      return res.status(404).json({
        error: 'Rule not found',
        message: `Alert rule with ID ${id} does not exist`
      });
    }

    const evaluation = await alertService.evaluateRule(rule);

    res.json({
      message: 'Alert rule test evaluation completed',
      data: evaluation
    });
  })
);

// ===================================
// アラート履歴エンドポイント
// ===================================

/**
 * @swagger
 * /monitoring/alerts:
 *   get:
 *     summary: アラート一覧取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: アラート一覧
 */
router.get(
  '/alerts',
  authenticateJWT,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { severity, status, start_date, end_date, limit = 50, offset = 0 } = req.query;

    const filters = {
      severity,
      status,
      startDate: start_date,
      endDate: end_date
    };

    const pagination = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    };

    const result = await alertService.getAlertHistory(filters, pagination);

    res.json({
      message: 'Alerts retrieved successfully',
      data: result
    });
  })
);

/**
 * @swagger
 * /monitoring/alerts/:id:
 *   get:
 *     summary: アラート詳細取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: アラート詳細
 */
router.get(
  '/alerts/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const alert = await knex('alert_history')
      .leftJoin('users', 'alert_history.acknowledged_by', 'users.id')
      .where('alert_history.id', id)
      .select('alert_history.*', 'users.username as acknowledged_by_username')
      .first();

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID ${id} does not exist`
      });
    }

    res.json({
      message: 'Alert retrieved successfully',
      data: alert
    });
  })
);

/**
 * @swagger
 * /monitoring/alerts/:id/acknowledge:
 *   put:
 *     summary: アラート確認
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: アラート確認成功
 */
router.put(
  '/alerts/:id/acknowledge',
  authenticateJWT,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const alert = await knex('alert_history').where('id', id).first();

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID ${id} does not exist`
      });
    }

    await alertService.acknowledgeAlert(id, userId);

    const updatedAlert = await knex('alert_history').where('id', id).first();

    res.json({
      message: 'Alert acknowledged successfully',
      data: updatedAlert
    });
  })
);

/**
 * @swagger
 * /monitoring/alerts/:id/resolve:
 *   put:
 *     summary: アラート解決
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: アラート解決成功
 */
router.put(
  '/alerts/:id/resolve',
  authenticateJWT,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const alert = await knex('alert_history').where('id', id).first();

    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        message: `Alert with ID ${id} does not exist`
      });
    }

    await alertService.resolveAlert(id);

    const updatedAlert = await knex('alert_history').where('id', id).first();

    res.json({
      message: 'Alert resolved successfully',
      data: updatedAlert
    });
  })
);

// ===================================
// 通知チャネル管理エンドポイント
// ===================================

/**
 * 通知設定を暗号化
 * @param {Object} config - 設定オブジェクト
 * @returns {string} 暗号化された設定
 */
function encryptConfig(config) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY || '0'.repeat(64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * 通知設定を復号化
 * @param {string} encryptedConfig - 暗号化された設定
 * @returns {Object} 復号化された設定
 */
function decryptConfig(encryptedConfig) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY || '0'.repeat(64), 'hex');
  const parts = encryptedConfig.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/**
 * @swagger
 * /monitoring/notification-channels:
 *   get:
 *     summary: 通知チャネル一覧取得
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 通知チャネル一覧
 */
router.get(
  '/notification-channels',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const channels = await knex('alert_notification_channels').orderBy('created_at', 'desc');

    // 設定を復号化（セキュアなフィールドはマスク）
    channels.forEach((channel) => {
      try {
        const config = decryptConfig(channel.config);
        // Webhookトークンやパスワードをマスク
        if (config.webhook_url) {
          config.webhook_url = config.webhook_url.replace(/\/([^/]+)$/, '/***');
        }
        channel.config = config;
      } catch (e) {
        // 復号化失敗の場合はそのまま
        try {
          channel.config = JSON.parse(channel.config);
        } catch (parseError) {
          channel.config = {};
        }
      }
    });

    res.json({
      message: 'Notification channels retrieved successfully',
      data: {
        total: channels.length,
        channels
      }
    });
  })
);

/**
 * @swagger
 * /monitoring/notification-channels:
 *   post:
 *     summary: 通知チャネル作成
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel_name
 *               - channel_type
 *               - config
 *             properties:
 *               channel_name:
 *                 type: string
 *               channel_type:
 *                 type: string
 *                 enum: ['email', 'slack', 'webhook']
 *               config:
 *                 type: object
 *               enabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 通知チャネル作成成功
 */
router.post(
  '/notification-channels',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { channel_name, channel_type, config, enabled = true } = req.body;

    // バリデーション
    if (!channel_name || !channel_type || !config) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Required fields: channel_name, channel_type, config'
      });
    }

    if (!['email', 'slack', 'webhook'].includes(channel_type)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid channel_type. Must be one of: email, slack, webhook'
      });
    }

    // 重複チェック
    const existing = await knex('alert_notification_channels')
      .where('channel_name', channel_name)
      .first();

    if (existing) {
      return res.status(409).json({
        error: 'Duplicate channel name',
        message: `Notification channel with name '${channel_name}' already exists`
      });
    }

    // 設定を暗号化
    const encryptedConfig = encryptConfig(config);

    const [id] = await knex('alert_notification_channels').insert({
      channel_name,
      channel_type,
      config: encryptedConfig,
      enabled: enabled ? 1 : 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const newChannel = await knex('alert_notification_channels').where('id', id).first();
    newChannel.config = config; // レスポンスには元の設定を返す

    res.status(201).json({
      message: 'Notification channel created successfully',
      data: newChannel
    });
  })
);

/**
 * @swagger
 * /monitoring/notification-channels/:id:
 *   delete:
 *     summary: 通知チャネル削除
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 通知チャネル削除成功
 */
router.delete(
  '/notification-channels/:id',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const channel = await knex('alert_notification_channels').where('id', id).first();

    if (!channel) {
      return res.status(404).json({
        error: 'Channel not found',
        message: `Notification channel with ID ${id} does not exist`
      });
    }

    await knex('alert_notification_channels').where('id', id).delete();

    res.json({
      message: 'Notification channel deleted successfully'
    });
  })
);

/**
 * @swagger
 * /monitoring/notification-channels/:id/test:
 *   post:
 *     summary: 通知チャネルテスト送信
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: テスト送信成功
 */
router.post(
  '/notification-channels/:id/test',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const channel = await knex('alert_notification_channels').where('id', id).first();

    if (!channel) {
      return res.status(404).json({
        error: 'Channel not found',
        message: `Notification channel with ID ${id} does not exist`
      });
    }

    // 設定を復号化
    try {
      channel.config = decryptConfig(channel.config);
    } catch (e) {
      try {
        channel.config = JSON.parse(channel.config);
      } catch (parseError) {
        return res.status(500).json({
          error: 'Configuration error',
          message: 'Failed to decrypt channel configuration'
        });
      }
    }

    const result = await notificationService.testNotificationChannel(channel);

    // 通知履歴を保存
    await knex('alert_notification_history').insert({
      channel_id: id,
      alert_id: null,
      subject: 'Test Notification',
      message: 'ITSM-Sec Nexus test notification',
      status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
      sent_at: new Date().toISOString()
    });

    res.json({
      message: 'Test notification sent',
      data: result
    });
  })
);

module.exports = router;
