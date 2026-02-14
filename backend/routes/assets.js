const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { cacheMiddleware, invalidateCacheMiddleware } = require('../middleware/cache');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('../middleware/pagination');
const { db } = require('../db');

// GET /api/v1/assets - 資産一覧取得
router.get('/', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM assets', (err, countRow) => {
    if (err) {
      logger.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      `SELECT
        asset_tag, name, type, criticality, status, last_updated
      FROM assets
      ORDER BY asset_tag ASC`,
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        logger.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

// POST /api/v1/assets - 資産作成
router.post(
  '/',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('assets'),
  (req, res) => {
    const { asset_tag, name, type, criticality = 3, status = 'Operational' } = req.body;

    if (!asset_tag || !name) {
      return res.status(400).json({ error: '資産タグと名称は必須です' });
    }

    const sql = `INSERT INTO assets (asset_tag, name, type, criticality, status, last_updated)
               VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    db.run(sql, [asset_tag, name, type, criticality, status], function (err) {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      res.status(201).json({
        message: '資産が正常に登録されました',
        asset_tag,
        created_by: req.user.username
      });
    });
  }
);

// PUT /api/v1/assets/:id - 資産更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('assets'),
  (req, res) => {
    const { name, type, criticality, status } = req.body;
    const sql = `UPDATE assets SET
    name = COALESCE(?, name),
    type = COALESCE(?, type),
    criticality = COALESCE(?, criticality),
    status = COALESCE(?, status),
    last_updated = CURRENT_TIMESTAMP
    WHERE asset_tag = ?`;

    db.run(sql, [name, type, criticality, status, req.params.id], function (err) {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '資産が見つかりません' });
      }
      res.json({
        message: '資産が正常に更新されました',
        changes: this.changes,
        updated_by: req.user.username
      });
    });
  }
);

// DELETE /api/v1/assets/:id - 資産削除
router.delete(
  '/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('assets'),
  (req, res) => {
    db.run('DELETE FROM assets WHERE asset_tag = ?', [req.params.id], function (err) {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '資産が見つかりません' });
      }
      res.json({ message: '資産が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

module.exports = router;
