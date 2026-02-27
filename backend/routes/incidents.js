const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const { incidentValidation } = require('../middleware/validation');
const { validate } = require('../middleware/validation');
const auditLog = require('../middleware/auditLog');
const { cacheMiddleware, invalidateCacheMiddleware } = require('../middleware/cache');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('../middleware/pagination');
const { db } = require('../db');
const { notifyIncident } = require('../services/notificationService');
const { asyncHandler, DatabaseError } = require('../middleware/errorHandler');

// GET /api/v1/incidents - インシデント一覧取得
router.get(
  '/',
  authenticateJWT,
  cacheMiddleware,
  asyncHandler(async (req, res) => {
    const { page, limit, offset } = parsePaginationParams(req);

    // 総件数取得
    const countRow = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM incidents', (err, row) => {
        if (err) {
          reject(new DatabaseError('インシデント一覧の取得中にエラーが発生しました'));
        } else {
          resolve(row);
        }
      });
    });

    // SELECT句最適化 + ページネーション
    const sql = buildPaginationSQL(
      `SELECT
      ticket_id, title, priority, status,
      is_security_incident, created_at
    FROM incidents
    ORDER BY created_at DESC`,
      { limit, offset }
    );

    const rows = await new Promise((resolve, reject) => {
      db.all(sql, (err, resultRows) => {
        if (err) {
          reject(new DatabaseError('インシデント一覧の取得中にエラーが発生しました'));
        } else {
          resolve(resultRows);
        }
      });
    });

    res.json({
      data: rows,
      pagination: createPaginationMeta(countRow.total, page, limit)
    });
  })
);

// GET /api/v1/incidents/:id - インシデント詳細取得
router.get('/:id', authenticateJWT, cacheMiddleware, (req, res) => {
  db.get('SELECT * FROM incidents WHERE ticket_id = ?', [req.params.id], (err, row) => {
    if (err) {
      logger.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    if (!row) return res.status(404).json({ error: 'インシデントが見つかりません' });
    res.json(row);
  });
});

// POST /api/v1/incidents - インシデント作成
router.post(
  '/',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  incidentValidation.create,
  validate,
  auditLog,
  invalidateCacheMiddleware('incidents'),
  (req, res) => {
    const { title, priority, status = 'New', description, is_security_incident = 0 } = req.body;
    const ticket_id = `INC-${Date.now().toString().slice(-6)}`;
    const sql =
      'INSERT INTO incidents (ticket_id, title, priority, status, description, is_security_incident) VALUES (?, ?, ?, ?, ?, ?)';

    db.run(
      sql,
      [ticket_id, title, priority, status, description, is_security_incident],
      function (err) {
        if (err) {
          logger.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }

        // インシデント作成通知を非同期で送信
        const incidentData = {
          id: this.lastID,
          ticket_id,
          title,
          priority,
          status,
          description,
          is_security_incident
        };
        notifyIncident(db, incidentData, 'created').catch((notifyErr) => {
          logger.error('Incident notification error:', notifyErr);
        });

        res.status(201).json({
          message: 'インシデントが正常に作成されました',
          id: ticket_id,
          created_by: req.user.username
        });
      }
    );
  }
);

// PUT /api/v1/incidents/:id - インシデント更新
router.put(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  incidentValidation.update,
  validate,
  auditLog,
  invalidateCacheMiddleware('incidents'),
  (req, res) => {
    const { status, priority, title, description } = req.body;
    const sql = `UPDATE incidents SET
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        title = COALESCE(?, title),
        description = COALESCE(?, description)
        WHERE ticket_id = ?`;

    db.run(sql, [status, priority, title, description, req.params.id], function (err) {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      // Logic: If a security incident is RESOLVED, increase RESPOND and RECOVER progress
      if (status === 'Resolved') {
        db.get(
          'SELECT is_security_incident FROM incidents WHERE ticket_id = ?',
          [req.params.id],
          (lookupErr, row) => {
            if (row && row.is_security_incident) {
              db.run(
                "UPDATE compliance SET progress = MIN(100, progress + 2) WHERE function IN ('RESPOND', 'RECOVER')"
              );
            }
          }
        );
      }

      // インシデント更新通知を非同期で送信
      db.get(
        'SELECT * FROM incidents WHERE ticket_id = ?',
        [req.params.id],
        (lookupErr, incidentRow) => {
          if (incidentRow) {
            const action = status === 'Resolved' ? 'resolved' : 'updated';
            notifyIncident(db, incidentRow, action).catch((notifyErr) => {
              logger.error('Incident notification error:', notifyErr);
            });
          }
        }
      );

      res.json({
        message: 'インシデントが正常に更新されました',
        changes: this.changes,
        updated_by: req.user.username
      });
    });
  }
);

// DELETE /api/v1/incidents/:id - インシデント削除
router.delete(
  '/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('incidents'),
  (req, res) => {
    db.run('DELETE FROM incidents WHERE ticket_id = ?', [req.params.id], function (err) {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'インシデントが見つかりません' });
      }
      res.json({ message: 'インシデントが正常に削除されました', deleted_by: req.user.username });
    });
  }
);

module.exports = router;
