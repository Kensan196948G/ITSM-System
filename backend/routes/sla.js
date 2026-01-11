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

// GET /api/v1/sla-agreements - SLA契約一覧取得
router.get('/agreements', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM sla_agreements', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT id, sla_id, service_name, metric_name, target_value, actual_value, achievement_rate, measurement_period, status, created_at FROM sla_agreements ORDER BY service_name ASC',
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

// PUT /api/v1/sla-agreements/:id - SLA契約更新
router.put(
  '/agreements/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('sla_agreements'),
  (req, res) => {
    const { service_name, target_response_time, target_resolution_time } = req.body;
    const sql = `UPDATE sla_agreements SET
    service_name = COALESCE(?, service_name),
    target_response_time = COALESCE(?, target_response_time),
    target_resolution_time = COALESCE(?, target_resolution_time)
    WHERE agreement_id = ?`;

    db.run(
      sql,
      [service_name, target_response_time, target_resolution_time, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'SLA契約が見つかりません' });
        }
        res.json({
          message: 'SLA契約が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

// DELETE /api/v1/sla-agreements/:id - SLA契約削除
router.delete(
  '/agreements/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('sla_agreements'),
  (req, res) => {
    db.run('DELETE FROM sla_agreements WHERE agreement_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'SLA契約が見つかりません' });
      }
      res.json({ message: 'SLA契約が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// GET /api/v1/sla-alerts - SLAアラート一覧取得
router.get('/alerts', authenticateJWT, (req, res) => {
  // Return empty result as sla_alert_history table doesn't exist yet
  res.json({
    data: [],
    alerts: [],
    total: 0,
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
  });
});

// GET /api/v1/sla-alerts/stats - SLAアラート統計取得
router.get('/alerts/stats', authenticateJWT, (req, res) => {
  // Return empty stats as sla_alert_history table doesn't exist yet
  res.json({
    total_alerts: 0,
    acknowledged_alerts: 0,
    pending_alerts: 0
  });
});

// GET /api/v1/sla-alerts/:id - SLAアラート詳細取得
router.get('/alerts/:id', authenticateJWT, (req, res) => {
  db.get('SELECT * FROM sla_alert_history WHERE alert_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    if (!row) return res.status(404).json({ error: 'SLAアラートが見つかりません' });
    res.json(row);
  });
});

// PUT /api/v1/sla-alerts/:id/acknowledge - SLAアラート承認
router.put('/alerts/:id/acknowledge', authenticateJWT, (req, res) => {
  const sql = `UPDATE sla_alert_history SET
    acknowledged = 1,
    acknowledged_by = ?,
    acknowledged_at = CURRENT_TIMESTAMP
    WHERE alert_id = ?`;

  db.run(sql, [req.user.username, req.params.id], function (err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'SLAアラートが見つかりません' });
    }
    res.json({ message: 'SLAアラートが正常に承認されました', acknowledged_by: req.user.username });
  });
});

// POST /api/v1/sla-alerts/acknowledge-bulk - SLAアラート一括承認
router.post('/alerts/acknowledge-bulk', authenticateJWT, (req, res) => {
  const { alert_ids } = req.body;

  if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
    return res.status(400).json({ error: 'アラートIDの配列が必要です' });
  }

  const placeholders = alert_ids.map(() => '?').join(',');
  const sql = `UPDATE sla_alert_history SET
    acknowledged = 1,
    acknowledged_by = ?,
    acknowledged_at = CURRENT_TIMESTAMP
    WHERE alert_id IN (${placeholders})`;

  db.run(sql, [req.user.username, ...alert_ids], function (err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json({
      message: `${this.changes}件のSLAアラートが正常に承認されました`,
      acknowledged_count: this.changes,
      acknowledged_by: req.user.username
    });
  });
});

// GET /api/v1/sla-statistics - SLA統計取得
router.get('/statistics', authenticateJWT, cacheMiddleware, (req, res) => {
  const sql = `
    SELECT
      service_name,
      metric_name,
      target_value,
      actual_value,
      achievement_rate,
      CASE
        WHEN achievement_rate >= 95 THEN 'Excellent'
        WHEN achievement_rate >= 90 THEN 'Good'
        WHEN achievement_rate >= 85 THEN 'Fair'
        ELSE 'Poor'
      END as performance_level
    FROM sla_agreements
    ORDER BY achievement_rate DESC
  `;

  db.all(sql, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

module.exports = router;
