/**
 * Reports Routes
 * レポート生成・スケジュール管理APIエンドポイント
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');
const knex = require('../knex');
const {
  generateReport,
  getSupportedReportTypes,
  REPORTS_DIR
} = require('../services/pdfReportService');
const {
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  executeScheduledReport,
  getReportHistory,
  cleanupOldReports
} = require('../services/schedulerService');

/**
 * @swagger
 * /reports/types:
 *   get:
 *     summary: サポートされているレポートタイプを取得
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: レポートタイプ一覧
 */
router.get('/types', authenticateJWT, authorize(['admin', 'manager', 'analyst']), (req, res) => {
  const types = getSupportedReportTypes();
  res.json({
    report_types: types,
    formats: ['pdf'],
    schedule_types: ['daily', 'weekly', 'monthly']
  });
});

/**
 * @swagger
 * /reports/generate/{type}:
 *   get:
 *     summary: レポートを生成
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [incident_summary, sla_compliance, security_overview]
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: download
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: 生成されたレポート
 */
router.get(
  '/generate/:type',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  async (req, res) => {
    const { type } = req.params;
    const { from_date, to_date, download } = req.query;

    // タイプ検証
    const validTypes = ['incident_summary', 'sla_compliance', 'security_overview'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: '無効なレポートタイプです',
        valid_types: validTypes
      });
    }

    try {
      console.log(`[Reports] Generating ${type} report (from: ${from_date}, to: ${to_date})`);

      // レポート生成
      const result = await generateReport(knex, type, {
        fromDate: from_date,
        toDate: to_date
      });

      // 履歴に記録
      await knex('report_history').insert({
        history_id: `HIS-${Date.now()}`,
        report_type: type,
        report_name: `${type} report`,
        format: 'pdf',
        file_path: result.filePath,
        file_size: result.fileSize,
        status: 'completed',
        parameters: JSON.stringify({ from_date, to_date }),
        generated_by: req.user.id,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      });

      // ダウンロード
      if (download === 'true') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
        const fileStream = fs.createReadStream(result.filePath);
        return fileStream.pipe(res);
      }

      // JSONレスポンス
      return res.json({
        success: true,
        report: {
          report_id: result.reportId,
          type,
          file_name: result.fileName,
          file_size: result.fileSize,
          download_url: `/api/v1/reports/download/${path.basename(result.filePath)}`,
          stats: result.stats
        }
      });
    } catch (error) {
      console.error('[Reports] Generation error:', error);
      return res.status(500).json({
        error: 'レポート生成中にエラーが発生しました',
        message: error.message
      });
    }
  }
);

/**
 * @swagger
 * /reports/download/{filename}:
 *   get:
 *     summary: レポートファイルをダウンロード
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDFファイル
 */
router.get(
  '/download/:filename',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const { filename } = req.params;

    // セキュリティ: パストラバーサル防止
    const safeName = path.basename(filename);
    const filePath = path.join(REPORTS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    const fileStream = fs.createReadStream(filePath);
    return fileStream.pipe(res);
  }
);

/**
 * @swagger
 * /reports/schedule:
 *   get:
 *     summary: スケジュールレポート一覧を取得
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: スケジュール一覧
 */
router.get(
  '/schedule',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const schedules = await knex('scheduled_reports')
        .select('scheduled_reports.*', 'users.username as created_by_name')
        .leftJoin('users', 'scheduled_reports.created_by', 'users.id')
        .orderBy('created_at', 'desc');

      // recipientsをパース
      const parsedSchedules = schedules.map((s) => ({
        ...s,
        recipients: s.recipients ? JSON.parse(s.recipients) : [],
        filters: s.filters ? JSON.parse(s.filters) : null
      }));

      res.json({
        schedules: parsedSchedules,
        total: parsedSchedules.length
      });
    } catch (error) {
      console.error('[Reports] Schedule list error:', error);
      res.status(500).json({ error: 'スケジュール取得中にエラーが発生しました' });
    }
  }
);

/**
 * @swagger
 * /reports/schedule:
 *   post:
 *     summary: スケジュールレポートを作成
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - report_type
 *               - schedule_type
 *             properties:
 *               name:
 *                 type: string
 *               report_type:
 *                 type: string
 *                 enum: [incident_summary, sla_compliance, security_overview]
 *               schedule_type:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               send_email:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 作成されたスケジュール
 */
router.post(
  '/schedule',
  authenticateJWT,
  authorize(['admin', 'manager']),
  auditLog,
  async (req, res) => {
    const { name, report_type, schedule_type, recipients, send_email, cron_expression, filters } =
      req.body;

    // バリデーション
    if (!name || !report_type || !schedule_type) {
      return res.status(400).json({
        error: '必須フィールドが不足しています',
        required: ['name', 'report_type', 'schedule_type']
      });
    }

    const validTypes = ['incident_summary', 'sla_compliance', 'security_overview'];
    if (!validTypes.includes(report_type)) {
      return res.status(400).json({
        error: '無効なレポートタイプです',
        valid_types: validTypes
      });
    }

    const validSchedules = ['daily', 'weekly', 'monthly'];
    if (!validSchedules.includes(schedule_type)) {
      return res.status(400).json({
        error: '無効なスケジュールタイプです',
        valid_schedules: validSchedules
      });
    }

    try {
      const schedule = await createScheduledReport(knex, {
        name,
        report_type,
        schedule_type,
        recipients: recipients || [],
        send_email: send_email !== false,
        cron_expression,
        filters,
        created_by: req.user.id
      });

      res.status(201).json({
        success: true,
        schedule: {
          ...schedule,
          recipients: schedule.recipients ? JSON.parse(schedule.recipients) : []
        }
      });
    } catch (error) {
      console.error('[Reports] Schedule creation error:', error);
      res.status(500).json({ error: 'スケジュール作成中にエラーが発生しました' });
    }
  }
);

/**
 * @swagger
 * /reports/schedule/{id}:
 *   get:
 *     summary: スケジュールレポート詳細を取得
 *     tags: [Reports]
 */
router.get(
  '/schedule/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    const { id } = req.params;

    try {
      const schedule = await knex('scheduled_reports').where('id', id).first();

      if (!schedule) {
        return res.status(404).json({ error: 'スケジュールが見つかりません' });
      }

      res.json({
        schedule: {
          ...schedule,
          recipients: schedule.recipients ? JSON.parse(schedule.recipients) : [],
          filters: schedule.filters ? JSON.parse(schedule.filters) : null
        }
      });
    } catch (error) {
      console.error('[Reports] Schedule get error:', error);
      res.status(500).json({ error: 'スケジュール取得中にエラーが発生しました' });
    }
  }
);

/**
 * @swagger
 * /reports/schedule/{id}:
 *   put:
 *     summary: スケジュールレポートを更新
 *     tags: [Reports]
 */
router.put(
  '/schedule/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  auditLog,
  async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
      const existing = await knex('scheduled_reports').where('id', id).first();
      if (!existing) {
        return res.status(404).json({ error: 'スケジュールが見つかりません' });
      }

      const schedule = await updateScheduledReport(knex, id, updateData);

      res.json({
        success: true,
        schedule: {
          ...schedule,
          recipients: schedule.recipients ? JSON.parse(schedule.recipients) : []
        }
      });
    } catch (error) {
      console.error('[Reports] Schedule update error:', error);
      res.status(500).json({ error: 'スケジュール更新中にエラーが発生しました' });
    }
  }
);

/**
 * @swagger
 * /reports/schedule/{id}:
 *   delete:
 *     summary: スケジュールレポートを削除
 *     tags: [Reports]
 */
router.delete(
  '/schedule/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  auditLog,
  async (req, res) => {
    const { id } = req.params;

    try {
      const existing = await knex('scheduled_reports').where('id', id).first();
      if (!existing) {
        return res.status(404).json({ error: 'スケジュールが見つかりません' });
      }

      await deleteScheduledReport(knex, id);

      res.json({ success: true, message: 'スケジュールを削除しました' });
    } catch (error) {
      console.error('[Reports] Schedule delete error:', error);
      res.status(500).json({ error: 'スケジュール削除中にエラーが発生しました' });
    }
  }
);

/**
 * @swagger
 * /reports/schedule/{id}/run:
 *   post:
 *     summary: スケジュールレポートを即時実行
 *     tags: [Reports]
 */
router.post(
  '/schedule/:id/run',
  authenticateJWT,
  authorize(['admin', 'manager']),
  auditLog,
  async (req, res) => {
    const { id } = req.params;

    try {
      const schedule = await knex('scheduled_reports').where('id', id).first();
      if (!schedule) {
        return res.status(404).json({ error: 'スケジュールが見つかりません' });
      }

      const result = await executeScheduledReport(knex, schedule);

      if (result.success) {
        res.json({
          success: true,
          message: 'レポートを生成しました',
          history_id: result.historyId,
          file_name: result.result.fileName
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          history_id: result.historyId
        });
      }
    } catch (error) {
      console.error('[Reports] Schedule run error:', error);
      res.status(500).json({ error: 'レポート生成中にエラーが発生しました' });
    }
  }
);

/**
 * @swagger
 * /reports/history:
 *   get:
 *     summary: レポート生成履歴を取得
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: report_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 履歴一覧
 */
router.get(
  '/history',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  async (req, res) => {
    const { report_type, status, limit } = req.query;

    try {
      const history = await getReportHistory(knex, {
        reportType: report_type,
        status,
        limit: limit ? parseInt(limit, 10) : 50
      });

      res.json({
        history,
        total: history.length
      });
    } catch (error) {
      console.error('[Reports] History error:', error);
      res.status(500).json({ error: '履歴取得中にエラーが発生しました' });
    }
  }
);

/**
 * @swagger
 * /reports/cleanup:
 *   post:
 *     summary: 古いレポートファイルを削除
 *     tags: [Reports]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days_to_keep:
 *                 type: integer
 *                 default: 30
 */
router.post(
  '/cleanup',
  authenticateJWT,
  authorize(['admin']),
  auditLog,
  async (req, res) => {
    const { days_to_keep = 30 } = req.body;

    try {
      const deletedCount = cleanupOldReports(days_to_keep);

      res.json({
        success: true,
        message: `${deletedCount}件の古いレポートを削除しました`,
        deleted_count: deletedCount
      });
    } catch (error) {
      console.error('[Reports] Cleanup error:', error);
      res.status(500).json({ error: 'クリーンアップ中にエラーが発生しました' });
    }
  }
);

module.exports = router;
