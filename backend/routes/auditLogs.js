/**
 * 監査ログルート
 * GET /api/v1/audit-logs - 監査ログ一覧（ページネーション、フィルター対応）
 * GET /api/v1/audit-logs/:id - 監査ログ詳細
 * GET /api/v1/audit-logs/export - CSVエクスポート
 * GET /api/v1/audit-logs/stats - 監査ログ統計
 */

const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();
const { db } = require('../db');
const { authenticateJWT, authorize } = require('../middleware/auth');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('../middleware/pagination');

/**
 * @swagger
 * /audit-logs:
 *   get:
 *     summary: 監査ログ一覧取得
 *     description: 監査ログをフィルター・ページネーション付きで取得
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: user
 *         description: ユーザー名でフィルタ
 *         schema:
 *           type: string
 *       - in: query
 *         name: user_id
 *         description: ユーザーIDでフィルタ
 *         schema:
 *           type: integer
 *       - in: query
 *         name: action
 *         description: アクション種別でフィルタ (create, update, delete)
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource_type
 *         description: リソースタイプでフィルタ
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource_id
 *         description: リソースIDでフィルタ
 *         schema:
 *           type: string
 *       - in: query
 *         name: security_only
 *         description: セキュリティアクションのみ
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: from_date
 *         description: 開始日時
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to_date
 *         description: 終了日時
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: ip_address
 *         description: IPアドレスでフィルタ
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 監査ログ一覧
 *       401:
 *         description: 認証エラー
 *       403:
 *         description: 権限エラー
 */
router.get('/', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);
  const {
    user,
    user_id,
    action,
    resource_type,
    resource_id,
    security_only,
    from_date,
    to_date,
    ip_address
  } = req.query;

  // Build WHERE clause
  const conditions = [];
  const params = [];

  if (user_id) {
    conditions.push('audit_logs.user_id = ?');
    params.push(user_id);
  }

  if (user) {
    conditions.push('(users.username LIKE ? OR users.full_name LIKE ?)');
    params.push(`%${user}%`, `%${user}%`);
  }

  if (action) {
    conditions.push('audit_logs.action = ?');
    params.push(action);
  }

  if (resource_type) {
    conditions.push('audit_logs.resource_type LIKE ?');
    params.push(`%${resource_type}%`);
  }

  if (resource_id) {
    conditions.push('audit_logs.resource_id = ?');
    params.push(resource_id);
  }

  if (security_only === 'true' || security_only === '1') {
    conditions.push('audit_logs.is_security_action = 1');
  }

  if (from_date) {
    conditions.push('audit_logs.created_at >= ?');
    params.push(from_date);
  }

  if (to_date) {
    conditions.push('audit_logs.created_at <= ?');
    params.push(`${to_date} 23:59:59`);
  }

  if (ip_address) {
    conditions.push('audit_logs.ip_address LIKE ?');
    params.push(`%${ip_address}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromClause = 'FROM audit_logs LEFT JOIN users ON audit_logs.user_id = users.id';

  // Get total count
  db.get(`SELECT COUNT(*) as total ${fromClause} ${whereClause}`, params, (err, countRow) => {
    if (err) {
      logger.error('[AuditLogs] Count error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    // Get paginated data
    const sql = buildPaginationSQL(
      `SELECT
          audit_logs.id,
          audit_logs.user_id,
          users.username,
          users.full_name as user_full_name,
          audit_logs.action,
          audit_logs.resource_type,
          audit_logs.resource_id,
          audit_logs.old_values,
          audit_logs.new_values,
          audit_logs.ip_address,
          audit_logs.user_agent,
          audit_logs.is_security_action,
          audit_logs.created_at
        ${fromClause} ${whereClause}
        ORDER BY audit_logs.created_at DESC`,
      { limit, offset }
    );

    db.all(sql, params, (dbErr, rows) => {
      if (dbErr) {
        logger.error('[AuditLogs] Query error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      const pagination = createPaginationMeta(countRow.total, page, limit);

      res.json({
        data: rows.map((row) => ({
          ...row,
          old_values: row.old_values ? JSON.parse(row.old_values) : null,
          new_values: row.new_values ? JSON.parse(row.new_values) : null
        })),
        pagination
      });
    });
  });
});

/**
 * @swagger
 * /audit-logs/stats:
 *   get:
 *     summary: 監査ログ統計
 *     description: 監査ログの統計情報を取得
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         description: 集計期間 (day, week, month)
 *         schema:
 *           type: string
 *           default: week
 */
router.get('/stats', authenticateJWT, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const period = req.query.period || 'week';
    let timeFilter;

    switch (period) {
      case 'day':
        timeFilter = "datetime('now', '-1 day')";
        break;
      case 'month':
        timeFilter = "datetime('now', '-30 days')";
        break;
      case 'week':
      default:
        timeFilter = "datetime('now', '-7 days')";
        break;
    }

    // Total logs in period
    const totalLogs = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= ${timeFilter}`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Security actions count
    const securityActions = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM audit_logs
         WHERE is_security_action = 1 AND created_at >= ${timeFilter}`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Actions by type
    const actionsByType = await new Promise((resolve, reject) => {
      db.all(
        `SELECT action, COUNT(*) as count FROM audit_logs
         WHERE created_at >= ${timeFilter}
         GROUP BY action ORDER BY count DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Actions by resource type
    const actionsByResource = await new Promise((resolve, reject) => {
      db.all(
        `SELECT resource_type, COUNT(*) as count FROM audit_logs
         WHERE created_at >= ${timeFilter}
         GROUP BY resource_type ORDER BY count DESC LIMIT 10`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Top users by activity
    const topUsers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT u.username, u.full_name, COUNT(*) as count FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.created_at >= ${timeFilter} AND al.user_id IS NOT NULL
         GROUP BY al.user_id ORDER BY count DESC LIMIT 10`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Activity over time
    const activityTimeline = await new Promise((resolve, reject) => {
      const groupFormat = period === 'day' ? '%Y-%m-%d %H:00' : '%Y-%m-%d';
      db.all(
        `SELECT strftime('${groupFormat}', created_at) as time_bucket, COUNT(*) as count
         FROM audit_logs WHERE created_at >= ${timeFilter}
         GROUP BY time_bucket ORDER BY time_bucket`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Top IPs
    const topIps = await new Promise((resolve, reject) => {
      db.all(
        `SELECT ip_address, COUNT(*) as count FROM audit_logs
         WHERE created_at >= ${timeFilter} AND ip_address IS NOT NULL
         GROUP BY ip_address ORDER BY count DESC LIMIT 10`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({
      period,
      total_logs: totalLogs,
      security_actions: securityActions,
      actions_by_type: actionsByType,
      actions_by_resource: actionsByResource,
      top_users: topUsers,
      activity_timeline: activityTimeline,
      top_ips: topIps
    });
  } catch (error) {
    logger.error('[AuditLogs] Stats error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

/**
 * @swagger
 * /audit-logs/export:
 *   get:
 *     summary: 監査ログCSVエクスポート
 *     description: 監査ログをCSV形式でエクスポート
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from_date
 *         description: 開始日時
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to_date
 *         description: 終了日時
 *         schema:
 *           type: string
 *           format: date
 */
router.get('/export', authenticateJWT, authorize(['admin']), (req, res) => {
  const { from_date, to_date, action, resource_type, security_only } = req.query;

  // Build WHERE clause
  const conditions = [];
  const params = [];

  if (from_date) {
    conditions.push('audit_logs.created_at >= ?');
    params.push(from_date);
  }

  if (to_date) {
    conditions.push('audit_logs.created_at <= ?');
    params.push(`${to_date} 23:59:59`);
  }

  if (action) {
    conditions.push('audit_logs.action = ?');
    params.push(action);
  }

  if (resource_type) {
    conditions.push('audit_logs.resource_type = ?');
    params.push(resource_type);
  }

  if (security_only === 'true' || security_only === '1') {
    conditions.push('audit_logs.is_security_action = 1');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `SELECT
      audit_logs.id,
      audit_logs.created_at,
      users.username,
      audit_logs.action,
      audit_logs.resource_type,
      audit_logs.resource_id,
      audit_logs.ip_address,
      audit_logs.user_agent,
      audit_logs.is_security_action,
      audit_logs.old_values,
      audit_logs.new_values
    FROM audit_logs
    LEFT JOIN users ON audit_logs.user_id = users.id
    ${whereClause}
    ORDER BY audit_logs.created_at DESC
    LIMIT 10000`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      logger.error('[AuditLogs] Export error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    // Generate CSV
    const headers = [
      'ID',
      'Timestamp',
      'User',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Security Action',
      'Old Values',
      'New Values'
    ];

    const csvRows = [headers.join(',')];

    rows.forEach((row) => {
      const values = [
        row.id,
        `"${row.created_at || ''}"`,
        `"${row.username || 'System'}"`,
        row.action,
        row.resource_type,
        row.resource_id || '',
        row.ip_address || '',
        `"${(row.user_agent || '').replace(/"/g, '""')}"`,
        row.is_security_action ? 'Yes' : 'No',
        `"${(row.old_values || '').replace(/"/g, '""')}"`,
        `"${(row.new_values || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(','));
    });

    const csv = csvRows.join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${timestamp}.csv"`);
    res.send(`\ufeff${csv}`); // BOM for Excel compatibility
  });
});

/**
 * @swagger
 * /audit-logs/{id}:
 *   get:
 *     summary: 監査ログ詳細取得
 *     description: 特定の監査ログの詳細情報を取得（差分情報含む）
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const { id } = req.params;

  const sql = `SELECT
      audit_logs.*,
      users.username,
      users.full_name as user_full_name,
      users.email as user_email
    FROM audit_logs
    LEFT JOIN users ON audit_logs.user_id = users.id
    WHERE audit_logs.id = ?`;

  db.get(sql, [id], (err, row) => {
    if (err) {
      logger.error('[AuditLogs] Detail error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    if (!row) {
      return res.status(404).json({ error: '監査ログが見つかりません' });
    }

    // Parse JSON fields
    const result = {
      ...row,
      old_values: row.old_values ? JSON.parse(row.old_values) : null,
      new_values: row.new_values ? JSON.parse(row.new_values) : null
    };

    // Extract diff information if available
    if (result.old_values && result.old_values.diff) {
      result.diff = result.old_values.diff;
      result.previous_values = result.old_values.previousValues;
      delete result.old_values;
    }

    res.json(result);
  });
});

module.exports = router;
