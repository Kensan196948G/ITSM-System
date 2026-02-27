const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { db } = require('../db');
const { authenticateJWT, authorize } = require('../middleware/auth');

const router = express.Router();

/** パスワード複雑性ルール（共通） */
const passwordRules = body('password')
  .isLength({ min: 8 })
  .withMessage('パスワードは8文字以上である必要があります')
  .matches(/[A-Z]/)
  .withMessage('パスワードは大文字を1文字以上含む必要があります')
  .matches(/[0-9]/)
  .withMessage('パスワードは数字を1文字以上含む必要があります');

/**
 * @swagger
 * /users:
 *   get:
 *     summary: ユーザー一覧を取得
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ユーザー一覧
 */
router.get('/', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  db.all(
    `SELECT id, username, email, full_name, role, is_active, created_at, last_login
     FROM users
     ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        logger.error('Users fetch error:', err);
        return res.status(500).json({ error: 'ユーザー一覧の取得に失敗しました' });
      }
      res.json(rows || []);
    }
  );
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: ユーザー詳細を取得
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticateJWT, (req, res) => {
  db.get(
    `SELECT id, username, email, full_name, role, is_active, created_at, last_login
     FROM users WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) {
        logger.error('User fetch error:', err);
        return res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
      }
      if (!row) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }
      res.json(row);
    }
  );
});

/**
 * @swagger
 * /users:
 *   post:
 *     summary: ユーザーを作成
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticateJWT, authorize(['admin']), [passwordRules], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, full_name, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, email, password, full_name, role, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      [username, email, hashedPassword, full_name, role || 'viewer'],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res
              .status(400)
              .json({ error: 'ユーザー名またはメールアドレスが既に使用されています' });
          }
          logger.error('User create error:', err);
          return res.status(500).json({ error: 'ユーザーの作成に失敗しました' });
        }
        res.status(201).json({
          id: this.lastID,
          message: 'ユーザーを作成しました'
        });
      }
    );
  } catch (error) {
    logger.error('User create error:', error);
    res.status(500).json({ error: 'ユーザーの作成に失敗しました' });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: ユーザーを更新
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticateJWT, async (req, res) => {
  const { password } = req.body;
  const userId = req.params.id;

  // パスワード変更時のみ複雑性チェック
  if (password !== undefined) {
    await body('password')
      .isLength({ min: 8 })
      .withMessage('パスワードは8文字以上である必要があります')
      .matches(/[A-Z]/)
      .withMessage('パスワードは大文字を1文字以上含む必要があります')
      .matches(/[0-9]/)
      .withMessage('パスワードは数字を1文字以上含む必要があります')
      .run(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  }

  // 自分自身または管理者のみ更新可能
  if (req.user.id !== parseInt(userId, 10) && req.user.role !== 'admin') {
    return res.status(403).json({ error: '権限がありません' });
  }

  try {
    // パーシャルアップデート対応: リクエストボディに含まれるフィールドのみ更新
    const updates = [];
    const params = [];
    const allowedFields = ['username', 'email', 'full_name', 'role', 'is_active'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '更新するフィールドが指定されていません' });
    }

    params.push(userId);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(sql, params, function (err) {
      if (err) {
        logger.error('User update error:', err);
        return res.status(500).json({ error: 'ユーザーの更新に失敗しました' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }
      res.json({ message: 'ユーザーを更新しました' });
    });
  } catch (error) {
    logger.error('User update error:', error);
    res.status(500).json({ error: 'ユーザーの更新に失敗しました' });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: ユーザーを削除
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticateJWT, authorize(['admin']), (req, res) => {
  const userId = req.params.id;

  // 自分自身は削除不可
  if (req.user.id === parseInt(userId, 10)) {
    return res.status(400).json({ error: '自分自身を削除することはできません' });
  }

  db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
    if (err) {
      logger.error('User delete error:', err);
      return res.status(500).json({ error: 'ユーザーの削除に失敗しました' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    res.json({ message: 'ユーザーを削除しました' });
  });
});

module.exports = router;
