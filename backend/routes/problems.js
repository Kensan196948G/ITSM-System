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

// GET /api/v1/problems - 問題一覧取得
router.get('/', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM problems', (err, countRow) => {
    if (err) {
      logger.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT problem_id, title, status, priority, related_incidents, assignee, created_at, resolved_at FROM problems ORDER BY created_at DESC',
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

// POST /api/v1/problems - 問題作成
router.post(
  '/',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('problems'),
  (req, res) => {
    const { title, description, priority = 'Medium', related_incidents = 0, assignee } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'タイトルは必須です' });
    }

    const problem_id = `PRB-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO problems (problem_id, title, description, status, priority, related_incidents, assignee)
               VALUES (?, ?, ?, 'Open', ?, ?, ?)`;

    db.run(
      sql,
      [problem_id, title, description, priority, related_incidents, assignee || req.user.username],
      function (err) {
        if (err) {
          logger.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: '問題が正常に作成されました',
          id: problem_id,
          created_by: req.user.username
        });
      }
    );
  }
);

// PUT /api/v1/problems/:id - 問題更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('problems'),
  (req, res) => {
    const { title, description, status, priority, root_cause, assignee } = req.body;
    const sql = `UPDATE problems SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    status = COALESCE(?, status),
    priority = COALESCE(?, priority),
    root_cause = COALESCE(?, root_cause),
    assignee = COALESCE(?, assignee),
    resolved_at = CASE WHEN ? = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END
    WHERE problem_id = ?`;

    db.run(
      sql,
      [title, description, status, priority, root_cause, assignee, status, req.params.id],
      function (err) {
        if (err) {
          logger.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '問題が見つかりません' });
        }
        res.json({
          message: '問題が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

// DELETE /api/v1/problems/:id - 問題削除
router.delete(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('problems'),
  (req, res) => {
    db.run('DELETE FROM problems WHERE problem_id = ?', [req.params.id], function (err) {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '問題が見つかりません' });
      }
      res.json({ message: '問題が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

module.exports = router;
