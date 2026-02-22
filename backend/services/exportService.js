/**
 * Export Service
 * データベースからデータを取得してエクスポート用に整形
 */

const { db } = require('../db');
const logger = require('../utils/logger');

/**
 * エクスポート可能なエンティティの定義
 */
const EXPORTABLE_ENTITIES = {
  incidents: {
    table: 'incidents',
    columns: [
      'id',
      'ticket_id',
      'title',
      'description',
      'status',
      'priority',
      'is_security_incident',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'created_at DESC'
  },
  vulnerabilities: {
    table: 'vulnerabilities',
    columns: [
      'id',
      'vulnerability_id',
      'title',
      'description',
      'severity',
      'cvss_score',
      'cvss_vector',
      'affected_asset',
      'status',
      'detection_date',
      'resolution_date',
      'nist_csf_function',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'cvss_score DESC, created_at DESC'
  },
  audit_logs: {
    table: 'audit_logs',
    columns: [
      'id',
      'user_id',
      'action',
      'resource_type',
      'resource_id',
      'ip_address',
      'user_agent',
      'is_security_action',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'created_at DESC',
    // old_values, new_valuesは除外（センシティブ情報）
    sensitiveColumns: ['old_values', 'new_values']
  },
  changes: {
    table: 'changes',
    columns: [
      'id',
      'rfc_id',
      'title',
      'description',
      'asset_tag',
      'status',
      'requester',
      'approver',
      'is_security_change',
      'impact_level',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'created_at DESC'
  },
  assets: {
    table: 'assets',
    columns: ['id', 'asset_tag', 'name', 'type', 'criticality', 'status', 'last_updated'],
    dateColumn: 'last_updated',
    orderBy: 'criticality DESC, asset_tag ASC'
  },
  security_alerts: {
    table: 'security_alerts',
    columns: [
      'id',
      'alert_type',
      'severity',
      'description',
      'affected_user_id',
      'affected_resource_type',
      'affected_resource_id',
      'source_ip',
      'is_acknowledged',
      'acknowledged_by',
      'acknowledged_at',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'severity DESC, created_at DESC'
  },
  user_activity: {
    table: 'user_activity',
    columns: [
      'id',
      'user_id',
      'activity_type',
      'ip_address',
      'user_agent',
      'success',
      'failure_reason',
      'session_id',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'created_at DESC'
  },
  problems: {
    table: 'problems',
    columns: [
      'id',
      'problem_id',
      'title',
      'description',
      'status',
      'priority',
      'root_cause',
      'related_incidents',
      'assignee',
      'created_at',
      'resolved_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'created_at DESC'
  },
  releases: {
    table: 'releases',
    columns: [
      'id',
      'release_id',
      'name',
      'description',
      'version',
      'status',
      'release_date',
      'change_count',
      'target_environment',
      'progress',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'release_date DESC'
  },
  service_requests: {
    table: 'service_requests',
    columns: [
      'id',
      'request_id',
      'request_type',
      'title',
      'description',
      'requester',
      'status',
      'priority',
      'created_at',
      'completed_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'created_at DESC'
  },
  sla_agreements: {
    table: 'sla_agreements',
    columns: [
      'id',
      'sla_id',
      'service_name',
      'metric_name',
      'target_value',
      'actual_value',
      'achievement_rate',
      'measurement_period',
      'status',
      'created_at'
    ],
    dateColumn: 'created_at',
    orderBy: 'created_at DESC'
  }
};

/**
 * エンティティが存在するか確認
 * @param {string} entity - エンティティ名
 * @returns {boolean} 存在する場合true
 */
function isValidEntity(entity) {
  return entity in EXPORTABLE_ENTITIES;
}

/**
 * エンティティのデータをエクスポート
 * @param {string} entity - エンティティ名
 * @param {Object} filters - フィルタ条件
 * @param {string} filters.from_date - 開始日（YYYY-MM-DD）
 * @param {string} filters.to_date - 終了日（YYYY-MM-DD）
 * @returns {Promise<Array<Object>>} エクスポートデータ
 */
function exportEntityData(entity, filters = {}) {
  return new Promise((resolve, reject) => {
    if (!isValidEntity(entity)) {
      reject(new Error(`Invalid entity: ${entity}`));
      return;
    }

    const config = EXPORTABLE_ENTITIES[entity];
    const { table, columns, dateColumn, orderBy } = config;

    // WHERE句の構築
    const whereClauses = [];
    const params = [];

    if (filters.from_date && dateColumn) {
      whereClauses.push(`${dateColumn} >= ?`);
      params.push(filters.from_date);
    }

    if (filters.to_date && dateColumn) {
      whereClauses.push(`${dateColumn} <= ?`);
      params.push(filters.to_date);
    }

    // エンティティ固有のフィルタ処理
    if (filters.status && columns.includes('status')) {
      whereClauses.push('status = ?');
      params.push(filters.status);
    }

    if (filters.priority && columns.includes('priority')) {
      whereClauses.push('priority = ?');
      params.push(filters.priority);
    }

    if (filters.severity && columns.includes('severity')) {
      whereClauses.push('severity = ?');
      params.push(filters.severity);
    }

    if (filters.user_id && columns.includes('user_id')) {
      whereClauses.push('user_id = ?');
      params.push(filters.user_id);
    }

    // SQL構築
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `SELECT ${columns.join(', ')} FROM ${table} ${whereClause} ORDER BY ${orderBy}`;

    // クエリ実行
    db.all(sql, params, (err, rows) => {
      if (err) {
        logger.error(`[Export] Database error for ${entity}:`, err);
        return reject(err);
      }

      logger.info(`[Export] Retrieved ${rows.length} records from ${entity}`);
      resolve(rows);
    });
  });
}

/**
 * エクスポート可能なエンティティのリストを取得
 * @returns {Array<string>} エンティティ名の配列
 */
function getExportableEntities() {
  return Object.keys(EXPORTABLE_ENTITIES);
}

/**
 * センシティブ情報を除外
 * @param {Array<Object>} data - 元データ
 * @param {Array<string>} sensitiveColumns - 除外するカラム名
 * @returns {Array<Object>} センシティブ情報を除外したデータ
 */
function excludeSensitiveData(data, sensitiveColumns = []) {
  if (sensitiveColumns.length === 0) {
    return data;
  }

  return data.map((row) => {
    const cleanRow = { ...row };
    sensitiveColumns.forEach((col) => {
      delete cleanRow[col];
    });
    return cleanRow;
  });
}

module.exports = {
  exportEntityData,
  isValidEntity,
  getExportableEntities,
  excludeSensitiveData,
  EXPORTABLE_ENTITIES
};
