const jwt = require('jsonwebtoken');
require('dotenv').config();
const tokenService = require('../services/tokenService');

// 有効なロールのリスト
const VALID_ROLES = ['admin', 'manager', 'analyst', 'viewer'];

// JWT認証ミドルウェア（ブラックリストチェック付き）
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    [, token] = authHeader.split(' ');
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      error: '認証トークンがありません',
      message: 'Authentication token is required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'トークンが無効または期限切れです',
        message: 'Invalid or expired token'
      });
    }

    // JTIがある場合はブラックリストチェック
    if (user.jti) {
      try {
        const isBlacklisted = await tokenService.isTokenBlacklisted(user.jti);
        if (isBlacklisted) {
          return res.status(401).json({
            error: 'トークンは無効化されています',
            message: 'Token has been revoked. Please login again.'
          });
        }
      } catch (blacklistError) {
        console.error('Blacklist check error:', blacklistError);
        // ブラックリストチェックエラーは無視して続行
      }
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
    req.token = token; // 後でログアウト時に使用
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
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    [, token] = authHeader.split(' ');
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

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
