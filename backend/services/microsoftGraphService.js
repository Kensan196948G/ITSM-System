/* eslint-disable no-await-in-loop, no-return-assign, class-methods-use-this */
/**
 * Microsoft Graph API サービス
 * 非対話型認証（Client Credentials Flow）によるMicrosoft 365連携
 *
 * @module services/microsoftGraphService
 */

const https = require('https');
const querystring = require('querystring');

/**
 * Microsoft Graph API クライアント
 */
class MicrosoftGraphService {
  constructor() {
    this.config = {
      tenantId: process.env.M365_TENANT_ID,
      clientId: process.env.M365_CLIENT_ID,
      clientSecret: process.env.M365_CLIENT_SECRET,
      graphEndpoint: process.env.M365_GRAPH_ENDPOINT || 'https://graph.microsoft.com/v1.0'
    };
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * 設定の検証
   * @returns {boolean} 設定が有効かどうか
   */
  isConfigured() {
    return !!(this.config.tenantId && this.config.clientId && this.config.clientSecret);
  }

  /**
   * アクセストークンの取得（Client Credentials Flow）
   * @returns {Promise<string>} アクセストークン
   */
  async getAccessToken() {
    // キャッシュされたトークンが有効な場合は再利用
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      throw new Error('Microsoft 365の認証設定が不完全です。環境変数を確認してください。');
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const postData = querystring.stringify({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    return new Promise((resolve, reject) => {
      const url = new URL(tokenUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) {
              this.accessToken = json.access_token;
              // トークンの有効期限を設定（5分前に更新）
              this.tokenExpiry = Date.now() + (json.expires_in - 300) * 1000;
              resolve(this.accessToken);
            } else {
              reject(new Error(json.error_description || 'トークン取得に失敗しました'));
            }
          } catch (e) {
            reject(new Error(`トークンレスポンスの解析に失敗: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`トークン取得リクエストエラー: ${e.message}`)));
      req.write(postData);
      req.end();
    });
  }

  /**
   * Graph API呼び出し
   * @param {string} endpoint APIエンドポイント
   * @param {string} method HTTPメソッド
   * @param {Object} body リクエストボディ
   * @returns {Promise<Object>} APIレスポンス
   */
  async callApi(endpoint, method = 'GET', body = null) {
    const token = await this.getAccessToken();
    const fullUrl = endpoint.startsWith('http')
      ? endpoint
      : `${this.config.graphEndpoint}${endpoint}`;

    return new Promise((resolve, reject) => {
      const url = new URL(fullUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        const bodyData = JSON.stringify(body);
        options.headers['Content-Length'] = Buffer.byteLength(bodyData);
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(`API Error ${res.statusCode}: ${json.error?.message || data}`));
            }
          } catch (e) {
            reject(new Error(`レスポンス解析エラー: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`APIリクエストエラー: ${e.message}`)));
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /**
   * ページネーション対応のデータ取得
   * @param {string} endpoint 初期エンドポイント
   * @param {number} maxRecords 最大取得件数（0=無制限）
   * @returns {Promise<Array>} 全レコード
   */
  async getAllPaged(endpoint, maxRecords = 0) {
    const allRecords = [];
    let nextLink = endpoint;

    while (nextLink) {
      const response = await this.callApi(nextLink);
      if (response.value) {
        allRecords.push(...response.value);
      }

      // 最大件数チェック
      if (maxRecords > 0 && allRecords.length >= maxRecords) {
        return allRecords.slice(0, maxRecords);
      }

      // 次ページ
      nextLink = response['@odata.nextLink'] || null;
    }

    return allRecords;
  }

  // ============================================
  // ユーザー管理
  // ============================================

  /**
   * Azure ADユーザー一覧を取得
   * @param {Object} options オプション
   * @returns {Promise<Array>} ユーザー一覧
   */
  async getUsers(options = {}) {
    const select =
      options.select ||
      'id,displayName,userPrincipalName,mail,accountEnabled,department,jobTitle,createdDateTime';
    const top = options.top || 100;
    const filter = options.filter || '';

    let endpoint = `/users?$select=${select}&$top=${top}`;
    if (filter) {
      endpoint += `&$filter=${encodeURIComponent(filter)}`;
    }

    if (options.all) {
      return this.getAllPaged(endpoint, options.maxRecords || 0);
    }

    const response = await this.callApi(endpoint);
    return response.value || [];
  }

  /**
   * ユーザー詳細を取得
   * @param {string} userId ユーザーID または UPN
   * @returns {Promise<Object>} ユーザー情報
   */
  async getUser(userId) {
    return this.callApi(`/users/${encodeURIComponent(userId)}`);
  }

  // ============================================
  // デバイス管理（Intune）
  // ============================================

  /**
   * Azure ADデバイス一覧を取得
   * @param {Object} options オプション
   * @returns {Promise<Array>} デバイス一覧
   */
  async getDevices(options = {}) {
    const select =
      options.select ||
      'id,displayName,operatingSystem,operatingSystemVersion,isManaged,isCompliant,registeredOwners';
    const top = options.top || 100;

    const endpoint = `/devices?$select=${select}&$top=${top}`;

    if (options.all) {
      return this.getAllPaged(endpoint, options.maxRecords || 0);
    }

    const response = await this.callApi(endpoint);
    return response.value || [];
  }

  /**
   * Intuneマネージドデバイス一覧を取得
   * @param {Object} options オプション
   * @returns {Promise<Array>} マネージドデバイス一覧
   */
  async getManagedDevices(options = {}) {
    const select =
      options.select ||
      'id,deviceName,operatingSystem,osVersion,model,manufacturer,serialNumber,complianceState,lastSyncDateTime';
    const top = options.top || 100;

    const endpoint = `/deviceManagement/managedDevices?$select=${select}&$top=${top}`;

    if (options.all) {
      return this.getAllPaged(endpoint, options.maxRecords || 0);
    }

    const response = await this.callApi(endpoint);
    return response.value || [];
  }

  // ============================================
  // セキュリティ
  // ============================================

  /**
   * セキュリティアラート一覧を取得
   * @param {Object} options オプション
   * @returns {Promise<Array>} アラート一覧
   */
  async getSecurityAlerts(options = {}) {
    const top = options.top || 50;
    let endpoint = `/security/alerts_v2?$top=${top}`;

    if (options.filter) {
      endpoint += `&$filter=${encodeURIComponent(options.filter)}`;
    }

    const response = await this.callApi(endpoint);
    return response.value || [];
  }

  // ============================================
  // 組織情報
  // ============================================

  /**
   * 組織情報を取得
   * @returns {Promise<Object>} 組織情報
   */
  async getOrganization() {
    const response = await this.callApi('/organization');
    return response.value?.[0] || null;
  }

  /**
   * ドメイン一覧を取得
   * @returns {Promise<Array>} ドメイン一覧
   */
  async getDomains() {
    const response = await this.callApi('/domains');
    return response.value || [];
  }

  // ============================================
  // ユーティリティ
  // ============================================

  /**
   * ITSM-Sec Nexus用にユーザーデータを変換
   * @param {Object} m365User Microsoft 365ユーザー
   * @returns {Object} ITSMユーザー形式
   */
  transformUserForITSM(m365User) {
    return {
      username: (m365User.userPrincipalName || '').split('@')[0].toLowerCase(),
      email: m365User.mail || m365User.userPrincipalName,
      full_name: m365User.displayName || '',
      role: 'viewer', // デフォルトロール（後で調整）
      is_active: m365User.accountEnabled !== false,
      department: m365User.department || null,
      job_title: m365User.jobTitle || null,
      external_id: m365User.id,
      source: 'microsoft365',
      synced_at: new Date().toISOString()
    };
  }

  /**
   * ITSM-Sec Nexus用にデバイスデータを変換
   * @param {Object} device Microsoft 365/Intuneデバイス
   * @returns {Object} ITSM資産形式
   */
  transformDeviceForITSM(device) {
    // デバイスタイプの判定
    let type = 'Endpoint';
    const os = (device.operatingSystem || '').toLowerCase();
    if (os.includes('windows')) type = 'Endpoint';
    else if (os.includes('ios') || os.includes('android')) type = 'Mobile';
    else if (os.includes('macos')) type = 'Endpoint';
    else if (os.includes('server')) type = 'Server';

    return {
      asset_tag: `DEV-${device.id.substring(0, 8).toUpperCase()}`,
      name: device.displayName || device.deviceName || 'Unknown Device',
      type,
      criticality: 3, // デフォルト中程度
      status: device.isCompliant ? 'Operational' : 'Warning',
      manufacturer: device.manufacturer || null,
      model: device.model || null,
      serial_number: device.serialNumber || null,
      operating_system: device.operatingSystem || null,
      os_version: device.operatingSystemVersion || device.osVersion || null,
      external_id: device.id,
      source: 'microsoft365',
      synced_at: new Date().toISOString()
    };
  }
}

// シングルトンインスタンス
const microsoftGraphService = new MicrosoftGraphService();

module.exports = microsoftGraphService;
module.exports.MicrosoftGraphService = MicrosoftGraphService;
