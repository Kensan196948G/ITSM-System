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
      'SELECT release_id, name, version, status, release_date, description, change_count, target_environment, progress, created_at FROM releases ORDER BY release_date DESC',
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
    const { name, version, release_date, description, target_environment } = req.body;

    // nameとversionは必須、release_dateはオプション
    if (!name || !version) {
      return res.status(400).json({ error: '名称とバージョンは必須です' });
    }

    const release_id = `REL-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO releases (release_id, name, version, status, release_date, description, target_environment)
               VALUES (?, ?, ?, 'Planned', ?, ?, ?)`;

    db.run(
      sql,
      [release_id, name, version, release_date || null, description, target_environment],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: 'リリースが正常に作成されました',
          id: release_id,
          created_by: req.user.username
        });
      }
    );
  }
);

// PUT /api/v1/releases/:id - リリース更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('releases'),
  (req, res) => {
    const { name, version, status, release_date, description, progress, target_environment } =
      req.body;
    const sql = `UPDATE releases SET
    name = COALESCE(?, name),
    version = COALESCE(?, version),
    status = COALESCE(?, status),
    release_date = COALESCE(?, release_date),
    description = COALESCE(?, description),
    progress = COALESCE(?, progress),
    target_environment = COALESCE(?, target_environment)
    WHERE release_id = ?`;

    db.run(
      sql,
      [
        name,
        version,
        status,
        release_date,
        description,
        progress,
        target_environment,
        req.params.id
      ],
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
