/**
 * Rate Limiting Middleware
 * Protects APIs from brute force attacks and abuse
 */

const rateLimit = require('express-rate-limit');

// ============================================================
// Rate Limiters
// ============================================================

/**
 * General API Rate Limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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
 * 5 requests per 15 minutes per IP
 * Stricter limit to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'ログイン試行回数が制限を超えました',
    message: '15分後に再試行してください',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    console.warn(`[SECURITY] Login rate limit exceeded from IP: ${req.ip}`);
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
 * 3 requests per hour per IP
 * Prevents mass account creation
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  skipSuccessfulRequests: true, // Don't count successful registrations
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'アカウント作成回数が制限を超えました',
    message: '1時間後に再試行してください',
    retryAfter: '1 hour'
  },
  handler: (req, res) => {
    console.warn(`[SECURITY] Registration rate limit exceeded from IP: ${req.ip}`);
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

module.exports = {
  apiLimiter,
  authLimiter,
  registerLimiter,
  strictLimiter
};
