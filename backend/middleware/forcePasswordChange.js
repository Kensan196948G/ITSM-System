/**
 * Force Password Change Middleware
 * パスワード変更が必要なユーザーのアクセスを制限するミドルウェア
 *
 * JWTペイロード内の password_must_change フラグをチェックし、
 * フラグが1の場合は認証系・パスワード変更系以外のエンドポイントへのアクセスを拒否します。
 */

// パスワード変更が必要でもアクセスを許可するパスのパターン
const EXEMPT_PATTERNS = [/^\/api\/v1\/auth\//, /^\/api\/v1\/health/, /^\/health/];

/**
 * ユーザー更新パス（パスワード変更用）かどうかを判定
 * PUT /api/v1/users/:id のみ許可
 */
function isUserUpdatePath(method, url) {
  if (method !== 'PUT') return false;
  return /^\/api\/v1\/users\/\d+/.test(url);
}

/**
 * パスワード強制変更ミドルウェア
 * password_must_change === 1 の場合、免除パス以外へのアクセスを403で拒否
 */
const forcePasswordChange = (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const url = req.originalUrl || req.url;

  // 免除パスのチェック
  if (EXEMPT_PATTERNS.some((pattern) => pattern.test(url))) {
    return next();
  }

  // パスワード変更エンドポイントは許可
  if (isUserUpdatePath(req.method, url)) {
    return next();
  }

  // パスワード変更が必要な場合はアクセスを拒否
  if (req.user.password_must_change === 1) {
    return res.status(403).json({
      error: 'PASSWORD_CHANGE_REQUIRED',
      message: 'セキュリティポリシーにより、パスワードの変更が必要です'
    });
  }

  next();
};

module.exports = { forcePasswordChange };
