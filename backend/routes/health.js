/**
 * Enhanced Health Check Routes
 * Provides Liveness and Readiness probes for production environments
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { db } = require('../db');

/**
 * Liveness Probe
 * Checks if the application process is alive
 * Returns 200 if alive, 503 if dead
 *
 * Usage: Kubernetes/Docker health check, uptime monitoring
 */
function liveness(req, res) {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    type: 'liveness'
  });
}

/**
 * Readiness Probe
 * Checks if the application is ready to accept traffic
 * Performs deep health checks on critical dependencies
 *
 * Usage: Load balancer health check, deployment verification
 */
async function readiness(req, res) {
  const checks = {
    database: false,
    disk: false,
    memory: false
  };

  let overallStatus = 'UP';
  const errors = [];

  // Check 1: Database connectivity
  try {
    await new Promise((resolve, reject) => {
      db.get('SELECT 1 as result', (err, row) => {
        if (err) reject(err);
        else if (row && row.result === 1) resolve();
        else reject(new Error('Unexpected query result'));
      });
    });
    checks.database = true;
  } catch (err) {
    checks.database = false;
    errors.push(`Database: ${err.message}`);
    overallStatus = 'DOWN';
  }

  // Check 2: Disk space
  try {
    const dbDir = path.dirname(process.env.DATABASE_PATH || './backend/itsm_nexus.db');
    const stats = fs.statfsSync(dbDir);
    const freeSpacePercent = (stats.bavail / stats.blocks) * 100;

    if (freeSpacePercent > 10) {
      checks.disk = true;
    } else {
      checks.disk = false;
      errors.push(`Disk: Only ${freeSpacePercent.toFixed(2)}% free`);
      overallStatus = 'DOWN';
    }
  } catch (err) {
    checks.disk = false;
    errors.push(`Disk: ${err.message}`);
  }

  // Check 3: Memory usage
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPercent = ((totalMem - freeMem) / totalMem) * 100;

    if (usedMemPercent < 90) {
      checks.memory = true;
    } else {
      checks.memory = false;
      errors.push(`Memory: ${usedMemPercent.toFixed(2)}% used`);
      overallStatus = 'DOWN';
    }
  } catch (err) {
    checks.memory = false;
    errors.push(`Memory: ${err.message}`);
  }

  // Determine HTTP status code
  const statusCode = overallStatus === 'UP' ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    type: 'readiness',
    checks,
    errors: errors.length > 0 ? errors : undefined,
    version: '1.0.0',
    uptime: process.uptime()
  });
}

/**
 * Basic Health Check (Legacy compatibility)
 * Simple health check endpoint
 */
function basic(req, res) {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}

module.exports = {
  liveness,
  readiness,
  basic
};
