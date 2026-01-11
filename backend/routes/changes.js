const express = require('express');
const { db } = require('../db');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /changes:
 *   get:
 *     summary: 変更リクエスト一覧を取得
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 変更リクエスト一覧
 */
router.get('/', authenticateJWT, (req, res) => {
  db.all(
    `SELECT id, rfc_id, title, description, asset_tag, status, requester, approver,
            is_security_change, impact_level, created_at, external_id, source
     FROM changes ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) {
        console.error('Changes fetch error:', err);
        return res.status(500).json({ error: '変更リクエストの取得に失敗しました' });
      }
      res.json(rows || []);
    }
  );
});

/**
 * @swagger
 * /changes/{id}:
 *   get:
 *     summary: 変更リクエスト詳細を取得
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticateJWT, (req, res) => {
  db.get(
    `SELECT * FROM changes WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) {
        console.error('Change fetch error:', err);
        return res.status(500).json({ error: '変更リクエストの取得に失敗しました' });
      }
      if (!row) {
        return res.status(404).json({ error: '変更リクエストが見つかりません' });
      }
      res.json(row);
    }
  );
});

/**
 * @swagger
 * /changes:
 *   post:
 *     summary: 変更リクエストを作成
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticateJWT, (req, res) => {
  const { title, description, asset_tag, status, requester, approver, is_security_change, impact_level } = req.body;
  const rfcId = `RFC-${Date.now()}`;

  db.run(
    `INSERT INTO changes (rfc_id, title, description, asset_tag, status, requester, approver, is_security_change, impact_level, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [rfcId, title, description, asset_tag, status || 'Draft', requester || req.user.username, approver, is_security_change ? 1 : 0, impact_level || 'low'],
    function(err) {
      if (err) {
        console.error('Change create error:', err);
        return res.status(500).json({ error: '変更リクエストの作成に失敗しました' });
      }
      res.status(201).json({
        id: this.lastID,
        rfc_id: rfcId,
        message: '変更リクエストを作成しました'
      });
    }
  );
});

/**
 * @swagger
 * /changes/{id}:
 *   put:
 *     summary: 変更リクエストを更新
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', authenticateJWT, (req, res) => {
  const { title, description, asset_tag, status, requester, approver, is_security_change, impact_level } = req.body;

  db.run(
    `UPDATE changes SET title = ?, description = ?, asset_tag = ?, status = ?, requester = ?, approver = ?, is_security_change = ?, impact_level = ?
     WHERE id = ?`,
    [title, description, asset_tag, status, requester, approver, is_security_change ? 1 : 0, impact_level, req.params.id],
    function(err) {
      if (err) {
        console.error('Change update error:', err);
        return res.status(500).json({ error: '変更リクエストの更新に失敗しました' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '変更リクエストが見つかりません' });
      }
      res.json({ message: '変更リクエストを更新しました' });
    }
  );
});

/**
 * @swagger
 * /changes/{id}:
 *   delete:
 *     summary: 変更リクエストを削除
 *     tags: [Changes]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticateJWT, (req, res) => {
  db.run(
    `DELETE FROM changes WHERE id = ?`,
    [req.params.id],
    function(err) {
      if (err) {
        console.error('Change delete error:', err);
        return res.status(500).json({ error: '変更リクエストの削除に失敗しました' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '変更リクエストが見つかりません' });
      }
      res.json({ message: '変更リクエストを削除しました' });
    }
  );
});

module.exports = router;
