/* eslint-disable no-await-in-loop, no-continue, no-restricted-syntax */
/**
 * 統合設定ルート
 * 外部システム統合の設定・管理API
 *
 * @module routes/integrations
 */

const express = require('express');
const { authenticateJWT, authorize } = require('../middleware/auth');
const microsoftGraphService = require('../services/microsoftGraphService');
const serviceNowService = require('../services/serviceNowService');
const { db } = require('../db');

const router = express.Router();

// ============================================
// ヘルパー関数
// ============================================

const dbRun = (sql, params) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

const dbAll = (sql, params) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

// ============================================
// 統合設定取得・更新
// ============================================

/**
 * @swagger
 * /settings/integrations:
 *   get:
 *     summary: 統合設定一覧取得
 *     description: 全ての外部システム統合設定を取得
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 統合設定一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 integrations:
 *                   type: object
 *                   properties:
 *                     microsoft365:
 *                       type: object
 *                     servicenow:
 *                       type: object
 */
router.get('/', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    // Microsoft 365設定
    const m365Status = {
      name: 'Microsoft 365',
      configured: microsoftGraphService.isConfigured(),
      settings: {
        tenantId: process.env.M365_TENANT_ID ? '設定済み' : '未設定',
        clientId: process.env.M365_CLIENT_ID ? '設定済み' : '未設定',
        clientSecret: process.env.M365_CLIENT_SECRET ? '設定済み' : '未設定',
        graphEndpoint: process.env.M365_GRAPH_ENDPOINT || 'https://graph.microsoft.com/v1.0'
      },
      features: {
        userSync: true,
        deviceSync: true,
        calendarIntegration: true,
        securityAlerts: true
      }
    };

    // ServiceNow設定
    const snowStatus = serviceNowService.getSyncStatus();
    const serviceNowSettings = {
      name: 'ServiceNow',
      configured: snowStatus.configured,
      settings: {
        instanceUrl: snowStatus.instanceUrl || '未設定',
        authMethod: snowStatus.authMethod,
        hasCredentials: snowStatus.hasCredentials ? '設定済み' : '未設定'
      },
      features: {
        incidentSync: true,
        changeRequestSync: true,
        bidirectional: true
      }
    };

    // データベースから追加設定を取得
    let dbSettings = [];
    try {
      dbSettings = await dbAll(`SELECT * FROM integration_settings ORDER BY integration_name`, []);
    } catch {
      // テーブルが存在しない場合は空配列
    }

    // カスタム設定をマージ
    const customSettings = {};
    dbSettings.forEach((setting) => {
      if (!customSettings[setting.integration_name]) {
        customSettings[setting.integration_name] = {};
      }
      // シークレット値はマスク
      customSettings[setting.integration_name][setting.setting_key] = setting.is_secret
        ? '********'
        : setting.setting_value;
    });

    res.json({
      success: true,
      integrations: {
        microsoft365: m365Status,
        servicenow: serviceNowSettings,
        custom: customSettings
      }
    });
  } catch (error) {
    console.error('統合設定取得エラー:', error);
    res.status(500).json({ error: '設定取得に失敗しました' });
  }
});

/**
 * @swagger
 * /settings/integrations:
 *   post:
 *     summary: 統合設定保存
 *     description: 統合設定を保存（データベースに永続化）
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - integration
 *               - settings
 *             properties:
 *               integration:
 *                 type: string
 *                 description: 統合名（microsoft365, servicenow等）
 *               settings:
 *                 type: object
 *                 description: 設定キーと値のペア
 *     responses:
 *       200:
 *         description: 保存成功
 *       400:
 *         description: バリデーションエラー
 */
router.post('/', authenticateJWT, authorize(['admin']), async (req, res) => {
  const { integration, settings } = req.body;

  if (!integration || !settings) {
    return res.status(400).json({ error: 'integrationとsettingsは必須です' });
  }

  // シークレットフィールドの定義
  const secretFields = [
    'client_secret',
    'password',
    'api_key',
    'webhook_secret',
    'token',
    'secret'
  ];

  try {
    // 設定テーブルが存在しない場合は作成
    await dbRun(
      `CREATE TABLE IF NOT EXISTS integration_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        integration_name TEXT NOT NULL,
        setting_key TEXT NOT NULL,
        setting_value TEXT,
        is_secret INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(integration_name, setting_key)
      )`,
      []
    );

    // 各設定を保存
    for (const [key, value] of Object.entries(settings)) {
      const isSecret = secretFields.some((f) => key.toLowerCase().includes(f)) ? 1 : 0;

      await dbRun(
        `INSERT INTO integration_settings (integration_name, setting_key, setting_value, is_secret, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(integration_name, setting_key)
         DO UPDATE SET setting_value = ?, is_secret = ?, updated_at = datetime('now')`,
        [integration, key, value, isSecret, value, isSecret]
      );
    }

    res.json({
      success: true,
      message: `${integration}の設定を保存しました`,
      keysUpdated: Object.keys(settings).length
    });
  } catch (error) {
    console.error('統合設定保存エラー:', error);
    res.status(500).json({ error: '設定保存に失敗しました' });
  }
});

// ============================================
// 接続テスト
// ============================================

/**
 * @swagger
 * /settings/integrations/test/microsoft365:
 *   post:
 *     summary: Microsoft 365接続テスト
 *     description: Microsoft Graph APIへの接続をテスト
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: テスト結果
 */
router.post('/test/microsoft365', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const result = await microsoftGraphService.testConnection();

    res.json({
      success: result.success,
      integration: 'microsoft365',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      integration: 'microsoft365',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /settings/integrations/test/servicenow:
 *   post:
 *     summary: ServiceNow接続テスト
 *     description: ServiceNow APIへの接続をテスト
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: テスト結果
 */
router.post('/test/servicenow', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const result = await serviceNowService.testConnection();

    res.json({
      success: result.success,
      integration: 'servicenow',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      integration: 'servicenow',
      error: error.message
    });
  }
});

// ============================================
// 同期操作
// ============================================

/**
 * @swagger
 * /settings/integrations/sync/microsoft365/users:
 *   post:
 *     summary: Microsoft 365ユーザー同期
 *     description: Azure ADからユーザーを同期
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               activeOnly:
 *                 type: boolean
 *                 default: true
 *               maxRecords:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       200:
 *         description: 同期結果
 */
router.post('/sync/microsoft365/users', authenticateJWT, authorize(['admin']), async (req, res) => {
  const { activeOnly = true, maxRecords = 0 } = req.body || {};

  if (!microsoftGraphService.isConfigured()) {
    return res.status(400).json({
      success: false,
      error: 'Microsoft 365が設定されていません'
    });
  }

  try {
    const options = {
      all: true,
      maxRecords,
      select:
        'id,displayName,userPrincipalName,mail,accountEnabled,department,jobTitle,createdDateTime'
    };

    if (activeOnly) {
      options.filter = 'accountEnabled eq true';
    }

    const m365Users = await microsoftGraphService.getUsers(options);
    const stats = { processed: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 };

    for (const m365User of m365Users) {
      const itsmUser = microsoftGraphService.transformUserForITSM(m365User);

      if (!itsmUser.username || !itsmUser.email) {
        stats.skipped += 1;
        continue;
      }

      try {
        const existing = await dbGet('SELECT id FROM users WHERE external_id = ? AND source = ?', [
          itsmUser.external_id,
          'microsoft365'
        ]);

        if (existing) {
          await dbRun(
            `UPDATE users SET
                email = ?, full_name = ?, is_active = ?, department = ?, job_title = ?,
                synced_at = datetime('now'), updated_at = datetime('now')
               WHERE id = ?`,
            [
              itsmUser.email,
              itsmUser.full_name,
              itsmUser.is_active ? 1 : 0,
              itsmUser.department,
              itsmUser.job_title,
              existing.id
            ]
          );
          stats.updated += 1;
        } else {
          // 新規ユーザーはスキップ（セキュリティ上の理由）
          // 必要に応じてパスワード生成ロジックを追加
          stats.skipped += 1;
        }
        stats.processed += 1;
      } catch (error) {
        console.error(`ユーザー同期エラー: ${itsmUser.username}`, error.message);
        stats.errors += 1;
      }
    }

    res.json({
      success: true,
      message: 'Microsoft 365ユーザー同期完了',
      stats
    });
  } catch (error) {
    console.error('M365ユーザー同期エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /settings/integrations/sync/servicenow/incidents:
 *   post:
 *     summary: ServiceNowインシデント同期
 *     description: ServiceNowからインシデントを同期
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: ServiceNowクエリ文字列
 *               limit:
 *                 type: integer
 *                 default: 100
 *     responses:
 *       200:
 *         description: 同期結果
 */
router.post(
  '/sync/servicenow/incidents',
  authenticateJWT,
  authorize(['admin']),
  async (req, res) => {
    const { query, limit = 100 } = req.body || {};

    if (!serviceNowService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'ServiceNowが設定されていません'
      });
    }

    try {
      const incidents = await serviceNowService.getIncidents({ query, limit });
      const stats = { processed: 0, inserted: 0, updated: 0, errors: 0 };

      for (const snowIncident of incidents) {
        const itsmIncident = serviceNowService.transformIncidentFromServiceNow(snowIncident);

        try {
          const existing = await dbGet(
            'SELECT id FROM incidents WHERE external_id = ? AND source = ?',
            [itsmIncident.external_id, 'servicenow']
          );

          if (existing) {
            await dbRun(
              `UPDATE incidents SET
                title = ?, description = ?, priority = ?, status = ?,
                assigned_to = ?, updated_at = datetime('now')
               WHERE id = ?`,
              [
                itsmIncident.title,
                itsmIncident.description,
                itsmIncident.priority,
                itsmIncident.status,
                itsmIncident.assigned_to,
                existing.id
              ]
            );
            stats.updated += 1;
          } else {
            const incidentId = `INC-SN-${Date.now()}-${stats.processed}`;
            await dbRun(
              `INSERT INTO incidents (
                incident_id, title, description, priority, status, category,
                reporter, assigned_to, external_id, source, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'servicenow', datetime('now'))`,
              [
                incidentId,
                itsmIncident.title,
                itsmIncident.description,
                itsmIncident.priority,
                itsmIncident.status,
                itsmIncident.category,
                itsmIncident.reporter,
                itsmIncident.assigned_to,
                itsmIncident.external_id
              ]
            );
            stats.inserted += 1;
          }
          stats.processed += 1;
        } catch (error) {
          console.error(`インシデント同期エラー:`, error.message);
          stats.errors += 1;
        }
      }

      res.json({
        success: true,
        message: 'ServiceNowインシデント同期完了',
        stats
      });
    } catch (error) {
      console.error('ServiceNowインシデント同期エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /settings/integrations/sync/servicenow/changes:
 *   post:
 *     summary: ServiceNow変更リクエスト同期
 *     description: ServiceNowから変更リクエストを同期
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *                 description: ServiceNowクエリ文字列
 *               limit:
 *                 type: integer
 *                 default: 100
 *     responses:
 *       200:
 *         description: 同期結果
 */
router.post('/sync/servicenow/changes', authenticateJWT, authorize(['admin']), async (req, res) => {
  const { query, limit = 100 } = req.body || {};

  if (!serviceNowService.isConfigured()) {
    return res.status(400).json({
      success: false,
      error: 'ServiceNowが設定されていません'
    });
  }

  try {
    const changes = await serviceNowService.getChangeRequests({ query, limit });
    const stats = { processed: 0, inserted: 0, updated: 0, errors: 0 };

    for (const snowChange of changes) {
      const itsmChange = serviceNowService.transformChangeFromServiceNow(snowChange);

      try {
        const existing = await dbGet(
          'SELECT id FROM changes WHERE external_id = ? AND source = ?',
          [itsmChange.external_id, 'servicenow']
        );

        if (existing) {
          await dbRun(
            `UPDATE changes SET
                title = ?, description = ?, type = ?, priority = ?, status = ?,
                assigned_to = ?, planned_start_date = ?, planned_end_date = ?,
                updated_at = datetime('now')
               WHERE id = ?`,
            [
              itsmChange.title,
              itsmChange.description,
              itsmChange.type,
              itsmChange.priority,
              itsmChange.status,
              itsmChange.assigned_to,
              itsmChange.planned_start_date,
              itsmChange.planned_end_date,
              existing.id
            ]
          );
          stats.updated += 1;
        } else {
          const changeId = `CHG-SN-${Date.now()}-${stats.processed}`;
          await dbRun(
            `INSERT INTO changes (
                change_id, title, description, type, priority, status,
                requester, assigned_to, planned_start_date, planned_end_date,
                external_id, source, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'servicenow', datetime('now'))`,
            [
              changeId,
              itsmChange.title,
              itsmChange.description,
              itsmChange.type,
              itsmChange.priority,
              itsmChange.status,
              itsmChange.requester,
              itsmChange.assigned_to,
              itsmChange.planned_start_date,
              itsmChange.planned_end_date,
              itsmChange.external_id
            ]
          );
          stats.inserted += 1;
        }
        stats.processed += 1;
      } catch (error) {
        console.error(`変更リクエスト同期エラー:`, error.message);
        stats.errors += 1;
      }
    }

    res.json({
      success: true,
      message: 'ServiceNow変更リクエスト同期完了',
      stats
    });
  } catch (error) {
    console.error('ServiceNow変更リクエスト同期エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// カレンダー連携
// ============================================

/**
 * @swagger
 * /settings/integrations/calendar/change-request:
 *   post:
 *     summary: 変更リクエストをカレンダーに登録
 *     description: 変更リクエストをMicrosoft 365カレンダーに登録
 *     tags: [Integrations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - changeId
 *               - organizerEmail
 *             properties:
 *               changeId:
 *                 type: integer
 *                 description: 変更リクエストID
 *               organizerEmail:
 *                 type: string
 *                 description: オーガナイザーのメールアドレス
 *               attendeeEmails:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 参加者のメールアドレス
 *     responses:
 *       200:
 *         description: カレンダー登録成功
 */
router.post(
  '/calendar/change-request',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    const { changeId, organizerEmail, attendeeEmails = [] } = req.body;

    if (!changeId || !organizerEmail) {
      return res.status(400).json({ error: 'changeIdとorganizerEmailは必須です' });
    }

    if (!microsoftGraphService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'Microsoft 365が設定されていません'
      });
    }

    try {
      // 変更リクエストを取得
      const changeRequest = await dbGet('SELECT * FROM changes WHERE id = ?', [changeId]);

      if (!changeRequest) {
        return res.status(404).json({ error: '変更リクエストが見つかりません' });
      }

      // カレンダーイベント作成
      const event = await microsoftGraphService.createChangeRequestEvent(
        changeRequest,
        organizerEmail,
        attendeeEmails
      );

      // 外部IDを保存
      await dbRun(
        `UPDATE changes SET calendar_event_id = ?, updated_at = datetime('now') WHERE id = ?`,
        [event.id, changeId]
      );

      res.json({
        success: true,
        message: 'カレンダーイベントを作成しました',
        eventId: event.id,
        webLink: event.webLink
      });
    } catch (error) {
      console.error('カレンダー登録エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /integrations/m365/status:
 *   get:
 *     summary: Microsoft 365統合ステータス取得
 *     description: Microsoft 365連携機能の現在のステータスを取得します
 */
router.get('/m365/status', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  try {
    res.json({
      enabled: false,
      configured: false,
      last_sync: null,
      status: 'not_configured',
      message: 'Microsoft 365統合は未設定です'
    });
  } catch (error) {
    console.error('M365 status error:', error);
    res.status(500).json({
      error: 'M365ステータスの取得に失敗しました'
    });
  }
});

/**
 * @swagger
 * /integrations/servicenow/status:
 *   get:
 *     summary: ServiceNow統合ステータス取得
 *     description: ServiceNow連携機能の現在のステータスを取得します
 */
router.get(
  '/servicenow/status',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      res.json({
        enabled: false,
        configured: false,
        connected: false,
        instance_url: null,
        username: null,
        last_sync: null,
        status: 'not_configured',
        message: 'ServiceNow統合は未設定です'
      });
    } catch (error) {
      console.error('ServiceNow status error:', error);
      res.status(500).json({
        error: 'ServiceNowステータスの取得に失敗しました'
      });
    }
  }
);

module.exports = router;
