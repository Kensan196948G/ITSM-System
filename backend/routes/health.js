/**
 * Enhanced Health Check Routes
 * Provides Liveness and Readiness probes for production environments
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const router = express.Router();
const { db } = require('../db');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: 基本ヘルスチェック
 *     description: システムが稼働しているかどうかを単純に確認します。
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: システム稼働中
 */
function basic(req, res) {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: ライブネスプローブ
 *     description: アプリケーションプロセスが生存しているかを確認します。
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: プロセス生存中
 */
function liveness(req, res) {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    type: 'liveness'
  });
}

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: レディネスプローブ
 *     description: データベースやディスク容量など、リクエストを受け付ける準備ができているかを確認します。
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: システム準備完了
 *       503:
 *         description: システム準備未完了
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

// Register routes
router.get('/', basic);
router.get('/live', liveness);
router.get('/ready', readiness);

module.exports = router;
