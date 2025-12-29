const { db } = require('../db');

/**
 * 監査ログミドルウェア
 * 全てのPOST/PUT/DELETEリクエストを監査ログに記録
 *
 * 機能:
 * - ユーザーID、アクション、リソースタイプ、リソースIDを自動抽出
 * - リクエスト/レスポンスボディをJSON化
 * - セキュリティ関連アクションを自動マーキング
 * - IPアドレス、User-Agentを記録
 * - setImmediate で非同期記録（レスポンスを遅延させない）
 */

// 監査対象外パス
const excludedPaths = [/^\/health\/.*/, /^\/metrics$/, /^\/api-docs\/.*/];

// セキュリティ関連アクションのパターン
const securityActions = [
  { method: 'PUT', path: /^\/api\/vulnerabilities\/.*/, description: '脆弱性の更新' },
  { method: 'POST', path: /^\/api\/incidents.*/, description: 'インシデント作成' },
  { method: 'PUT', path: /^\/api\/users\/.*/, description: 'ユーザー権限変更' },
  {
    method: 'POST',
    path: /^\/api\/changes.*/,
    isSecurityChange: true,
    description: 'セキュリティ変更管理'
  }
];

/**
 * パスが監査対象外かチェック
 */
function isExcludedPath(path, method) {
  // GETリクエストは監査対象外
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
  // パスから情報を抽出 (例: /api/vulnerabilities/123 -> { type: 'vulnerabilities', id: '123' })
  const match = path.match(/^\/api\/([^/]+)(?:\/([^/]+))?/);

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

  // リクエスト情報を保存
  const requestBody = req.body ? JSON.stringify(req.body) : null;
  const userId = req.user ? req.user.id : null;
  const ipAddress = req.ip || req.connection.remoteAddress || null;
  const userAgent = req.get('user-agent') || null;

  // セキュリティ関連アクションかチェック
  const isSecurityAct = isSecurityAction(req.method, req.path, req.body);

  // 元のレスポンス送信関数を保存
  const originalSend = res.send;

  // レスポンス送信をフック
  res.send = function (data) {
    // レスポンスを記録後、非同期で監査ログを書き込み
    setImmediate(() => {
      // 監査ログデータを構築
      const logData = {
        userId,
        action,
        resourceType,
        resourceId,
        oldValues: null, // リクエストボディ（更新前の値として扱う）
        newValues: requestBody, // リクエストボディ（新しい値として扱う）
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

  next();
};

module.exports = auditLog;
