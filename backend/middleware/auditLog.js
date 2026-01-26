const { db } = require('../db');

/**
 * 監査ログミドルウェア (強化版)
 * 全てのPOST/PUT/PATCH/DELETEリクエストを監査ログに記録
 *
 * 機能:
 * - ユーザーID、アクション、リソースタイプ、リソースIDを自動抽出
 * - リクエスト/レスポンスボディをJSON化（機密データは除外）
 * - 変更前後の差分記録（UPDATE時）
 * - セキュリティ関連アクションを自動マーキング
 * - IPアドレス、User-Agentを記録
 * - setImmediate で非同期記録（レスポンスを遅延させない）
 */

// 監査対象外パス
const excludedPaths = [/^\/health\/.*/, /^\/metrics$/, /^\/api-docs\/.*/, /^\/api\/v1\/audit-logs/];

// セキュリティ関連アクションのパターン
const securityActions = [
  { method: 'PUT', path: /^\/api\/vulnerabilities\/.*/, description: '脆弱性の更新' },
  { method: 'POST', path: /^\/api\/incidents.*/, description: 'インシデント作成' },
  { method: 'PUT', path: /^\/api\/users\/.*/, description: 'ユーザー権限変更' },
  { method: 'DELETE', path: /^\/api\/users\/.*/, description: 'ユーザー削除' },
  {
    method: 'POST',
    path: /^\/api\/changes.*/,
    isSecurityChange: true,
    description: 'セキュリティ変更管理'
  },
  { method: 'POST', path: /^\/api\/v1\/auth\/login/, description: 'ログイン試行' },
  { method: 'POST', path: /^\/api\/v1\/auth\/register/, description: 'ユーザー登録' },
  { method: 'PUT', path: /^\/api\/v1\/security\/.*/, description: 'セキュリティ設定変更' },
  { method: 'DELETE', path: /^\/api\/v1\/security\/.*/, description: 'セキュリティ設定削除' }
];

// 機密フィールド（ログから除外）
const sensitiveFields = [
  'password',
  'password_hash',
  'token',
  'secret',
  'api_key',
  'apiKey',
  'access_token',
  'refresh_token',
  'totp_secret',
  'backup_codes',
  'credit_card',
  'ssn',
  'social_security',
  'private_key',
  'encryption_key',
  'session_id',
  'cookie',
  'authorization'
];

/**
 * 機密データをマスク処理
 * @param {Object} obj - 処理対象オブジェクト
 * @returns {Object} マスク済みオブジェクト
 */
function sanitizeSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // 配列の場合
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeSensitiveData(item));
  }

  const sanitized = {};
  Object.entries(obj).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();

    // 機密フィールドはマスク
    if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // ネストしたオブジェクトも再帰的に処理
      sanitized[key] = sanitizeSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  });
  return sanitized;
}

/**
 * パスが監査対象外かチェック
 */
function isExcludedPath(path, method) {
  // GETリクエストは監査対象外（ただし検索APIは記録しない）
  if (method === 'GET') {
    return true;
  }

  // 除外パスに一致するかチェック
  return excludedPaths.some((pattern) => pattern.test(path));
}

/**
 * セキュリティ関連アクションかチェック
 */
function isSecurityAction(method, path, body) {
  return securityActions.some((action) => {
    // メソッドとパスが一致するかチェック
    if (action.method === method && action.path.test(path)) {
      // is_security_change のチェックが必要な場合
      if (action.isSecurityChange) {
        return body && body.is_security_change === 1;
      }
      return true;
    }
    return false;
  });
}

/**
 * リソースタイプとIDを抽出
 */
function extractResourceInfo(path) {
  // パスから情報を抽出 (例: /api/v1/vulnerabilities/123 -> { type: 'vulnerabilities', id: '123' })
  // v1 がある場合とない場合の両方に対応
  let match = path.match(/^\/api\/v1\/([^/]+)(?:\/([^/]+))?/);
  if (!match) {
    match = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?/);
  }

  if (!match) {
    return { resourceType: 'unknown', resourceId: null };
  }

  const resourceType = match[1];
  const resourceId = match[2] || null;

  return { resourceType, resourceId };
}

/**
 * HTTPメソッドをアクション名に変換
 */
function methodToAction(method) {
  const actionMap = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete'
  };

  return actionMap[method] || method.toLowerCase();
}

/**
 * 変更前後の差分を計算
 * @param {Object} oldValues - 変更前の値
 * @param {Object} newValues - 変更後の値
 * @returns {Object} 差分情報
 */
function calculateDiff(oldValues, newValues) {
  if (!oldValues || !newValues) {
    return null;
  }

  const diff = {
    added: {},
    removed: {},
    changed: {}
  };

  // 新しい値と変更された値をチェック
  Object.entries(newValues).forEach(([key, newValue]) => {
    if (!(key in oldValues)) {
      diff.added[key] = newValue;
    } else if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValue)) {
      diff.changed[key] = {
        from: oldValues[key],
        to: newValue
      };
    }
  });

  // 削除された値をチェック
  Object.keys(oldValues).forEach((key) => {
    if (!(key in newValues)) {
      diff.removed[key] = oldValues[key];
    }
  });

  // 差分がない場合はnull
  if (
    Object.keys(diff.added).length === 0 &&
    Object.keys(diff.removed).length === 0 &&
    Object.keys(diff.changed).length === 0
  ) {
    return null;
  }

  return diff;
}

/**
 * 変更前のデータを取得（UPDATE/DELETE時）
 * @param {string} resourceType - リソースタイプ
 * @param {string} resourceId - リソースID
 * @returns {Promise<Object|null>} 変更前のデータ
 */
async function fetchOldValues(resourceType, resourceId) {
  if (!resourceId) {
    return null;
  }

  // テーブルマッピング
  const tableMap = {
    incidents: { table: 'incidents', idField: 'id' },
    changes: { table: 'changes', idField: 'id' },
    vulnerabilities: { table: 'vulnerabilities', idField: 'id' },
    assets: { table: 'assets', idField: 'id' },
    problems: { table: 'problems', idField: 'id' },
    releases: { table: 'releases', idField: 'id' },
    users: { table: 'users', idField: 'id' },
    'service-requests': { table: 'service_requests', idField: 'id' },
    'sla-agreements': { table: 'sla_agreements', idField: 'id' },
    'knowledge-articles': { table: 'knowledge_articles', idField: 'id' },
    'capacity-metrics': { table: 'capacity_metrics', idField: 'id' }
  };

  const mapping = tableMap[resourceType];
  if (!mapping) {
    return null;
  }

  return new Promise((resolve) => {
    db.get(
      `SELECT * FROM ${mapping.table} WHERE ${mapping.idField} = ?`,
      [resourceId],
      (err, row) => {
        if (err) {
          console.error('[AuditLog] Failed to fetch old values:', err);
          resolve(null);
        } else {
          resolve(row || null);
        }
      }
    );
  });
}

/**
 * 監査ログをデータベースに記録
 */
function writeAuditLog(logData) {
  const sql = `
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      old_values,
      new_values,
      ip_address,
      user_agent,
      is_security_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    logData.userId,
    logData.action,
    logData.resourceType,
    logData.resourceId,
    logData.oldValues,
    logData.newValues,
    logData.ipAddress,
    logData.userAgent,
    logData.isSecurityAction ? 1 : 0
  ];

  db.run(sql, params, (err) => {
    if (err) {
      console.error('[AuditLog] Failed to write audit log:', err);
    }
  });
}

/**
 * 監査ログミドルウェア本体
 */
const auditLog = (req, res, next) => {
  // 監査対象外のリクエストはスキップ
  if (isExcludedPath(req.path, req.method)) {
    return next();
  }

  // リソース情報を抽出
  const { resourceType, resourceId } = extractResourceInfo(req.path);
  const action = methodToAction(req.method);

  // リクエスト情報を保存（機密データはマスク）
  const sanitizedBody = sanitizeSensitiveData(req.body);
  const requestBody = sanitizedBody ? JSON.stringify(sanitizedBody) : null;
  const userId = req.user ? req.user.id : null;
  const ipAddress = req.ip || req.connection.remoteAddress || null;
  const userAgent = req.get('user-agent') || null;

  // セキュリティ関連アクションかチェック
  const isSecurityAct = isSecurityAction(req.method, req.path, req.body);

  // UPDATE/DELETEの場合、変更前のデータを取得（非同期）
  let oldValuesPromise = Promise.resolve(null);
  if ((action === 'update' || action === 'delete') && resourceId) {
    oldValuesPromise = fetchOldValues(resourceType, resourceId);
  }

  // 変更前データを取得してからレスポンスをフック
  oldValuesPromise.then((oldData) => {
    const sanitizedOldData = sanitizeSensitiveData(oldData);

    // 元のレスポンス送信関数を保存
    const originalSend = res.send;

    // レスポンス送信をフック
    res.send = function (data) {
      // レスポンスを記録後、非同期で監査ログを書き込み
      setImmediate(() => {
        // 変更差分を計算（UPDATE時のみ）
        let oldValuesJson = null;
        if (action === 'update' && sanitizedOldData) {
          const diff = calculateDiff(sanitizedOldData, sanitizedBody);
          if (diff) {
            oldValuesJson = JSON.stringify({
              previousValues: sanitizedOldData,
              diff
            });
          } else {
            oldValuesJson = JSON.stringify(sanitizedOldData);
          }
        } else if (action === 'delete' && sanitizedOldData) {
          oldValuesJson = JSON.stringify(sanitizedOldData);
        }

        // 監査ログデータを構築
        const logData = {
          userId,
          action,
          resourceType,
          resourceId,
          oldValues: oldValuesJson,
          newValues: requestBody,
          ipAddress,
          userAgent,
          isSecurityAction: isSecurityAct
        };

        // 監査ログを記録
        writeAuditLog(logData);
      });

      // 元のsend関数を呼び出してレスポンスを返す
      return originalSend.call(this, data);
    };

    // フック設定後に次のミドルウェアを呼び出し
    next();
  });
};

// エクスポート（テスト用にヘルパー関数も公開）
module.exports = auditLog;
module.exports.sanitizeSensitiveData = sanitizeSensitiveData;
module.exports.calculateDiff = calculateDiff;
module.exports.isExcludedPath = isExcludedPath;
module.exports.isSecurityAction = isSecurityAction;
module.exports.extractResourceInfo = extractResourceInfo;
module.exports.methodToAction = methodToAction;
