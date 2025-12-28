/**
 * Content Security Policy (CSP) Middleware
 * Enhanced security headers for production environment
 */

const helmet = require('helmet');

/**
 * Enhanced CSP Configuration
 * Restricts resource loading to prevent XSS and injection attacks
 */
const cspMiddleware = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
    styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for UI frameworks
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    manifestSrc: ["'self'"],
    workerSrc: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: []
  },
  reportOnly: false
});

/**
 * HSTS (HTTP Strict Transport Security) Configuration
 * Forces HTTPS connections
 */
const hstsMiddleware = helmet.hsts({
  maxAge: 31536000, // 1 year in seconds
  includeSubDomains: true,
  preload: true
});

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
