/**
 * Security Alerts Utility
 * ITSM-Sec Nexus - Real-time security alert generation
 *
 * Detects and generates security alerts based on user actions and system events
 */

const { db } = require('../db');

/**
 * Check for login-related security alerts
 * - Failed login attempts (5+ in 15 minutes)
 * - Suspicious activity (same user, different IPs, within 30 seconds)
 */
async function checkLoginAlerts(user, action, ip_address) {
  try {
    // Check failed login attempts
    if (action === 'failed_login') {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      const failedLogins = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count
           FROM user_activity
           WHERE user_id = ?
           AND activity_type = 'failed_login'
           AND created_at > ?`,
          [user.id, fifteenMinutesAgo],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (failedLogins.count >= 5) {
        return {
          alert_type: 'failed_login',
          severity: 'high',
          description: `User '${user.username}' has ${failedLogins.count} failed login attempts in the last 15 minutes.`,
          affected_user_id: user.id,
          affected_resource_type: 'user',
          affected_resource_id: user.id.toString(),
          source_ip: ip_address,
          is_acknowledged: false
        };
      }
    }

    // Check suspicious activity (different IPs within 30 seconds)
    if (action === 'login') {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

      const recentLogins = await new Promise((resolve, reject) => {
        db.all(
          `SELECT ip_address, created_at
           FROM user_activity
           WHERE user_id = ?
           AND activity_type = 'login'
           AND success = 1
           AND created_at > ?
           ORDER BY created_at DESC
           LIMIT 2`,
          [user.id, thirtySecondsAgo],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      if (recentLogins.length >= 2 && recentLogins[0].ip_address !== recentLogins[1].ip_address) {
        return {
          alert_type: 'suspicious_activity',
          severity: 'high',
          description: `User '${user.username}' logged in from different IP addresses (${recentLogins[1].ip_address}, ${recentLogins[0].ip_address}) within 30 seconds.`,
          affected_user_id: user.id,
          affected_resource_type: 'user',
          affected_resource_id: user.id.toString(),
          source_ip: ip_address,
          is_acknowledged: false
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[Security Alerts] Error checking login alerts:', error);
    return null;
  }
}

/**
 * Check for privilege escalation
 * - Role change from analyst/viewer/manager to admin
 */
async function checkPrivilegeEscalation(user, oldValues, newValues) {
  try {
    const oldRole = oldValues.role;
    const newRole = newValues.role;

    // Check if role was changed to admin from a lower privilege role
    if (newRole === 'admin' && oldRole !== 'admin') {
      return {
        alert_type: 'privilege_escalation',
        severity: 'critical',
        description: `User '${user.username}' escalated privileges from '${oldRole}' to 'admin' for user ID ${oldValues.id || 'unknown'}.`,
        affected_user_id: oldValues.id || null,
        affected_resource_type: 'user',
        affected_resource_id: oldValues.id ? oldValues.id.toString() : null,
        source_ip: null,
        is_acknowledged: false
      };
    }

    return null;
  } catch (error) {
    console.error('[Security Alerts] Error checking privilege escalation:', error);
    return null;
  }
}

/**
 * Check for vulnerability detection alerts
 * - Critical or High severity vulnerabilities
 */
async function checkVulnerabilityAlert(user, resource_data) {
  try {
    const { severity } = resource_data;

    if (severity === 'Critical' || severity === 'High') {
      return {
        alert_type: 'vulnerability_detected',
        severity: severity === 'Critical' ? 'critical' : 'high',
        description: `${severity} severity vulnerability detected: ${resource_data.title || 'Unknown vulnerability'} (${resource_data.vulnerability_id || 'N/A'}).`,
        affected_user_id: user.id,
        affected_resource_type: 'vulnerability',
        affected_resource_id: resource_data.vulnerability_id || resource_data.id?.toString(),
        source_ip: null,
        is_acknowledged: false
      };
    }

    return null;
  } catch (error) {
    console.error('[Security Alerts] Error checking vulnerability alert:', error);
    return null;
  }
}

/**
 * Check for unauthorized security change implementation
 * - Security change (is_security_change=1) implemented without approval
 */
async function checkUnauthorizedChange(user, resource_data, oldValues, newValues) {
  try {
    const isSecurityChange = resource_data.is_security_change === 1;
    const oldStatus = oldValues?.status;
    const newStatus = newValues?.status;

    // Check if security change was implemented without approval
    if (isSecurityChange && oldStatus !== 'Implemented' && newStatus === 'Implemented') {
      const currentStatus = resource_data.status;

      // If status is Implemented but not Approved, trigger alert
      if (currentStatus === 'Implemented' && oldStatus !== 'Approved') {
        return {
          alert_type: 'unauthorized_change',
          severity: 'high',
          description: `Security change '${resource_data.rfc_id || resource_data.title}' was implemented without approval by user '${user.username}'.`,
          affected_user_id: user.id,
          affected_resource_type: 'change',
          affected_resource_id: resource_data.rfc_id || resource_data.id?.toString(),
          source_ip: null,
          is_acknowledged: false
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[Security Alerts] Error checking unauthorized change:', error);
    return null;
  }
}

/**
 * Check for security incident creation
 * - Incident marked as security incident (is_security_incident=1)
 */
async function checkSecurityIncident(user, resource_data) {
  try {
    const isSecurityIncident = resource_data.is_security_incident === 1;

    if (isSecurityIncident) {
      return {
        alert_type: 'security_incident_created',
        severity: 'high',
        description: `Security incident created: ${resource_data.title || 'Unknown incident'} (${resource_data.ticket_id || 'N/A'}) by user '${user.username}'.`,
        affected_user_id: user.id,
        affected_resource_type: 'incident',
        affected_resource_id: resource_data.ticket_id || resource_data.id?.toString(),
        source_ip: null,
        is_acknowledged: false
      };
    }

    return null;
  } catch (error) {
    console.error('[Security Alerts] Error checking security incident:', error);
    return null;
  }
}

/**
 * Save alert to database
 * @param {Object} alert - Alert object
 * @returns {Promise<Object>} Saved alert with ID
 */
async function saveAlert(alert) {
  try {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO security_alerts (
          alert_type,
          severity,
          description,
          affected_user_id,
          affected_resource_type,
          affected_resource_id,
          source_ip,
          is_acknowledged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        alert.alert_type,
        alert.severity,
        alert.description,
        alert.affected_user_id || null,
        alert.affected_resource_type || null,
        alert.affected_resource_id || null,
        alert.source_ip || null,
        alert.is_acknowledged ? 1 : 0
      ];

      db.run(sql, params, function (err) {
        if (err) {
          console.error('[Security Alerts] Error saving alert:', err);
          reject(err);
        } else {
          console.log(`[Security Alerts] Alert created: ${alert.alert_type} (ID: ${this.lastID})`);
          resolve({ ...alert, id: this.lastID });
        }
      });
    });
  } catch (error) {
    console.error('[Security Alerts] Error in saveAlert:', error);
    throw error;
  }
}

/**
 * Generate security alert based on action context
 * @param {Object} context - Action context
 * @param {Object} context.user - User object (id, username, role)
 * @param {string} context.action - Action type (create, update, delete, login, etc.)
 * @param {string} context.resource_type - Resource type (user, incident, change, etc.)
 * @param {Object} context.resource_data - Resource data (current state)
 * @param {Object} context.oldValues - Previous values for updates
 * @param {Object} context.newValues - New values for updates
 * @param {string} context.ip_address - Source IP address
 * @returns {Promise<Object|null>} Security alert object or null if no alert triggered
 */
exports.generateAlert = async (context) => {
  try {
    const { user, action, resource_type, resource_data, oldValues, newValues, ip_address } =
      context;

    // Ensure required context is provided
    if (!user || !action || !resource_type) {
      return null;
    }

    let alert = null;

    // 1. LOGIN RELATED ALERTS
    if (action === 'login' || action === 'failed_login') {
      alert = await checkLoginAlerts(user, action, ip_address);
    }

    // 2. PRIVILEGE ESCALATION ALERTS
    if (action === 'update' && resource_type === 'user' && oldValues && newValues) {
      alert = await checkPrivilegeEscalation(user, oldValues, newValues);
    }

    // 3. VULNERABILITY DETECTION ALERTS
    if (action === 'create' && resource_type === 'vulnerability') {
      alert = await checkVulnerabilityAlert(user, resource_data);
    }

    // 4. UNAUTHORIZED CHANGE ALERTS
    if (action === 'update' && resource_type === 'change') {
      alert = await checkUnauthorizedChange(user, resource_data, oldValues, newValues);
    }

    // 5. SECURITY INCIDENT CREATION ALERTS
    if (action === 'create' && resource_type === 'incident') {
      alert = await checkSecurityIncident(user, resource_data);
    }

    // If alert was generated, save it to database
    if (alert) {
      return await saveAlert(alert);
    }

    return null;
  } catch (error) {
    console.error('[Security Alerts] Error generating alert:', error);
    return null;
  }
};
