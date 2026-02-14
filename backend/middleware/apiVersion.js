/**
 * API Versioning Middleware
 * Supports multiple version declaration methods and deprecation warnings
 */

const logger = require('../utils/logger');

// Current supported API versions
const SUPPORTED_VERSIONS = ['v1'];
const CURRENT_VERSION = 'v1';
const DEFAULT_VERSION = 'v1';

// Deprecated endpoints with sunset dates
const DEPRECATED_ENDPOINTS = {
  // Example: 'GET /api/v1/old-endpoint': { sunset: '2026-06-01', alternative: '/api/v1/new-endpoint' }
};

/**
 * Normalize version string to vX format
 */
function normalizeVersion(version) {
  if (!version) return null;

  const str = String(version).toLowerCase().trim();

  // Already in vX format
  if (/^v\d+$/.test(str)) {
    return str;
  }

  // Just a number
  if (/^\d+$/.test(str)) {
    return `v${str}`;
  }

  // X.Y.Z format - extract major version
  const semverMatch = str.match(/^(\d+)\.\d+/);
  if (semverMatch) {
    return `v${semverMatch[1]}`;
  }

  return null;
}

/**
 * Find deprecation info for an endpoint
 */
function findDeprecation(endpointKey) {
  // Direct match
  if (DEPRECATED_ENDPOINTS[endpointKey]) {
    return DEPRECATED_ENDPOINTS[endpointKey];
  }

  // Pattern match (for parameterized routes)
  for (const [pattern, info] of Object.entries(DEPRECATED_ENDPOINTS)) {
    const regex = new RegExp(`^${pattern.replace(/:\w+/g, '[^/]+')}$`);
    if (regex.test(endpointKey)) {
      return info;
    }
  }

  return null;
}

/**
 * Extract API version from request
 * Priority: URL path > X-API-Version header > Accept header > Query param > Default
 */
function extractVersion(req) {
  // 1. URL path version (e.g., /api/v1/...)
  const urlMatch = req.originalUrl.match(/\/api\/(v\d+)\//);
  if (urlMatch && SUPPORTED_VERSIONS.includes(urlMatch[1])) {
    return { version: urlMatch[1], source: 'url' };
  }

  // 2. X-API-Version header
  const headerVersion = req.headers['x-api-version'];
  if (headerVersion) {
    const normalizedVersion = normalizeVersion(headerVersion);
    if (normalizedVersion && SUPPORTED_VERSIONS.includes(normalizedVersion)) {
      return { version: normalizedVersion, source: 'header' };
    }
  }

  // 3. Accept header with version (e.g., application/vnd.itsm+json;version=1)
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/version=(\d+)/);
    if (versionMatch) {
      const version = `v${versionMatch[1]}`;
      if (SUPPORTED_VERSIONS.includes(version)) {
        return { version, source: 'accept' };
      }
    }
  }

  // 4. Query parameter (e.g., ?api-version=1)
  const queryVersion = req.query['api-version'];
  if (queryVersion) {
    const normalizedVersion = normalizeVersion(queryVersion);
    if (normalizedVersion && SUPPORTED_VERSIONS.includes(normalizedVersion)) {
      return { version: normalizedVersion, source: 'query' };
    }
  }

  // 5. Default version
  return { version: DEFAULT_VERSION, source: 'default' };
}

/**
 * API Version Middleware
 * Adds version info to request and sets response headers
 */
function apiVersionMiddleware(req, res, next) {
  const { version, source } = extractVersion(req);

  // Attach version info to request
  req.apiVersion = version;
  req.apiVersionSource = source;

  // Set response headers
  res.setHeader('X-API-Version', version);
  res.setHeader('X-API-Supported-Versions', SUPPORTED_VERSIONS.join(', '));
  res.setHeader('X-API-Current-Version', CURRENT_VERSION);

  // Check for deprecated endpoints
  const endpointKey = `${req.method} ${req.originalUrl.split('?')[0]}`;
  const deprecationInfo = findDeprecation(endpointKey);

  if (deprecationInfo) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', deprecationInfo.sunset);
    if (deprecationInfo.alternative) {
      res.setHeader('Link', `<${deprecationInfo.alternative}>; rel="successor-version"`);
    }

    // Log deprecation usage
    logger.warn(`[API] Deprecated endpoint accessed: ${endpointKey} by ${req.ip}`);
  }

  next();
}

/**
 * Middleware to require specific API version
 */
function requireVersion(requiredVersions) {
  const versions = Array.isArray(requiredVersions) ? requiredVersions : [requiredVersions];

  return (req, res, next) => {
    if (!versions.includes(req.apiVersion)) {
      return res.status(400).json({
        error: 'API Version Not Supported',
        message: `This endpoint requires API version: ${versions.join(' or ')}`,
        currentVersion: req.apiVersion,
        supportedVersions: versions
      });
    }
    next();
  };
}

/**
 * Add deprecation warning to specific route
 */
function deprecated(options = {}) {
  const { sunset, alternative, message } = options;

  return (req, res, next) => {
    res.setHeader('Deprecation', 'true');

    if (sunset) {
      res.setHeader('Sunset', sunset);
    }

    if (alternative) {
      res.setHeader('Link', `<${alternative}>; rel="successor-version"`);
    }

    // Add warning to response
    const originalJson = res.json.bind(res);
    res.json = function jsonWithDeprecation(data) {
      if (typeof data === 'object' && data !== null) {
        data.deprecationWarning = {
          deprecated: true,
          sunset: sunset || 'TBD',
          alternative: alternative || null,
          message: message || 'This endpoint is deprecated and will be removed.'
        };
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Version-specific rate limit key generator
 */
function versionedRateLimitKeyGenerator(req) {
  return `${req.apiVersion}:${req.ip}`;
}

module.exports = {
  apiVersionMiddleware,
  requireVersion,
  deprecated,
  versionedRateLimitKeyGenerator,
  extractVersion,
  normalizeVersion,
  SUPPORTED_VERSIONS,
  CURRENT_VERSION,
  DEFAULT_VERSION
};
