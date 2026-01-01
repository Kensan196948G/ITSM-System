/**
 * Excel Formatter
 * JSONデータをExcel（xlsx）形式に変換
 */

const XLSX = require('xlsx');

/**
 * JSONデータをExcel形式に変換
 * @param {Array<Object>} data - 変換対象のJSONデータ
 * @param {Object} options - オプション設定
 * @param {string} options.sheetName - ワークシート名
 * @returns {Buffer} Excelファイルのバッファ
 */
function jsonToExcel(data, options = {}) {
  const { sheetName = 'Sheet1' } = options;

  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  // ワークシートを作成
  const worksheet = XLSX.utils.json_to_sheet(data);

  // ワークブックを作成
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // バッファとして出力
  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true
  });

  return buffer;
}

/**
 * Excelフォーマット用のメタデータを生成
 * @param {string} entityName - エンティティ名
 * @returns {Object} Content-Type と Content-Disposition
 */
function getExcelHeaders(entityName) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `${entityName}_${timestamp}.xlsx`;

  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    contentDisposition: `attachment; filename="${filename}"`
  };
}

module.exports = {
  jsonToExcel,
  getExcelHeaders
};
