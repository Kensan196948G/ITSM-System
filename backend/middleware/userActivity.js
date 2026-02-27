/**
 * User Activity Tracking Middleware
 * ITSM-Sec Nexus - Comprehensive user activity monitoring and anomaly detection
 *
 * Tracks login, logout, password changes, TOTP enablement, and detects anomalous patterns
 */

const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const logger = require('../utils/logger');

/**
 * Track successful or failed login attempts
 * @param {number} user_id - User ID
 * @param {string} ip_address - Client IP address
 * @param {string} user_agent - User agent string
 * @param {boolean} success - Whether login was successful
 * @param {string|null} failure_reason - Reason for failure if applicable
 * @returns {Promise<void>}
 */
exports.trackLogin = async (user_id, ip_address, user_agent, success, failure_reason = null) =>
  new Promise((resolve, reject) => {
    const session_id = success ? uuidv4() : null;
    const activity_type = success ? 'login' : 'failed_login';

    const query = `
      INSERT INTO user_activity
      (user_id, activity_type, ip_address, user_agent, success, failure_reason, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      query,
      [user_id, activity_type, ip_address, user_agent, success ? 1 : 0, failure_reason, session_id],
      function (err) {
        if (err) {
          logger.error('[UserActivity] Error tracking login:', err);
          return reject(err);
        }
        logger.info(
          `[UserActivity] ${activity_type} tracked for user_id=${user_id}, ip=${ip_address}`
        );
        resolve({ id: this.lastID, session_id });
      }
    );
  });

/**
 * Track user logout
 * @param {number} user_id - User ID
 * @param {string} ip_address - Client IP address
 * @param {string} user_agent - User agent string
 * @returns {Promise<void>}
 */
exports.trackLogout = async (user_id, ip_address, user_agent) =>
  new Promise((resolve, reject) => {
    const query = `
      INSERT INTO user_activity
      (user_id, activity_type, ip_address, user_agent, success, session_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [user_id, 'logout', ip_address, user_agent, 1, null], function (err) {
      if (err) {
        logger.error('[UserActivity] Error tracking logout:', err);
        return reject(err);
      }
      logger.info(`[UserActivity] logout tracked for user_id=${user_id}, ip=${ip_address}`);
      resolve({ id: this.lastID });
    });
  });

/**
 * Track password change activity
 * @param {number} user_id - User ID
 * @param {string} ip_address - Client IP address
 * @param {string} user_agent - User agent string
 * @returns {Promise<void>}
 */
exports.trackPasswordChange = async (user_id, ip_address, user_agent) =>
  new Promise((resolve, reject) => {
    const query = `
      INSERT INTO user_activity
      (user_id, activity_type, ip_address, user_agent, success, session_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [user_id, 'password_change', ip_address, user_agent, 1, null], function (err) {
      if (err) {
        logger.error('[UserActivity] Error tracking password change:', err);
        return reject(err);
      }
      logger.info(
        `[UserActivity] password_change tracked for user_id=${user_id}, ip=${ip_address}`
      );
      resolve({ id: this.lastID });
    });
  });

/**
 * Track TOTP enablement
 * @param {number} user_id - User ID
 * @param {string} ip_address - Client IP address
 * @param {string} user_agent - User agent string
 * @returns {Promise<void>}
 */
exports.trackTotpEnabled = async (user_id, ip_address, user_agent) =>
  new Promise((resolve, reject) => {
    const query = `
      INSERT INTO user_activity
      (user_id, activity_type, ip_address, user_agent, success, session_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(query, [user_id, 'totp_enabled', ip_address, user_agent, 1, null], function (err) {
      if (err) {
        logger.error('[UserActivity] Error tracking TOTP enablement:', err);
        return reject(err);
      }
      logger.info(`[UserActivity] totp_enabled tracked for user_id=${user_id}, ip=${ip_address}`);
      resolve({ id: this.lastID });
    });
  });

/**
 * Detect anomalous user activity patterns
 * @param {number} user_id - User ID to check
 * @returns {Promise<boolean>} - True if anomalous activity detected
 */
exports.isAnomalousActivity = async (user_id) =>
  new Promise((resolve, reject) => {
    // Check for multiple sessions created in short time window (5 minutes)
    const multipleSessionsQuery = `
      SELECT COUNT(DISTINCT session_id) as session_count
      FROM user_activity
      WHERE user_id = ?
        AND activity_type = 'login'
        AND success = 1
        AND session_id IS NOT NULL
        AND created_at >= datetime('now', '-5 minutes')
    `;

    db.get(multipleSessionsQuery, [user_id], (err, sessionRow) => {
      if (err) {
        logger.error('[UserActivity] Error checking multiple sessions:', err);
        return reject(err);
      }

      // Anomaly: More than 3 successful logins in 5 minutes
      if (sessionRow && sessionRow.session_count > 3) {
        logger.info(
          `[UserActivity] ANOMALY DETECTED: user_id=${user_id} created ${sessionRow.session_count} sessions in 5 minutes`
        );
        return resolve(true);
      }

      // Check for frequent IP address changes (different IPs in last 30 minutes)
      const ipChangeQuery = `
        SELECT COUNT(DISTINCT ip_address) as ip_count
        FROM user_activity
        WHERE user_id = ?
          AND activity_type IN ('login', 'logout')
          AND created_at >= datetime('now', '-30 minutes')
      `;

      db.get(ipChangeQuery, [user_id], (err2, ipRow) => {
        if (err2) {
          logger.error('[UserActivity] Error checking IP changes:', err2);
          return reject(err2);
        }

        // Anomaly: More than 4 different IPs in 30 minutes
        if (ipRow && ipRow.ip_count > 4) {
          logger.info(
            `[UserActivity] ANOMALY DETECTED: user_id=${user_id} used ${ipRow.ip_count} different IPs in 30 minutes`
          );
          return resolve(true);
        }

        // Check for multiple failed login attempts (brute force indicator)
        const failedLoginQuery = `
          SELECT COUNT(*) as failed_count
          FROM user_activity
          WHERE user_id = ?
            AND activity_type = 'failed_login'
            AND created_at >= datetime('now', '-10 minutes')
        `;

        db.get(failedLoginQuery, [user_id], (err3, failRow) => {
          if (err3) {
            logger.error('[UserActivity] Error checking failed logins:', err3);
            return reject(err3);
          }

          // Anomaly: More than 5 failed logins in 10 minutes
          if (failRow && failRow.failed_count > 5) {
            logger.info(
              `[UserActivity] ANOMALY DETECTED: user_id=${user_id} had ${failRow.failed_count} failed logins in 10 minutes`
            );
            return resolve(true);
          }

          // No anomalies detected
          resolve(false);
        });
      });
    });
  });

/**
 * Get recent activity for a user
 * @param {number} user_id - User ID
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} - Array of activity records
 */
exports.getRecentActivity = async (user_id, limit = 50) =>
  new Promise((resolve, reject) => {
    const query = `
      SELECT id, activity_type, ip_address, user_agent, success, failure_reason, session_id, created_at
      FROM user_activity
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    db.all(query, [user_id, limit], (err, rows) => {
      if (err) {
        logger.error('[UserActivity] Error fetching recent activity:', err);
        return reject(err);
      }
      resolve(rows || []);
    });
  });

/**
 * Get activity statistics for a user
 * @param {number} user_id - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} - Activity statistics
 */
exports.getActivityStats = async (user_id, days = 30) =>
  new Promise((resolve, reject) => {
    const query = `
      SELECT
        activity_type,
        COUNT(*) as count,
        COUNT(DISTINCT ip_address) as unique_ips,
        MAX(created_at) as last_occurrence
      FROM user_activity
      WHERE user_id = ?
        AND created_at >= datetime('now', '-${days} days')
      GROUP BY activity_type
    `;

    db.all(query, [user_id], (err, rows) => {
      if (err) {
        logger.error('[UserActivity] Error fetching activity stats:', err);
        return reject(err);
      }

      const stats = {
        user_id,
        period_days: days,
        activities: rows || [],
        total_events: rows ? rows.reduce((sum, row) => sum + row.count, 0) : 0
      };

      resolve(stats);
    });
  });

module.exports = exports;
