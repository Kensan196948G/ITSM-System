/**
 * バックアップ・リストアAPIルート
 * Phase 9.1: Backup & Restore functionality
 * ISO 20000 & NIST CSF 2.0 準拠
 */

const express = require('express');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const knex = require('../knex');
const backupService = require('../services/backupService');

// BackupServiceにKnexインスタンスを注入
backupService.setDatabase(knex);

/**
 * @swagger
 * /backups:
 *   post:
 *     summary: バックアップ作成
 *     description: 手動バックアップを作成します（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [daily, weekly, monthly, manual]
 *                 description: バックアップ種別
 *               description:
 *                 type: string
 *                 description: バックアップ説明（manual時）
 *     responses:
 *       201:
 *         description: バックアップ作成成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: バックアップ作成失敗
 */
router.post(
  '/',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { type = 'manual', description = '' } = req.body;
    const userId = req.user.id;

    // バリデーション
    if (!['daily', 'weekly', 'monthly', 'manual'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid backup type',
        message: 'Backup type must be one of: daily, weekly, monthly, manual'
      });
    }

    // バックアップ作成
    const result = await backupService.createBackup(type, userId, description);

    // 監査ログ記録
    await knex('backup_audit_logs').insert({
      operation: 'create',
      backup_id: result.backupId,
      user_id: userId,
      username: req.user.username,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      details: JSON.stringify({
        backup_type: type,
        file_size: result.fileSize,
        duration_seconds: result.duration
      })
    });

    res.status(201).json({
      message: 'Backup created successfully',
      data: result
    });
  })
);

/**
 * @swagger
 * /backups:
 *   get:
 *     summary: バックアップ一覧取得
 *     description: バックアップ履歴を取得します（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, manual]
 *         description: バックアップ種別でフィルタ
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [in_progress, success, failure]
 *         description: ステータスでフィルタ
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: 取得件数
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: オフセット
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, started_at, file_size, backup_type]
 *           default: created_at
 *         description: ソートキー
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: ソート順
 *     responses:
 *       200:
 *         description: バックアップ一覧
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get(
  '/',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { type, status, limit = 50, offset = 0, sort = 'created_at', order = 'desc' } = req.query;

    const options = {
      type,
      status,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      sort,
      order
    };

    const result = await backupService.listBackups(options);

    // 監査ログ記録
    await knex('backup_audit_logs').insert({
      operation: 'list',
      backup_id: null,
      user_id: req.user.id,
      username: req.user.username,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      details: JSON.stringify({
        filters: { type, status },
        result_count: result.backups.length
      })
    });

    res.json({
      message: 'Backups retrieved successfully',
      data: result
    });
  })
);

/**
 * @swagger
 * /backups/stats:
 *   get:
 *     summary: バックアップ統計取得
 *     description: バックアップの統計情報を取得します（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: バックアップ統計
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get(
  '/stats',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    // バックアップ統計情報を取得
    const [totalBackups] = await knex('backup_logs')
      .whereNot('status', 'deleted')
      .count('* as count');

    const [successBackups] = await knex('backup_logs')
      .where('status', 'success')
      .count('* as count');

    const [failedBackups] = await knex('backup_logs')
      .where('status', 'failure')
      .count('* as count');

    const [totalSize] = await knex('backup_logs')
      .where('status', 'success')
      .sum('file_size as total');

    const latestBackup = await knex('backup_logs')
      .where('status', 'success')
      .orderBy('created_at', 'desc')
      .first();

    const stats = {
      total_backups: totalBackups.count,
      successful_backups: successBackups.count,
      failed_backups: failedBackups.count,
      total_size_bytes: totalSize.total || 0,
      latest_backup: latestBackup
        ? {
            backup_id: latestBackup.backup_id,
            backup_type: latestBackup.backup_type,
            created_at: latestBackup.created_at,
            file_size: latestBackup.file_size
          }
        : null
    };

    res.json({
      message: 'Backup statistics retrieved successfully',
      data: stats
    });
  })
);

/**
 * @swagger
 * /backups/{backupId}:
 *   get:
 *     summary: バックアップ詳細取得
 *     description: 特定のバックアップ詳細を取得します（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *         description: Backup ID (e.g. BKP-20260131-143025-daily)
 *     responses:
 *       200:
 *         description: バックアップ詳細
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: バックアップが見つかりません
 */
router.get(
  '/:backupId',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { backupId } = req.params;

    const backup = await backupService.getBackup(backupId);

    if (!backup) {
      return res.status(404).json({
        error: 'Backup not found',
        message: `Backup with ID ${backupId} does not exist`
      });
    }

    res.json({
      message: 'Backup retrieved successfully',
      data: backup
    });
  })
);

/**
 * @swagger
 * /backups/{backupId}/restore:
 *   post:
 *     summary: リストア実行
 *     description: バックアップからデータベースをリストアします（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *         description: バックアップID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirm:
 *                 type: boolean
 *                 default: true
 *                 description: リストア実行確認
 *               backup_current:
 *                 type: boolean
 *                 default: true
 *                 description: リストア前に現在のDBをバックアップ
 *     responses:
 *       200:
 *         description: リストア成功
 *       400:
 *         description: リクエストエラー
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: バックアップが見つかりません
 *       500:
 *         description: リストア失敗
 */
router.post(
  '/:backupId/restore',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const { confirm = true, backup_current = true } = req.body;
    const userId = req.user.id;

    if (!confirm) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Please set confirm: true to execute restore'
      });
    }

    try {
      const result = await backupService.restoreBackup(backupId, userId, { backup_current });

      // 監査ログ記録
      await knex('backup_audit_logs').insert({
        operation: 'restore',
        backup_id: backupId,
        user_id: userId,
        username: req.user.username,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        status: 'success',
        details: JSON.stringify({
          backup_current,
          restored_from: backupId
        })
      });

      res.json({
        message: 'Restore completed successfully',
        data: result
      });
    } catch (error) {
      // 監査ログ記録（失敗）
      await knex('backup_audit_logs').insert({
        operation: 'restore',
        backup_id: backupId,
        user_id: userId,
        username: req.user.username,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        status: 'failure',
        error_message: error.message
      });

      throw error;
    }
  })
);

/**
 * @swagger
 * /backups/{backupId}:
 *   delete:
 *     summary: バックアップ削除
 *     description: バックアップファイルとログを削除します（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *         description: バックアップID
 *     responses:
 *       200:
 *         description: バックアップ削除成功
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       404:
 *         description: バックアップが見つかりません
 *       500:
 *         description: 削除失敗
 */
router.delete(
  '/:backupId',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const userId = req.user.id;

    try {
      await backupService.deleteBackup(backupId, userId);

      // 監査ログ記録
      await knex('backup_audit_logs').insert({
        operation: 'delete',
        backup_id: backupId,
        user_id: userId,
        username: req.user.username,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        status: 'success',
        details: JSON.stringify({
          deleted_by: req.user.username
        })
      });

      res.json({
        message: 'Backup deleted successfully'
      });
    } catch (error) {
      // 監査ログ記録（失敗）
      await knex('backup_audit_logs').insert({
        operation: 'delete',
        backup_id: backupId,
        user_id: userId,
        username: req.user.username,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        status: 'failure',
        error_message: error.message
      });

      throw error;
    }
  })
);

/**
 * @swagger
 * /backups/{backupId}/verify:
 *   post:
 *     summary: 整合性チェック実行
 *     description: バックアップファイルの整合性をチェックします（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: backupId
 *         required: true
 *         schema:
 *           type: string
 *         description: バックアップID（省略時は全バックアップ）
 *     responses:
 *       200:
 *         description: チェック完了
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 *       500:
 *         description: チェック失敗
 */
router.post(
  '/:backupId/verify',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { backupId } = req.params;
    const userId = req.user.id;

    const result = await backupService.checkIntegrity(backupId);

    // 監査ログ記録
    await knex('backup_audit_logs').insert({
      operation: 'verify',
      backup_id: backupId,
      user_id: userId,
      username: req.user.username,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      details: JSON.stringify({
        total_checks: result.total_checks,
        passed: result.passed,
        failed: result.failed
      })
    });

    res.json({
      message: 'Integrity check completed',
      data: result
    });
  })
);

/**
 * @swagger
 * /backups/health/integrity:
 *   get:
 *     summary: データベース整合性チェック
 *     description: データベース本体のSQLite整合性チェックを実行します（Admin権限必須）
 *     tags: [Backup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: チェック結果
 *       500:
 *         description: チェック失敗
 */
router.get(
  '/health/integrity',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    // eslint-disable-next-line global-require
    const { checkDatabaseIntegrity } = require('../services/dbHealthService');
    const result = await checkDatabaseIntegrity();
    res.json(result);
  })
);

module.exports = router;
