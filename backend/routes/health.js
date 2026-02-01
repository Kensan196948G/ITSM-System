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

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: 詳細ヘルスチェック
 *     description: データベース、ディスク、メモリ、キャッシュ、スケジューラーの詳細状態を確認します。
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: 詳細ヘルスチェック結果
 *       503:
 *         description: システム異常検出
 */
async function detailed(req, res) {
  const checks = {
    database: { status: 'unknown', message: '' },
    disk: { status: 'unknown', message: '' },
    memory: { status: 'unknown', message: '' },
    cache: { status: 'unknown', message: '' },
    scheduler: { status: 'unknown', message: '' }
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
    checks.database.status = 'UP';
    checks.database.message = 'Database connection is healthy';
  } catch (err) {
    checks.database.status = 'DOWN';
    checks.database.message = `Database error: ${err.message}`;
    errors.push(`Database: ${err.message}`);
    overallStatus = 'DOWN';
  }

  // Check 2: Disk space
  try {
    const dbDir = path.dirname(process.env.DATABASE_PATH || './backend/itsm_nexus.db');
    const stats = fs.statfsSync(dbDir);
    const freeSpacePercent = (stats.bavail / stats.blocks) * 100;
    const freeSpaceGB = (stats.bavail * stats.bsize) / 1024 / 1024 / 1024;

    if (freeSpacePercent > 20) {
      checks.disk.status = 'UP';
      checks.disk.message = `${freeSpacePercent.toFixed(2)}% free (${freeSpaceGB.toFixed(2)} GB)`;
    } else if (freeSpacePercent > 10) {
      checks.disk.status = 'WARNING';
      checks.disk.message = `Low disk space: ${freeSpacePercent.toFixed(2)}% free`;
      errors.push(`Disk: Only ${freeSpacePercent.toFixed(2)}% free`);
    } else {
      checks.disk.status = 'DOWN';
      checks.disk.message = `Critical disk space: ${freeSpacePercent.toFixed(2)}% free`;
      errors.push(`Disk: Critical - Only ${freeSpacePercent.toFixed(2)}% free`);
      overallStatus = 'DOWN';
    }
  } catch (err) {
    checks.disk.status = 'DOWN';
    checks.disk.message = `Disk check error: ${err.message}`;
    errors.push(`Disk: ${err.message}`);
  }

  // Check 3: Memory usage
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPercent = ((totalMem - freeMem) / totalMem) * 100;
    const freeMemMB = freeMem / 1024 / 1024;

    if (usedMemPercent < 80) {
      checks.memory.status = 'UP';
      checks.memory.message = `${usedMemPercent.toFixed(2)}% used (${freeMemMB.toFixed(0)} MB free)`;
    } else if (usedMemPercent < 90) {
      checks.memory.status = 'WARNING';
      checks.memory.message = `High memory usage: ${usedMemPercent.toFixed(2)}% used`;
      errors.push(`Memory: High usage - ${usedMemPercent.toFixed(2)}%`);
    } else {
      checks.memory.status = 'DOWN';
      checks.memory.message = `Critical memory usage: ${usedMemPercent.toFixed(2)}% used`;
      errors.push(`Memory: Critical - ${usedMemPercent.toFixed(2)}% used`);
      overallStatus = 'DOWN';
    }
  } catch (err) {
    checks.memory.status = 'DOWN';
    checks.memory.message = `Memory check error: ${err.message}`;
    errors.push(`Memory: ${err.message}`);
  }

  // Check 4: Cache health
  try {
    // キャッシュモジュールの存在確認
    // eslint-disable-next-line global-require
    require('node-cache');
    checks.cache.status = 'UP';
    checks.cache.message = 'Cache module loaded';
  } catch (err) {
    checks.cache.status = 'WARNING';
    checks.cache.message = 'Cache module not available';
  }

  // Check 5: Scheduler health
  try {
    // スケジューラーサービスの存在確認
    // eslint-disable-next-line global-require
    require('../services/schedulerService');
    checks.scheduler.status = 'UP';
    checks.scheduler.message = 'Scheduler service loaded';
  } catch (err) {
    checks.scheduler.status = 'WARNING';
    checks.scheduler.message = 'Scheduler service not available';
  }

  // Determine HTTP status code
  const statusCode = overallStatus === 'UP' ? 200 : 503;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    type: 'detailed',
    checks,
    errors: errors.length > 0 ? errors : undefined,
    version: '1.0.0',
    uptime: process.uptime()
  });
}

/**
 * @swagger
 * /health/auto-fix:
 *   get:
 *     summary: 自動修復ステータス
 *     description: 自動修復システムの現在の状態を確認します。
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: 自動修復ステータス
 */
async function autoFix(req, res) {
  try {
    // eslint-disable-next-line global-require
    const autoFixService = require('../services/autoFixService');
    const status = await autoFixService.getStatus();
    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      type: 'auto-fix',
      ...status
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      type: 'auto-fix',
      error: err.message
    });
  }
}

// Register routes
router.get('/', basic);
router.get('/live', liveness);
router.get('/ready', readiness);
router.get('/detailed', detailed);
router.get('/auto-fix', autoFix);

module.exports = router;
