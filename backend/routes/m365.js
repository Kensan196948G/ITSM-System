/**
 * Microsoft 365 Integration Routes
 * @module routes/m365
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { authenticateJWT, authorize } = require('../middleware/auth');
const microsoftGraphService = require('../services/microsoftGraphService');
const { db } = require('../db');

const router = express.Router();

/**
 * Generate a secure temporary password
 * @returns {string} Temporary password
 */
function generateTempPassword() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, 'x');
}

/**
 * Process a single user for synchronization
 * @param {Object} user - ITSM user object
 * @param {Function} dbGet - Database get function
 * @param {Function} dbRun - Database run function
 * @returns {Promise<string>} Result: 'inserted', 'updated', 'skipped', or 'error'
 */
async function processUser(user, dbGet, dbRun) {
  if (!user.username || !user.email) {
    return 'skipped';
  }

  try {
    // Check for existing user
    const existing = await dbGet('SELECT id, username FROM users WHERE username = ? OR email = ?', [
      user.username,
      user.email
    ]);

    if (existing) {
      // Update existing user
      await dbRun(
        `UPDATE users SET
          email = ?,
          full_name = ?,
          is_active = ?,
          department = ?,
          job_title = ?,
          external_id = ?,
          source = ?,
          synced_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?`,
        [
          user.email,
          user.full_name || null,
          user.is_active ? 1 : 0,
          user.department || null,
          user.job_title || null,
          user.external_id,
          user.source,
          existing.id
        ]
      );
      return 'updated';
    }

    // Insert new user with temporary password
    const tempPassword = generateTempPassword();
    const passwordHash = bcrypt.hashSync(tempPassword, 10);

    await dbRun(
      `INSERT INTO users (username, email, password_hash, role, full_name, is_active, department, job_title, external_id, source, synced_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        user.username,
        user.email,
        passwordHash,
        user.role || 'viewer',
        user.full_name || null,
        user.is_active ? 1 : 0,
        user.department || null,
        user.job_title || null,
        user.external_id,
        user.source
      ]
    );
    return 'inserted';
  } catch (err) {
    console.error(`M365 Sync Error for user ${user.username}:`, err.message);
    return 'error';
  }
}

/**
 * @swagger
 * /m365/sync/users:
 *   post:
 *     summary: Microsoft 365からユーザーを同期
 *     description: Azure ADからユーザー情報を取得し、ITSMデータベースに同期します
 *     tags: [Microsoft365]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               activeOnly:
 *                 type: boolean
 *                 description: 有効なユーザーのみ同期
 *                 default: true
 *               maxRecords:
 *                 type: integer
 *                 description: 最大取得件数（0=無制限）
 *                 default: 0
 *     responses:
 *       200:
 *         description: 同期成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     processed:
 *                       type: integer
 *                     inserted:
 *                       type: integer
 *                     updated:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     errors:
 *                       type: integer
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: 同期エラー
 */
router.post('/sync/users', authenticateJWT, authorize(['admin']), async (req, res) => {
  const { activeOnly = true, maxRecords = 0 } = req.body || {};

  // Check M365 configuration
  if (!microsoftGraphService.isConfigured()) {
    return res.status(500).json({
      success: false,
      error: 'Microsoft 365の認証設定が不完全です。環境変数を確認してください。'
    });
  }

  const stats = {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0
  };

  try {
    // Fetch users from M365
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

    // Transform to ITSM format
    const itsmUsers = m365Users.map((u) => microsoftGraphService.transformUserForITSM(u));

    // Promisified database functions
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

    // Process users sequentially (database operations)
    const results = await itsmUsers.reduce(async (promiseAcc, user) => {
      const acc = await promiseAcc;
      const result = await processUser(user, dbGet, dbRun);
      acc.push(result);
      return acc;
    }, Promise.resolve([]));

    // Count results
    results.forEach((result) => {
      stats.processed += 1;
      if (result === 'inserted') stats.inserted += 1;
      else if (result === 'updated') stats.updated += 1;
      else if (result === 'skipped') stats.skipped += 1;
      else if (result === 'error') stats.errors += 1;
    });

    res.json({
      success: true,
      message: 'Microsoft 365からユーザーを同期しました',
      stats
    });
  } catch (error) {
    console.error('M365 Sync Error:', error);
    res.status(500).json({
      success: false,
      error: `同期エラー: ${error.message}`,
      stats
    });
  }
});

/**
 * @swagger
 * /m365/status:
 *   get:
 *     summary: Microsoft 365接続ステータス
 *     description: M365接続設定の状態を確認します
 *     tags: [Microsoft365]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ステータス情報
 */
router.get('/status', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const isConfigured = microsoftGraphService.isConfigured();

  res.json({
    configured: isConfigured,
    message: isConfigured
      ? 'Microsoft 365の接続設定が完了しています'
      : 'Microsoft 365の接続設定が必要です（環境変数を確認してください）'
  });
});

/**
 * @swagger
 * /m365/calendar/events:
 *   get:
 *     summary: カレンダーイベント一覧取得
 *     description: 指定ユーザーのカレンダーイベントを取得します
 *     tags: [Microsoft365]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ユーザーID（UPNまたはオブジェクトID）
 *       - in: query
 *         name: startDateTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 開始日時
 *       - in: query
 *         name: endDateTime
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 終了日時
 *       - in: query
 *         name: top
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 取得件数
 *     responses:
 *       200:
 *         description: カレンダーイベント一覧
 */
router.get(
  '/calendar/events',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    const { userId, startDateTime, endDateTime, top = 50 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userIdは必須です' });
    }

    if (!microsoftGraphService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'Microsoft 365の認証設定が不完全です'
      });
    }

    try {
      const options = { top: parseInt(top, 10) };

      if (startDateTime) {
        options.startDateTime = startDateTime;
      }
      if (endDateTime) {
        options.endDateTime = endDateTime;
      }

      const events = await microsoftGraphService.getCalendarEvents(userId, options);
      const transformedEvents = events.map((e) =>
        microsoftGraphService.transformCalendarEventForITSM(e)
      );

      res.json({
        success: true,
        data: transformedEvents,
        total: transformedEvents.length
      });
    } catch (error) {
      console.error('カレンダーイベント取得エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /m365/groups:
 *   get:
 *     summary: Azure ADグループ一覧取得
 *     description: Azure ADのグループ一覧を取得します
 *     tags: [Microsoft365]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: top
 *         schema:
 *           type: integer
 *           default: 100
 *         description: 取得件数
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *         description: ODataフィルター
 *     responses:
 *       200:
 *         description: グループ一覧
 */
router.get('/groups', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  const { top = 100, filter } = req.query;

  if (!microsoftGraphService.isConfigured()) {
    return res.status(500).json({
      success: false,
      error: 'Microsoft 365の認証設定が不完全です'
    });
  }

  try {
    const options = { top: parseInt(top, 10) };
    if (filter) {
      options.filter = filter;
    }

    const groups = await microsoftGraphService.getGroups(options);

    res.json({
      success: true,
      data: groups,
      total: groups.length
    });
  } catch (error) {
    console.error('グループ取得エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /m365/groups/{groupId}/members:
 *   get:
 *     summary: グループメンバー取得
 *     description: 指定グループのメンバー一覧を取得します
 *     tags: [Microsoft365]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *         description: グループID
 *     responses:
 *       200:
 *         description: メンバー一覧
 */
router.get(
  '/groups/:groupId/members',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    const { groupId } = req.params;

    if (!microsoftGraphService.isConfigured()) {
      return res.status(500).json({
        success: false,
        error: 'Microsoft 365の認証設定が不完全です'
      });
    }

    try {
      const members = await microsoftGraphService.getGroupMembers(groupId);

      res.json({
        success: true,
        data: members,
        total: members.length
      });
    } catch (error) {
      console.error('グループメンバー取得エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /m365/test:
 *   post:
 *     summary: Microsoft 365接続テスト
 *     description: Microsoft Graph APIへの接続をテストします
 *     tags: [Microsoft365]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: テスト結果
 */
router.post('/test', authenticateJWT, authorize(['admin']), async (req, res) => {
  try {
    const result = await microsoftGraphService.testConnection();

    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
