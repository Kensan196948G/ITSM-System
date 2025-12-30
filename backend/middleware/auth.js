const jwt = require('jsonwebtoken');
require('dotenv').config();

// 有効なロールのリスト
const VALID_ROLES = ['admin', 'manager', 'analyst', 'viewer'];

// JWT認証ミドルウェア
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: '認証トークンがありません',
      message: 'Authorization header is required'
    });
  }

  // Bearer プレフィックスの検証
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(403).json({
      error: '無効な認証形式',
      message: 'Authorization header must start with "Bearer "'
    });
  }

  const token = authHeader.split(' ')[1]; // "Bearer <token>"形式

  if (!token) {
    return res.status(401).json({
      error: '無効なトークン形式',
      message: 'Token format should be "Bearer <token>"'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'トークンが無効または期限切れです',
        message: 'Invalid or expired token'
      });
    }

    // ロールの有効性を検証（ロールが明示的に設定されている場合のみ）
    // ロールが存在し、文字列型で、かつ有効なロールリストに含まれない場合のみエラー
    const hasInvalidRole =
      user.role &&
      typeof user.role === 'string' &&
      user.role !== '' &&
      !VALID_ROLES.includes(user.role);

    if (hasInvalidRole) {
      return res.status(403).json({
        error: '無効なロール',
        message: `Invalid role: ${user.role}. Valid roles are: ${VALID_ROLES.join(', ')}`
      });
    }

    req.user = user; // ユーザー情報をリクエストに付加
    next();
  });
};

// ロールベースアクセス制御（RBAC）ミドルウェア
const authorize = (rolesParam = []) => {
  // rolesは配列または文字列
  const roles = typeof rolesParam === 'string' ? [rolesParam] : rolesParam;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: '認証が必要です',
        message: 'Authentication required'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: '権限がありません',
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// オプショナル認証（認証があれば使用、なくてもOK）
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
};

module.exports = {
  authenticateJWT,
  authorize,
  optionalAuth
};
