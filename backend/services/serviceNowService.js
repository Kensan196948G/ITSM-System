/* eslint-disable no-await-in-loop, class-methods-use-this */
/**
 * ServiceNow API サービス
 * ServiceNowとのインシデント・変更リクエスト同期
 *
 * @module services/serviceNowService
 */

const https = require('https');
const crypto = require('crypto');

/**
 * ServiceNow API クライアント
 */
class ServiceNowService {
  constructor() {
    this.config = {
      instanceUrl: process.env.SERVICENOW_INSTANCE_URL,
      username: process.env.SERVICENOW_USERNAME,
      password: process.env.SERVICENOW_PASSWORD,
      clientId: process.env.SERVICENOW_CLIENT_ID,
      clientSecret: process.env.SERVICENOW_CLIENT_SECRET
    };
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * 設定の検証
   * @returns {boolean} 設定が有効かどうか
   */
  isConfigured() {
    // Basic認証またはOAuth認証のいずれかが設定されていればOK
    const hasBasicAuth = !!(this.config.instanceUrl && this.config.username && this.config.password);
    const hasOAuth = !!(
      this.config.instanceUrl &&
      this.config.clientId &&
      this.config.clientSecret
    );
    return hasBasicAuth || hasOAuth;
  }

  /**
   * Basic認証ヘッダーを生成
   * @returns {string} Base64エンコードされた認証文字列
   */
  getBasicAuthHeader() {
    const credentials = `${this.config.username}:${this.config.password}`;
    return `Basic ${Buffer.from(credentials).toString('base64')}`;
  }

  /**
   * OAuthアクセストークンを取得
   * @returns {Promise<string>} アクセストークン
   */
  async getOAuthToken() {
    // キャッシュされたトークンが有効な場合は再利用
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('OAuth認証設定が不完全です');
    }

    const tokenUrl = `${this.config.instanceUrl}/oauth_token.do`;
    const postData = new URLSearchParams({
      grant_type: 'password',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      username: this.config.username,
      password: this.config.password
    }).toString();

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
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) {
              this.accessToken = json.access_token;
              // トークンの有効期限を設定（5分前に更新）
              const expiresIn = json.expires_in || 3600;
              this.tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
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
   * 認証ヘッダーを取得
   * @returns {Promise<string>} 認証ヘッダー
   */
  async getAuthHeader() {
    // OAuthが設定されている場合はOAuthを優先
    if (this.config.clientId && this.config.clientSecret) {
      const token = await this.getOAuthToken();
      return `Bearer ${token}`;
    }
    // Basic認証
    return this.getBasicAuthHeader();
  }

  /**
   * ServiceNow API呼び出し
   * @param {string} endpoint APIエンドポイント
   * @param {string} method HTTPメソッド
   * @param {Object} body リクエストボディ
   * @param {Object} queryParams クエリパラメータ
   * @returns {Promise<Object>} APIレスポンス
   */
  async callApi(endpoint, method = 'GET', body = null, queryParams = {}) {
    const authHeader = await this.getAuthHeader();
    const baseUrl = this.config.instanceUrl.replace(/\/$/, '');
    const queryString = new URLSearchParams(queryParams).toString();
    const fullUrl = `${baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;

    return new Promise((resolve, reject) => {
      const url = new URL(fullUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      };

      if (body) {
        const bodyData = JSON.stringify(body);
        options.headers['Content-Length'] = Buffer.byteLength(bodyData);
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(
                new Error(
                  `ServiceNow API Error ${res.statusCode}: ${json.error?.message || json.error?.detail || data}`
                )
              );
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

  // ============================================
  // インシデント管理
  // ============================================

  /**
   * インシデント一覧を取得
   * @param {Object} options オプション
   * @returns {Promise<Array>} インシデント一覧
   */
  async getIncidents(options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const queryParams = {
      sysparm_limit: limit,
      sysparm_offset: offset,
      sysparm_display_value: 'true'
    };

    if (options.query) {
      queryParams.sysparm_query = options.query;
    }

    if (options.fields) {
      queryParams.sysparm_fields = options.fields;
    }

    const response = await this.callApi('/api/now/table/incident', 'GET', null, queryParams);
    return response.result || [];
  }

  /**
   * インシデント詳細を取得
   * @param {string} sysId インシデントのsys_id
   * @returns {Promise<Object>} インシデント情報
   */
  async getIncident(sysId) {
    const response = await this.callApi(`/api/now/table/incident/${sysId}`, 'GET', null, {
      sysparm_display_value: 'true'
    });
    return response.result;
  }

  /**
   * インシデントを作成
   * @param {Object} incident インシデント情報
   * @returns {Promise<Object>} 作成されたインシデント
   */
  async createIncident(incident) {
    const response = await this.callApi('/api/now/table/incident', 'POST', incident);
    return response.result;
  }

  /**
   * インシデントを更新
   * @param {string} sysId インシデントのsys_id
   * @param {Object} updates 更新内容
   * @returns {Promise<Object>} 更新されたインシデント
   */
  async updateIncident(sysId, updates) {
    const response = await this.callApi(`/api/now/table/incident/${sysId}`, 'PATCH', updates);
    return response.result;
  }

  /**
   * ITSM-Sec Nexus用インシデントデータを変換してServiceNow形式に
   * @param {Object} itsmIncident ITSMインシデント
   * @returns {Object} ServiceNow形式
   */
  transformIncidentToServiceNow(itsmIncident) {
    // 優先度マッピング
    const priorityMap = {
      Critical: 1,
      High: 2,
      Medium: 3,
      Low: 4
    };

    // ステータスマッピング
    const stateMap = {
      New: 1,
      'In Progress': 2,
      'On Hold': 3,
      Resolved: 6,
      Closed: 7
    };

    return {
      short_description: itsmIncident.title,
      description: itsmIncident.description || '',
      priority: priorityMap[itsmIncident.priority] || 3,
      state: stateMap[itsmIncident.status] || 1,
      category: itsmIncident.category || 'Inquiry',
      subcategory: itsmIncident.subcategory || '',
      assignment_group: itsmIncident.assigned_team || '',
      assigned_to: itsmIncident.assigned_to || '',
      caller_id: itsmIncident.reporter || '',
      impact: itsmIncident.impact || 3,
      urgency: itsmIncident.urgency || 3,
      u_external_id: itsmIncident.incident_id, // カスタムフィールド
      u_source_system: 'ITSM-Sec Nexus'
    };
  }

  /**
   * ServiceNow形式からITSM-Sec Nexus形式に変換
   * @param {Object} snowIncident ServiceNowインシデント
   * @returns {Object} ITSM形式
   */
  transformIncidentFromServiceNow(snowIncident) {
    // 優先度逆マッピング
    const priorityMap = {
      1: 'Critical',
      2: 'High',
      3: 'Medium',
      4: 'Low',
      5: 'Low'
    };

    // ステータス逆マッピング
    const stateMap = {
      1: 'New',
      2: 'In Progress',
      3: 'On Hold',
      4: 'Pending',
      5: 'Pending',
      6: 'Resolved',
      7: 'Closed'
    };

    return {
      title: snowIncident.short_description || '',
      description: snowIncident.description || '',
      priority: priorityMap[snowIncident.priority] || 'Medium',
      status: stateMap[snowIncident.state] || 'New',
      category: snowIncident.category || null,
      reporter: snowIncident.caller_id?.display_value || snowIncident.caller_id || null,
      assigned_to: snowIncident.assigned_to?.display_value || snowIncident.assigned_to || null,
      assigned_team: snowIncident.assignment_group?.display_value || null,
      external_id: snowIncident.sys_id,
      external_number: snowIncident.number,
      source: 'servicenow',
      synced_at: new Date().toISOString()
    };
  }

  // ============================================
  // 変更リクエスト管理
  // ============================================

  /**
   * 変更リクエスト一覧を取得
   * @param {Object} options オプション
   * @returns {Promise<Array>} 変更リクエスト一覧
   */
  async getChangeRequests(options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const queryParams = {
      sysparm_limit: limit,
      sysparm_offset: offset,
      sysparm_display_value: 'true'
    };

    if (options.query) {
      queryParams.sysparm_query = options.query;
    }

    if (options.fields) {
      queryParams.sysparm_fields = options.fields;
    }

    const response = await this.callApi('/api/now/table/change_request', 'GET', null, queryParams);
    return response.result || [];
  }

  /**
   * 変更リクエスト詳細を取得
   * @param {string} sysId 変更リクエストのsys_id
   * @returns {Promise<Object>} 変更リクエスト情報
   */
  async getChangeRequest(sysId) {
    const response = await this.callApi(`/api/now/table/change_request/${sysId}`, 'GET', null, {
      sysparm_display_value: 'true'
    });
    return response.result;
  }

  /**
   * 変更リクエストを作成
   * @param {Object} changeRequest 変更リクエスト情報
   * @returns {Promise<Object>} 作成された変更リクエスト
   */
  async createChangeRequest(changeRequest) {
    const response = await this.callApi('/api/now/table/change_request', 'POST', changeRequest);
    return response.result;
  }

  /**
   * 変更リクエストを更新
   * @param {string} sysId 変更リクエストのsys_id
   * @param {Object} updates 更新内容
   * @returns {Promise<Object>} 更新された変更リクエスト
   */
  async updateChangeRequest(sysId, updates) {
    const response = await this.callApi(`/api/now/table/change_request/${sysId}`, 'PATCH', updates);
    return response.result;
  }

  /**
   * ITSM-Sec Nexus用変更リクエストデータをServiceNow形式に変換
   * @param {Object} itsmChange ITSM変更リクエスト
   * @returns {Object} ServiceNow形式
   */
  transformChangeToServiceNow(itsmChange) {
    // タイプマッピング
    const typeMap = {
      Standard: 'standard',
      Normal: 'normal',
      Emergency: 'emergency'
    };

    // ステータスマッピング
    const stateMap = {
      Draft: -5,
      New: -4,
      Assess: -3,
      Authorize: -2,
      Scheduled: -1,
      Implement: 0,
      Review: 1,
      Closed: 3,
      Cancelled: 4
    };

    return {
      short_description: itsmChange.title,
      description: itsmChange.description || '',
      type: typeMap[itsmChange.type] || 'normal',
      state: stateMap[itsmChange.status] || -4,
      priority: (() => {
        if (itsmChange.priority === 'Critical') return 1;
        if (itsmChange.priority === 'High') return 2;
        return 3;
      })(),
      risk: itsmChange.risk_level || 3,
      impact: itsmChange.impact || 3,
      assignment_group: itsmChange.assigned_team || '',
      assigned_to: itsmChange.assigned_to || '',
      requested_by: itsmChange.requester || '',
      start_date: itsmChange.planned_start_date || '',
      end_date: itsmChange.planned_end_date || '',
      justification: itsmChange.reason || '',
      implementation_plan: itsmChange.implementation_plan || '',
      backout_plan: itsmChange.backout_plan || '',
      test_plan: itsmChange.test_plan || '',
      u_external_id: itsmChange.change_id,
      u_source_system: 'ITSM-Sec Nexus'
    };
  }

  /**
   * ServiceNow形式からITSM-Sec Nexus形式に変換
   * @param {Object} snowChange ServiceNow変更リクエスト
   * @returns {Object} ITSM形式
   */
  transformChangeFromServiceNow(snowChange) {
    // タイプ逆マッピング
    const typeMap = {
      standard: 'Standard',
      normal: 'Normal',
      emergency: 'Emergency'
    };

    // ステータス逆マッピング
    const stateMap = {
      '-5': 'Draft',
      '-4': 'New',
      '-3': 'Assess',
      '-2': 'Authorize',
      '-1': 'Scheduled',
      0: 'Implement',
      1: 'Review',
      3: 'Closed',
      4: 'Cancelled'
    };

    // 優先度逆マッピング
    const priorityMap = {
      1: 'Critical',
      2: 'High',
      3: 'Medium',
      4: 'Low'
    };

    return {
      title: snowChange.short_description || '',
      description: snowChange.description || '',
      type: typeMap[snowChange.type] || 'Normal',
      status: stateMap[String(snowChange.state)] || 'New',
      priority: priorityMap[snowChange.priority] || 'Medium',
      risk_level: snowChange.risk || null,
      impact: snowChange.impact || null,
      requester: snowChange.requested_by?.display_value || snowChange.requested_by || null,
      assigned_to: snowChange.assigned_to?.display_value || snowChange.assigned_to || null,
      assigned_team: snowChange.assignment_group?.display_value || null,
      planned_start_date: snowChange.start_date || null,
      planned_end_date: snowChange.end_date || null,
      reason: snowChange.justification || null,
      implementation_plan: snowChange.implementation_plan || null,
      backout_plan: snowChange.backout_plan || null,
      test_plan: snowChange.test_plan || null,
      external_id: snowChange.sys_id,
      external_number: snowChange.number,
      source: 'servicenow',
      synced_at: new Date().toISOString()
    };
  }

  // ============================================
  // ユーティリティ
  // ============================================

  /**
   * 接続テスト
   * @returns {Promise<Object>} テスト結果
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'ServiceNowの認証設定が不完全です',
        configured: false
      };
    }

    try {
      // システム情報を取得してテスト
      await this.callApi('/api/now/table/sys_properties', 'GET', null, {
        sysparm_limit: 1,
        sysparm_fields: 'name,value'
      });

      return {
        success: true,
        configured: true,
        instanceUrl: this.config.instanceUrl,
        message: 'ServiceNowに正常に接続できました'
      };
    } catch (error) {
      return {
        success: false,
        configured: true,
        error: error.message
      };
    }
  }

  /**
   * Webhook署名を検証
   * @param {string} payload リクエストボディ
   * @param {string} signature 署名ヘッダー
   * @param {string} secret 共有シークレット
   * @returns {boolean} 署名が有効かどうか
   */
  verifyWebhookSignature(payload, signature, secret) {
    if (!signature || !secret) {
      return false;
    }

    // ServiceNowのWebhookはHMAC-SHA256を使用
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // タイミング攻撃を防ぐため、constant-time比較を使用
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  /**
   * 同期ステータスを取得
   * @returns {Object} 同期設定情報
   */
  getSyncStatus() {
    return {
      configured: this.isConfigured(),
      instanceUrl: this.config.instanceUrl || null,
      authMethod: this.config.clientId ? 'oauth' : 'basic',
      hasCredentials: !!(this.config.username && this.config.password)
    };
  }
}

// シングルトンインスタンス
const serviceNowService = new ServiceNowService();

module.exports = serviceNowService;
module.exports.ServiceNowService = ServiceNowService;
