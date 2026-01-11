/**
 * ダッシュボード強化API
 * チャートデータとウィジェットデータを提供するエンドポイント
 */

const express = require('express');
const { db } = require('../db');
const { authenticateJWT } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

// ===== ヘルパー関数 =====

/**
 * 過去7日間のインシデント推移データを取得
 */
function getIncidentTrend() {
  return new Promise((resolve, reject) => {
    // 過去7日間の日付ラベルを生成
    const labels = [];
    const dateConditions = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
      dateConditions.push(dateStr);
    }

    // 各日付のインシデント数をカウント
    const sql = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM incidents
      WHERE DATE(created_at) >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      // 日付ごとのカウントをマッピング
      const countMap = {};
      (rows || []).forEach((row) => {
        countMap[row.date] = row.count;
      });

      // 各日付のデータを配列に変換（データがない日は0）
      const data = dateConditions.map((dateStr) => countMap[dateStr] || 0);

      // クローズされたインシデント数も取得
      const closedSql = `
        SELECT DATE(resolved_at) as date, COUNT(*) as count
        FROM incidents
        WHERE DATE(resolved_at) >= DATE('now', '-7 days')
          AND resolved_at IS NOT NULL
        GROUP BY DATE(resolved_at)
        ORDER BY DATE(resolved_at)
      `;

      db.all(closedSql, (closedErr, closedRows) => {
        if (closedErr) {
          reject(closedErr);
          return;
        }

        const closedMap = {};
        (closedRows || []).forEach((row) => {
          closedMap[row.date] = row.count;
        });

        const closedData = dateConditions.map((dateStr) => closedMap[dateStr] || 0);

        resolve({
          labels,
          datasets: [
            {
              label: '新規インシデント',
              data,
              borderColor: '#4f46e5',
              backgroundColor: 'rgba(79, 70, 229, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: '解決済み',
              data: closedData,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        });
      });
    });
  });
}

/**
 * SLA達成率データを取得
 */
function getSlaAchievement() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        SUM(CASE WHEN status = 'Met' THEN 1 ELSE 0 END) as met,
        SUM(CASE WHEN status = 'At-Risk' THEN 1 ELSE 0 END) as at_risk,
        SUM(CASE WHEN status IN ('Violated', 'Breached') THEN 1 ELSE 0 END) as violated,
        COUNT(*) as total
      FROM sla_agreements
    `;

    db.get(sql, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      const met = row?.met || 0;
      const atRisk = row?.at_risk || 0;
      const violated = row?.violated || 0;
      const total = row?.total || 0;

      // 達成率を計算
      const achievementRate = total > 0 ? Math.round((met / total) * 100) : 0;

      resolve({
        labels: ['達成', 'リスク', '違反'],
        datasets: [
          {
            data: [met, atRisk, violated],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }
        ],
        summary: {
          total,
          met,
          atRisk,
          violated,
          achievementRate
        }
      });
    });
  });
}

/**
 * 優先度別インシデント数を取得
 */
function getIncidentsByPriority() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        priority,
        COUNT(*) as count
      FROM incidents
      WHERE status NOT IN ('Closed', 'Resolved')
      GROUP BY priority
      ORDER BY
        CASE priority
          WHEN 'Critical' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3
          WHEN 'Low' THEN 4
          ELSE 5
        END
    `;

    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      // 優先度の順序を定義
      const priorityOrder = ['Critical', 'High', 'Medium', 'Low'];
      const priorityColors = {
        Critical: '#ef4444',
        High: '#f97316',
        Medium: '#f59e0b',
        Low: '#22c55e'
      };

      const priorityLabels = {
        Critical: '緊急',
        High: '高',
        Medium: '中',
        Low: '低'
      };

      // 優先度ごとのカウントをマッピング
      const countMap = {};
      (rows || []).forEach((row) => {
        countMap[row.priority] = row.count;
      });

      const labels = priorityOrder.map((p) => priorityLabels[p] || p);
      const data = priorityOrder.map((p) => countMap[p] || 0);
      const backgroundColor = priorityOrder.map((p) => priorityColors[p]);

      resolve({
        labels,
        datasets: [
          {
            label: 'インシデント数',
            data,
            backgroundColor
          }
        ]
      });
    });
  });
}

/**
 * ステータス別インシデント数を取得
 */
function getIncidentsByStatus() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        status,
        COUNT(*) as count
      FROM incidents
      GROUP BY status
    `;

    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const statusLabels = {
        Open: '未対応',
        'In Progress': '対応中',
        Pending: '保留',
        Resolved: '解決済み',
        Closed: '完了'
      };

      const statusColors = {
        Open: '#ef4444',
        'In Progress': '#3b82f6',
        Pending: '#f59e0b',
        Resolved: '#10b981',
        Closed: '#6b7280'
      };

      const labels = (rows || []).map((r) => statusLabels[r.status] || r.status);
      const data = (rows || []).map((r) => r.count);
      const backgroundColor = (rows || []).map((r) => statusColors[r.status] || '#94a3b8');

      resolve({
        labels,
        datasets: [
          {
            data,
            backgroundColor,
            borderWidth: 0
          }
        ]
      });
    });
  });
}

/**
 * 変更リクエストの傾向データを取得
 */
function getChangeTrend() {
  return new Promise((resolve, reject) => {
    const labels = [];
    const dateConditions = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      labels.push(`${date.getMonth() + 1}/${date.getDate()}`);
      dateConditions.push(dateStr);
    }

    const sql = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM changes
      WHERE DATE(created_at) >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;

    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      const countMap = {};
      (rows || []).forEach((row) => {
        countMap[row.date] = row.count;
      });

      const data = dateConditions.map((dateStr) => countMap[dateStr] || 0);

      resolve({
        labels,
        datasets: [
          {
            label: '変更リクエスト',
            data,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      });
    });
  });
}

/**
 * KPIメトリクスを取得（MTTR, MTBF, SLA達成率）
 */
function getKpiMetrics() {
  return new Promise((resolve, reject) => {
    // MTTR（平均修復時間）の計算
    const mttrSql = `
      SELECT
        AVG(
          CAST(
            (julianday(resolved_at) - julianday(created_at)) * 24
          AS REAL)
        ) as mttr
      FROM incidents
      WHERE resolved_at IS NOT NULL
        AND created_at IS NOT NULL
    `;

    db.get(mttrSql, (err, mttrRow) => {
      if (err) {
        reject(err);
        return;
      }

      // MTBF（平均故障間隔）の計算
      const mtbfSql = `
        SELECT
          (30 * 24.0) / NULLIF(COUNT(*), 0) as mtbf
        FROM incidents
        WHERE created_at >= datetime('now', '-30 days')
      `;

      db.get(mtbfSql, (mtbfErr, mtbfRow) => {
        if (mtbfErr) {
          reject(mtbfErr);
          return;
        }

        // SLA達成率の計算
        const slaSql = `
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Met' THEN 1 ELSE 0 END) as met
          FROM sla_agreements
        `;

        db.get(slaSql, (slaErr, slaRow) => {
          if (slaErr) {
            reject(slaErr);
            return;
          }

          // アクティブインシデント数
          const activeIncidentsSql = `
            SELECT COUNT(*) as count FROM incidents
            WHERE status NOT IN ('resolved', 'closed', 'Resolved', 'Closed')
          `;

          db.get(activeIncidentsSql, (incErr, incRow) => {
            if (incErr) {
              reject(incErr);
              return;
            }

            // 重要脆弱性数（vulnerabilities テーブルが存在しない場合は0）
            const vulnSql = `
              SELECT COUNT(*) as count FROM vulnerabilities
              WHERE severity IN ('Critical', 'critical', 'High', 'high')
                AND status NOT IN ('resolved', 'closed', 'Resolved', 'Closed', 'Remediated')
            `;

            db.get(vulnSql, (vulnErr, vulnRow) => {
              // テーブルがない場合は0として処理
              const criticalVulns = vulnRow?.count || 0;

              const mttr = mttrRow?.mttr ? Math.round(mttrRow.mttr * 10) / 10 : 0;
              const mtbf = mtbfRow?.mtbf ? Math.round(mtbfRow.mtbf * 10) / 10 : 0;
              const slaTotal = slaRow?.total || 0;
              const slaMet = slaRow?.met || 0;
              const slaAchievementRate = slaTotal > 0 ? Math.round((slaMet / slaTotal) * 1000) / 10 : 0;
              const activeIncidents = incRow?.count || 0;

              resolve({
                // フロントエンドが期待する形式
                active_incidents: activeIncidents,
                sla_compliance: slaAchievementRate,
                vulnerabilities: {
                  critical: criticalVulns,
                  high: 0,
                  medium: 0,
                  low: 0
                },
                csf_progress: {
                  govern: 75,
                  identify: 80,
                  protect: 70,
                  detect: 65,
                  respond: 60,
                  recover: 55
                },
                // 従来のKPIデータも維持
                mttr: {
                  value: mttr,
                  unit: '時間',
                  label: '平均修復時間 (MTTR)',
                  description: 'インシデント発生から解決までの平均時間'
                },
                mtbf: {
                  value: mtbf,
                  unit: '時間',
                  label: '平均故障間隔 (MTBF)',
                  description: 'インシデント発生の平均間隔（30日間）'
                },
                slaAchievementRate: {
                  value: slaAchievementRate,
                  unit: '%',
                  label: 'SLA達成率',
                  description: '全SLA契約のうち達成しているものの割合'
                }
              });
            });
          });
        });
      });
    });
  });
}

/**
 * アクティブインシデント数サマリーを取得
 */
function getActiveIncidentsSummary() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN priority = 'Critical' AND status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN priority = 'High' AND status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END) as high
      FROM incidents
      WHERE status NOT IN ('Resolved', 'Closed')
    `;

    db.get(sql, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        total: row?.total || 0,
        open: row?.open || 0,
        inProgress: row?.in_progress || 0,
        pending: row?.pending || 0,
        critical: row?.critical || 0,
        high: row?.high || 0
      });
    });
  });
}

/**
 * 今週の変更リクエスト数を取得
 */
function getWeeklyChanges() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'Implemented' THEN 1 ELSE 0 END) as implemented,
        SUM(CASE WHEN impact_level = 'low' THEN 1 ELSE 0 END) as standard,
        SUM(CASE WHEN impact_level = 'medium' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN impact_level = 'high' OR is_security_change = 1 THEN 1 ELSE 0 END) as emergency
      FROM changes
      WHERE created_at >= datetime('now', '-7 days')
    `;

    db.get(sql, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        total: row?.total || 0,
        approved: row?.approved || 0,
        pending: row?.pending || 0,
        rejected: row?.rejected || 0,
        implemented: row?.implemented || 0,
        byType: {
          standard: row?.standard || 0,
          normal: row?.normal || 0,
          emergency: row?.emergency || 0
        }
      });
    });
  });
}

/**
 * 問題管理統計を取得
 */
function getProblemStats() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
      FROM problems
    `;

    db.get(sql, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        total: row?.total || 0,
        open: row?.open || 0,
        inProgress: row?.in_progress || 0,
        resolved: row?.resolved || 0
      });
    });
  });
}

/**
 * 脆弱性統計を取得
 */
function getVulnerabilityStats() {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'Critical' AND status NOT IN ('Resolved', 'Mitigated') THEN 1 ELSE 0 END) as critical_open,
        SUM(CASE WHEN severity = 'High' AND status NOT IN ('Resolved', 'Mitigated') THEN 1 ELSE 0 END) as high_open,
        SUM(CASE WHEN status IN ('Resolved', 'Mitigated') THEN 1 ELSE 0 END) as resolved
      FROM vulnerabilities
    `;

    db.get(sql, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({
        total: row?.total || 0,
        criticalOpen: row?.critical_open || 0,
        highOpen: row?.high_open || 0,
        resolved: row?.resolved || 0
      });
    });
  });
}

// ===== APIルート =====

/**
 * @swagger
 * /dashboard/kpi:
 *   get:
 *     summary: KPIメトリクスを取得
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPIメトリクスデータ
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: 内部サーバーエラー
 */
router.get('/kpi', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const kpiData = await getKpiMetrics();
    res.json(kpiData);
  } catch (error) {
    console.error('KPI data fetch error:', error);
    res.status(500).json({ error: 'KPIデータの取得に失敗しました' });
  }
});

/**
 * @swagger
 * /dashboard/charts:
 *   get:
 *     summary: チャートデータ取得
 *     description: ダッシュボード用のインシデント傾向、SLA達成率、優先度別インシデント数のチャートデータを取得します。
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: チャートデータ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 incidentTrend:
 *                   type: object
 *                   description: 過去7日間のインシデント推移データ
 *                 slaAchievement:
 *                   type: object
 *                   description: SLA達成率の円グラフデータ
 *                 incidentsByPriority:
 *                   type: object
 *                   description: 優先度別インシデント数の棒グラフデータ
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: 内部サーバーエラー
 */
router.get('/charts', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    // 過去7日間のインシデント推移データを取得
    const incidentTrendData = await getIncidentTrend();

    // SLA達成率データを取得
    const slaAchievementData = await getSlaAchievement();

    // 優先度別インシデント数を取得
    const incidentsByPriorityData = await getIncidentsByPriority();

    // ステータス別インシデント数を取得
    const incidentsByStatusData = await getIncidentsByStatus();

    // 変更リクエストの傾向データを取得
    const changeTrendData = await getChangeTrend();

    res.json({
      incidentTrend: incidentTrendData,
      slaAchievement: slaAchievementData,
      incidentsByPriority: incidentsByPriorityData,
      incidentsByStatus: incidentsByStatusData,
      changeTrend: changeTrendData,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chart data fetch error:', error);
    res.status(500).json({ error: 'チャートデータの取得に失敗しました' });
  }
});

/**
 * @swagger
 * /dashboard/widgets:
 *   get:
 *     summary: ウィジェットデータ取得
 *     description: KPIカード用のMTTR、MTBF、SLA達成率、アクティブインシデント数、今週の変更リクエスト数などのウィジェットデータを取得します。
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ウィジェットデータ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 kpi:
 *                   type: object
 *                   properties:
 *                     mttr:
 *                       type: number
 *                       description: 平均修復時間（時間）
 *                     mtbf:
 *                       type: number
 *                       description: 平均故障間隔（時間）
 *                     slaAchievementRate:
 *                       type: number
 *                       description: SLA達成率（%）
 *                 activeIncidents:
 *                   type: object
 *                   description: アクティブインシデント数サマリー
 *                 weeklyChanges:
 *                   type: object
 *                   description: 今週の変更リクエスト数
 *       401:
 *         description: 認証エラー
 *       500:
 *         description: 内部サーバーエラー
 */
router.get('/widgets', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    // KPIデータを取得
    const kpiData = await getKpiMetrics();

    // アクティブインシデント数サマリーを取得
    const activeIncidentsSummary = await getActiveIncidentsSummary();

    // 今週の変更リクエスト数を取得
    const weeklyChanges = await getWeeklyChanges();

    // 問題管理統計を取得
    const problemStats = await getProblemStats();

    // 脆弱性統計を取得
    const vulnerabilityStats = await getVulnerabilityStats();

    res.json({
      kpi: kpiData,
      activeIncidents: activeIncidentsSummary,
      weeklyChanges,
      problemStats,
      vulnerabilityStats,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Widget data fetch error:', error);
    res.status(500).json({ error: 'ウィジェットデータの取得に失敗しました' });
  }
});

/**
 * @swagger
 * /dashboard/activity:
 *   get:
 *     summary: 最近のアクティビティを取得
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: アクティビティデータ
 */
router.get('/activity', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const activities = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          'incident' as type,
          id,
          title,
          status,
          created_at as timestamp
        FROM incidents
        ORDER BY created_at DESC
        LIMIT 10`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({
      activities: activities.map(a => ({
        ...a,
        message: `${a.type === 'incident' ? 'インシデント' : 'アクティビティ'}: ${a.title}`,
        timestamp: a.timestamp
      }))
    });
  } catch (error) {
    console.error('Activity fetch error:', error);
    res.status(500).json({ error: 'アクティビティの取得に失敗しました' });
  }
});

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: ダッシュボード統計を取得
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 統計データ
 */
router.get('/stats', authenticateJWT, cacheMiddleware, async (req, res) => {
  try {
    const stats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT
          (SELECT COUNT(*) FROM incidents) as totalIncidents,
          (SELECT COUNT(*) FROM incidents WHERE status = 'Open') as openIncidents,
          (SELECT COUNT(*) FROM assets) as totalAssets,
          (SELECT COUNT(*) FROM sla_agreements WHERE status = 'Met') as slaMet,
          (SELECT COUNT(*) FROM sla_agreements) as slaTotal
        `,
        (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        }
      );
    });

    res.json({
      incidents: {
        total: stats.totalIncidents || 0,
        open: stats.openIncidents || 0
      },
      assets: {
        total: stats.totalAssets || 0
      },
      sla: {
        achieved: stats.slaMet || 0,
        total: stats.slaTotal || 0,
        rate: stats.slaTotal > 0 ? Math.round((stats.slaMet / stats.slaTotal) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: '統計データの取得に失敗しました' });
  }
});

module.exports = router;
