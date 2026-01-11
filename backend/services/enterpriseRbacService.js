/**
 * Enterprise RBAC Service
 * エンタープライズレベルのロールベースアクセス制御
 *
 * @module services/enterpriseRbacService
 */

const { db } = require('../db');

class EnterpriseRbacService {
  constructor() {
    this.roles = {
      super_admin: {
        name: 'Super Administrator',
        level: 100,
        permissions: ['*'], // すべての権限
        description: '最高権限を持つ管理者'
      },
      admin: {
        name: 'Administrator',
        level: 80,
        permissions: [
          'users.manage',
          'roles.manage',
          'incidents.manage',
          'problems.manage',
          'changes.manage',
          'releases.manage',
          'assets.manage',
          'vulnerabilities.manage',
          'compliance.manage',
          'reports.view',
          'security.view',
          'audit.view',
          'integrations.manage'
        ],
        description: 'システム管理者'
      },
      manager: {
        name: 'Manager',
        level: 60,
        permissions: [
          'incidents.manage',
          'problems.manage',
          'changes.manage',
          'releases.manage',
          'assets.view',
          'vulnerabilities.view',
          'reports.view',
          'security.view',
          'audit.view'
        ],
        description: '部門マネージャー'
      },
      analyst: {
        name: 'Analyst',
        level: 40,
        permissions: [
          'incidents.create',
          'incidents.update',
          'problems.create',
          'problems.update',
          'changes.create',
          'changes.update',
          'assets.view',
          'vulnerabilities.view',
          'reports.view'
        ],
        description: 'ITアナリスト'
      },
      viewer: {
        name: 'Viewer',
        level: 20,
        permissions: [
          'incidents.view',
          'problems.view',
          'changes.view',
          'releases.view',
          'assets.view',
          'vulnerabilities.view',
          'reports.view',
          'security.view'
        ],
        description: '閲覧専用ユーザー'
      },
      user: {
        name: 'End User',
        level: 10,
        permissions: ['incidents.create', 'service_requests.create', 'knowledge.view'],
        description: 'エンドユーザー'
      }
    };

    // テナント固有の権限マッピング
    this.tenantPermissions = new Map();
  }

  /**
   * ユーザー権限を確認
   * @param {Object} user ユーザー情報
   * @param {string} permission 確認する権限
   * @param {string} resource リソース（オプション）
   * @param {string} tenantId テナントID（オプション）
   */
  async checkPermission(user, permission, resource = null, tenantId = null) {
    try {
      // ユーザーのロールを取得
      const userRoles = await this.getUserRoles(user.username, tenantId);

      // 各ロールの権限をチェック
      for (const roleName of userRoles) {
        const role = this.roles[roleName];
        if (!role) continue;

        // ワイルドカード権限がある場合
        if (role.permissions.includes('*')) {
          return true;
        }

        // 特定の権限がある場合
        if (role.permissions.includes(permission)) {
          // リソース固有のチェック
          if (resource) {
            return await this.checkResourcePermission(user, permission, resource, tenantId);
          }
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * リソース固有の権限チェック
   * @param {Object} user ユーザー情報
   * @param {string} permission 権限
   * @param {string} resource リソース
   * @param {string} tenantId テナントID
   */
  async checkResourcePermission(user, permission, resource, tenantId) {
    // リソース所有者のチェック
    const isOwner = await this.isResourceOwner(user.username, resource, tenantId);
    if (isOwner) {
      return true;
    }

    // 部門ベースのアクセス制御
    const userDepartment = await this.getUserDepartment(user.username);
    const resourceDepartment = await this.getResourceDepartment(resource);

    if (userDepartment && resourceDepartment === userDepartment) {
      return true;
    }

    // テナント固有の権限ルール
    if (tenantId) {
      const tenantRules = this.tenantPermissions.get(tenantId) || [];
      for (const rule of tenantRules) {
        if (rule.permission === permission && rule.resource === resource) {
          if (rule.users.includes(user.username) || rule.departments.includes(userDepartment)) {
            return rule.allowed;
          }
        }
      }
    }

    return false;
  }

  /**
   * ユーザーがリソースの所有者かどうか確認
   * @param {string} username ユーザー名
   * @param {string} resource リソース
   * @param {string} tenantId テナントID
   */
  async isResourceOwner(username, resource, tenantId) {
    const resourceType = resource.split(':')[0];
    const resourceId = resource.split(':')[1];

    const queries = {
      incident: 'SELECT created_by FROM incidents WHERE ticket_id = ?',
      problem: 'SELECT assignee FROM problems WHERE problem_id = ?',
      change: 'SELECT requester FROM changes WHERE change_id = ?',
      asset: 'SELECT owner FROM assets WHERE asset_tag = ?'
    };

    if (!queries[resourceType]) {
      return false;
    }

    return new Promise((resolve, reject) => {
      db.get(queries[resourceType], [resourceId], (err, row) => {
        if (err) reject(err);
        else resolve(row && row[Object.keys(row)[0]] === username);
      });
    });
  }

  /**
   * ユーザーの部門を取得
   * @param {string} username ユーザー名
   */
  async getUserDepartment(username) {
    return new Promise((resolve, reject) => {
      db.get('SELECT department FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.department : null);
      });
    });
  }

  /**
   * リソースの部門を取得
   * @param {string} resource リソース
   */
  async getResourceDepartment(resource) {
    const resourceType = resource.split(':')[0];
    const resourceId = resource.split(':')[1];

    const queries = {
      incident: 'SELECT department FROM incidents WHERE ticket_id = ?',
      problem: 'SELECT department FROM problems WHERE problem_id = ?',
      asset: 'SELECT department FROM assets WHERE asset_tag = ?'
    };

    if (!queries[resourceType]) {
      return null;
    }

    return new Promise((resolve, reject) => {
      db.get(queries[resourceType], [resourceId], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.department : null);
      });
    });
  }

  /**
   * ユーザーのロールを取得
   * @param {string} username ユーザー名
   * @param {string} tenantId テナントID
   */
  async getUserRoles(username, tenantId = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT role FROM users WHERE username = ?';
      let params = [username];

      if (tenantId) {
        query =
          'SELECT ur.role FROM user_roles ur JOIN tenants t ON ur.tenant_id = t.id WHERE ur.username = ? AND t.tenant_id = ?';
        params = [username, tenantId];
      }

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows ? rows.map((row) => row.role) : []);
      });
    });
  }

  /**
   * ロールにユーザーを割り当て
   * @param {string} username ユーザー名
   * @param {string} role ロール名
   * @param {string} tenantId テナントID
   */
  async assignRole(username, role, tenantId = null) {
    if (!this.roles[role]) {
      throw new Error(`Invalid role: ${role}`);
    }

    return new Promise((resolve, reject) => {
      let query;
      let params;

      if (tenantId) {
        query = 'INSERT OR REPLACE INTO user_roles (username, role, tenant_id) VALUES (?, ?, ?)';
        params = [username, role, tenantId];
      } else {
        query = 'UPDATE users SET role = ? WHERE username = ?';
        params = [role, username];
      }

      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * ロールからユーザーを削除
   * @param {string} username ユーザー名
   * @param {string} role ロール名
   * @param {string} tenantId テナントID
   */
  async removeRole(username, role, tenantId = null) {
    return new Promise((resolve, reject) => {
      let query;
      let params;

      if (tenantId) {
        query = 'DELETE FROM user_roles WHERE username = ? AND role = ? AND tenant_id = ?';
        params = [username, role, tenantId];
      } else {
        query = 'UPDATE users SET role = NULL WHERE username = ? AND role = ?';
        params = [username, role];
      }

      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * カスタム権限ルールを作成
   * @param {string} tenantId テナントID
   * @param {Object} rule 権限ルール
   */
  createPermissionRule(tenantId, rule) {
    const rules = this.tenantPermissions.get(tenantId) || [];
    rules.push({
      permission: rule.permission,
      resource: rule.resource,
      users: rule.users || [],
      departments: rule.departments || [],
      allowed: rule.allowed
    });
    this.tenantPermissions.set(tenantId, rules);
  }

  /**
   * 利用可能なロールを取得
   */
  getAvailableRoles() {
    return Object.keys(this.roles).map((roleKey) => ({
      key: roleKey,
      ...this.roles[roleKey]
    }));
  }

  /**
   * ロールの権限を取得
   * @param {string} role ロール名
   */
  getRolePermissions(role) {
    return this.roles[role] ? this.roles[role].permissions : [];
  }

  /**
   * ユーザーの有効な権限を取得
   * @param {string} username ユーザー名
   * @param {string} tenantId テナントID
   */
  async getEffectivePermissions(username, tenantId = null) {
    const userRoles = await this.getUserRoles(username, tenantId);
    const permissions = new Set();

    for (const role of userRoles) {
      const rolePermissions = this.getRolePermissions(role);
      rolePermissions.forEach((permission) => permissions.add(permission));
    }

    return Array.from(permissions);
  }

  /**
   * 権限の説明を取得
   */
  getPermissionDescriptions() {
    return {
      'users.manage': 'ユーザー管理',
      'roles.manage': 'ロール管理',
      'incidents.manage': 'インシデント管理',
      'incidents.create': 'インシデント作成',
      'incidents.update': 'インシデント更新',
      'incidents.view': 'インシデント閲覧',
      'problems.manage': '問題管理',
      'problems.create': '問題作成',
      'problems.update': '問題更新',
      'problems.view': '問題閲覧',
      'changes.manage': '変更管理',
      'changes.create': '変更作成',
      'changes.update': '変更更新',
      'changes.view': '変更閲覧',
      'releases.manage': 'リリース管理',
      'releases.view': 'リリース閲覧',
      'assets.manage': '資産管理',
      'assets.view': '資産閲覧',
      'vulnerabilities.manage': '脆弱性管理',
      'vulnerabilities.view': '脆弱性閲覧',
      'compliance.manage': 'コンプライアンス管理',
      'reports.view': 'レポート閲覧',
      'security.view': 'セキュリティ閲覧',
      'audit.view': '監査ログ閲覧',
      'integrations.manage': '統合管理',
      'service_requests.create': 'サービスリクエスト作成',
      'knowledge.view': 'ナレッジ閲覧'
    };
  }
}

module.exports = new EnterpriseRbacService();
