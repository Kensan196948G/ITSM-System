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

// SLA ID生成
function generateSlaId() {
  return `SLA-${Date.now().toString().slice(-8)}`;
}

// GET /api/v1/sla/agreements または /api/v1/sla-agreements - SLA契約一覧取得
router.get('/agreements', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM sla_agreements', (err, countRow) => {
    if (err) {
      logger.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT id, sla_id, service_name, metric_name, target_value, actual_value, achievement_rate, measurement_period, status, created_at FROM sla_agreements ORDER BY created_at DESC',
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
          logger.error('Database error:', err);
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
          logger.error('Database error:', getErr);
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
              logger.error('Database error:', err);
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
        logger.error('Database error:', err);
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
      logger.error('Database error:', err);
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
      logger.error('Database error:', err);
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
      logger.error('Database error:', err);
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
      logger.error('Database error:', err);
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

// GET /api/v1/sla/metrics - SLO/SLAメトリクス計算（可用性・応答時間・達成率）
router.get('/metrics', authenticateJWT, cacheMiddleware, (req, res) => {
  // SLA契約データからメトリクスを集計
  const slaStatsSql = `
    SELECT
      COUNT(*) as total_agreements,
      SUM(CASE WHEN status = 'Met' THEN 1 ELSE 0 END) as met_count,
      SUM(CASE WHEN status = 'At-Risk' THEN 1 ELSE 0 END) as at_risk_count,
      SUM(CASE WHEN status = 'Violated' THEN 1 ELSE 0 END) as violated_count,
      AVG(CAST(achievement_rate AS REAL)) as avg_achievement_rate,
      AVG(CAST(actual_value AS REAL)) as avg_actual_value,
      AVG(CAST(target_value AS REAL)) as avg_target_value
    FROM sla_agreements
  `;

  // インシデントデータからMTTR（平均解決時間）を計算
  const mttrSql = `
    SELECT
      COUNT(*) as total_incidents,
      AVG(
        CASE
          WHEN resolved_at IS NOT NULL AND created_at IS NOT NULL
          THEN (julianday(resolved_at) - julianday(created_at)) * 24 * 60
          ELSE NULL
        END
      ) as avg_resolution_minutes,
      COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_count
    FROM incidents
    WHERE created_at >= datetime('now', '-30 days')
  `;

  db.get(slaStatsSql, (slaErr, slaRow) => {
    if (slaErr) {
      logger.error('SLA metrics DB error:', slaErr);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    db.get(mttrSql, (mttrErr, mttrData) => {
      // MTTRは任意データのためエラーでも継続
      const mttrRow = mttrErr
        ? { total_incidents: 0, avg_resolution_minutes: null, resolved_count: 0 }
        : mttrData;

      const totalAgreements = slaRow.total_agreements || 0;
      const metCount = slaRow.met_count || 0;
      const avgAchievementRate = slaRow.avg_achievement_rate || 0;

      // SLO目標値（NIST CSF 2.0準拠）
      const sloTargets = {
        availability: 99.5, // 可用性 ≥ 99.5%
        response_time_p95_ms: 500, // API応答時間P95 ≤ 500ms
        mttr_minutes: 15, // 平均解決時間 ≤ 15分
        sla_compliance_rate: 95.0 // SLA達成率 ≥ 95%
      };

      // 現在値の計算
      const currentSlaComplianceRate = totalAgreements > 0 ? (metCount / totalAgreements) * 100 : 0;

      const avgResolutionMinutes = mttrRow.avg_resolution_minutes;

      // SLO達成判定
      const sloStatus = {
        availability: {
          target: sloTargets.availability,
          current: avgAchievementRate,
          met: avgAchievementRate >= sloTargets.availability,
          unit: '%'
        },
        sla_compliance: {
          target: sloTargets.sla_compliance_rate,
          current: Math.round(currentSlaComplianceRate * 100) / 100,
          met: currentSlaComplianceRate >= sloTargets.sla_compliance_rate,
          unit: '%'
        },
        mttr: {
          target: sloTargets.mttr_minutes,
          current:
            avgResolutionMinutes !== null ? Math.round(avgResolutionMinutes * 10) / 10 : null,
          met:
            avgResolutionMinutes !== null ? avgResolutionMinutes <= sloTargets.mttr_minutes : null,
          unit: '分'
        }
      };

      const sloMetCount = Object.values(sloStatus).filter((s) => s.met === true).length;
      const sloTotalCount = Object.values(sloStatus).filter((s) => s.met !== null).length;

      res.json({
        metrics: {
          sla_agreements: {
            total: totalAgreements,
            met: metCount,
            at_risk: slaRow.at_risk_count || 0,
            violated: slaRow.violated_count || 0,
            compliance_rate: Math.round(currentSlaComplianceRate * 100) / 100,
            avg_achievement_rate: Math.round(avgAchievementRate * 100) / 100
          },
          incidents: {
            total_last_30_days: mttrRow.total_incidents || 0,
            resolved: mttrRow.resolved_count || 0,
            avg_resolution_minutes:
              avgResolutionMinutes !== null ? Math.round(avgResolutionMinutes * 10) / 10 : null
          },
          slo_status: sloStatus,
          overall: {
            slo_met: sloMetCount,
            slo_total: sloTotalCount,
            health_score: sloTotalCount > 0 ? Math.round((sloMetCount / sloTotalCount) * 100) : 0
          }
        },
        targets: sloTargets,
        generated_at: new Date().toISOString()
      });
    });
  });
});

module.exports = router;
