const express = require('express');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { cacheMiddleware, invalidateCacheMiddleware } = require('../middleware/cache');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('../middleware/pagination');
const auditLog = require('../middleware/auditLog');
const { db } = require('../db');

// GET /api/v1/vulnerabilities - 脆弱性一覧取得
router.get('/', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM vulnerabilities', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT vulnerability_id, title, severity, cvss_score, affected_asset, status, detection_date FROM vulnerabilities ORDER BY cvss_score DESC',
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

// POST /api/v1/vulnerabilities - 脆弱性作成
router.post(
  '/',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { title, description, severity, cvss_score, affected_asset } = req.body;

    if (!title || !severity) {
      return res.status(400).json({ error: 'タイトルと深刻度は必須です' });
    }

    const vulnerability_id = `VUL-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO vulnerabilities (vulnerability_id, title, description, severity, cvss_score, affected_asset, status)
               VALUES (?, ?, ?, ?, ?, ?, 'Open')`;

    db.run(
      sql,
      [vulnerability_id, title, description, severity, cvss_score, affected_asset],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: '脆弱性が正常に作成されました',
          id: vulnerability_id,
          created_by: req.user.username
        });
      }
    );
  }
);

// PUT /api/v1/vulnerabilities/:id - 脆弱性更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { title, description, severity, cvss_score, affected_asset, status } = req.body;
    const sql = `UPDATE vulnerabilities SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    severity = COALESCE(?, severity),
    cvss_score = COALESCE(?, cvss_score),
    affected_asset = COALESCE(?, affected_asset),
    status = COALESCE(?, status),
    resolution_date = CASE WHEN ? = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolution_date END
    WHERE vulnerability_id = ?`;

    db.run(
      sql,
      [title, description, severity, cvss_score, affected_asset, status, status, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '脆弱性が見つかりません' });
        }
        res.json({
          message: '脆弱性が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

// DELETE /api/v1/vulnerabilities/:id - 脆弱性削除
router.delete(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    db.run(
      'DELETE FROM vulnerabilities WHERE vulnerability_id = ?',
      [req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '脆弱性が見つかりません' });
        }
        res.json({ message: '脆弱性が正常に削除されました', deleted_by: req.user.username });
      }
    );
  }
);

module.exports = router;
