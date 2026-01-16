/**
 * Notification Settings Routes
 * 通知設定API
 * @module routes/notifications
 */

const express = require('express');
const { authenticateJWT, authorize } = require('../middleware/auth');
const {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  sendTestNotification
} = require('../services/notificationService');
const { db } = require('../db');

const router = express.Router();

/**
 * Promisified database functions
 */
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

/**
 * @swagger
 * /settings/notifications:
 *   get:
 *     summary: 通知チャネル一覧取得
 *     description: 登録されている通知チャネルの一覧を取得します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 通知チャネル一覧
 */
router.get('/', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  try {
    // テーブルが存在しない場合は空配列を返す
    let channels = [];
    try {
      channels = await dbAll(`
          SELECT
            id,
            name,
            channel_type,
            webhook_url,
            config,
            notification_types,
            is_active,
            created_by,
            created_at,
            updated_at
          FROM notification_channels
          ORDER BY created_at DESC
        `);
    } catch (tableError) {
      if (tableError.message.includes('no such table')) {
        console.warn('[Notifications] notification_channels table does not exist yet');
        channels = [];
      } else {
        throw tableError;
      }
    }

    // Webhook URLをマスク
    const maskedChannels = channels.map((channel) => ({
      ...channel,
      webhook_url: channel.webhook_url ? `${channel.webhook_url.substring(0, 30)}...` : null,
      config: channel.config ? JSON.parse(channel.config) : null
    }));

    res.json({
      success: true,
      data: maskedChannels,
      meta: {
        total: channels.length,
        channel_types: Object.values(NOTIFICATION_CHANNELS),
        notification_types: Object.values(NOTIFICATION_TYPES)
      }
    });
  } catch (error) {
    console.error('Error fetching notification channels:', error);
    res.status(500).json({
      success: false,
      error: '通知チャネルの取得に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications/logs:
 *   get:
 *     summary: 通知ログ取得
 *     description: 通知送信ログを取得します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 通知ログ一覧
 */
router.get('/logs', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { limit = 50, offset = 0, channel, status, notification_type } = req.query;

    // テーブルが存在しない場合は空配列を返す
    let logs = [];
    let total = 0;
    try {
      let whereClause = '1=1';
      const params = [];

      if (channel) {
        whereClause += ' AND channel = ?';
        params.push(channel);
      }
      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }
      if (notification_type) {
        whereClause += ' AND notification_type = ?';
        params.push(notification_type);
      }

      logs = await dbAll(
        `SELECT * FROM notification_logs
           WHERE ${whereClause}
           ORDER BY sent_at DESC
           LIMIT ? OFFSET ?`,
        [...params, parseInt(limit, 10), parseInt(offset, 10)]
      );

      const countResult = await dbGet(
        `SELECT COUNT(*) as total FROM notification_logs WHERE ${whereClause}`,
        params
      );
      total = countResult.total;
    } catch (tableError) {
      if (tableError.message.includes('no such table')) {
        console.warn('[Notifications] notification_logs table does not exist yet');
        logs = [];
        total = 0;
      } else {
        throw tableError;
      }
    }

    res.json({
      success: true,
      data: logs,
      meta: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching notification logs:', error);
    res.status(500).json({
      success: false,
      error: '通知ログの取得に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications/stats:
 *   get:
 *     summary: 通知統計取得
 *     description: 通知送信の統計情報を取得します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 通知統計情報
 */
router.get('/stats', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  try {
    // テーブルが存在しない場合は空の統計を返す
    let byChannel = [];
    let byType = [];
    let last24Hours = { total: 0, sent: 0, failed: 0 };
    let activeChannels = { count: 0 };

    try {
      // チャネル別統計
      byChannel = await dbAll(`
          SELECT
            channel,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
          FROM notification_logs
          GROUP BY channel
        `);

      // 通知タイプ別統計
      byType = await dbAll(`
          SELECT
            notification_type,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
          FROM notification_logs
          GROUP BY notification_type
        `);

      // 過去24時間の統計
      last24Hours = await dbGet(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
          FROM notification_logs
          WHERE sent_at >= datetime('now', '-24 hours')
        `);

      // 有効なチャネル数
      activeChannels = await dbGet(`
          SELECT COUNT(*) as count FROM notification_channels WHERE is_active = 1
        `);
    } catch (tableError) {
      if (tableError.message.includes('no such table')) {
        console.warn('[Notifications] Notification tables do not exist yet');
        // 空の統計を返す（すでに初期化済み）
      } else {
        throw tableError;
      }
    }

    res.json({
      success: true,
      data: {
        by_channel: byChannel,
        by_type: byType,
        last_24_hours: last24Hours,
        active_channels: activeChannels.count
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      error: '通知統計の取得に失敗しました'
    });
  }
});

/**
 * @swagger
 * /notifications/channels:
 *   get:
 *     summary: 利用可能な通知チャネルタイプ一覧取得
 *     description: システムで利用可能な通知チャネルタイプの一覧を取得します
 */
router.get('/channels', authenticateJWT, async (req, res) => {
  try {
    const channels = [
      { id: 'email', name: 'Email', enabled: true, description: 'メール通知' },
      { id: 'slack', name: 'Slack', enabled: true, description: 'Slack Webhook通知' },
      { id: 'teams', name: 'Microsoft Teams', enabled: true, description: 'Teams Webhook通知' },
      { id: 'webhook', name: 'Generic Webhook', enabled: true, description: '汎用Webhook通知' }
    ];
    res.json({ channels });
  } catch (error) {
    console.error('Error fetching notification channels:', error);
    res.status(500).json({
      error: '通知チャネルの取得に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications/{id}:
 *   get:
 *     summary: 通知チャネル詳細取得
 *     description: 指定IDの通知チャネル詳細を取得します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 通知チャネル詳細
 *       404:
 *         description: チャネルが見つかりません
 */
router.get('/:id', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await dbGet('SELECT * FROM notification_channels WHERE id = ?', [id]);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: '通知チャネルが見つかりません'
      });
    }

    // Webhook URLをマスク（管理者以外）
    if (req.user.role !== 'admin') {
      channel.webhook_url = channel.webhook_url
        ? `${channel.webhook_url.substring(0, 30)}...`
        : null;
    }

    channel.config = channel.config ? JSON.parse(channel.config) : null;

    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error fetching notification channel:', error);
    res.status(500).json({
      success: false,
      error: '通知チャネルの取得に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications:
 *   post:
 *     summary: 通知チャネル作成
 *     description: 新しい通知チャネルを作成します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - channel_type
 *             properties:
 *               name:
 *                 type: string
 *                 description: チャネル名
 *               channel_type:
 *                 type: string
 *                 enum: [email, slack, teams]
 *               webhook_url:
 *                 type: string
 *                 description: Webhook URL（Slack/Teams用）
 *               config:
 *                 type: object
 *                 description: 追加設定
 *               notification_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 対象通知タイプ
 *               is_active:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: 作成成功
 *       400:
 *         description: バリデーションエラー
 */
router.post('/', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const {
      name,
      channel_type,
      webhook_url,
      config,
      notification_types,
      is_active = true
    } = req.body;

    // バリデーション
    if (!name || !channel_type) {
      return res.status(400).json({
        success: false,
        error: 'nameとchannel_typeは必須です'
      });
    }

    if (!Object.values(NOTIFICATION_CHANNELS).includes(channel_type)) {
      return res.status(400).json({
        success: false,
        error: `channel_typeは${Object.values(NOTIFICATION_CHANNELS).join(', ')}のいずれかである必要があります`
      });
    }

    // Slack/TeamsはWebhook URLが必須
    if ((channel_type === 'slack' || channel_type === 'teams') && !webhook_url) {
      return res.status(400).json({
        success: false,
        error: 'Slack/TeamsチャネルにはWebhook URLが必須です'
      });
    }

    const result = await dbRun(
      `INSERT INTO notification_channels (
          name, channel_type, webhook_url, config, notification_types,
          is_active, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        name,
        channel_type,
        webhook_url || null,
        config ? JSON.stringify(config) : null,
        notification_types ? notification_types.join(',') : null,
        is_active ? 1 : 0,
        req.user.username
      ]
    );

    res.status(201).json({
      success: true,
      message: '通知チャネルを作成しました',
      data: {
        id: result.lastID,
        name,
        channel_type,
        is_active
      }
    });
  } catch (error) {
    console.error('Error creating notification channel:', error);
    res.status(500).json({
      success: false,
      error: '通知チャネルの作成に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications/{id}:
 *   put:
 *     summary: 通知チャネル更新
 *     description: 既存の通知チャネルを更新します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: 更新成功
 *       404:
 *         description: チャネルが見つかりません
 */
router.put('/:id', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, channel_type, webhook_url, config, notification_types, is_active } = req.body;

    // チャネルの存在確認
    const existing = await dbGet('SELECT * FROM notification_channels WHERE id = ?', [id]);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '通知チャネルが見つかりません'
      });
    }

    // 更新フィールドを構築
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (channel_type !== undefined) {
      updates.push('channel_type = ?');
      params.push(channel_type);
    }
    if (webhook_url !== undefined) {
      updates.push('webhook_url = ?');
      params.push(webhook_url);
    }
    if (config !== undefined) {
      updates.push('config = ?');
      params.push(JSON.stringify(config));
    }
    if (notification_types !== undefined) {
      updates.push('notification_types = ?');
      params.push(notification_types.join(','));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    await dbRun(`UPDATE notification_channels SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({
      success: true,
      message: '通知チャネルを更新しました'
    });
  } catch (error) {
    console.error('Error updating notification channel:', error);
    res.status(500).json({
      success: false,
      error: '通知チャネルの更新に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications/{id}:
 *   delete:
 *     summary: 通知チャネル削除
 *     description: 通知チャネルを削除します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 削除成功
 *       404:
 *         description: チャネルが見つかりません
 */
router.delete('/:id', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await dbGet('SELECT * FROM notification_channels WHERE id = ?', [id]);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '通知チャネルが見つかりません'
      });
    }

    await dbRun('DELETE FROM notification_channels WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '通知チャネルを削除しました'
    });
  } catch (error) {
    console.error('Error deleting notification channel:', error);
    res.status(500).json({
      success: false,
      error: '通知チャネルの削除に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications/{id}/test:
 *   post:
 *     summary: テスト通知送信
 *     description: 指定チャネルにテスト通知を送信します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: テスト送信結果
 */
router.post('/:id/test', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await dbGet('SELECT * FROM notification_channels WHERE id = ?', [id]);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: '通知チャネルが見つかりません'
      });
    }

    if (channel.channel_type === 'email') {
      return res.status(400).json({
        success: false,
        error: 'メールチャネルのテストは/api/v1/settings/notifications/test/emailを使用してください'
      });
    }

    const result = await sendTestNotification(channel.channel_type, channel.webhook_url);

    if (result.success) {
      res.json({
        success: true,
        message: 'テスト通知を送信しました'
      });
    } else {
      res.status(400).json({
        success: false,
        error: `テスト通知の送信に失敗しました: ${result.error}`
      });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'テスト通知の送信に失敗しました'
    });
  }
});

/**
 * @swagger
 * /settings/notifications/test/webhook:
 *   post:
 *     summary: Webhook URLテスト
 *     description: 新しいWebhook URLにテスト通知を送信します
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel_type
 *               - webhook_url
 *             properties:
 *               channel_type:
 *                 type: string
 *                 enum: [slack, teams]
 *               webhook_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: テスト送信結果
 */
router.post('/test/webhook', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const { channel_type, webhook_url } = req.body;

    if (!channel_type || !webhook_url) {
      return res.status(400).json({
        success: false,
        error: 'channel_typeとwebhook_urlは必須です'
      });
    }

    if (!['slack', 'teams'].includes(channel_type)) {
      return res.status(400).json({
        success: false,
        error: 'channel_typeはslackまたはteamsである必要があります'
      });
    }

    const result = await sendTestNotification(channel_type, webhook_url);

    if (result.success) {
      res.json({
        success: true,
        message: 'テスト通知を送信しました'
      });
    } else {
      res.status(400).json({
        success: false,
        error: `テスト通知の送信に失敗しました: ${result.error}`
      });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      error: 'テスト通知の送信に失敗しました'
    });
  }
});

module.exports = router;
