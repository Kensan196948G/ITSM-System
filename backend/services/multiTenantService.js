/**
 * Multi-Tenant Service
 * マルチテナント機能の実装
 *
 * @module services/multiTenantService
 */

const { db } = require('../db');

class MultiTenantService {
  constructor() {
    this.tenants = new Map();
    this.tenantCache = new Map();
  }

  /**
   * テナントを作成
   * @param {Object} tenantData テナントデータ
   */
  async createTenant(tenantData) {
    const { tenantId, name, description, adminUsername, domain, settings } = tenantData;

    if (!tenantId || !name) {
      throw new Error('Tenant ID and name are required');
    }

    // テナントIDの重複チェック
    const existing = await this.getTenantById(tenantId);
    if (existing) {
      throw new Error('Tenant ID already exists');
    }

    const tenant = {
      id: tenantId,
      name,
      description: description || '',
      adminUsername,
      domain: domain || null,
      settings: settings || {},
      createdAt: new Date(),
      status: 'active'
    };

    // データベースに保存
    await this.saveTenant(tenant);

    // テナント固有のデータベーススキーマを作成
    await this.createTenantSchema(tenantId);

    // 管理者ユーザーをテナントに割り当て
    if (adminUsername) {
      await this.assignUserToTenant(adminUsername, tenantId, 'admin');
    }

    this.tenants.set(tenantId, tenant);
    return tenant;
  }

  /**
   * テナントを取得
   * @param {string} tenantId テナントID
   */
  async getTenantById(tenantId) {
    // キャッシュチェック
    if (this.tenantCache.has(tenantId)) {
      return this.tenantCache.get(tenantId);
    }

    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM tenants WHERE tenant_id = ? AND status = "active"',
        [tenantId],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            const tenant = {
              id: row.tenant_id,
              name: row.name,
              description: row.description,
              adminUsername: row.admin_username,
              domain: row.domain,
              settings: JSON.parse(row.settings || '{}'),
              createdAt: new Date(row.created_at),
              status: row.status
            };
            this.tenantCache.set(tenantId, tenant);
            resolve(tenant);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * リクエストからテナントIDを解決
   * @param {Object} req Expressリクエストオブジェクト
   */
  async resolveTenant(req) {
    // ヘッダーからのテナントID
    let tenantId = req.headers['x-tenant-id'];

    // サブドメインからの解決
    if (!tenantId && req.subdomains && req.subdomains.length > 0) {
      const subdomain = req.subdomains[0];
      const tenant = await this.getTenantByDomain(`${subdomain}.${req.hostname}`);
      if (tenant) {
        tenantId = tenant.id;
      }
    }

    // JWTトークンからの解決
    if (!tenantId && req.user && req.user.tenantId) {
      tenantId = req.user.tenantId;
    }

    // デフォルトテナント
    if (!tenantId) {
      tenantId = 'default';
    }

    return tenantId;
  }

  /**
   * ドメインからテナントを取得
   * @param {string} domain ドメイン
   */
  async getTenantByDomain(domain) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM tenants WHERE domain = ? AND status = "active"',
        [domain],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            resolve({
              id: row.tenant_id,
              name: row.name,
              description: row.description,
              adminUsername: row.admin_username,
              domain: row.domain,
              settings: JSON.parse(row.settings || '{}'),
              createdAt: new Date(row.created_at),
              status: row.status
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * ユーザーをテナントに割り当て
   * @param {string} username ユーザー名
   * @param {string} tenantId テナントID
   * @param {string} role ロール
   */
  async assignUserToTenant(username, tenantId, role = 'user') {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR REPLACE INTO user_tenants (username, tenant_id, role, assigned_at) VALUES (?, ?, ?, ?)',
        [username, tenantId, role, new Date().toISOString()],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  /**
   * ユーザーのテナントを取得
   * @param {string} username ユーザー名
   */
  async getUserTenants(username) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT ut.tenant_id, ut.role, t.name, t.domain FROM user_tenants ut JOIN tenants t ON ut.tenant_id = t.tenant_id WHERE ut.username = ?',
        [username],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * テナントのユーザーを取得
   * @param {string} tenantId テナントID
   */
  async getTenantUsers(tenantId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT u.username, u.email, ut.role, ut.assigned_at FROM users u JOIN user_tenants ut ON u.username = ut.username WHERE ut.tenant_id = ?',
        [tenantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * テナント固有のデータベーススキーマを作成
   * @param {string} tenantId テナントID
   */
  async createTenantSchema(tenantId) {
    const schemaQueries = [
      `CREATE TABLE IF NOT EXISTS ${tenantId}_incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT UNIQUE,
        title TEXT NOT NULL,
        priority TEXT,
        status TEXT,
        description TEXT,
        is_security_incident INTEGER DEFAULT 0,
        created_by TEXT,
        assignee TEXT,
        department TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS ${tenantId}_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_tag TEXT UNIQUE,
        name TEXT NOT NULL,
        type TEXT,
        criticality INTEGER DEFAULT 3,
        status TEXT DEFAULT 'Operational',
        department TEXT,
        owner TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS ${tenantId}_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        action TEXT,
        resource TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const query of schemaQueries) {
      await new Promise((resolve, reject) => {
        db.run(query, [], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * テナント設定を更新
   * @param {string} tenantId テナントID
   * @param {Object} settings 設定
   */
  async updateTenantSettings(tenantId, settings) {
    const self = this;
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE tenants SET settings = ?, updated_at = ? WHERE tenant_id = ?',
        [JSON.stringify(settings), new Date().toISOString(), tenantId],
        function (err) {
          if (err) reject(err);
          else {
            // キャッシュをクリア
            self.tenantCache.delete(tenantId);
            resolve(this.changes);
          }
        }
      );
    });
  }

  /**
   * テナントを無効化
   * @param {string} tenantId テナントID
   */
  async deactivateTenant(tenantId) {
    const self = this;
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE tenants SET status = "inactive", updated_at = ? WHERE tenant_id = ?',
        [new Date().toISOString(), tenantId],
        function (err) {
          if (err) reject(err);
          else {
            // キャッシュをクリア
            self.tenantCache.delete(tenantId);
            resolve(this.changes);
          }
        }
      );
    });
  }

  /**
   * テナント統計を取得
   * @param {string} tenantId テナントID
   */
  async getTenantStats(tenantId) {
    const stats = {
      users: 0,
      incidents: 0,
      assets: 0,
      auditLogs: 0
    };

    // ユーザー数
    const users = await this.getTenantUsers(tenantId);
    stats.users = users.length;

    // インシデント数
    const incidents = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM ${tenantId}_incidents`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
    stats.incidents = incidents;

    // 資産数
    const assets = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM ${tenantId}_assets`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
    stats.assets = assets;

    // 監査ログ数
    const auditLogs = await new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM ${tenantId}_audit_logs`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
    stats.auditLogs = auditLogs;

    return stats;
  }

  /**
   * 全テナントを取得（管理者用）
   */
  async getAllTenants() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT tenant_id, name, description, domain, status, created_at FROM tenants ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * テナントをデータベースに保存
   * @param {Object} tenant テナントデータ
   */
  async saveTenant(tenant) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO tenants
         (tenant_id, name, description, admin_username, domain, settings, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenant.id,
          tenant.name,
          tenant.description,
          tenant.adminUsername,
          tenant.domain,
          JSON.stringify(tenant.settings),
          tenant.status,
          tenant.createdAt.toISOString()
        ],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * テナントミドルウェア
   * リクエストにテナント情報を追加
   */
  tenantMiddleware() {
    return async (req, res, next) => {
      try {
        const tenantId = await this.resolveTenant(req);
        req.tenantId = tenantId;

        // テナントが存在するか確認
        const tenant = await this.getTenantById(tenantId);
        if (!tenant && tenantId !== 'default') {
          return res.status(404).json({ error: 'Tenant not found' });
        }

        req.tenant = tenant;
        next();
      } catch (error) {
        console.error('Tenant middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }
}

module.exports = new MultiTenantService();
