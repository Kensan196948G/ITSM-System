/**
 * Reports Routes - Integration Tests
 *
 * テスト対象: backend/routes/reports.js (Branch 0% → 60%+)
 *
 * テスト構成:
 * - GET  /api/v1/reports/types        - レポートタイプ一覧
 * - GET  /api/v1/reports/generate/:type - レポート生成
 * - GET  /api/v1/reports/download/:filename - ダウンロード
 * - GET  /api/v1/reports/schedule     - スケジュール一覧
 * - POST /api/v1/reports/schedule     - スケジュール作成
 * - GET  /api/v1/reports/schedule/:id - スケジュール詳細
 * - PUT  /api/v1/reports/schedule/:id - スケジュール更新
 * - DELETE /api/v1/reports/schedule/:id - スケジュール削除
 * - POST /api/v1/reports/schedule/:id/run - スケジュール即時実行
 * - GET  /api/v1/reports/history      - 生成履歴
 * - POST /api/v1/reports/cleanup      - 古いレポート削除
 * - GET  /api/v1/reports/schedules    - スケジュール一覧（エイリアス）
 *
 * 注意: pdfReportService（PDFKit使用）とschedulerService（cron使用）をモック
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app, dbReady } = require('../../server');
const knex = require('../../knex');

// テスト用レポート保存ディレクトリ
const TEST_REPORTS_DIR = path.join('/tmp', 'test-itsm-reports');

// ============================================================
// 外部サービスのモック
// ============================================================

jest.mock('../../services/pdfReportService', () => ({
  generateReport: jest.fn(),
  getSupportedReportTypes: jest.fn(),
  REPORTS_DIR: '/tmp/test-itsm-reports'
}));

jest.mock('../../services/schedulerService', () => ({
  createScheduledReport: jest.fn(),
  updateScheduledReport: jest.fn(),
  deleteScheduledReport: jest.fn(),
  executeScheduledReport: jest.fn(),
  getReportHistory: jest.fn(),
  cleanupOldReports: jest.fn(),
  // 他のエクスポートもモック（initializeScheduler等がserver.jsで使われる可能性がある）
  initializeScheduler: jest.fn(),
  stopScheduler: jest.fn(),
  registerScheduledReportJob: jest.fn(),
  unregisterScheduledReportJob: jest.fn(),
  loadScheduledReports: jest.fn(),
  calculateNextRunAt: jest.fn(),
  triggerReportNow: jest.fn()
}));

const pdfReportService = require('../../services/pdfReportService');
const schedulerService = require('../../services/schedulerService');

// ============================================================
// テストスイート
// ============================================================

describe('Reports Routes (reports.js)', () => {
  let adminToken;
  let managerToken;
  let analystToken;
  let viewerToken;

  // ----------------------------------------------------------
  // セットアップ
  // ----------------------------------------------------------

  beforeAll(async () => {
    await dbReady;

    // テスト用ディレクトリを作成
    if (!fs.existsSync(TEST_REPORTS_DIR)) {
      fs.mkdirSync(TEST_REPORTS_DIR, { recursive: true });
    }

    // テスト用PDFファイルを作成
    fs.writeFileSync(path.join(TEST_REPORTS_DIR, 'test-download.pdf'), '%PDF-1.4 test content');

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
    // テストデータのクリーンアップ
    await knex('report_history')
      .whereIn('report_type', ['incident_summary', 'sla_compliance', 'security_overview'])
      .where('status', 'completed')
      .delete()
      .catch(() => {});
    await knex('scheduled_reports')
      .where('name', 'like', 'TEST-REPORTS-%')
      .delete()
      .catch(() => {});

    // テストファイルのクリーンアップ
    try {
      if (fs.existsSync(TEST_REPORTS_DIR)) {
        const files = fs.readdirSync(TEST_REPORTS_DIR);
        files.forEach((f) => fs.unlinkSync(path.join(TEST_REPORTS_DIR, f)));
        fs.rmdirSync(TEST_REPORTS_DIR);
      }
    } catch (_) {
      // 無視
    }

    await knex.destroy();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトモック実装
    pdfReportService.getSupportedReportTypes.mockReturnValue([
      { type: 'incident_summary', name: 'インシデントサマリー' },
      { type: 'sla_compliance', name: 'SLA コンプライアンス' },
      { type: 'security_overview', name: 'セキュリティ概要' }
    ]);

    pdfReportService.generateReport.mockResolvedValue({
      reportId: `RPT-${Date.now()}`,
      filePath: path.join(TEST_REPORTS_DIR, 'test-report.pdf'),
      fileName: 'test-report.pdf',
      fileSize: 1024,
      stats: { total_incidents: 10 }
    });

    schedulerService.createScheduledReport.mockResolvedValue({
      id: 1,
      name: 'TEST-REPORTS-Schedule',
      report_type: 'incident_summary',
      schedule_type: 'daily',
      recipients: '[]',
      is_active: true
    });

    schedulerService.updateScheduledReport.mockResolvedValue({
      id: 1,
      name: 'Updated Schedule',
      report_type: 'incident_summary',
      schedule_type: 'daily',
      recipients: '[]'
    });

    schedulerService.deleteScheduledReport.mockResolvedValue(true);

    schedulerService.executeScheduledReport.mockResolvedValue({
      success: true,
      historyId: `HIS-${Date.now()}`,
      result: { fileName: 'test-report.pdf' }
    });

    schedulerService.getReportHistory.mockResolvedValue([
      { id: 1, report_type: 'incident_summary', status: 'completed' }
    ]);

    schedulerService.cleanupOldReports.mockReturnValue(5);
  });

  // ============================================================
  // GET /api/v1/reports/types
  // ============================================================

  describe('GET /api/v1/reports/types', () => {
    it('admin がレポートタイプ一覧を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/reports/types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.report_types).toBeDefined();
      expect(res.body.formats).toEqual(['pdf']);
      expect(res.body.schedule_types).toContain('daily');
      expect(pdfReportService.getSupportedReportTypes).toHaveBeenCalled();
    });

    it('analyst もレポートタイプ一覧を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/reports/types')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
    });

    it('認証なしで 401 を返す', async () => {
      const res = await request(app).get('/api/v1/reports/types');
      expect(res.status).toBe(401);
    });

    it('viewer ロールは 403 を返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/types')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // GET /api/v1/reports/generate/:type
  // ============================================================

  describe('GET /api/v1/reports/generate/:type', () => {
    it('無効なレポートタイプで 400 を返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/generate/invalid_type')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('無効なレポートタイプです');
      expect(res.body.valid_types).toBeDefined();
    });

    it('有効なレポートタイプで JSON レスポンスを返す', async () => {
      // テスト用ファイルを作成
      fs.writeFileSync(path.join(TEST_REPORTS_DIR, 'test-report.pdf'), '%PDF-1.4 content');

      const res = await request(app)
        .get('/api/v1/reports/generate/incident_summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.type).toBe('incident_summary');
      expect(res.body.report.file_name).toBeDefined();
    });

    it('sla_compliance タイプのレポートを生成できる', async () => {
      fs.writeFileSync(path.join(TEST_REPORTS_DIR, 'test-report.pdf'), '%PDF-1.4 content');

      const res = await request(app)
        .get('/api/v1/reports/generate/sla_compliance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.report.type).toBe('sla_compliance');
    });

    it('download=true の場合に PDF ストリームを返す', async () => {
      fs.writeFileSync(path.join(TEST_REPORTS_DIR, 'test-report.pdf'), '%PDF-1.4 download content');

      const res = await request(app)
        .get('/api/v1/reports/generate/incident_summary?download=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('レポート生成エラー時に 500 を返す', async () => {
      pdfReportService.generateReport.mockRejectedValue(new Error('PDF generation failed'));

      const res = await request(app)
        .get('/api/v1/reports/generate/incident_summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    it('from_date/to_date クエリパラメータを渡せる', async () => {
      fs.writeFileSync(path.join(TEST_REPORTS_DIR, 'test-report.pdf'), '%PDF-1.4 content');

      const res = await request(app)
        .get('/api/v1/reports/generate/security_overview?from_date=2026-01-01&to_date=2026-01-31')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(pdfReportService.generateReport).toHaveBeenCalledWith(
        expect.anything(),
        'security_overview',
        expect.objectContaining({ fromDate: '2026-01-01', toDate: '2026-01-31' })
      );
    });
  });

  // ============================================================
  // GET /api/v1/reports/download/:filename
  // ============================================================

  describe('GET /api/v1/reports/download/:filename', () => {
    it('存在しないファイルで 404 を返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/download/nonexistent-9999.pdf')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ファイルが見つかりません');
    });

    it('存在するファイルを PDF ストリームで返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/download/test-download.pdf')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('パストラバーサル試行時はファイル名のみで処理する', async () => {
      // path.basename で安全に処理されるため、../../etc/passwd → etc/passwd となり 404
      const res = await request(app)
        .get('/api/v1/reports/download/..%2F..%2Fetc%2Fpasswd')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // GET /api/v1/reports/schedule
  // ============================================================

  describe('GET /api/v1/reports/schedule', () => {
    it('admin がスケジュール一覧を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.schedules).toBeDefined();
      expect(typeof res.body.total).toBe('number');
    });

    it('manager もスケジュール一覧を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });

    it('analyst ロールは 403 を返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // POST /api/v1/reports/schedule
  // ============================================================

  describe('POST /api/v1/reports/schedule', () => {
    it('必須フィールド不足で 400 を返す', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' }); // report_type と schedule_type が不足

      expect(res.status).toBe(400);
      expect(res.body.required).toEqual(
        expect.arrayContaining(['name', 'report_type', 'schedule_type'])
      );
    });

    it('name のみ不足で 400 を返す', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ report_type: 'incident_summary', schedule_type: 'daily' });

      expect(res.status).toBe(400);
    });

    it('無効な report_type で 400 を返す', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', report_type: 'invalid_type', schedule_type: 'daily' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('無効なレポートタイプです');
    });

    it('無効な schedule_type で 400 を返す', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', report_type: 'incident_summary', schedule_type: 'hourly' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('無効なスケジュールタイプです');
    });

    it('有効なデータでスケジュールを作成できる', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TEST-REPORTS-Daily',
          report_type: 'incident_summary',
          schedule_type: 'daily',
          recipients: ['test@example.com'],
          send_email: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.schedule).toBeDefined();
    });

    it('週次スケジュールも作成できる', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TEST-REPORTS-Weekly',
          report_type: 'sla_compliance',
          schedule_type: 'weekly'
        });

      expect(res.status).toBe(201);
    });

    it('サービスエラー時に 500 を返す', async () => {
      schedulerService.createScheduledReport.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .post('/api/v1/reports/schedule')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', report_type: 'incident_summary', schedule_type: 'daily' });

      expect(res.status).toBe(500);
    });
  });

  // ============================================================
  // GET /api/v1/reports/schedule/:id
  // ============================================================

  describe('GET /api/v1/reports/schedule/:id', () => {
    let testScheduleId;

    beforeEach(async () => {
      const result = await knex('scheduled_reports').insert({
        report_id: `TEST-RPT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: 'TEST-REPORTS-GetById',
        report_type: 'incident_summary',
        schedule_type: 'daily',
        is_active: true,
        created_by: 1
      });
      [testScheduleId] = result;
    });

    afterEach(async () => {
      await knex('scheduled_reports')
        .where('id', testScheduleId)
        .delete()
        .catch(() => {});
    });

    it('存在しない ID で 404 を返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/schedule/99999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('スケジュールが見つかりません');
    });

    it('存在する ID でスケジュールを返す', async () => {
      const res = await request(app)
        .get(`/api/v1/reports/schedule/${testScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.schedule).toBeDefined();
      expect(res.body.schedule.id).toBe(testScheduleId);
    });

    it('recipients と filters が JSON パースされる', async () => {
      // recipients と filters を持つレコードを追加で作成
      await knex('scheduled_reports')
        .where('id', testScheduleId)
        .update({
          recipients: JSON.stringify(['a@example.com', 'b@example.com']),
          filters: JSON.stringify({ status: 'open' })
        });

      const res = await request(app)
        .get(`/api/v1/reports/schedule/${testScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.schedule.recipients)).toBe(true);
      expect(res.body.schedule.filters).toEqual({ status: 'open' });
    });
  });

  // ============================================================
  // PUT /api/v1/reports/schedule/:id
  // ============================================================

  describe('PUT /api/v1/reports/schedule/:id', () => {
    let testScheduleId;

    beforeEach(async () => {
      const result = await knex('scheduled_reports').insert({
        report_id: `TEST-RPT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: 'TEST-REPORTS-Update',
        report_type: 'incident_summary',
        schedule_type: 'daily',
        is_active: true,
        created_by: 1
      });
      [testScheduleId] = result;
    });

    afterEach(async () => {
      await knex('scheduled_reports')
        .where('id', testScheduleId)
        .delete()
        .catch(() => {});
    });

    it('存在しない ID で 404 を返す', async () => {
      const res = await request(app)
        .put('/api/v1/reports/schedule/99999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('存在する ID でスケジュールを更新できる', async () => {
      schedulerService.updateScheduledReport.mockResolvedValue({
        id: testScheduleId,
        name: 'Updated Name',
        report_type: 'incident_summary',
        schedule_type: 'daily',
        recipients: '["test@example.com"]'
      });

      const res = await request(app)
        .put(`/api/v1/reports/schedule/${testScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ============================================================
  // DELETE /api/v1/reports/schedule/:id
  // ============================================================

  describe('DELETE /api/v1/reports/schedule/:id', () => {
    let testScheduleId;

    beforeEach(async () => {
      const result = await knex('scheduled_reports').insert({
        report_id: `TEST-RPT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: 'TEST-REPORTS-Delete',
        report_type: 'sla_compliance',
        schedule_type: 'weekly',
        is_active: true,
        created_by: 1
      });
      [testScheduleId] = result;
    });

    afterEach(async () => {
      // deleteScheduledReport はモックなので実際には削除されない
      await knex('scheduled_reports')
        .where('id', testScheduleId)
        .delete()
        .catch(() => {});
    });

    it('存在しない ID で 404 を返す', async () => {
      const res = await request(app)
        .delete('/api/v1/reports/schedule/99999999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('存在する ID でスケジュールを削除できる', async () => {
      const res = await request(app)
        .delete(`/api/v1/reports/schedule/${testScheduleId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBeDefined();
    });
  });

  // ============================================================
  // POST /api/v1/reports/schedule/:id/run
  // ============================================================

  describe('POST /api/v1/reports/schedule/:id/run', () => {
    let testScheduleId;

    beforeEach(async () => {
      const result = await knex('scheduled_reports').insert({
        report_id: `TEST-RPT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: 'TEST-REPORTS-Run',
        report_type: 'security_overview',
        schedule_type: 'monthly',
        is_active: true,
        created_by: 1
      });
      [testScheduleId] = result;
    });

    afterEach(async () => {
      await knex('scheduled_reports')
        .where('id', testScheduleId)
        .delete()
        .catch(() => {});
    });

    it('存在しない ID で 404 を返す', async () => {
      const res = await request(app)
        .post('/api/v1/reports/schedule/99999999/run')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('成功時に 200 を返す', async () => {
      const res = await request(app)
        .post(`/api/v1/reports/schedule/${testScheduleId}/run`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.history_id).toBeDefined();
    });

    it('レポート生成失敗時に 500 を返す', async () => {
      schedulerService.executeScheduledReport.mockResolvedValue({
        success: false,
        error: 'Report generation failed',
        historyId: `HIS-FAIL-${Date.now()}`
      });

      const res = await request(app)
        .post(`/api/v1/reports/schedule/${testScheduleId}/run`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Report generation failed');
    });
  });

  // ============================================================
  // GET /api/v1/reports/history
  // ============================================================

  describe('GET /api/v1/reports/history', () => {
    it('履歴一覧を返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toBeDefined();
      expect(typeof res.body.total).toBe('number');
    });

    it('クエリパラメータなしの場合デフォルト limit=50 で呼ばれる', async () => {
      await request(app)
        .get('/api/v1/reports/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(schedulerService.getReportHistory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 50 })
      );
    });

    it('limit パラメータが渡される', async () => {
      const res = await request(app)
        .get('/api/v1/reports/history?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(schedulerService.getReportHistory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 10 })
      );
    });

    it('report_type と status フィルタが渡される', async () => {
      await request(app)
        .get('/api/v1/reports/history?report_type=incident_summary&status=completed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(schedulerService.getReportHistory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          reportType: 'incident_summary',
          status: 'completed'
        })
      );
    });

    it('サービスエラー時に 500 を返す', async () => {
      schedulerService.getReportHistory.mockRejectedValue(new Error('DB error'));

      const res = await request(app)
        .get('/api/v1/reports/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
    });

    it('analyst もアクセス可能', async () => {
      const res = await request(app)
        .get('/api/v1/reports/history')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // POST /api/v1/reports/cleanup
  // ============================================================

  describe('POST /api/v1/reports/cleanup', () => {
    it('admin が古いレポートを削除できる', async () => {
      const res = await request(app)
        .post('/api/v1/reports/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deleted_count).toBe(5);
      expect(schedulerService.cleanupOldReports).toHaveBeenCalledWith(30);
    });

    it('days_to_keep パラメータを渡せる', async () => {
      const res = await request(app)
        .post('/api/v1/reports/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ days_to_keep: 7 });

      expect(res.status).toBe(200);
      expect(schedulerService.cleanupOldReports).toHaveBeenCalledWith(7);
    });

    it('manager ロールは 403 を返す', async () => {
      const res = await request(app)
        .post('/api/v1/reports/cleanup')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
    });

    it('サービスエラー時に 500 を返す', async () => {
      schedulerService.cleanupOldReports.mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      const res = await request(app)
        .post('/api/v1/reports/cleanup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(500);
    });
  });

  // ============================================================
  // GET /api/v1/reports/schedules (エイリアス)
  // ============================================================

  describe('GET /api/v1/reports/schedules', () => {
    it('スケジュール一覧を返す（/schedule エイリアス）', async () => {
      const res = await request(app)
        .get('/api/v1/reports/schedules')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.schedules).toBeDefined();
    });

    it('analyst ロールは 403 を返す', async () => {
      const res = await request(app)
        .get('/api/v1/reports/schedules')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });
  });
});
