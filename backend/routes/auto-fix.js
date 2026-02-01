/**
 * Auto-Fix API Routes
 * 自動修復API管理
 * Phase 9.2: 監視・ヘルスチェック強化
 */

const express = require('express');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const knex = require('../knex');
const autoFixService = require('../services/autoFixService');

// サービスにKnexインスタンスを注入
autoFixService.setDatabase(knex);

// ===================================
// 手動エラー検知エンドポイント
// ===================================

/**
 * @swagger
 * /auto-fix/scan:
 *   post:
 *     summary: 手動エラー検知
 *     tags: [AutoFix]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 検出されたエラーリスト
 */
router.post(
  '/scan',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const errors = await autoFixService.detectErrors();

    // エラーごとにパターンマッチングを実行
    const detectedErrors = [];
    for (const error of errors) {
      const matched = await autoFixService.matchPattern(error);
      if (matched) {
        detectedErrors.push(matched);
      } else {
        // マッチしなかったエラーもリストに含める
        detectedErrors.push({
          ...error,
          pattern_id: null,
          pattern_name: 'Unknown',
          auto_fix: false
        });
      }
    }

    res.json({
      message: 'Error detection completed',
      data: {
        total_detected: errors.length,
        matched_patterns: detectedErrors.filter((e) => e.pattern_id).length,
        auto_fixable: detectedErrors.filter((e) => e.auto_fix).length,
        errors: detectedErrors
      }
    });
  })
);

// ===================================
// 手動修復実行エンドポイント
// ===================================

/**
 * @swagger
 * /auto-fix/execute:
 *   post:
 *     summary: 手動修復実行
 *     tags: [AutoFix]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pattern_id
 *               - action
 *             properties:
 *               pattern_id:
 *                 type: string
 *               action:
 *                 type: string
 *               error_message:
 *                 type: string
 *     responses:
 *       200:
 *         description: 修復実行結果
 */
router.post(
  '/execute',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { pattern_id, action, error_message = '' } = req.body;

    // バリデーション
    if (!pattern_id || !action) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Required fields: pattern_id, action'
      });
    }

    // エラーコンテキスト構築
    const error = {
      pattern_id,
      actions: [action],
      message: error_message,
      metadata: {},
      severity: 'unknown'
    };

    // 修復アクション実行
    const results = await autoFixService.executeFixAction(error);

    // 履歴記録
    await autoFixService.recordHistory(error, results);

    // クールダウン記録
    const errorHash = autoFixService.generateErrorHash(error_message, pattern_id);
    await autoFixService.recordCooldown(errorHash, pattern_id, 300);

    res.json({
      message: 'Fix action executed',
      data: {
        pattern_id,
        action,
        results
      }
    });
  })
);

// ===================================
// 履歴取得エンドポイント
// ===================================

/**
 * @swagger
 * /auto-fix/history:
 *   get:
 *     summary: 自動修復履歴取得
 *     tags: [AutoFix]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pattern
 *         in: query
 *         schema:
 *           type: string
 *       - name: severity
 *         in: query
 *         schema:
 *           type: string
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: 履歴データ
 */
router.get(
  '/history',
  authenticateJWT,
  authorize(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { pattern, severity, status, limit = 50, offset = 0 } = req.query;

    const filters = {
      pattern,
      severity,
      status
    };

    const pagination = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    };

    // バリデーション
    if (pagination.limit > 200) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Limit cannot exceed 200'
      });
    }

    if (pagination.limit < 1) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Limit must be at least 1'
      });
    }

    if (pagination.offset < 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Offset cannot be negative'
      });
    }

    const result = await autoFixService.getHistory(filters, pagination);

    res.json({
      message: 'Auto-fix history retrieved successfully',
      data: result
    });
  })
);

// ===================================
// ステータス取得エンドポイント
// ===================================

/**
 * @swagger
 * /auto-fix/status:
 *   get:
 *     summary: 自動修復ステータス取得
 *     tags: [AutoFix]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ステータス情報
 */
router.get(
  '/status',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  asyncHandler(async (req, res) => {
    const status = await autoFixService.getStatus();

    res.json({
      message: 'Auto-fix status retrieved successfully',
      data: status
    });
  })
);

// ===================================
// クールダウンリセットエンドポイント
// ===================================

/**
 * @swagger
 * /auto-fix/cooldown/reset:
 *   post:
 *     summary: クールダウンリセット
 *     tags: [AutoFix]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - error_hash
 *             properties:
 *               error_hash:
 *                 type: string
 *     responses:
 *       200:
 *         description: クールダウンリセット成功
 */
router.post(
  '/cooldown/reset',
  authenticateJWT,
  authorize(['admin']),
  asyncHandler(async (req, res) => {
    const { error_hash } = req.body;

    // バリデーション
    if (!error_hash) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Required field: error_hash'
      });
    }

    // SHA256形式の検証（64文字の16進数）
    if (!/^[a-f0-9]{64}$/i.test(error_hash)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'error_hash must be a valid SHA256 hash (64 hex characters)'
      });
    }

    // クールダウンレコードの削除
    const deleted = await knex('auto_fix_cooldowns').where('error_hash', error_hash).delete();

    if (deleted === 0) {
      return res.status(404).json({
        error: 'Cooldown not found',
        message: `No cooldown record found for error_hash: ${error_hash}`
      });
    }

    res.json({
      message: 'Cooldown reset successfully',
      data: {
        error_hash,
        deleted_count: deleted
      }
    });
  })
);

module.exports = router;
