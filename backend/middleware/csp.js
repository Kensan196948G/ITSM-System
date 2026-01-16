/**
 * Content Security Policy (CSP) Middleware
 * Enhanced security headers for production environment
 */

const helmet = require('helmet');

/**
 * Enhanced CSP Configuration
 * Restricts resource loading to prevent XSS and injection attacks
 * HTTPとHTTPSで異なるポリシーを適用
 */
const cspMiddleware = (req, res, next) => {
  const isHTTPS = req.secure || req.protocol === 'https';

  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.jsdelivr.net',
      'https://cdnjs.cloudflare.com'
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
      'https://cdn.jsdelivr.net'
    ], // Allow inline styles for UI frameworks
    imgSrc: ["'self'", 'data:', 'https:', 'http:'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'http:'],
    connectSrc: [
      "'self'",
      'http:',
      'https:',
      'https://cdn.jsdelivr.net',
      'https://cdnjs.cloudflare.com'
    ],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"]
  };

  // HTTPSの場合のみupgradeInsecureRequestsを追加
  if (isHTTPS) {
    directives.upgradeInsecureRequests = [];
  }

  helmet.contentSecurityPolicy({
    directives,
    reportOnly: false
  })(req, res, next);
};

/**
 * HSTS (HTTP Strict Transport Security) Configuration
 * Forces HTTPS connections
 * HTTPSの場合のみ適用される条件付きミドルウェア
 */
const hstsMiddleware = (req, res, next) => {
  // HTTPSプロトコルの場合のみHSTSヘッダーを送信
  if (req.secure || req.protocol === 'https') {
    helmet.hsts({
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true
    })(req, res, next);
  } else {
    next();
  }
};

/**
 * Additional Security Headers
 */
const securityHeadersMiddleware = (req, res, next) => {
  // X-Frame-Options (already set by helmet)
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options (already set by helmet)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection (legacy but still useful)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );

  // X-Powered-By (remove to hide technology stack)
  res.removeHeader('X-Powered-By');

  next();
};

module.exports = {
  cspMiddleware,
  hstsMiddleware,
  securityHeadersMiddleware
};
