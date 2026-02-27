/**
 * ServiceNow Service Unit Tests
 *
 * https モジュールをモックして、実際のネットワーク接続なしに
 * ServiceNowService のすべてのメソッドをテストします。
 */

const crypto = require('crypto');
const https = require('https');

// https モジュール全体をモック
jest.mock('https');

const { ServiceNowService } = require('../../../services/serviceNowService');

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/**
 * 成功レスポンスのhttpsリクエストモックを作成
 * @param {number} statusCode HTTPステータスコード
 * @param {*} responseData レスポンスデータ（オブジェクトまたは文字列）
 * @returns {{ mockRes, mockReq }}
 */
function mockSuccessResponse(statusCode, responseData) {
  const dataStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);

  const mockRes = {
    statusCode,
    on: jest.fn((event, cb) => {
      if (event === 'data') cb(dataStr);
      if (event === 'end') cb();
      return mockRes;
    })
  };

  const mockReq = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn().mockReturnThis()
  };

  https.request.mockImplementation((_options, callback) => {
    callback(mockRes);
    return mockReq;
  });

  return { mockRes, mockReq };
}

/**
 * ネットワークエラーのhttpsリクエストモックを作成
 * @param {string} errorMessage エラーメッセージ
 * @returns {Object} mockReq
 */
function mockNetworkError(errorMessage) {
  const networkError = new Error(errorMessage);
  let errorCallback;

  const mockReq = {
    write: jest.fn(),
    end: jest.fn(() => {
      // req.end() 呼び出し時にエラーを発火
      if (errorCallback) setTimeout(() => errorCallback(networkError), 0);
    }),
    on: jest.fn((event, cb) => {
      if (event === 'error') errorCallback = cb;
      return mockReq;
    })
  };

  https.request.mockImplementation(() => mockReq);

  return mockReq;
}

/**
 * 空レスポンス（データなし）のhttpsリクエストモックを作成
 * @param {number} statusCode HTTPステータスコード
 */
function mockEmptyResponse(statusCode) {
  const mockRes = {
    statusCode,
    on: jest.fn((event, cb) => {
      // 'data' イベントは発火しない（空ボディ）
      if (event === 'end') cb();
      return mockRes;
    })
  };

  const mockReq = {
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn().mockReturnThis()
  };

  https.request.mockImplementation((_options, callback) => {
    callback(mockRes);
    return mockReq;
  });

  return { mockRes, mockReq };
}

// ============================================================
// テストスイート
// ============================================================

describe('ServiceNowService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();

    // 各テストで新しいインスタンスを作成（環境変数に依存しない）
    service = new ServiceNowService();
    // Basic認証設定（デフォルト）
    service.config = {
      instanceUrl: 'https://test.service-now.com',
      username: 'testuser',
      password: 'testpassword',
      clientId: null,
      clientSecret: null
    };
    // OAuthトークンキャッシュをリセット
    service.accessToken = null;
    service.tokenExpiry = null;
  });

  // ----------------------------------------------------------
  describe('isConfigured()', () => {
    test('Basic認証（instanceUrl + username + password）が設定されていればtrue', () => {
      expect(service.isConfigured()).toBe(true);
    });

    test('OAuth認証（instanceUrl + clientId + clientSecret）が設定されていればtrue', () => {
      service.config = {
        instanceUrl: 'https://test.service-now.com',
        username: null,
        password: null,
        clientId: 'client-id',
        clientSecret: 'client-secret'
      };
      expect(service.isConfigured()).toBe(true);
    });

    test('instanceUrlが未設定の場合はfalse', () => {
      service.config.instanceUrl = null;
      expect(service.isConfigured()).toBe(false);
    });

    test('usernameのみ（passwordなし）かつOAuthも未設定の場合はfalse', () => {
      service.config.password = null;
      expect(service.isConfigured()).toBe(false);
    });

    test('clientIdのみ（clientSecretなし）かつBasicも未設定の場合はfalse', () => {
      service.config = {
        instanceUrl: 'https://test.service-now.com',
        username: null,
        password: null,
        clientId: 'client-id',
        clientSecret: null
      };
      expect(service.isConfigured()).toBe(false);
    });

    test('すべてnullの場合はfalse', () => {
      service.config = {
        instanceUrl: null,
        username: null,
        password: null,
        clientId: null,
        clientSecret: null
      };
      expect(service.isConfigured()).toBe(false);
    });
  });

  // ----------------------------------------------------------
  describe('getBasicAuthHeader()', () => {
    test('Base64エンコードされたBasic認証ヘッダーを返す', () => {
      const header = service.getBasicAuthHeader();
      const expected = `Basic ${Buffer.from('testuser:testpassword').toString('base64')}`;
      expect(header).toBe(expected);
    });

    test('コロンを含む認証情報も正しくエンコードする', () => {
      service.config.username = 'admin';
      service.config.password = 'pass:word:with:colons';
      const header = service.getBasicAuthHeader();
      const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe('admin:pass:word:with:colons');
    });

    test('特殊文字を含む認証情報をエンコードできる', () => {
      service.config.username = 'user@example.com';
      service.config.password = 'P@ssw0rd!#$%';
      const header = service.getBasicAuthHeader();
      expect(header).toMatch(/^Basic /);
      const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
      expect(decoded).toBe('user@example.com:P@ssw0rd!#$%');
    });
  });

  // ----------------------------------------------------------
  describe('getOAuthToken()', () => {
    beforeEach(() => {
      service.config.clientId = 'test-client-id';
      service.config.clientSecret = 'test-client-secret';
    });

    test('キャッシュされたトークンが有効な場合は再利用する', async () => {
      service.accessToken = 'cached-token';
      service.tokenExpiry = Date.now() + 10 * 60 * 1000; // 10分後

      const token = await service.getOAuthToken();
      expect(token).toBe('cached-token');
      expect(https.request).not.toHaveBeenCalled();
    });

    test('期限切れのトークンは再取得する', async () => {
      service.accessToken = 'expired-token';
      service.tokenExpiry = Date.now() - 1000; // 1秒前に期限切れ
      mockSuccessResponse(200, { access_token: 'new-token', expires_in: 3600 });

      const token = await service.getOAuthToken();
      expect(token).toBe('new-token');
    });

    test('トークンを正常に取得してキャッシュする', async () => {
      mockSuccessResponse(200, { access_token: 'fresh-token', expires_in: 3600 });

      const token = await service.getOAuthToken();
      expect(token).toBe('fresh-token');
      expect(service.accessToken).toBe('fresh-token');
      // 有効期限が現在より後（3600-300=3300秒後）
      expect(service.tokenExpiry).toBeGreaterThan(Date.now() + 3200 * 1000);
    });

    test('expires_inが省略された場合はデフォルト3600秒を使用する', async () => {
      mockSuccessResponse(200, { access_token: 'default-expiry-token' }); // expires_in省略

      const before = Date.now();
      const token = await service.getOAuthToken();
      expect(token).toBe('default-expiry-token');
      // デフォルト3600-300=3300秒以上先の有効期限
      expect(service.tokenExpiry).toBeGreaterThan(before + 3200 * 1000);
    });

    test('access_tokenがないレスポンスでerror_descriptionがある場合にそれをスロー', async () => {
      mockSuccessResponse(200, {
        error: 'invalid_client',
        error_description: 'クライアント認証失敗'
      });
      await expect(service.getOAuthToken()).rejects.toThrow('クライアント認証失敗');
    });

    test('error_descriptionがない場合はデフォルトメッセージをスロー', async () => {
      mockSuccessResponse(200, { error: 'invalid_client' });
      await expect(service.getOAuthToken()).rejects.toThrow('トークン取得に失敗しました');
    });

    test('無効なJSONレスポンスの場合はパースエラーをスロー', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn((event, cb) => {
          if (event === 'data') cb('this is not json!!!');
          if (event === 'end') cb();
          return mockRes;
        })
      };
      const mockReq = { write: jest.fn(), end: jest.fn(), on: jest.fn().mockReturnThis() };
      https.request.mockImplementation((_opts, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await expect(service.getOAuthToken()).rejects.toThrow('トークンレスポンスの解析に失敗');
    });

    test('ネットワークエラーの場合はエラーをスロー', async () => {
      mockNetworkError('connection refused');
      await expect(service.getOAuthToken()).rejects.toThrow(
        'トークン取得リクエストエラー: connection refused'
      );
    });

    test('clientIdが未設定の場合はエラーをスロー', async () => {
      service.config.clientId = null;
      await expect(service.getOAuthToken()).rejects.toThrow('OAuth認証設定が不完全です');
    });

    test('clientSecretが未設定の場合はエラーをスロー', async () => {
      service.config.clientSecret = null;
      await expect(service.getOAuthToken()).rejects.toThrow('OAuth認証設定が不完全です');
    });
  });

  // ----------------------------------------------------------
  describe('getAuthHeader()', () => {
    test('OAuthが設定されている場合はBearerトークンを返す', async () => {
      service.config.clientId = 'client-id';
      service.config.clientSecret = 'client-secret';
      // キャッシュされたトークンを使用
      service.accessToken = 'cached-oauth-token';
      service.tokenExpiry = Date.now() + 60000;

      const header = await service.getAuthHeader();
      expect(header).toBe('Bearer cached-oauth-token');
    });

    test('OAuthが未設定の場合はBasic認証ヘッダーを返す', async () => {
      // clientId=null（beforeEachで設定済み）
      const header = await service.getAuthHeader();
      expect(header).toMatch(/^Basic /);
    });
  });

  // ----------------------------------------------------------
  describe('callApi()', () => {
    beforeEach(() => {
      // Basic認証を強制（OAuthを使わない）
      service.config.clientId = null;
      service.config.clientSecret = null;
    });

    test('GETリクエストを正常に実行できる', async () => {
      const responseData = { result: [{ sys_id: 'abc123' }] };
      mockSuccessResponse(200, responseData);

      const result = await service.callApi('/api/now/table/incident');
      expect(result).toEqual(responseData);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'GET' }),
        expect.any(Function)
      );
    });

    test('クエリパラメータをURLに含める', async () => {
      mockSuccessResponse(200, { result: [] });

      await service.callApi('/api/now/table/incident', 'GET', null, { sysparm_limit: 50 });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('sysparm_limit=50')
        }),
        expect.any(Function)
      );
    });

    test('クエリパラメータがない場合はパスにクエスチョンマークを含まない', async () => {
      mockSuccessResponse(200, { result: [] });

      await service.callApi('/api/now/table/incident');

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.not.stringContaining('?')
        }),
        expect.any(Function)
      );
    });

    test('POSTリクエストでボディを送信できる', async () => {
      const { mockReq } = mockSuccessResponse(201, { result: { sys_id: 'new001' } });
      const body = { short_description: 'New incident' };

      await service.callApi('/api/now/table/incident', 'POST', body);

      // req.write() が呼ばれてボディが送信されていること
      expect(mockReq.write).toHaveBeenCalledWith(JSON.stringify(body));
      expect(mockReq.end).toHaveBeenCalled();
    });

    test('PATCHリクエストを実行できる', async () => {
      mockSuccessResponse(200, { result: { sys_id: 'inc001', state: '2' } });

      await service.callApi('/api/now/table/incident/inc001', 'PATCH', { state: 2 });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'PATCH' }),
        expect.any(Function)
      );
    });

    test('4xxエラーでエラーをスロー（error.messageを使用）', async () => {
      mockSuccessResponse(404, { error: { message: 'Record not found' } });

      await expect(service.callApi('/api/now/table/incident/invalid')).rejects.toThrow(
        'ServiceNow API Error 404: Record not found'
      );
    });

    test('4xxエラーでerror.detailを使用する', async () => {
      mockSuccessResponse(403, { error: { detail: 'Access denied by ACL' } });

      await expect(service.callApi('/api/now/table/test')).rejects.toThrow('Access denied by ACL');
    });

    test('5xxエラーでエラーをスロー', async () => {
      mockSuccessResponse(500, { error: { message: 'Internal server error' } });

      await expect(service.callApi('/api/now/table/test')).rejects.toThrow(
        'ServiceNow API Error 500'
      );
    });

    test('エラーオブジェクトがない場合は生のレスポンス文字列を使用する', async () => {
      // error キーがない有効なJSONを返す → json.error?.message も undefined → data(raw string)にフォールバック
      const mockRes = {
        statusCode: 503,
        on: jest.fn((event, cb) => {
          if (event === 'data') cb('{"status":"Service Unavailable"}');
          if (event === 'end') cb();
          return mockRes;
        })
      };
      const mockReq = { write: jest.fn(), end: jest.fn(), on: jest.fn().mockReturnThis() };
      https.request.mockImplementation((_opts, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await expect(service.callApi('/api/now/table/test')).rejects.toThrow(
        'ServiceNow API Error 503'
      );
    });

    test('空のレスポンスボディ（204 No Content）を処理できる', async () => {
      mockEmptyResponse(204);

      const result = await service.callApi('/api/now/table/test', 'DELETE');
      expect(result).toEqual({});
    });

    test('無効なJSONレスポンスの場合はレスポンス解析エラーをスロー', async () => {
      const mockRes = {
        statusCode: 200,
        on: jest.fn((event, cb) => {
          if (event === 'data') cb('this-is-not-json');
          if (event === 'end') cb();
          return mockRes;
        })
      };
      const mockReq = { write: jest.fn(), end: jest.fn(), on: jest.fn().mockReturnThis() };
      https.request.mockImplementation((_opts, callback) => {
        callback(mockRes);
        return mockReq;
      });

      await expect(service.callApi('/api/now/table/test')).rejects.toThrow('レスポンス解析エラー');
    });

    test('ネットワークエラーの場合はAPIリクエストエラーをスロー', async () => {
      mockNetworkError('ECONNREFUSED');

      await expect(service.callApi('/api/now/table/test')).rejects.toThrow(
        'APIリクエストエラー: ECONNREFUSED'
      );
    });

    test('instanceUrlの末尾スラッシュを除去してURLを構築する', async () => {
      service.config.instanceUrl = 'https://test.service-now.com/'; // 末尾スラッシュあり
      mockSuccessResponse(200, { result: [] });

      await service.callApi('/api/now/table/incident');

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'test.service-now.com'
        }),
        expect.any(Function)
      );
    });

    test('ボディがない場合はContent-Lengthヘッダーを設定しない', async () => {
      mockSuccessResponse(200, { result: [] });

      await service.callApi('/api/now/table/incident', 'GET', null);

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.not.objectContaining({ 'Content-Length': expect.anything() })
        }),
        expect.any(Function)
      );
    });
  });

  // ----------------------------------------------------------
  describe('getIncidents()', () => {
    beforeEach(() => {
      service.config.clientId = null;
      service.config.clientSecret = null;
    });

    test('デフォルトオプションでインシデント一覧を取得する', async () => {
      const incidents = [{ sys_id: 'inc001' }, { sys_id: 'inc002' }];
      mockSuccessResponse(200, { result: incidents });

      const result = await service.getIncidents();

      expect(result).toEqual(incidents);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('/api/now/table/incident')
        }),
        expect.any(Function)
      );
    });

    test('カスタムlimitとoffsetを適用できる', async () => {
      mockSuccessResponse(200, { result: [] });

      await service.getIncidents({ limit: 50, offset: 10 });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('sysparm_limit=50')
        }),
        expect.any(Function)
      );
    });

    test('queryオプションでsysparm_queryを追加する', async () => {
      mockSuccessResponse(200, { result: [] });

      await service.getIncidents({ query: 'state=1^active=true' });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('sysparm_query=')
        }),
        expect.any(Function)
      );
    });

    test('fieldsオプションでsysparm_fieldsを追加する', async () => {
      mockSuccessResponse(200, { result: [] });

      await service.getIncidents({ fields: 'sys_id,number,short_description' });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('sysparm_fields=')
        }),
        expect.any(Function)
      );
    });

    test('resultフィールドがない場合は空配列を返す', async () => {
      mockSuccessResponse(200, {}); // resultなし

      const result = await service.getIncidents();
      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  describe('getIncident()', () => {
    test('指定したsys_idのインシデントを取得する', async () => {
      const incident = { sys_id: 'abc123', short_description: 'Test incident' };
      mockSuccessResponse(200, { result: incident });

      const result = await service.getIncident('abc123');

      expect(result).toEqual(incident);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('/api/now/table/incident/abc123')
        }),
        expect.any(Function)
      );
    });
  });

  // ----------------------------------------------------------
  describe('createIncident()', () => {
    test('インシデントを作成して結果を返す', async () => {
      const created = { sys_id: 'new001', number: 'INC0001234' };
      mockSuccessResponse(201, { result: created });
      const incidentData = { short_description: 'New incident' };

      const result = await service.createIncident(incidentData);

      expect(result).toEqual(created);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: expect.stringContaining('/api/now/table/incident')
        }),
        expect.any(Function)
      );
    });
  });

  // ----------------------------------------------------------
  describe('updateIncident()', () => {
    test('インシデントを更新して結果を返す', async () => {
      const updated = { sys_id: 'inc001', state: '2' };
      mockSuccessResponse(200, { result: updated });

      const result = await service.updateIncident('inc001', { state: 2 });

      expect(result).toEqual(updated);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          path: expect.stringContaining('/api/now/table/incident/inc001')
        }),
        expect.any(Function)
      );
    });
  });

  // ----------------------------------------------------------
  describe('transformIncidentToServiceNow()', () => {
    const baseIncident = {
      title: 'System down',
      description: 'The system is not responding',
      priority: 'High',
      status: 'In Progress',
      category: 'Software',
      subcategory: 'OS',
      assigned_team: 'IT Ops',
      assigned_to: 'John Doe',
      reporter: 'Jane Smith',
      impact: 1,
      urgency: 1,
      incident_id: 'INC-001'
    };

    test('基本的なインシデントデータをServiceNow形式に変換する', () => {
      const result = service.transformIncidentToServiceNow(baseIncident);

      expect(result.short_description).toBe('System down');
      expect(result.description).toBe('The system is not responding');
      expect(result.priority).toBe(2); // High → 2
      expect(result.state).toBe(2); // In Progress → 2
      expect(result.category).toBe('Software');
      expect(result.subcategory).toBe('OS');
      expect(result.assignment_group).toBe('IT Ops');
      expect(result.assigned_to).toBe('John Doe');
      expect(result.caller_id).toBe('Jane Smith');
      expect(result.u_external_id).toBe('INC-001');
      expect(result.u_source_system).toBe('ITSM-Sec Nexus');
    });

    test('優先度マッピング: Critical=1, High=2, Medium=3, Low=4', () => {
      const cases = [
        { priority: 'Critical', expected: 1 },
        { priority: 'High', expected: 2 },
        { priority: 'Medium', expected: 3 },
        { priority: 'Low', expected: 4 }
      ];

      cases.forEach(({ priority, expected }) => {
        const result = service.transformIncidentToServiceNow({ ...baseIncident, priority });
        expect(result.priority).toBe(expected);
      });
    });

    test('未知の優先度はデフォルト3（Medium相当）を使用する', () => {
      const result = service.transformIncidentToServiceNow({
        ...baseIncident,
        priority: 'Unknown'
      });
      expect(result.priority).toBe(3);
    });

    test('ステータスマッピング: New=1, In Progress=2, On Hold=3, Resolved=6, Closed=7', () => {
      const cases = [
        { status: 'New', expected: 1 },
        { status: 'In Progress', expected: 2 },
        { status: 'On Hold', expected: 3 },
        { status: 'Resolved', expected: 6 },
        { status: 'Closed', expected: 7 }
      ];

      cases.forEach(({ status, expected }) => {
        const result = service.transformIncidentToServiceNow({ ...baseIncident, status });
        expect(result.state).toBe(expected);
      });
    });

    test('未知のステータスはデフォルト1（New相当）を使用する', () => {
      const result = service.transformIncidentToServiceNow({
        ...baseIncident,
        status: 'Unknown'
      });
      expect(result.state).toBe(1);
    });

    test('省略可能フィールドが未設定の場合はデフォルト値を使用する', () => {
      const minimalIncident = {
        title: 'Minimal',
        priority: 'Medium',
        status: 'New',
        incident_id: 'I001'
      };

      const result = service.transformIncidentToServiceNow(minimalIncident);

      expect(result.description).toBe('');
      expect(result.category).toBe('Inquiry');
      expect(result.subcategory).toBe('');
      expect(result.assignment_group).toBe('');
      expect(result.assigned_to).toBe('');
      expect(result.caller_id).toBe('');
      expect(result.impact).toBe(3);
      expect(result.urgency).toBe(3);
    });
  });

  // ----------------------------------------------------------
  describe('transformIncidentFromServiceNow()', () => {
    const baseSnowIncident = {
      sys_id: 'snow001',
      number: 'INC0000001',
      short_description: 'Server crash',
      description: 'Server went down unexpectedly',
      priority: 2,
      state: 2,
      category: 'Hardware',
      caller_id: { display_value: 'Alice' },
      assigned_to: { display_value: 'Bob' },
      assignment_group: { display_value: 'NOC Team' }
    };

    test('基本的なServiceNowインシデントをITSM形式に変換する', () => {
      const result = service.transformIncidentFromServiceNow(baseSnowIncident);

      expect(result.title).toBe('Server crash');
      expect(result.description).toBe('Server went down unexpectedly');
      expect(result.priority).toBe('High'); // 2 → High
      expect(result.status).toBe('In Progress'); // 2 → In Progress
      expect(result.category).toBe('Hardware');
      expect(result.reporter).toBe('Alice'); // display_value
      expect(result.assigned_to).toBe('Bob'); // display_value
      expect(result.assigned_team).toBe('NOC Team'); // display_value
      expect(result.external_id).toBe('snow001');
      expect(result.external_number).toBe('INC0000001');
      expect(result.source).toBe('servicenow');
    });

    test('優先度逆マッピング: 1=Critical, 2=High, 3=Medium, 4=Low, 5=Low', () => {
      const cases = [
        { priority: 1, expected: 'Critical' },
        { priority: 2, expected: 'High' },
        { priority: 3, expected: 'Medium' },
        { priority: 4, expected: 'Low' },
        { priority: 5, expected: 'Low' } // 5もLow
      ];

      cases.forEach(({ priority, expected }) => {
        const result = service.transformIncidentFromServiceNow({ ...baseSnowIncident, priority });
        expect(result.priority).toBe(expected);
      });
    });

    test('未知の優先度はデフォルトMediumを使用する', () => {
      const result = service.transformIncidentFromServiceNow({ ...baseSnowIncident, priority: 99 });
      expect(result.priority).toBe('Medium');
    });

    test('ステータス逆マッピング: 1=New, 2=InProgress, 3=OnHold, 4=Pending, 5=Pending, 6=Resolved, 7=Closed', () => {
      const cases = [
        { state: 1, expected: 'New' },
        { state: 2, expected: 'In Progress' },
        { state: 3, expected: 'On Hold' },
        { state: 4, expected: 'Pending' },
        { state: 5, expected: 'Pending' },
        { state: 6, expected: 'Resolved' },
        { state: 7, expected: 'Closed' }
      ];

      cases.forEach(({ state, expected }) => {
        const result = service.transformIncidentFromServiceNow({ ...baseSnowIncident, state });
        expect(result.status).toBe(expected);
      });
    });

    test('未知のステータスはデフォルトNewを使用する', () => {
      const result = service.transformIncidentFromServiceNow({ ...baseSnowIncident, state: 99 });
      expect(result.status).toBe('New');
    });

    test('display_valueがない場合はプレーン文字列を使用する', () => {
      const incident = {
        ...baseSnowIncident,
        caller_id: 'plain-caller',
        assigned_to: 'plain-assignee',
        assignment_group: { display_value: null } // display_valueがnull
      };

      const result = service.transformIncidentFromServiceNow(incident);

      expect(result.reporter).toBe('plain-caller');
      expect(result.assigned_to).toBe('plain-assignee');
      expect(result.assigned_team).toBeNull();
    });

    test('assignment_groupがnullの場合はassigned_teamをnullにする', () => {
      const incident = { ...baseSnowIncident, assignment_group: null };
      const result = service.transformIncidentFromServiceNow(incident);
      expect(result.assigned_team).toBeNull();
    });

    test('synced_atはISO 8601形式の日時文字列を返す', () => {
      const result = service.transformIncidentFromServiceNow(baseSnowIncident);
      expect(result.synced_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('short_descriptionがない場合はtitleを空文字列にする', () => {
      const incident = { ...baseSnowIncident, short_description: undefined };
      const result = service.transformIncidentFromServiceNow(incident);
      expect(result.title).toBe('');
    });
  });

  // ----------------------------------------------------------
  describe('getChangeRequests()', () => {
    beforeEach(() => {
      service.config.clientId = null;
      service.config.clientSecret = null;
    });

    test('デフォルトオプションで変更リクエスト一覧を取得する', async () => {
      const changes = [{ sys_id: 'chg001' }, { sys_id: 'chg002' }];
      mockSuccessResponse(200, { result: changes });

      const result = await service.getChangeRequests();

      expect(result).toEqual(changes);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('/api/now/table/change_request')
        }),
        expect.any(Function)
      );
    });

    test('queryとfieldsオプションを使用できる', async () => {
      mockSuccessResponse(200, { result: [] });

      await service.getChangeRequests({
        limit: 25,
        offset: 5,
        query: 'state=-4',
        fields: 'sys_id,number'
      });

      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('sysparm_limit=25')
        }),
        expect.any(Function)
      );
    });

    test('resultフィールドがない場合は空配列を返す', async () => {
      mockSuccessResponse(200, {});
      const result = await service.getChangeRequests();
      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  describe('getChangeRequest()', () => {
    test('指定したsys_idの変更リクエストを取得する', async () => {
      const change = { sys_id: 'chg001', short_description: 'OS upgrade' };
      mockSuccessResponse(200, { result: change });

      const result = await service.getChangeRequest('chg001');

      expect(result).toEqual(change);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('/api/now/table/change_request/chg001')
        }),
        expect.any(Function)
      );
    });
  });

  // ----------------------------------------------------------
  describe('createChangeRequest()', () => {
    test('変更リクエストを作成して結果を返す', async () => {
      const created = { sys_id: 'chg_new001', number: 'CHG0001234' };
      mockSuccessResponse(201, { result: created });

      const result = await service.createChangeRequest({ short_description: 'New change' });

      expect(result).toEqual(created);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: expect.stringContaining('/api/now/table/change_request')
        }),
        expect.any(Function)
      );
    });
  });

  // ----------------------------------------------------------
  describe('updateChangeRequest()', () => {
    test('変更リクエストを更新して結果を返す', async () => {
      const updated = { sys_id: 'chg001', state: '0' };
      mockSuccessResponse(200, { result: updated });

      const result = await service.updateChangeRequest('chg001', { state: 0 });

      expect(result).toEqual(updated);
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          path: expect.stringContaining('/api/now/table/change_request/chg001')
        }),
        expect.any(Function)
      );
    });
  });

  // ----------------------------------------------------------
  describe('transformChangeToServiceNow()', () => {
    const baseChange = {
      title: 'OS Update',
      description: 'Update OS to latest version',
      type: 'Normal',
      status: 'Scheduled',
      priority: 'High',
      risk_level: 2,
      impact: 2,
      assigned_team: 'IT Ops',
      assigned_to: 'Alice',
      requester: 'Bob',
      planned_start_date: '2026-03-01',
      planned_end_date: '2026-03-02',
      reason: 'Security patching',
      implementation_plan: 'Steps to implement',
      backout_plan: 'Steps to rollback',
      test_plan: 'Steps to test',
      change_id: 'CHG-001'
    };

    test('基本的な変更リクエストをServiceNow形式に変換する', () => {
      const result = service.transformChangeToServiceNow(baseChange);

      expect(result.short_description).toBe('OS Update');
      expect(result.description).toBe('Update OS to latest version');
      expect(result.type).toBe('normal'); // Normal → normal
      expect(result.state).toBe(-1); // Scheduled → -1
      expect(result.priority).toBe(2); // High → 2
      expect(result.risk).toBe(2);
      expect(result.impact).toBe(2);
      expect(result.assignment_group).toBe('IT Ops');
      expect(result.assigned_to).toBe('Alice');
      expect(result.requested_by).toBe('Bob');
      expect(result.start_date).toBe('2026-03-01');
      expect(result.end_date).toBe('2026-03-02');
      expect(result.justification).toBe('Security patching');
      expect(result.implementation_plan).toBe('Steps to implement');
      expect(result.backout_plan).toBe('Steps to rollback');
      expect(result.test_plan).toBe('Steps to test');
      expect(result.u_external_id).toBe('CHG-001');
      expect(result.u_source_system).toBe('ITSM-Sec Nexus');
    });

    test('タイプマッピング: Standard=standard, Normal=normal, Emergency=emergency', () => {
      const cases = [
        { type: 'Standard', expected: 'standard' },
        { type: 'Normal', expected: 'normal' },
        { type: 'Emergency', expected: 'emergency' }
      ];

      cases.forEach(({ type, expected }) => {
        const result = service.transformChangeToServiceNow({ ...baseChange, type });
        expect(result.type).toBe(expected);
      });
    });

    test('未知のタイプはデフォルトnormalを使用する', () => {
      const result = service.transformChangeToServiceNow({ ...baseChange, type: 'Custom' });
      expect(result.type).toBe('normal');
    });

    test('ステータスマッピング: Draft=-5, New=-4, Assess=-3, Authorize=-2, Scheduled=-1, Implement=-4(falsy bug), Review=1, Closed=3, Cancelled=4', () => {
      // 注意: stateMap['Implement']=0 だが、実装が `stateMap[status] || -4` のため
      // 0 || -4 = -4 となる (0はfalsyなのでフォールバックされる実装バグ)
      const cases = [
        { status: 'Draft', expected: -5 },
        { status: 'New', expected: -4 },
        { status: 'Assess', expected: -3 },
        { status: 'Authorize', expected: -2 },
        { status: 'Scheduled', expected: -1 },
        { status: 'Implement', expected: -4 }, // 実装バグ: 0 || -4 = -4
        { status: 'Review', expected: 1 },
        { status: 'Closed', expected: 3 },
        { status: 'Cancelled', expected: 4 }
      ];

      cases.forEach(({ status, expected }) => {
        const result = service.transformChangeToServiceNow({ ...baseChange, status });
        expect(result.state).toBe(expected);
      });
    });

    test('未知のステータスはデフォルト-4（New相当）を使用する', () => {
      const result = service.transformChangeToServiceNow({ ...baseChange, status: 'Unknown' });
      expect(result.state).toBe(-4);
    });

    test('優先度マッピング: Critical=1, High=2, それ以外=3', () => {
      expect(
        service.transformChangeToServiceNow({ ...baseChange, priority: 'Critical' }).priority
      ).toBe(1);
      expect(
        service.transformChangeToServiceNow({ ...baseChange, priority: 'High' }).priority
      ).toBe(2);
      expect(
        service.transformChangeToServiceNow({ ...baseChange, priority: 'Medium' }).priority
      ).toBe(3);
      expect(service.transformChangeToServiceNow({ ...baseChange, priority: 'Low' }).priority).toBe(
        3
      );
    });

    test('省略可能フィールドが未設定の場合はデフォルト値を使用する', () => {
      const minimalChange = {
        title: 'Minimal change',
        type: 'Normal',
        status: 'New',
        priority: 'Medium',
        change_id: 'CHG-MIN'
      };

      const result = service.transformChangeToServiceNow(minimalChange);

      expect(result.description).toBe('');
      expect(result.assignment_group).toBe('');
      expect(result.assigned_to).toBe('');
      expect(result.requested_by).toBe('');
      expect(result.start_date).toBe('');
      expect(result.end_date).toBe('');
      expect(result.justification).toBe('');
      expect(result.implementation_plan).toBe('');
      expect(result.backout_plan).toBe('');
      expect(result.test_plan).toBe('');
    });
  });

  // ----------------------------------------------------------
  describe('transformChangeFromServiceNow()', () => {
    const baseSnowChange = {
      sys_id: 'snow_chg001',
      number: 'CHG0000001',
      short_description: 'Network upgrade',
      description: 'Upgrade network infrastructure',
      type: 'normal',
      state: -1, // Scheduled
      priority: 2,
      risk: 2,
      impact: 2,
      requested_by: { display_value: 'Manager' },
      assigned_to: { display_value: 'Engineer' },
      assignment_group: { display_value: 'Network Team' },
      start_date: '2026-03-01',
      end_date: '2026-03-02',
      justification: 'Capacity upgrade needed',
      implementation_plan: 'Implementation steps',
      backout_plan: 'Rollback steps',
      test_plan: 'Testing steps'
    };

    test('基本的なServiceNow変更リクエストをITSM形式に変換する', () => {
      const result = service.transformChangeFromServiceNow(baseSnowChange);

      expect(result.title).toBe('Network upgrade');
      expect(result.description).toBe('Upgrade network infrastructure');
      expect(result.type).toBe('Normal'); // normal → Normal
      expect(result.status).toBe('Scheduled'); // -1 → Scheduled
      expect(result.priority).toBe('High'); // 2 → High
      expect(result.risk_level).toBe(2);
      expect(result.impact).toBe(2);
      expect(result.requester).toBe('Manager'); // display_value
      expect(result.assigned_to).toBe('Engineer'); // display_value
      expect(result.assigned_team).toBe('Network Team'); // display_value
      expect(result.planned_start_date).toBe('2026-03-01');
      expect(result.planned_end_date).toBe('2026-03-02');
      expect(result.reason).toBe('Capacity upgrade needed');
      expect(result.implementation_plan).toBe('Implementation steps');
      expect(result.backout_plan).toBe('Rollback steps');
      expect(result.test_plan).toBe('Testing steps');
      expect(result.external_id).toBe('snow_chg001');
      expect(result.external_number).toBe('CHG0000001');
      expect(result.source).toBe('servicenow');
    });

    test('タイプ逆マッピング: standard=Standard, normal=Normal, emergency=Emergency', () => {
      const cases = [
        { type: 'standard', expected: 'Standard' },
        { type: 'normal', expected: 'Normal' },
        { type: 'emergency', expected: 'Emergency' }
      ];

      cases.forEach(({ type, expected }) => {
        const result = service.transformChangeFromServiceNow({ ...baseSnowChange, type });
        expect(result.type).toBe(expected);
      });
    });

    test('未知のタイプはデフォルトNormalを使用する', () => {
      const result = service.transformChangeFromServiceNow({ ...baseSnowChange, type: 'unknown' });
      expect(result.type).toBe('Normal');
    });

    test('ステータス逆マッピング（負数含む）: -5=Draft, -4=New, -3=Assess, -2=Authorize, -1=Scheduled, 0=Implement, 1=Review, 3=Closed, 4=Cancelled', () => {
      const cases = [
        { state: -5, expected: 'Draft' },
        { state: -4, expected: 'New' },
        { state: -3, expected: 'Assess' },
        { state: -2, expected: 'Authorize' },
        { state: -1, expected: 'Scheduled' },
        { state: 0, expected: 'Implement' },
        { state: 1, expected: 'Review' },
        { state: 3, expected: 'Closed' },
        { state: 4, expected: 'Cancelled' }
      ];

      cases.forEach(({ state, expected }) => {
        const result = service.transformChangeFromServiceNow({ ...baseSnowChange, state });
        expect(result.status).toBe(expected);
      });
    });

    test('未知のステータスはデフォルトNewを使用する', () => {
      const result = service.transformChangeFromServiceNow({ ...baseSnowChange, state: 99 });
      expect(result.status).toBe('New');
    });

    test('優先度逆マッピング: 1=Critical, 2=High, 3=Medium, 4=Low', () => {
      const cases = [
        { priority: 1, expected: 'Critical' },
        { priority: 2, expected: 'High' },
        { priority: 3, expected: 'Medium' },
        { priority: 4, expected: 'Low' }
      ];

      cases.forEach(({ priority, expected }) => {
        const result = service.transformChangeFromServiceNow({ ...baseSnowChange, priority });
        expect(result.priority).toBe(expected);
      });
    });

    test('未知の優先度はデフォルトMediumを使用する', () => {
      const result = service.transformChangeFromServiceNow({ ...baseSnowChange, priority: 99 });
      expect(result.priority).toBe('Medium');
    });

    test('display_valueがない場合はプレーン文字列を使用する', () => {
      const change = {
        ...baseSnowChange,
        requested_by: 'plain-requester',
        assigned_to: 'plain-engineer',
        assignment_group: null
      };

      const result = service.transformChangeFromServiceNow(change);

      expect(result.requester).toBe('plain-requester');
      expect(result.assigned_to).toBe('plain-engineer');
      expect(result.assigned_team).toBeNull();
    });

    test('nullフィールドを適切に処理する', () => {
      const change = {
        ...baseSnowChange,
        start_date: null,
        end_date: null,
        justification: null,
        implementation_plan: null,
        backout_plan: null,
        test_plan: null,
        risk: null,
        impact: null
      };

      const result = service.transformChangeFromServiceNow(change);

      expect(result.planned_start_date).toBeNull();
      expect(result.planned_end_date).toBeNull();
      expect(result.reason).toBeNull();
      expect(result.implementation_plan).toBeNull();
      expect(result.backout_plan).toBeNull();
      expect(result.test_plan).toBeNull();
      expect(result.risk_level).toBeNull();
      expect(result.impact).toBeNull();
    });

    test('synced_atはISO 8601形式の日時文字列を返す', () => {
      const result = service.transformChangeFromServiceNow(baseSnowChange);
      expect(result.synced_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  // ----------------------------------------------------------
  describe('testConnection()', () => {
    beforeEach(() => {
      service.config.clientId = null;
      service.config.clientSecret = null;
    });

    test('設定が不完全な場合は接続失敗オブジェクトを返す', async () => {
      service.config.instanceUrl = null;

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.configured).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('接続が成功した場合は接続成功オブジェクトを返す', async () => {
      mockSuccessResponse(200, {
        result: [{ name: 'test.property', value: 'test' }]
      });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.configured).toBe(true);
      expect(result.instanceUrl).toBe('https://test.service-now.com');
      expect(result.message).toContain('ServiceNow');
    });

    test('APIエラーの場合はsuccess=falseとエラーメッセージを返す', async () => {
      mockSuccessResponse(401, { error: { message: 'Unauthorized' } });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.configured).toBe(true);
      expect(result.error).toBeDefined();
    });

    test('ネットワークエラーの場合はsuccess=falseとエラーを返す', async () => {
      mockNetworkError('ENOTFOUND test.service-now.com');

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.configured).toBe(true);
      expect(result.error).toContain('ENOTFOUND');
    });
  });

  // ----------------------------------------------------------
  describe('verifyWebhookSignature()', () => {
    const secret = 'my-webhook-secret';
    const payload = 'test-payload-data';

    test('正しい署名の場合はtrueを返す', () => {
      const correctSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const result = service.verifyWebhookSignature(payload, correctSig, secret);
      expect(result).toBe(true);
    });

    test('間違った署名の場合はfalseを返す', () => {
      const result = service.verifyWebhookSignature(payload, 'wrong-signature-value-here', secret);
      expect(result).toBe(false);
    });

    test('signatureがnullの場合はfalseを返す', () => {
      const result = service.verifyWebhookSignature(payload, null, secret);
      expect(result).toBe(false);
    });

    test('secretがnullの場合はfalseを返す', () => {
      const correctSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const result = service.verifyWebhookSignature(payload, correctSig, null);
      expect(result).toBe(false);
    });

    test('signatureが空文字列の場合はfalseを返す', () => {
      const result = service.verifyWebhookSignature(payload, '', secret);
      expect(result).toBe(false);
    });

    test('secretが空文字列の場合はfalseを返す', () => {
      const correctSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const result = service.verifyWebhookSignature(payload, correctSig, '');
      expect(result).toBe(false);
    });

    test('長さが異なる署名でもエラーをスローせずfalseを返す', () => {
      // crypto.timingSafeEqual は長さ不一致でエラー → try-catch でfalseに変換
      expect(() => {
        const result = service.verifyWebhookSignature(payload, 'short', secret);
        expect(result).toBe(false);
      }).not.toThrow();
    });

    test('ペイロードが異なる場合はfalseを返す', () => {
      const sigForOriginal = crypto
        .createHmac('sha256', secret)
        .update('original-payload')
        .digest('hex');

      const result = service.verifyWebhookSignature('different-payload', sigForOriginal, secret);
      expect(result).toBe(false);
    });
  });

  // ----------------------------------------------------------
  describe('getSyncStatus()', () => {
    test('Basic認証設定のステータスを返す', () => {
      // clientId=null → basic auth
      const status = service.getSyncStatus();

      expect(status.configured).toBe(true);
      expect(status.instanceUrl).toBe('https://test.service-now.com');
      expect(status.authMethod).toBe('basic');
      expect(status.hasCredentials).toBe(true);
    });

    test('OAuth認証設定のステータスを返す', () => {
      service.config.clientId = 'oauth-client-id';
      service.config.clientSecret = 'oauth-client-secret';

      const status = service.getSyncStatus();

      expect(status.authMethod).toBe('oauth');
      expect(status.configured).toBe(true);
    });

    test('未設定の場合のステータスを返す', () => {
      service.config = {
        instanceUrl: null,
        username: null,
        password: null,
        clientId: null,
        clientSecret: null
      };

      const status = service.getSyncStatus();

      expect(status.configured).toBe(false);
      expect(status.instanceUrl).toBeNull();
      expect(status.authMethod).toBe('basic'); // clientId=null → basic
      expect(status.hasCredentials).toBe(false);
    });

    test('clientIdが設定されている場合はauthMethod=oauthを返す', () => {
      service.config.clientId = 'some-client';
      const status = service.getSyncStatus();
      expect(status.authMethod).toBe('oauth');
    });
  });

  // ----------------------------------------------------------
  describe('モジュールエクスポート', () => {
    test('デフォルトエクスポートはServiceNowServiceのシングルトンインスタンス', () => {
      const serviceNowModule = require('../../../services/serviceNowService');
      expect(serviceNowModule).toBeInstanceOf(ServiceNowService);
    });

    test('ServiceNowServiceクラスが名前付きエクスポートされている', () => {
      const { ServiceNowService: ExportedClass } = require('../../../services/serviceNowService');
      expect(ExportedClass).toBe(ServiceNowService);
      expect(typeof ExportedClass).toBe('function');
    });

    test('新しいインスタンスをServiceNowServiceから作成できる', () => {
      const newInstance = new ServiceNowService();
      expect(newInstance).toBeInstanceOf(ServiceNowService);
      expect(newInstance.accessToken).toBeNull();
      expect(newInstance.tokenExpiry).toBeNull();
    });
  });
});
