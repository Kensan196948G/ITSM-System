/**
 * Export Routes
 * データエクスポート用APIエンドポイント
 */

const express = require('express');

const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');
const {
  exportEntityData,
  isValidEntity,
  getExportableEntities,
  excludeSensitiveData,
  EXPORTABLE_ENTITIES
} = require('../services/exportService');
const { jsonToCsv, getCsvHeaders } = require('../services/formatters/csvFormatter');
const { formatJson, getJsonHeaders } = require('../services/formatters/jsonFormatter');
const { jsonToExcel, getExcelHeaders } = require('../services/formatters/excelFormatter');

/**
 * エクスポート可能なエンティティ一覧を取得
 * GET /api/v1/export/entities
 */
router.get('/entities', authenticateJWT, authorize(['admin', 'manager', 'analyst']), (req, res) => {
  const entities = getExportableEntities();
  res.json({
    entities,
    formats: ['csv', 'xlsx', 'json'],
    message: 'エクスポート可能なエンティティとフォーマットの一覧'
  });
});

/**
 * エンティティデータをエクスポート
 * GET /api/v1/export/:entity
 *
 * Query Parameters:
 *   - format: csv | xlsx | json (default: csv)
 *   - from_date: YYYY-MM-DD (optional)
 *   - to_date: YYYY-MM-DD (optional)
 *   - status: フィルタ条件（オプション）
 *   - priority: フィルタ条件（オプション）
 *   - severity: フィルタ条件（オプション）
 *   - user_id: フィルタ条件（オプション）
 */
router.get(
  '/:entity',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  async (req, res) => {
    const { entity } = req.params;
    const { format = 'csv', from_date, to_date, ...otherFilters } = req.query;

    // エンティティの検証
    if (!isValidEntity(entity)) {
      return res.status(400).json({
        error: '無効なエンティティです',
        available_entities: getExportableEntities()
      });
    }

    // フォーマットの検証
    const supportedFormats = ['csv', 'xlsx', 'excel', 'json'];
    if (!supportedFormats.includes(format.toLowerCase())) {
      return res.status(400).json({
        error: 'サポートされていないフォーマットです',
        supported_formats: ['csv', 'xlsx', 'json']
      });
    }

    try {
      // データ取得
      const filters = {
        from_date,
        to_date,
        ...otherFilters
      };

      console.log(`[Export] Exporting ${entity} (format: ${format}, filters:`, filters, ')');

      const data = await exportEntityData(entity, filters);

      // センシティブ情報の除外
      const config = EXPORTABLE_ENTITIES[entity];
      const cleanData =
        config.sensitiveColumns && config.sensitiveColumns.length > 0
          ? excludeSensitiveData(data, config.sensitiveColumns)
          : data;

      // データが空の場合
      if (cleanData.length === 0) {
        return res.status(404).json({
          error: 'エクスポート対象のデータが見つかりません',
          filters
        });
      }

      // フォーマット別処理
      const formatLower = format.toLowerCase();

      if (formatLower === 'csv') {
        const csv = jsonToCsv(cleanData, { includeBOM: true });
        const headers = getCsvHeaders(entity);

        res.setHeader('Content-Type', headers.contentType);
        res.setHeader('Content-Disposition', headers.contentDisposition);
        return res.send(csv);
      }

      if (formatLower === 'xlsx' || formatLower === 'excel') {
        const sheetName = entity.charAt(0).toUpperCase() + entity.slice(1);
        const buffer = jsonToExcel(cleanData, { sheetName });
        const headers = getExcelHeaders(entity);

        res.setHeader('Content-Type', headers.contentType);
        res.setHeader('Content-Disposition', headers.contentDisposition);
        return res.send(buffer);
      }

      if (formatLower === 'json') {
        const jsonData = formatJson(cleanData, { indent: 2 });
        const headers = getJsonHeaders(entity);

        res.setHeader('Content-Type', headers.contentType);
        res.setHeader('Content-Disposition', headers.contentDisposition);
        return res.send(jsonData);
      }

      // 念のため（通常ここには到達しない）
      return res.status(400).json({ error: 'サポートされていないフォーマットです' });
    } catch (error) {
      console.error('[Export] Error:', error);
      return res.status(500).json({
        error: 'エクスポート中にエラーが発生しました',
        message: error.message
      });
    }
  }
);

module.exports = router;
