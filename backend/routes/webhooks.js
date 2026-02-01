/* eslint-disable no-await-in-loop, no-restricted-syntax, no-use-before-define */
/**
 * Webhook受信ルート
 * Microsoft 365およびServiceNowからのWebhook処理
 *
 * @module routes/webhooks
 */

const crypto = require('crypto');
const express = require('express');
const { authenticateJWT, authorize } = require('../middleware/auth');
const microsoftGraphService = require('../services/microsoftGraphService');
const serviceNowService = require('../services/serviceNowService');
const { db } = require('../db');

const router = express.Router();

// ============================================
// ヘルパー関数
// ============================================

/**
 * データベース操作のPromiseラッパー
 */
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

/**
 * Webhookイベントをログに記録
 * @param {string} source ソースシステム
 * @param {string} eventType イベントタイプ
 * @param {Object} payload ペイロード
 * @param {string} status ステータス
 * @param {string} error エラーメッセージ
 */
async function logWebhookEvent(source, eventType, payload, status, error = null) {
  try {
    await dbRun(
      `INSERT INTO webhook_logs (source, event_type, payload, status, error_message, received_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [source, eventType, JSON.stringify(payload), status, error]
    );
  } catch (e) {
    console.error('Webhookログ記録エラー:', e.message);
  }
}

/**
 * HMAC署名を検証
 * @param {string} payload リクエストボディ
 * @param {string} signature 署名ヘッダー
 * @param {string} secret シークレットキー
 * @param {string} algorithm ハッシュアルゴリズム
 * @returns {boolean} 署名が有効かどうか
 */
function verifyHmacSignature(payload, signature, secret, algorithm = 'sha256') {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = crypto.createHmac(algorithm, secret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace(/^sha256=/, '')),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ============================================
// Microsoft 365 Webhook
// ============================================

/**
 * @swagger
 * /webhooks/m365:
 *   post:
 *     summary: Microsoft 365 Webhook受信
 *     description: Microsoft Graph APIからの変更通知を受信
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               validationToken:
 *                 type: string
 *                 description: サブスクリプション検証トークン
 *               value:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     subscriptionId:
 *                       type: string
 *                     changeType:
 *                       type: string
 *                     resource:
 *                       type: string
 *                     resourceData:
 *                       type: object
 *     responses:
 *       200:
 *         description: Webhook処理成功
 *       202:
 *         description: 検証トークン返却
 *       400:
 *         description: 署名検証失敗
 */
router.post('/m365', async (req, res) => {
  let payload;
  let rawBody;

  // express.json()が先に処理した場合、req.bodyは既にオブジェクト
  // express.raw()が処理した場合、req.bodyはBuffer
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString();
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: '無効なJSONペイロード' });
    }
  } else if (typeof req.body === 'object' && req.body !== null) {
    // express.json()が既にパースしている場合
    payload = req.body;
    rawBody = JSON.stringify(req.body);
  } else {
    return res.status(400).json({ error: '無効なリクエストボディ' });
  }

  // サブスクリプション検証（Microsoft Graph APIの要件）
  if (payload.validationToken) {
    console.log('[M365 Webhook] サブスクリプション検証');
    return res.status(200).contentType('text/plain').send(payload.validationToken);
  }

  // 署名検証（設定されている場合）
  const signature = req.headers['x-ms-signature'];
  const webhookSecret = process.env.M365_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    if (!verifyHmacSignature(rawBody, signature, webhookSecret)) {
      await logWebhookEvent('microsoft365', 'unknown', payload, 'rejected', '署名検証失敗');
      return res.status(400).json({ error: '署名検証に失敗しました' });
    }
  }

  // 通知処理
  const notifications = payload.value || [];

  for (const notification of notifications) {
    const { changeType, resource, resourceData } = notification;
    const eventType = `${changeType}_${resource.split('/')[0]}`;

    console.log(`[M365 Webhook] 通知受信: ${eventType}`);

    try {
      // ユーザー変更通知
      if (resource.includes('users')) {
        await handleM365UserChange(changeType, resourceData, notification);
      }
      // デバイス変更通知
      else if (resource.includes('devices')) {
        await handleM365DeviceChange(changeType, resourceData, notification);
      }
      // セキュリティアラート通知
      else if (resource.includes('security/alerts')) {
        await handleM365SecurityAlert(changeType, resourceData, notification);
      }

      await logWebhookEvent('microsoft365', eventType, notification, 'processed');
    } catch (error) {
      console.error(`[M365 Webhook] 処理エラー:`, error.message);
      await logWebhookEvent('microsoft365', eventType, notification, 'error', error.message);
    }
  }

  res.status(200).json({ message: '通知を処理しました', count: notifications.length });
});

/**
 * M365ユーザー変更を処理
 */
async function handleM365UserChange(changeType, resourceData, notification) {
  const userId = resourceData?.id || notification.resource.split('/').pop();

  if (!userId) return;

  if (changeType === 'deleted') {
    // ユーザー削除時：無効化
    await dbRun(
      `UPDATE users SET is_active = 0, updated_at = datetime('now')
       WHERE external_id = ? AND source = 'microsoft365'`,
      [userId]
    );
  } else {
    // 作成/更新時：詳細を取得して同期
    try {
      const user = await microsoftGraphService.getUser(userId);
      const itsmUser = microsoftGraphService.transformUserForITSM(user);

      const existing = await dbGet('SELECT id FROM users WHERE external_id = ? AND source = ?', [
        userId,
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
      }
    } catch (error) {
      console.error(`[M365 Webhook] ユーザー同期エラー: ${error.message}`);
    }
  }
}

/**
 * M365デバイス変更を処理
 */
async function handleM365DeviceChange(changeType, resourceData, _notification) {
  const deviceId = resourceData?.id;

  if (!deviceId) return;

  console.log(`[M365 Webhook] デバイス変更: ${changeType} - ${deviceId}`);
  // デバイス同期ロジックをここに実装
}

/**
 * M365セキュリティアラートを処理
 */
async function handleM365SecurityAlert(changeType, resourceData, _notification) {
  console.log(`[M365 Webhook] セキュリティアラート: ${changeType}`);

  // アラートをインシデントとして作成
  if (changeType === 'created' && resourceData) {
    try {
      const alertId = `SEC-ALERT-${Date.now()}`;
      await dbRun(
        `INSERT INTO incidents (incident_id, title, description, priority, status, category, created_at)
         VALUES (?, ?, ?, ?, 'New', 'Security', datetime('now'))`,
        [
          alertId,
          resourceData.title || 'M365セキュリティアラート',
          resourceData.description || JSON.stringify(resourceData),
          resourceData.severity === 'high' ? 'Critical' : 'High'
        ]
      );
    } catch (error) {
      console.error(`[M365 Webhook] アラート作成エラー: ${error.message}`);
    }
  }
}

// ============================================
// ServiceNow Webhook
// ============================================

/**
 * @swagger
 * /webhooks/servicenow:
 *   post:
 *     summary: ServiceNow Webhook受信
 *     description: ServiceNowからの変更通知を受信
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_type:
 *                 type: string
 *                 description: イベントタイプ（incident.created, change.updated等）
 *               record:
 *                 type: object
 *                 description: レコードデータ
 *               sys_id:
 *                 type: string
 *                 description: ServiceNow sys_id
 *     responses:
 *       200:
 *         description: Webhook処理成功
 *       400:
 *         description: 署名検証失敗
 */
router.post('/servicenow', async (req, res) => {
  let payload;
  let rawBody;

  // express.json()が先に処理した場合、req.bodyは既にオブジェクト
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body.toString();
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: '無効なJSONペイロード' });
    }
  } else if (typeof req.body === 'object' && req.body !== null) {
    payload = req.body;
    rawBody = JSON.stringify(req.body);
  } else {
    return res.status(400).json({ error: '無効なリクエストボディ' });
  }

  // 署名検証
  const signature = req.headers['x-servicenow-signature'];
  const webhookSecret = process.env.SERVICENOW_WEBHOOK_SECRET;

  if (webhookSecret) {
    if (!serviceNowService.verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      await logWebhookEvent(
        'servicenow',
        payload.event_type || 'unknown',
        payload,
        'rejected',
        '署名検証失敗'
      );
      return res.status(400).json({ error: '署名検証に失敗しました' });
    }
  }

  const eventType = payload.event_type || 'unknown';
  const record = payload.record || {};

  console.log(`[ServiceNow Webhook] 通知受信: ${eventType}`);

  try {
    // インシデント関連イベント
    if (eventType.startsWith('incident.')) {
      await handleServiceNowIncident(eventType, record, payload);
    }
    // 変更リクエスト関連イベント
    else if (eventType.startsWith('change.') || eventType.startsWith('change_request.')) {
      await handleServiceNowChange(eventType, record, payload);
    }

    await logWebhookEvent('servicenow', eventType, payload, 'processed');
    res.status(200).json({ message: '通知を処理しました', eventType });
  } catch (error) {
    console.error(`[ServiceNow Webhook] 処理エラー:`, error.message);
    await logWebhookEvent('servicenow', eventType, payload, 'error', error.message);
    res.status(500).json({ error: '処理中にエラーが発生しました' });
  }
});

/**
 * ServiceNowインシデントを処理
 */
async function handleServiceNowIncident(eventType, record, payload) {
  const sysId = record.sys_id || payload.sys_id;
  if (!sysId) return;

  const itsmIncident = serviceNowService.transformIncidentFromServiceNow(record);

  // 既存レコードをチェック
  const existing = await dbGet('SELECT id FROM incidents WHERE external_id = ? AND source = ?', [
    sysId,
    'servicenow'
  ]);

  if (eventType === 'incident.created' && !existing) {
    // 新規作成
    const incidentId = `INC-SN-${Date.now()}`;
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
        sysId
      ]
    );
    console.log(`[ServiceNow Webhook] インシデント作成: ${incidentId}`);
  } else if (existing) {
    // 更新
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
    console.log(`[ServiceNow Webhook] インシデント更新: ${existing.id}`);
  }
}

/**
 * ServiceNow変更リクエストを処理
 */
async function handleServiceNowChange(eventType, record, payload) {
  const sysId = record.sys_id || payload.sys_id;
  if (!sysId) return;

  const itsmChange = serviceNowService.transformChangeFromServiceNow(record);

  // 既存レコードをチェック
  const existing = await dbGet('SELECT id FROM changes WHERE external_id = ? AND source = ?', [
    sysId,
    'servicenow'
  ]);

  if ((eventType === 'change.created' || eventType === 'change_request.created') && !existing) {
    // 新規作成
    const changeId = `CHG-SN-${Date.now()}`;
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
        sysId
      ]
    );
    console.log(`[ServiceNow Webhook] 変更リクエスト作成: ${changeId}`);
  } else if (existing) {
    // 更新
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
    console.log(`[ServiceNow Webhook] 変更リクエスト更新: ${existing.id}`);
  }
}

// ============================================
// Webhook管理エンドポイント
// ============================================

/**
 * @swagger
 * /webhooks/logs:
 *   get:
 *     summary: Webhookログ一覧取得
 *     description: 受信したWebhookイベントのログを取得
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [microsoft365, servicenow]
 *         description: ソースシステムでフィルタ
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [processed, error, rejected]
 *         description: ステータスでフィルタ
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 取得件数
 *     responses:
 *       200:
 *         description: ログ一覧
 */
router.get('/logs', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  const { source, status, limit = 50 } = req.query;

  let sql = 'SELECT * FROM webhook_logs WHERE 1=1';
  const params = [];

  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY received_at DESC LIMIT ?';
  params.push(parseInt(limit, 10));

  try {
    const logs = await new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (error) {
    console.error('Webhookログ取得エラー:', error);
    res.status(500).json({ error: 'ログ取得に失敗しました' });
  }
});

module.exports = router;
