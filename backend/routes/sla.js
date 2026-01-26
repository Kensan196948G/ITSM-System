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

// SLA ID生成
function generateSlaId() {
  return `SLA-${Date.now().toString().slice(-8)}`;
}

// GET /api/v1/sla/agreements または /api/v1/sla-agreements - SLA契約一覧取得
router.get('/agreements', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM sla_agreements', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT id, sla_id, service_name, metric_name, target_value, actual_value, achievement_rate, measurement_period, status, created_at FROM sla_agreements ORDER BY created_at DESC',
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

// POST /api/v1/sla/agreements または /api/v1/sla-agreements - SLA契約作成
router.post(
  '/agreements',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('sla_agreements'),
  (req, res) => {
    const {
      service_name,
      metric_name,
      target_value,
      actual_value,
      achievement_rate,
      measurement_period,
      status
    } = req.body;

    // バリデーション
    if (!service_name) {
      return res.status(400).json({ error: 'service_nameは必須です' });
    }
    if (!metric_name || !target_value) {
      return res.status(400).json({ error: 'metric_nameとtarget_valueは必須です' });
    }

    const slaId = generateSlaId();

    const sql = `INSERT INTO sla_agreements (sla_id, service_name, metric_name, target_value, actual_value, achievement_rate, measurement_period, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    db.run(
      sql,
      [
        slaId,
        service_name,
        metric_name,
        target_value,
        actual_value || null,
        achievement_rate || 0,
        measurement_period || 'Monthly',
        status || 'Met'
      ],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: 'SLA契約が正常に作成されました',
          sla_id: slaId,
          id: this.lastID,
          created_by: req.user.username
        });
      }
    );
  }
);

// PUT /api/v1/sla/agreements/:id または /api/v1/sla-agreements/:id - SLA契約更新
router.put(
  '/agreements/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('sla_agreements'),
  (req, res) => {
    const {
      service_name,
      metric_name,
      target_value,
      actual_value,
      achievement_rate,
      measurement_period,
      status
    } = req.body;
    const idParam = req.params.id;

    // IDがSLA-で始まるか確認
    const whereClause = idParam.startsWith('SLA-') ? 'sla_id = ?' : 'id = ?';

    // 前のステータスを取得してアラート判定
    db.get(
      `SELECT status FROM sla_agreements WHERE ${whereClause}`,
      [idParam],
      (getErr, existingRow) => {
        if (getErr) {
          console.error('Database error:', getErr);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (!existingRow) {
          return res.status(404).json({ error: 'SLA契約が見つかりません' });
        }

        const previousStatus = existingRow.status;
        const alertTriggered =
          status && (status === 'Violated' || status === 'At-Risk') && previousStatus === 'Met';

        const sql = `UPDATE sla_agreements SET
        service_name = COALESCE(?, service_name),
        metric_name = COALESCE(?, metric_name),
        target_value = COALESCE(?, target_value),
        actual_value = COALESCE(?, actual_value),
        achievement_rate = COALESCE(?, achievement_rate),
        measurement_period = COALESCE(?, measurement_period),
        status = COALESCE(?, status)
        WHERE ${whereClause}`;

        db.run(
          sql,
          [
            service_name,
            metric_name,
            target_value,
            actual_value,
            achievement_rate,
            measurement_period,
            status,
            idParam
          ],
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
              updated_by: req.user.username,
              alert_triggered: alertTriggered
            });
          }
        );
      }
    );
  }
);

// DELETE /api/v1/sla/agreements/:id または /api/v1/sla-agreements/:id - SLA契約削除
router.delete(
  '/agreements/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('sla_agreements'),
  (req, res) => {
    const idParam = req.params.id;
    const whereClause = idParam.startsWith('SLA-') ? 'sla_id = ?' : 'id = ?';

    db.run(`DELETE FROM sla_agreements WHERE ${whereClause}`, [idParam], function (err) {
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

// GET /api/v1/sla/alerts - SLAアラート一覧取得
router.get('/alerts', authenticateJWT, (req, res) => {
  res.json({
    data: [],
    alerts: [],
    total: 0,
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
  });
});

// GET /api/v1/sla/alerts/stats - SLAアラート統計取得
router.get('/alerts/stats', authenticateJWT, (req, res) => {
  res.json({
    total_alerts: 0,
    acknowledged_alerts: 0,
    pending_alerts: 0
  });
});

// GET /api/v1/sla/alerts/:id - SLAアラート詳細取得
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

// PUT /api/v1/sla/alerts/:id/acknowledge - SLAアラート承認
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

// POST /api/v1/sla/alerts/acknowledge-bulk - SLAアラート一括承認
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

// GET /api/v1/sla/statistics - SLA統計取得
router.get('/statistics', authenticateJWT, cacheMiddleware, (req, res) => {
  const sql = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Met' THEN 1 ELSE 0 END) as met,
      SUM(CASE WHEN status = 'At-Risk' THEN 1 ELSE 0 END) as at_risk,
      SUM(CASE WHEN status = 'Violated' THEN 1 ELSE 0 END) as violated,
      AVG(achievement_rate) as avg_achievement_rate
    FROM sla_agreements
  `;

  db.get(sql, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const total = row.total || 0;
    const met = row.met || 0;
    const complianceRate = total > 0 ? (met / total) * 100 : 0;

    res.json({
      statistics: {
        total,
        met,
        at_risk: row.at_risk || 0,
        violated: row.violated || 0,
        avg_achievement_rate: row.avg_achievement_rate || 0,
        compliance_rate: Math.round(complianceRate * 100) / 100
      },
      alert_threshold: 90
    });
  });
});

module.exports = router;
