const express = require('express');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { cacheMiddleware, invalidateCacheMiddleware } = require('../middleware/cache');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('../middleware/pagination');
const { db } = require('../db');

// GET /api/v1/releases - リリース一覧取得
router.get('/', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM releases', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT release_id, name, version, status, scheduled_date, actual_date, rollback_plan FROM releases ORDER BY scheduled_date DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

// POST /api/v1/releases - リリース作成
router.post(
  '/',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('releases'),
  (req, res) => {
    const { name, version, scheduled_date, rollback_plan } = req.body;

    if (!name || !version || !scheduled_date) {
      return res.status(400).json({ error: '名称、バージョン、予定日は必須です' });
    }

    const release_id = `REL-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO releases (release_id, name, version, status, scheduled_date, rollback_plan)
               VALUES (?, ?, ?, 'Planned', ?, ?)`;

    db.run(sql, [release_id, name, version, scheduled_date, rollback_plan], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      res.status(201).json({
        message: 'リリースが正常に作成されました',
        id: release_id,
        created_by: req.user.username
      });
    });
  }
);

// PUT /api/v1/releases/:id - リリース更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('releases'),
  (req, res) => {
    const { name, version, status, scheduled_date, actual_date, rollback_plan } = req.body;
    const sql = `UPDATE releases SET
    name = COALESCE(?, name),
    version = COALESCE(?, version),
    status = COALESCE(?, status),
    scheduled_date = COALESCE(?, scheduled_date),
    actual_date = COALESCE(?, actual_date),
    rollback_plan = COALESCE(?, rollback_plan)
    WHERE release_id = ?`;

    db.run(
      sql,
      [name, version, status, scheduled_date, actual_date, rollback_plan, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'リリースが見つかりません' });
        }
        res.json({
          message: 'リリースが正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

// DELETE /api/v1/releases/:id - リリース削除
router.delete(
  '/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('releases'),
  (req, res) => {
    db.run('DELETE FROM releases WHERE release_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'リリースが見つかりません' });
      }
      res.json({ message: 'リリースが正常に削除されました', deleted_by: req.user.username });
    });
  }
);

module.exports = router;
