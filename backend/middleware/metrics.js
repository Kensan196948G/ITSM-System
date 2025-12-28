/**
 * Prometheus Metrics Middleware
 * Collects and exposes application metrics for monitoring
 */

const promClient = require('prom-client');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'itsm_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// ============================================================
// Custom Metrics
// ============================================================

// HTTP Request Counter
const httpRequestCounter = new promClient.Counter({
  name: 'itsm_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// HTTP Request Duration Histogram
const httpRequestDuration = new promClient.Histogram({
  name: 'itsm_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

// Active Users Gauge
const activeUsersGauge = new promClient.Gauge({
  name: 'itsm_active_users_total',
  help: 'Number of currently active users',
  registers: [register]
});

// Database Queries Counter
const dbQueriesCounter = new promClient.Counter({
  name: 'itsm_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table'],
  registers: [register]
});

// Authentication Errors Counter
const authErrorsCounter = new promClient.Counter({
  name: 'itsm_auth_errors_total',
  help: 'Total number of authentication errors',
  labelNames: ['error_type'],
  registers: [register]
});

// Incident Management Metrics
const incidentCounter = new promClient.Counter({
  name: 'itsm_incidents_total',
  help: 'Total number of incidents created',
  labelNames: ['priority', 'is_security'],
  registers: [register]
});

const incidentGauge = new promClient.Gauge({
  name: 'itsm_incidents_open',
  help: 'Number of currently open incidents',
  labelNames: ['priority'],
  registers: [register]
});

// SLA Compliance Gauge
const slaComplianceGauge = new promClient.Gauge({
  name: 'itsm_sla_compliance_rate',
  help: 'Current SLA compliance rate (percentage)',
  labelNames: ['service_name'],
  registers: [register]
});

// ============================================================
// Middleware Function
// ============================================================

/**
 * Metrics collection middleware
 * Records HTTP request metrics for all routes
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // Record response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode
    };

    // Increment request counter
    httpRequestCounter.inc(labels);

    // Record request duration
    httpRequestDuration.observe(labels, duration);

    // Track authentication errors
    if (res.statusCode === 401) {
      authErrorsCounter.inc({ error_type: 'unauthorized' });
    } else if (res.statusCode === 403) {
      authErrorsCounter.inc({ error_type: 'forbidden' });
    }
  });

  next();
}

/**
 * Metrics endpoint handler
 * Returns all collected metrics in Prometheus format
 */
async function metricsEndpoint(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (err) {
    res.status(500).send(err.message);
  }
}

/**
 * Helper function to track database queries
 * Call this function after each DB operation
 */
function trackDbQuery(operation, table) {
  dbQueriesCounter.inc({ operation, table });
}

/**
 * Helper function to track incident creation
 */
function trackIncident(priority, isSecurityIncident) {
  incidentCounter.inc({
    priority: priority || 'Medium',
    is_security: isSecurityIncident ? 'true' : 'false'
  });
}

/**
 * Helper function to update active users count
 */
function updateActiveUsers(count) {
  activeUsersGauge.set(count);
}

/**
 * Helper function to update SLA compliance rate
 */
function updateSlaCompliance(serviceName, rate) {
  slaComplianceGauge.set({ service_name: serviceName }, rate);
}

/**
 * Helper function to update open incidents count
 */
function updateOpenIncidents(priority, count) {
  incidentGauge.set({ priority }, count);
}

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  trackDbQuery,
  trackIncident,
  updateActiveUsers,
  updateSlaCompliance,
  updateOpenIncidents,
  register
};
