/**
 * Threat Detection Service
 * 脅威検知・自動対応機能
 *
 * @module services/threatDetectionService
 */

const { db } = require('../db');
const { sendSecurityAlert } = require('./emailService');
const { notifyIncident } = require('./notificationService');

class ThreatDetectionService {
  constructor() {
    this.threatPatterns = {
      // ブルートフォース攻撃検知
      bruteForce: {
        name: 'Brute Force Attack',
        threshold: 5, // 5分間に5回以上失敗
        window: 5 * 60 * 1000, // 5分
        severity: 'High'
      },

      // 異常なアクセスパターン
      suspiciousActivity: {
        name: 'Suspicious Activity',
        threshold: 3, // 異なるIPからのログイン
        window: 10 * 60 * 1000, // 10分
        severity: 'Medium'
      },

      // 権限昇格攻撃
      privilegeEscalation: {
        name: 'Privilege Escalation',
        threshold: 1, // 1回の昇格試行
        severity: 'Critical'
      },

      // 脆弱性悪用
      vulnerabilityExploitation: {
        name: 'Vulnerability Exploitation',
        threshold: 1,
        severity: 'Critical'
      }
    };

    this.activeThreats = new Map();
  }

  /**
   * ログイン失敗を監視
   * @param {Object} loginAttempt ログイン試行情報
   */
  async monitorLoginFailure(loginAttempt) {
    const { username, ip, timestamp } = loginAttempt;

    // 失敗履歴を取得
    const failures = await this.getRecentFailures(username, this.threatPatterns.bruteForce.window);

    if (failures.length >= this.threatPatterns.bruteForce.threshold) {
      await this.detectThreat({
        type: 'bruteForce',
        username,
        ip,
        details: {
          failureCount: failures.length,
          window: this.threatPatterns.bruteForce.window,
          lastFailure: timestamp
        }
      });
    }
  }

  /**
   * 異常なアクセスを監視
   * @param {Object} accessInfo アクセス情報
   */
  async monitorSuspiciousAccess(accessInfo) {
    const { username, ip, location } = accessInfo;

    // 最近のアクセス履歴を取得
    const recentAccesses = await this.getRecentAccesses(
      username,
      this.threatPatterns.suspiciousActivity.window
    );

    // 異なるIPアドレスからのアクセスを検知
    const uniqueIPs = new Set(recentAccesses.map((access) => access.ip));
    if (uniqueIPs.size >= this.threatPatterns.suspiciousActivity.threshold) {
      await this.detectThreat({
        type: 'suspiciousActivity',
        username,
        ip,
        details: {
          uniqueIPs: Array.from(uniqueIPs),
          accessCount: recentAccesses.length,
          location
        }
      });
    }
  }

  /**
   * 権限昇格を監視
   * @param {Object} privilegeChange 権限変更情報
   */
  async monitorPrivilegeEscalation(privilegeChange) {
    const { username, oldRole, newRole, changedBy } = privilegeChange;

    const roleHierarchy = {
      viewer: 1,
      analyst: 2,
      manager: 3,
      admin: 4
    };

    if (roleHierarchy[newRole] > roleHierarchy[oldRole]) {
      await this.detectThreat({
        type: 'privilegeEscalation',
        username,
        details: {
          oldRole,
          newRole,
          changedBy,
          escalation: roleHierarchy[newRole] - roleHierarchy[oldRole]
        }
      });
    }
  }

  /**
   * 脆弱性悪用を監視
   * @param {Object} vulnerabilityInfo 脆弱性情報
   */
  async monitorVulnerabilityExploitation(vulnerabilityInfo) {
    const { vulnerabilityId, severity, affectedAsset } = vulnerabilityInfo;

    if (severity === 'Critical') {
      await this.detectThreat({
        type: 'vulnerabilityExploitation',
        details: {
          vulnerabilityId,
          severity,
          affectedAsset,
          exploitDetected: true
        }
      });
    }
  }

  /**
   * 脅威を検知して対応
   * @param {Object} threatInfo 脅威情報
   */
  async detectThreat(threatInfo) {
    const threatId = `THREAT-${Date.now()}`;
    const threat = {
      id: threatId,
      type: threatInfo.type,
      severity: this.threatPatterns[threatInfo.type].severity,
      status: 'Active',
      detectedAt: new Date(),
      ...threatInfo
    };

    // 脅威をデータベースに記録
    await this.saveThreat(threat);

    // 自動対応を実行
    await this.executeAutomatedResponse(threat);

    // アラートを送信
    await this.sendThreatAlert(threat);

    console.log(`[THREAT DETECTED] ${threat.type} - ID: ${threatId}`);

    return threat;
  }

  /**
   * 自動対応を実行
   * @param {Object} threat 脅威情報
   */
  async executeAutomatedResponse(threat) {
    const responses = {
      bruteForce: async (t) => {
        // アカウントを一時的にロック
        await this.lockAccount(t.username, 30); // 30分ロック
        return 'Account temporarily locked';
      },

      suspiciousActivity: async (t) => {
        // 追加の認証を要求
        await this.requireAdditionalAuth(t.username);
        return 'Additional authentication required';
      },

      privilegeEscalation: async (t) => {
        // 昇格をブロックして管理者に通知
        await this.blockPrivilegeChange(t.username);
        return 'Privilege escalation blocked';
      },

      vulnerabilityExploitation: async (t) => {
        // 影響を受けた資産を隔離
        await this.isolateAsset(t.details.affectedAsset);
        return 'Asset isolated for investigation';
      }
    };

    if (responses[threat.type]) {
      const action = await responses[threat.type](threat);

      // 対応を記録
      await this.saveResponse(threat.id, action);

      return action;
    }
  }

  /**
   * 脅威アラートを送信
   * @param {Object} threat 脅威情報
   */
  async sendThreatAlert(threat) {
    const alertData = {
      alert_type: threat.type,
      severity: threat.severity,
      description: `Threat detected: ${threat.type}`,
      timestamp: threat.detectedAt,
      threat_id: threat.id,
      details: threat.details
    };

    // メール通知
    await sendSecurityAlert(alertData);

    // インシデント作成
    const incidentData = {
      ticket_id: `SEC-${Date.now().toString().slice(-6)}`,
      title: `Security Threat: ${threat.type}`,
      priority: threat.severity === 'Critical' ? 'Critical' : 'High',
      status: 'New',
      description: `Automated threat detection: ${threat.type}`,
      is_security_incident: 1
    };

    await notifyIncident(db, incidentData, 'created');
  }

  /**
   * アカウントをロック
   * @param {string} username ユーザー名
   * @param {number} minutes ロック時間（分）
   */
  async lockAccount(username, minutes) {
    const lockUntil = new Date(Date.now() + minutes * 60 * 1000);

    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET locked_until = ? WHERE username = ?',
        [lockUntil.toISOString(), username],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 追加認証を要求
   * @param {string} username ユーザー名
   */
  async requireAdditionalAuth(username) {
    // 2FAを強制的に要求
    return new Promise((resolve, reject) => {
      db.run('UPDATE users SET require_2fa = 1 WHERE username = ?', [username], function (err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 権限変更をブロック
   * @param {string} username ユーザー名
   */
  async blockPrivilegeChange(username) {
    // 権限変更を一時的にブロック
    const blockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1時間

    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET privilege_change_blocked_until = ? WHERE username = ?',
        [blockUntil.toISOString(), username],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 資産を隔離
   * @param {string} assetTag 資産タグ
   */
  async isolateAsset(assetTag) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE assets SET status = "Isolated", isolation_reason = "Security threat detected" WHERE asset_tag = ?',
        [assetTag],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 最近の失敗ログインを取得
   * @param {string} username ユーザー名
   * @param {number} windowMs 時間枠（ミリ秒）
   */
  async getRecentFailures(username, windowMs) {
    const since = new Date(Date.now() - windowMs);

    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM user_activity WHERE username = ? AND action = "login_failed" AND timestamp >= ?',
        [username, since.toISOString()],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * 最近のアクセスを取得
   * @param {string} username ユーザー名
   * @param {number} windowMs 時間枠（ミリ秒）
   */
  async getRecentAccesses(username, windowMs) {
    const since = new Date(Date.now() - windowMs);

    return new Promise((resolve, reject) => {
      db.all(
        'SELECT ip_address, timestamp FROM user_activity WHERE username = ? AND action = "login_success" AND timestamp >= ?',
        [username, since.toISOString()],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * 脅威をデータベースに保存
   * @param {Object} threat 脅威情報
   */
  async saveThreat(threat) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO security_threats
         (threat_id, type, severity, status, details, detected_at, username, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          threat.id,
          threat.type,
          threat.severity,
          threat.status,
          JSON.stringify(threat.details),
          threat.detectedAt.toISOString(),
          threat.username,
          threat.ip
        ],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * 対応をデータベースに保存
   * @param {string} threatId 脅威ID
   * @param {string} action 実行された対応
   */
  async saveResponse(threatId, action) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO threat_responses (threat_id, action, executed_at) VALUES (?, ?, ?)',
        [threatId, action, new Date().toISOString()],
        function (err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * アクティブな脅威を取得
   */
  async getActiveThreats() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM security_threats WHERE status = "Active" ORDER BY detected_at DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * 脅威を解決
   * @param {string} threatId 脅威ID
   */
  async resolveThreat(threatId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE security_threats SET status = "Resolved", resolved_at = ? WHERE threat_id = ?',
        [new Date().toISOString(), threatId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
}

module.exports = new ThreatDetectionService();
