/**
 * Webhooks Routes - Integration Tests
 *
 * Tests for webhook endpoints:
 * - POST /api/v1/webhooks/m365 (Microsoft 365 Webhook)
 * - POST /api/v1/webhooks/servicenow (ServiceNow Webhook)
 * - GET  /api/v1/webhooks/logs (管理者・マネージャーのみ)
 *
 * カバレッジ対象: webhooks.js (Branch 0% → 50%+)
 *
 * ⚠️ 既知のスキーマ不一致バグ（実装は変更しない）:
 *   - ServiceNow incident INSERT: incidents テーブルに category, reporter, assigned_to 列が存在しない
 *     → INSERT が SQLite エラー → outer catch → 500 応答
 *   - ServiceNow change INSERT: changes テーブルに change_id, type, assigned_to 等が存在しない
 *     → INSERT が SQLite エラー → outer catch → 500 応答
 *   - M365 user UPDATE: users テーブルに updated_at 列が存在しない
 *     → UPDATE が SQLite エラー → inner catch（吸収）→ 200 応答
 *   - M365 security alert INSERT: incidents テーブルに category 列が存在しない
 *     → INSERT が SQLite エラー → inner catch（吸収）→ 200 応答
 */

const crypto = require('crypto');
const request = require('supertest');
const { app, dbReady } = require('../../server');
const knex = require('../../knex');

// ============================================================
// 外部サービスのモック（webhooks.js が require するモジュール）
// ============================================================

jest.mock('../../services/microsoftGraphService', () => ({
  getUser: jest.fn(),
  transformUserForITSM: jest.fn()
}));

jest.mock('../../services/serviceNowService', () => ({
  verifyWebhookSignature: jest.fn(),
  transformIncidentFromServiceNow: jest.fn(),
  transformChangeFromServiceNow: jest.fn()
}));

const microsoftGraphService = require('../../services/microsoftGraphService');
const serviceNowService = require('../../services/serviceNowService');

// テスト用のシークレット定数
const M365_WEBHOOK_SECRET = 'test-m365-webhook-secret';
const SERVICENOW_WEBHOOK_SECRET = 'test-servicenow-webhook-secret';

// ============================================================
// テストスイート
// ============================================================

describe('Webhook Routes (webhooks.js)', () => {
  let adminToken;
  let managerToken;
  let analystToken;
  let viewerToken;

  // ----------------------------------------------------------
  // セットアップ
  // ----------------------------------------------------------

  beforeAll(async () => {
    await dbReady;

    const [adminRes, managerRes, analystRes, viewerRes] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'admin123' }),
      request(app).post('/api/v1/auth/login').send({ username: 'manager', password: 'manager123' }),
      request(app).post('/api/v1/auth/login').send({ username: 'analyst', password: 'analyst123' }),
      request(app).post('/api/v1/auth/login').send({ username: 'viewer', password: 'viewer123' })
    ]);

    adminToken = adminRes.body.token;
    managerToken = managerRes.body.token;
    analystToken = analystRes.body.token;
    viewerToken = viewerRes.body.token;
  }, 90000);

  afterAll(async () => {
    await knex('webhook_logs').delete();
    await knex.destroy();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // 環境変数をリセット（各テストで明示的に設定）
    delete process.env.M365_WEBHOOK_SECRET;
    delete process.env.SERVICENOW_WEBHOOK_SECRET;

    // デフォルトのモック実装
    microsoftGraphService.getUser.mockResolvedValue({
      id: 'test-user-ext-id',
      userPrincipalName: 'test@example.com',
      mail: 'test@example.com',
      displayName: 'Test User',
      accountEnabled: true,
      department: 'IT',
      jobTitle: 'Engineer'
    });

    microsoftGraphService.transformUserForITSM.mockReturnValue({
      email: 'test@example.com',
      full_name: 'Test User',
      is_active: true,
      department: 'IT',
      job_title: 'Engineer'
    });

    serviceNowService.verifyWebhookSignature.mockReturnValue(true);

    serviceNowService.transformIncidentFromServiceNow.mockReturnValue({
      title: 'ServiceNow Test Incident',
      description: 'Test description',
      priority: 'High',
      status: 'New',
      category: 'Hardware',
      reporter: 'user1',
      assigned_to: 'user2'
    });

    serviceNowService.transformChangeFromServiceNow.mockReturnValue({
      title: 'ServiceNow Test Change',
      description: 'Test description',
      type: 'normal',
      priority: 'Medium',
      status: 'Requested',
      requester: 'user1',
      assigned_to: 'user2',
      planned_start_date: '2026-03-01',
      planned_end_date: '2026-03-02'
    });
  });

  // ============================================================
  // POST /api/v1/webhooks/m365
  // ============================================================

  describe('POST /api/v1/webhooks/m365', () => {
    // ----------------------------------------------------------
    // リクエストボディのバリデーション
    // ----------------------------------------------------------

    describe('リクエストボディのバリデーション', () => {
      it('null JSON ボディ → 400 無効なリクエストボディ', async () => {
        // express.json() の strict: true が null（非 object/array）をレジェクト → 400
        // body-parser のエラーレスポンスは { type: 'entity.parse.failed', ... } 形式
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .set('Content-Type', 'application/json')
          .send('null');

        expect(res.status).toBe(400);
      });

      it('正常な JSON オブジェクト（空の value 配列）→ 200', async () => {
        const res = await request(app).post('/api/v1/webhooks/m365').send({ value: [] });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
      });
    });

    // ----------------------------------------------------------
    // サブスクリプション検証（Microsoft Graph API の要件）
    // ----------------------------------------------------------

    describe('サブスクリプション検証', () => {
      it('validationToken がある場合 → 200 text/plain でトークンをそのまま返す', async () => {
        const token = 'test-validation-token-abc123';

        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({ validationToken: token });

        expect(res.status).toBe(200);
        expect(res.text).toBe(token);
        expect(res.headers['content-type']).toMatch(/text\/plain/);
      });
    });

    // ----------------------------------------------------------
    // HMAC 署名検証
    // ----------------------------------------------------------

    describe('署名検証（x-ms-signature）', () => {
      it('M365_WEBHOOK_SECRET 未設定 → 署名検証をスキップ → 200', async () => {
        // webhookSecret が falsy のため if (webhookSecret && signature) が評価されない
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .set('x-ms-signature', 'any-signature')
          .send({ value: [] });

        expect(res.status).toBe(200);
      });

      it('M365_WEBHOOK_SECRET あり + 署名ヘッダーなし → 検証スキップ（AND 条件）→ 200', async () => {
        // 条件: webhookSecret && signature → signature が falsy → スキップ
        process.env.M365_WEBHOOK_SECRET = M365_WEBHOOK_SECRET;

        const res = await request(app).post('/api/v1/webhooks/m365').send({ value: [] });

        expect(res.status).toBe(200);
      });

      it('M365_WEBHOOK_SECRET あり + 不正な署名 → 400 署名検証失敗', async () => {
        process.env.M365_WEBHOOK_SECRET = M365_WEBHOOK_SECRET;

        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .set('x-ms-signature', 'invalid-signature-value')
          .send({ value: [] });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/署名/);
      });

      it('M365_WEBHOOK_SECRET あり + 正しい HMAC 署名（プレフィックスなし）→ 200', async () => {
        process.env.M365_WEBHOOK_SECRET = M365_WEBHOOK_SECRET;

        // webhooks.js は rawBody = JSON.stringify(req.body) で署名計算するため
        // テスト側でも同じ body オブジェクトを使い JSON.stringify する
        const bodyObj = { value: [] };
        const rawBody = JSON.stringify(bodyObj);
        const hmac = crypto.createHmac('sha256', M365_WEBHOOK_SECRET).update(rawBody).digest('hex');

        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .set('x-ms-signature', hmac)
          .send(bodyObj);

        expect(res.status).toBe(200);
      });

      it('M365_WEBHOOK_SECRET あり + sha256= プレフィックス付き正しい署名 → 200', async () => {
        // verifyHmacSignature は signature.replace(/^sha256=/, '') でプレフィックスを除去
        process.env.M365_WEBHOOK_SECRET = M365_WEBHOOK_SECRET;

        const bodyObj = { value: [] };
        const rawBody = JSON.stringify(bodyObj);
        const hmac = crypto.createHmac('sha256', M365_WEBHOOK_SECRET).update(rawBody).digest('hex');
        const sigWithPrefix = `sha256=${hmac}`;

        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .set('x-ms-signature', sigWithPrefix)
          .send(bodyObj);

        expect(res.status).toBe(200);
      });
    });

    // ----------------------------------------------------------
    // 通知処理（value 配列のルーティング）
    // ----------------------------------------------------------

    describe('通知処理', () => {
      it('空の通知リスト → 200 count: 0', async () => {
        const res = await request(app).post('/api/v1/webhooks/m365').send({ value: [] });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
      });

      it('value フィールドなし → 200 count: 0（payload.value || [] で空配列）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({ subscriptionId: 'sub-001' });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
      });

      // --- users リソース ---

      it('users リソース: deleted → 200（updated_at エラーは outer catch で吸収）', async () => {
        // handleM365UserChange で UPDATE users SET updated_at=... → updated_at 列なし → エラー
        // エラーは outer for-loop の catch で捕捉 → ループ継続 → 最終 200
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'deleted',
                resource: 'users/ext-user-del-001',
                resourceData: { id: 'ext-user-del-001' },
                subscriptionId: 'sub-002'
              }
            ]
          });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
      });

      it('users リソース: deleted + resourceData なし → 200（resource URL から userId 取得）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'deleted',
                resource: 'users/ext-user-del-002',
                resourceData: null,
                subscriptionId: 'sub-003'
              }
            ]
          });

        // resourceData?.id → undefined → notification.resource.split('/').pop() を使用
        expect(res.status).toBe(200);
      });

      it('users リソース: updated + 既存ユーザーなし → 200（getUser が呼ばれ UPDATE スキップ）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'updated',
                resource: 'users/ext-user-upd-001',
                resourceData: { id: 'ext-user-upd-001' },
                subscriptionId: 'sub-004'
              }
            ]
          });

        expect(res.status).toBe(200);
        // 外部 API 呼び出しが実行されたことを検証
        expect(microsoftGraphService.getUser).toHaveBeenCalledWith('ext-user-upd-001');
        expect(microsoftGraphService.transformUserForITSM).toHaveBeenCalled();
      });

      it('users リソース: updated + getUser エラー → 200（inner catch で吸収）', async () => {
        microsoftGraphService.getUser.mockRejectedValue(new Error('Graph API connection error'));

        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'updated',
                resource: 'users/ext-user-upd-002',
                resourceData: { id: 'ext-user-upd-002' },
                subscriptionId: 'sub-005'
              }
            ]
          });

        // handleM365UserChange の inner try/catch がエラーを吸収 → 200
        expect(res.status).toBe(200);
      });

      it('users リソース: created + resourceData.id なし + resource URL 末尾が空 → 200（早期リターン）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'created',
                resource: 'users/',
                resourceData: null,
                subscriptionId: 'sub-006'
              }
            ]
          });

        // userId = '' → !userId → return (早期リターン) → outer catch なし → 200
        expect(res.status).toBe(200);
        expect(microsoftGraphService.getUser).not.toHaveBeenCalled();
      });

      // --- devices リソース ---

      it('devices リソース: updated + deviceId あり → 200（ログのみ）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'updated',
                resource: 'devices/device-id-001',
                resourceData: { id: 'device-id-001' },
                subscriptionId: 'sub-007'
              }
            ]
          });

        // handleM365DeviceChange はログ出力のみ（DB 操作なし）→ エラーなし → 200
        expect(res.status).toBe(200);
      });

      it('devices リソース: resourceData なし → 200（deviceId undefined → 早期リターン）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'deleted',
                resource: 'devices/device-id-002',
                resourceData: null,
                subscriptionId: 'sub-008'
              }
            ]
          });

        // !deviceId → return → 200
        expect(res.status).toBe(200);
      });

      // --- security/alerts リソース ---

      it('security/alerts リソース: created + resourceData あり → 200（category エラーは inner catch で吸収）', async () => {
        // handleM365SecurityAlert: INSERT incidents (..., category, ...) → category 列なし → エラー
        // inner try/catch が捕捉 → outer catch まで伝播しない → 200
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'created',
                resource: 'security/alerts/alert-001',
                resourceData: {
                  id: 'alert-001',
                  title: 'Test Security Alert',
                  description: 'Test alert description',
                  severity: 'high'
                },
                subscriptionId: 'sub-009'
              }
            ]
          });

        expect(res.status).toBe(200);
      });

      it('security/alerts リソース: created + severity high 以外 → 200（priority High）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'created',
                resource: 'security/alerts/alert-002',
                resourceData: {
                  id: 'alert-002',
                  title: 'Medium Alert',
                  severity: 'medium'
                },
                subscriptionId: 'sub-010'
              }
            ]
          });

        expect(res.status).toBe(200);
      });

      it('security/alerts リソース: updated → 200（created でないため INSERT しない）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'updated',
                resource: 'security/alerts/alert-003',
                resourceData: { id: 'alert-003', title: 'Updated Alert' },
                subscriptionId: 'sub-011'
              }
            ]
          });

        // changeType !== 'created' → if ブランチに入らない → DB 操作なし → 200
        expect(res.status).toBe(200);
      });

      it('security/alerts リソース: created + resourceData なし → 200（INSERT しない）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'created',
                resource: 'security/alerts/alert-004',
                resourceData: null,
                subscriptionId: 'sub-012'
              }
            ]
          });

        // changeType === 'created' && resourceData → false（null）→ if ブランチに入らない → 200
        expect(res.status).toBe(200);
      });

      it('複数通知（users + devices + security/alerts）→ 200 count: 3', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/m365')
          .send({
            value: [
              {
                changeType: 'updated',
                resource: 'users/ext-user-multi-001',
                resourceData: { id: 'ext-user-multi-001' },
                subscriptionId: 'sub-013'
              },
              {
                changeType: 'updated',
                resource: 'devices/device-multi-001',
                resourceData: { id: 'device-multi-001' },
                subscriptionId: 'sub-013'
              },
              {
                changeType: 'updated',
                resource: 'security/alerts/alert-multi-001',
                resourceData: { id: 'alert-multi-001' },
                subscriptionId: 'sub-013'
              }
            ]
          });

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(3);
      });
    });
  });

  // ============================================================
  // POST /api/v1/webhooks/servicenow
  // ============================================================

  describe('POST /api/v1/webhooks/servicenow', () => {
    // ----------------------------------------------------------
    // リクエストボディのバリデーション
    // ----------------------------------------------------------

    describe('リクエストボディのバリデーション', () => {
      it('null JSON ボディ → 400', async () => {
        // express.json() の strict: true が null（非 object/array）をレジェクト → 400
        // body-parser のエラーレスポンスは { type: 'entity.parse.failed', ... } 形式
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .set('Content-Type', 'application/json')
          .send('null');

        expect(res.status).toBe(400);
      });

      it('正常な JSON オブジェクト → 200', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'unknown', record: {} });

        expect(res.status).toBe(200);
      });
    });

    // ----------------------------------------------------------
    // 署名検証（x-servicenow-signature）
    // ----------------------------------------------------------

    describe('署名検証', () => {
      it('SERVICENOW_WEBHOOK_SECRET 未設定 → 署名検証スキップ → 200', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .set('x-servicenow-signature', 'any-signature')
          .send({ event_type: 'unknown', record: {} });

        expect(res.status).toBe(200);
        expect(serviceNowService.verifyWebhookSignature).not.toHaveBeenCalled();
      });

      it('SERVICENOW_WEBHOOK_SECRET あり + 署名検証失敗 → 400', async () => {
        process.env.SERVICENOW_WEBHOOK_SECRET = SERVICENOW_WEBHOOK_SECRET;
        serviceNowService.verifyWebhookSignature.mockReturnValue(false);

        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .set('x-servicenow-signature', 'invalid-signature')
          .send({ event_type: 'incident.created', record: {} });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/署名/);
        expect(serviceNowService.verifyWebhookSignature).toHaveBeenCalled();
      });

      it('SERVICENOW_WEBHOOK_SECRET あり + 署名ヘッダーなし → verifyWebhookSignature を呼ぶ', async () => {
        // m365 と異なり、ServiceNow は signature の有無に関わらず secret があれば検証する
        process.env.SERVICENOW_WEBHOOK_SECRET = SERVICENOW_WEBHOOK_SECRET;
        serviceNowService.verifyWebhookSignature.mockReturnValue(true);

        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'unknown', record: {} });

        expect(res.status).toBe(200);
        // rawBody と undefined signature と secret で呼ばれる
        expect(serviceNowService.verifyWebhookSignature).toHaveBeenCalled();
      });

      it('SERVICENOW_WEBHOOK_SECRET あり + 署名検証成功 → 処理継続 → 200', async () => {
        process.env.SERVICENOW_WEBHOOK_SECRET = SERVICENOW_WEBHOOK_SECRET;
        serviceNowService.verifyWebhookSignature.mockReturnValue(true);

        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .set('x-servicenow-signature', 'valid-signature')
          .send({ event_type: 'unknown', record: {} });

        expect(res.status).toBe(200);
      });
    });

    // ----------------------------------------------------------
    // イベントタイプ処理
    // ----------------------------------------------------------

    describe('イベントタイプ処理', () => {
      it('event_type なし → unknown として処理 → 200', async () => {
        const res = await request(app).post('/api/v1/webhooks/servicenow').send({ record: {} });

        expect(res.status).toBe(200);
        expect(res.body.eventType).toBe('unknown');
      });

      it('incident. プレフィックス以外のイベント → ハンドラなし → 200', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'problem.created', record: {} });

        expect(res.status).toBe(200);
        expect(res.body.eventType).toBe('problem.created');
        // transform 系は呼ばれない
        expect(serviceNowService.transformIncidentFromServiceNow).not.toHaveBeenCalled();
        expect(serviceNowService.transformChangeFromServiceNow).not.toHaveBeenCalled();
      });

      // --- incident イベント ---

      it('incident.created + sys_id なし → 早期リターン → 200', async () => {
        // handleServiceNowIncident: !sysId → return → DB 操作なし → 200
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'incident.created', record: {} });

        expect(res.status).toBe(200);
        // sysId がないため transform は呼ばれない場合もあるが、現コードは transform を先に呼ぶ
      });

      it('incident.created + sys_id あり → 500（スキーマ不一致バグ: incidents に category 列なし）', async () => {
        // handleServiceNowIncident: INSERT incidents (..., category, reporter, assigned_to, ...)
        // → SQLite error → 外部 outer catch → 500
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({
            event_type: 'incident.created',
            sys_id: 'snow-inc-001',
            record: { sys_id: 'snow-inc-001', short_description: 'Test Incident' }
          });

        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
        expect(serviceNowService.transformIncidentFromServiceNow).toHaveBeenCalled();
      });

      it('incident.updated + sys_id なし → 早期リターン → 200', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'incident.updated', record: {} });

        expect(res.status).toBe(200);
      });

      it('incident.resolved + sys_id なし → 早期リターン → 200', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'incident.resolved', record: {} });

        expect(res.status).toBe(200);
      });

      // --- change イベント ---

      it('change.created + sys_id なし → 早期リターン → 200', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'change.created', record: {} });

        expect(res.status).toBe(200);
      });

      it('change.created + sys_id あり → 500（スキーマ不一致バグ: changes に change_id 列なし）', async () => {
        // handleServiceNowChange: INSERT changes (..., change_id, type, assigned_to, ...)
        // → SQLite error → outer catch → 500
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({
            event_type: 'change.created',
            sys_id: 'snow-chg-001',
            record: { sys_id: 'snow-chg-001', short_description: 'Test Change' }
          });

        expect(res.status).toBe(500);
        expect(serviceNowService.transformChangeFromServiceNow).toHaveBeenCalled();
      });

      it('change_request.created + sys_id あり → 500（スキーマ不一致バグ）', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({
            event_type: 'change_request.created',
            sys_id: 'snow-chg-002',
            record: { sys_id: 'snow-chg-002' }
          });

        expect(res.status).toBe(500);
      });

      it('change.updated + sys_id なし → 早期リターン → 200', async () => {
        const res = await request(app)
          .post('/api/v1/webhooks/servicenow')
          .send({ event_type: 'change.updated', record: {} });

        expect(res.status).toBe(200);
      });
    });
  });

  // ============================================================
  // GET /api/v1/webhooks/logs
  // ============================================================

  describe('GET /api/v1/webhooks/logs', () => {
    beforeAll(async () => {
      // テスト用ログデータをセットアップ（POST テストで挿入されたものはクリア）
      await knex('webhook_logs').delete();
      await knex('webhook_logs').insert([
        {
          source: 'microsoft365',
          event_type: 'created_users',
          payload: '{"test":1}',
          status: 'processed',
          error_message: null
        },
        {
          source: 'servicenow',
          event_type: 'incident.created',
          payload: '{"test":2}',
          status: 'error',
          error_message: 'スキーマ不一致エラー'
        },
        {
          source: 'microsoft365',
          event_type: 'created_security/alerts',
          payload: '{"test":3}',
          status: 'rejected',
          error_message: '署名検証失敗'
        },
        {
          source: 'servicenow',
          event_type: 'change.created',
          payload: '{"test":4}',
          status: 'error',
          error_message: 'スキーマ不一致エラー'
        }
      ]);
    });

    // ----------------------------------------------------------
    // 認証・認可テスト
    // ----------------------------------------------------------

    it('認証なし → 401', async () => {
      const res = await request(app).get('/api/v1/webhooks/logs');
      expect(res.status).toBe(401);
    });

    it('admin → 200 + ログ一覧', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });

    it('manager → 200', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });

    it('analyst → 403 権限不足', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });

    it('viewer → 403 権限不足', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });

    // ----------------------------------------------------------
    // フィルタリング
    // ----------------------------------------------------------

    it('source=microsoft365 フィルタ → microsoft365 のみ返す', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs?source=microsoft365')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const sources = res.body.data.map((log) => log.source);
      expect(sources.every((s) => s === 'microsoft365')).toBe(true);
    });

    it('source=servicenow フィルタ → servicenow のみ返す', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs?source=servicenow')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const sources = res.body.data.map((log) => log.source);
      expect(sources.every((s) => s === 'servicenow')).toBe(true);
    });

    it('status=error フィルタ → error ステータスのみ返す', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs?status=error')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      const statuses = res.body.data.map((log) => log.status);
      expect(statuses.every((s) => s === 'error')).toBe(true);
    });

    it('status=processed フィルタ → processed のみ返す', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs?status=processed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const statuses = res.body.data.map((log) => log.status);
      expect(statuses.every((s) => s === 'processed')).toBe(true);
    });

    it('status=rejected フィルタ → rejected のみ返す', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs?status=rejected')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const statuses = res.body.data.map((log) => log.status);
      expect(statuses.every((s) => s === 'rejected')).toBe(true);
    });

    it('limit=1 → 1 件のみ返す', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs?limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('source + status 複合フィルタ', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs?source=servicenow&status=error')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((log) => {
        expect(log.source).toBe('servicenow');
        expect(log.status).toBe('error');
      });
    });

    it('デフォルト limit=50 → 50 件以下を返す', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(50);
    });

    it('レスポンス構造: success, data, total フィールドを持つ', async () => {
      const res = await request(app)
        .get('/api/v1/webhooks/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body.total).toBe(res.body.data.length);
    });
  });
});
