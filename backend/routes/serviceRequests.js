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

// GET /api/v1/service-requests - サービスリクエスト一覧取得
router.get('/', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM service_requests', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT request_id, title, request_type, status, requester, priority, created_at FROM service_requests ORDER BY created_at DESC',
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

// POST /api/v1/service-requests - サービスリクエスト作成
router.post(
  '/',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('service_requests'),
  (req, res) => {
    const { title, request_type, description, priority } = req.body;

    if (!title || !request_type) {
      return res.status(400).json({ error: 'タイトルと種類は必須です' });
    }

    const request_id = `SR-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO service_requests (request_id, title, request_type, description, status, priority, requester)
               VALUES (?, ?, ?, ?, 'New', ?, ?)`;

    db.run(sql, [request_id, title, request_type, description, priority || 'Medium', req.user.username], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      res.status(201).json({
        message: 'サービスリクエストが正常に作成されました',
        id: request_id,
        created_by: req.user.username
      });
    });
  }
);

// PUT /api/v1/service-requests/:id - サービスリクエスト更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('service_requests'),
  (req, res) => {
    const { title, category, description, status, assignee } = req.body;
    const sql = `UPDATE service_requests SET
    title = COALESCE(?, title),
    category = COALESCE(?, category),
    description = COALESCE(?, description),
    status = COALESCE(?, status),
    assignee = COALESCE(?, assignee)
    WHERE request_id = ?`;

    db.run(sql, [title, category, description, status, assignee, req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'サービスリクエストが見つかりません' });
      }
      res.json({
        message: 'サービスリクエストが正常に更新されました',
        changes: this.changes,
        updated_by: req.user.username
      });
    });
  }
);

// DELETE /api/v1/service-requests/:id - サービスリクエスト削除
router.delete(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('service_requests'),
  (req, res) => {
    db.run('DELETE FROM service_requests WHERE request_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'サービスリクエストが見つかりません' });
      }
      res.json({
        message: 'サービスリクエストが正常に削除されました',
        deleted_by: req.user.username
      });
    });
  }
);

module.exports = router;
