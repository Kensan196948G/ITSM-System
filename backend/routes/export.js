/**
 * Export Routes
 * データエクスポート用APIエンドポイント
 */

const express = require('express');
const logger = require('../utils/logger');

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
 * @swagger
 * /export/entities:
 *   get:
 *     summary: エクスポート可能なエンティティ一覧
 *     description: システムからエクスポート可能なデータの種類（エンティティ）とサポートされるフォーマットを取得します。
 *     tags: [Data Export]
 *     responses:
 *       200:
 *         description: エンティティ一覧
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
 * @swagger
 * /export/{entity}:
 *   get:
 *     summary: データのデータエクスポート
 *     description: 指定されたエンティティのデータを指定されたフォーマットでエクスポート（ダウンロード）します。
 *     tags: [Data Export]
 *     parameters:
 *       - in: path
 *         name: entity
 *         required: true
 *         schema:
 *           type: string
 *         description: エクスポートするエンティティ名 (incidents, assets, etc.)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, xlsx, json]
 *           default: csv
 *         description: ファイルフォーマット
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 開始日 (YYYY-MM-DD)
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 終了日 (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: ファイルデータ
 *       400:
 *         description: 無効なエンティティまたはフォーマット
 *       404:
 *         description: データが見つかりません
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

      logger.info(`[Export] Exporting ${entity} (format: ${format}, filters:`, filters, ')');

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
        const buffer = await jsonToExcel(cleanData, { sheetName });
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
      logger.error('[Export] Error:', error);
      return res.status(500).json({
        error: 'エクスポート中にエラーが発生しました',
        message: error.message
      });
    }
  }
);

module.exports = router;
