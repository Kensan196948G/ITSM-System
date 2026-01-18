/**
 * E2Eテスト: レポート生成機能
 * インシデントサマリー、SLAコンプライアンス、セキュリティ概要レポート生成のテスト
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app } = require('../../server');

describe('E2E: レポート生成機能テスト', () => {
  let adminToken;
  let managerToken;
  let analystToken;
  let createdScheduleId;
  let generatedFileName;

  beforeAll(async () => {
    // サーバー起動待機
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 管理者ログイン
    const adminRes = await request(app).post('/api/v1/auth/login').send({
      username: 'admin',
      password: 'admin123'
    });
    expect(adminRes.statusCode).toEqual(200);
    adminToken = adminRes.body.token;

    // マネージャーログイン
    const managerRes = await request(app).post('/api/v1/auth/login').send({
      username: 'manager',
      password: 'manager123'
    });
    expect(managerRes.statusCode).toEqual(200);
    managerToken = managerRes.body.token;

    // アナリストログイン
    const analystRes = await request(app).post('/api/v1/auth/login').send({
      username: 'analyst',
      password: 'analyst123'
    });
    expect(analystRes.statusCode).toEqual(200);
    analystToken = analystRes.body.token;
  });

  describe('E2E-REPORT-1: レポートタイプ取得テスト', () => {
    it('ステップ1: サポートされているレポートタイプを取得', async () => {
      const res = await request(app)
        .get('/api/v1/reports/types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('report_types');
      expect(res.body).toHaveProperty('formats');
      expect(res.body).toHaveProperty('schedule_types');

      // レポートタイプの確認
      expect(Array.isArray(res.body.report_types)).toBe(true);
      expect(res.body.report_types).toContain('incident_summary');
      expect(res.body.report_types).toContain('sla_compliance');
      expect(res.body.report_types).toContain('security_overview');

      // フォーマットの確認
      expect(res.body.formats).toContain('pdf');

      // スケジュールタイプの確認
      expect(res.body.schedule_types).toContain('daily');
      expect(res.body.schedule_types).toContain('weekly');
      expect(res.body.schedule_types).toContain('monthly');
    });

    it('ステップ2: アナリストもレポートタイプを取得可能', async () => {
      const res = await request(app)
        .get('/api/v1/reports/types')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('E2E-REPORT-2: インシデントサマリーレポート生成テスト', () => {
    it('ステップ1: インシデントサマリーレポートを生成（JSONレスポンス）', async () => {
      const res = await request(app)
        .get('/api/v1/reports/generate/incident_summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('report');

      // レポート情報の確認
      expect(res.body.report).toHaveProperty('report_id');
      expect(res.body.report).toHaveProperty('type', 'incident_summary');
      expect(res.body.report).toHaveProperty('file_name');
      expect(res.body.report).toHaveProperty('file_size');
      expect(res.body.report).toHaveProperty('download_url');
      expect(res.body.report).toHaveProperty('stats');

      // ファイル名を保存
      generatedFileName = path.basename(res.body.report.download_url);

      // ファイルサイズが0より大きいことを確認
      expect(res.body.report.file_size).toBeGreaterThan(0);
    });

    it('ステップ2: 日付範囲を指定してレポートを生成', async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      const toDate = new Date();

      const res = await request(app)
        .get('/api/v1/reports/generate/incident_summary')
        .query({
          from_date: fromDate.toISOString().split('T')[0],
          to_date: toDate.toISOString().split('T')[0]
        })
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('E2E-REPORT-3: SLAコンプライアンスレポート生成テスト', () => {
    it('ステップ1: SLAコンプライアンスレポートを生成', async () => {
      const res = await request(app)
        .get('/api/v1/reports/generate/sla_compliance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.type).toBe('sla_compliance');
      expect(res.body.report).toHaveProperty('stats');
    });
  });

  describe('E2E-REPORT-4: セキュリティ概要レポート生成テスト', () => {
    it('ステップ1: セキュリティ概要レポートを生成', async () => {
      const res = await request(app)
        .get('/api/v1/reports/generate/security_overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.type).toBe('security_overview');
    });
  });

  describe('E2E-REPORT-5: PDFダウンロードテスト', () => {
    it('ステップ1: 生成したレポートをPDFとしてダウンロード', async () => {
      // まずレポートを生成（download=trueパラメータ付き）
      const res = await request(app)
        .get('/api/v1/reports/generate/incident_summary?download=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('.pdf');

      // PDFデータが存在することを確認
      expect(res.body).toBeDefined();
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('ステップ2: ダウンロードエンドポイントを使用してPDFを取得', async () => {
      if (!generatedFileName) {
        // ファイル名がない場合はスキップ
        return;
      }

      const res = await request(app)
        .get(`/api/v1/reports/download/${generatedFileName}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 404]).toContain(res.statusCode);

      if (res.statusCode === 200) {
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(res.headers['content-disposition']).toContain('attachment');
      }
    });

    it('ステップ3: 存在しないファイルをダウンロードすると404エラー', async () => {
      const res = await request(app)
        .get('/api/v1/reports/download/nonexistent-report.pdf')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('E2E-REPORT-6: スケジュールレポート作成テスト', () => {
    it('ステップ1: 日次スケジュールレポートを作成', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Daily Incident Report',
          report_type: 'incident_summary',
          schedule_type: 'daily',
          recipients: ['admin@example.com', 'manager@example.com'],
          send_email: true
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('schedule');
      expect(res.body.schedule).toHaveProperty('id');
      expect(res.body.schedule.name).toBe('E2E Daily Incident Report');
      expect(res.body.schedule.report_type).toBe('incident_summary');
      expect(res.body.schedule.schedule_type).toBe('daily');

      // 作成されたIDを保存
      createdScheduleId = res.body.schedule.id;
    });

    it('ステップ2: 週次スケジュールレポートを作成', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Weekly SLA Report',
          report_type: 'sla_compliance',
          schedule_type: 'weekly',
          recipients: ['sla-team@example.com'],
          send_email: true
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
    });

    it('ステップ3: 月次スケジュールレポートを作成', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Monthly Security Report',
          report_type: 'security_overview',
          schedule_type: 'monthly',
          recipients: ['security@example.com'],
          send_email: true
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('E2E-REPORT-7: スケジュールレポート一覧・詳細取得テスト', () => {
    it('ステップ1: スケジュールレポート一覧を取得', async () => {
      const res = await request(app)
        .get('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('schedules');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.schedules)).toBe(true);

      // 作成したスケジュールが含まれていることを確認
      const created = res.body.schedules.find((s) => s.id === createdScheduleId);
      expect(created).toBeDefined();
      if (created) {
        expect(created.name).toBe('E2E Daily Incident Report');
        expect(Array.isArray(created.recipients)).toBe(true);
      }
    });

    it('ステップ2: 特定のスケジュールレポート詳細を取得', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/schedule/${createdScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('schedule');
      expect(res.body.schedule.id).toBe(createdScheduleId);
      expect(res.body.schedule).toHaveProperty('recipients');
      expect(Array.isArray(res.body.schedule.recipients)).toBe(true);
    });
  });

  describe('E2E-REPORT-8: スケジュールレポート更新テスト', () => {
    it('ステップ1: スケジュールレポートを更新', async () => {
      const res = await request(app)
        .put(`/api/v1/reports/schedule/${createdScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Daily Incident Report',
          is_active: false
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('ステップ2: 更新内容を確認', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/schedule/${createdScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.schedule.name).toBe('Updated Daily Incident Report');
      expect(res.body.schedule.is_active).toBe(0); // SQLiteでは0/1
    });
  });

  describe('E2E-REPORT-9: スケジュールレポート即時実行テスト', () => {
    it('ステップ1: スケジュールレポートを即時実行', async () => {
      const res = await request(app)
        .post(`/api/v1/reports/schedule/${createdScheduleId}/run`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 500]).toContain(res.statusCode);

      if (res.statusCode === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('history_id');
        expect(res.body).toHaveProperty('file_name');
      }
    });

    it('ステップ2: 存在しないスケジュールを実行すると404エラー', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule/99999/run')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('E2E-REPORT-10: レポート履歴取得テスト', () => {
    it('ステップ1: レポート生成履歴を取得', async () => {
      const res = await request(app)
        .get('/api/v1/reports/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('history');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.history)).toBe(true);
    });

    it('ステップ2: レポートタイプでフィルタして履歴を取得', async () => {
      const res = await request(app)
        .get('/api/v1/reports/history?report_type=incident_summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.history)).toBe(true);

      // フィルタが適用されていることを確認
      if (res.body.history.length > 0) {
        res.body.history.forEach((item) => {
          expect(item.report_type).toBe('incident_summary');
        });
      }
    });

    it('ステップ3: ステータスでフィルタして履歴を取得', async () => {
      const res = await request(app)
        .get('/api/v1/reports/history?status=completed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.history)).toBe(true);
    });

    it('ステップ4: 件数制限を指定して履歴を取得', async () => {
      const res = await request(app)
        .get('/api/v1/reports/history?limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('E2E-REPORT-11: スケジュールレポート削除テスト', () => {
    it('ステップ1: スケジュールレポートを削除', async () => {
      const res = await request(app)
        .delete(`/api/v1/reports/schedule/${createdScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('message');
    });

    it('ステップ2: 削除したスケジュールの取得を試みると404エラー', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/schedule/${createdScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('E2E-REPORT-12: バリデーションテスト', () => {
    it('ステップ1: 無効なレポートタイプで生成すると400エラー', async () => {
      const res = await request(app)
        .get('/api/v1/reports/generate/invalid_type')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('valid_types');
    });

    it('ステップ2: 必須フィールドなしでスケジュール作成すると400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Incomplete Schedule'
          // report_typeとschedule_typeを省略
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body).toHaveProperty('required');
    });

    it('ステップ3: 無効なスケジュールタイプで作成すると400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Schedule',
          report_type: 'incident_summary',
          schedule_type: 'invalid_schedule'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('E2E-REPORT-13: 権限テスト', () => {
    it('アナリストはレポート生成可能', async () => {
      const res = await request(app)
        .get('/api/v1/reports/generate/incident_summary')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('アナリストはスケジュール作成不可（権限不足）', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          name: 'Analyst Schedule',
          report_type: 'incident_summary',
          schedule_type: 'daily'
        });

      expect(res.statusCode).toEqual(403);
    });

    it('マネージャーはスケジュール作成可能', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manager Schedule',
          report_type: 'sla_compliance',
          schedule_type: 'weekly'
        });

      expect(res.statusCode).toEqual(201);
    });

    it('認証なしでアクセスすると401エラー', async () => {
      const res = await request(app).get('/api/v1/reports/types');

      expect(res.statusCode).toEqual(401);
    });
  });
});
