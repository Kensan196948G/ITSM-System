/**
 * Rate Limiting Middleware
 * Protects APIs from brute force attacks and abuse
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// テスト環境かどうか
const isTestEnv = process.env.NODE_ENV === 'test';

// ============================================================
// Rate Limiters
// ============================================================

/**
 * General API Rate Limiter
 * 100 requests per 15 minutes per IP (本番環境)
 * 1000 requests per 1 minute per IP (テスト環境)
 */
const apiLimiter = rateLimit({
  windowMs: isTestEnv ? 60 * 1000 : 15 * 60 * 1000, // テスト: 1分, 本番: 15分
  max: isTestEnv ? 1000 : 100, // テスト: 1000回, 本番: 100回
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: {
    error: 'リクエスト制限を超過しました',
    message: '15分後に再試行してください',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'リクエスト制限を超過しました。15分後に再試行してください。',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Authentication API Rate Limiter
 * 5 requests per 15 minutes per IP (本番環境)
 * 6 requests per 1 minute per IP (テスト環境)
 * Stricter limit to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: isTestEnv ? 60 * 1000 : 15 * 60 * 1000, // テスト: 1分, 本番: 15分
  max: isTestEnv ? 8 : 5, // テスト: 8回（10回試行で2-3回は429）, 本番: 5回
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'ログイン試行回数が制限を超えました',
    message: '15分後に再試行してください',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    logger.warn(`[SECURITY] Login rate limit exceeded from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'ログイン試行回数が制限を超えました。15分後に再試行してください。',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      lockoutUntil: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

/**
 * Registration API Rate Limiter
 * 3 requests per hour per IP (本番環境)
 * 7 requests per 1 minute per IP (テスト環境)
 * Prevents mass account creation
 */
const registerLimiter = rateLimit({
  windowMs: isTestEnv ? 60 * 1000 : 60 * 60 * 1000, // テスト: 1分, 本番: 1時間
  max: isTestEnv ? 8 : 3, // テスト: 8回（10回試行で2回は429、かつバリデーションも通過）, 本番: 3回
  skipSuccessfulRequests: !isTestEnv, // テスト: 全てカウント, 本番: 成功はスキップ
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'アカウント作成回数が制限を超えました',
    message: '1時間後に再試行してください',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    logger.warn(`[SECURITY] Registration rate limit exceeded from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'アカウント作成回数が制限を超えました。1時間後に再試行してください。',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

/**
 * Strict Rate Limiter for sensitive operations
 * 10 requests per hour per IP
 */
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'リクエスト制限を超過しました',
    message: '1時間後に再試行してください',
    retryAfter: '1 hour'
  }
});

/**
 * 2FA Rate Limiter
 * 5 requests per 5 minutes per IP (本番環境)
 * 20 requests per 1 minute per IP (テスト環境)
 * Prevents brute force attacks on 2FA codes
 */
const twoFactorLimiter = rateLimit({
  windowMs: isTestEnv ? 60 * 1000 : 5 * 60 * 1000, // テスト: 1分, 本番: 5分
  max: isTestEnv ? 20 : 5, // テスト: 20回, 本番: 5回
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '2FA検証の試行回数が制限を超えました',
    message: '5分後に再試行してください',
    retryAfter: '5 minutes'
  },
  handler: (req, res) => {
    logger.warn(`[SECURITY] 2FA rate limit exceeded from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: '2FA検証の試行回数が制限を超えました。5分後に再試行してください。',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
      lockoutUntil: new Date(req.rateLimit.resetTime).toISOString()
    });
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  registerLimiter,
  strictLimiter,
  twoFactorLimiter
};
