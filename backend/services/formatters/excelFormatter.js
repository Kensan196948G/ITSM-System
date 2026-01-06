/**
 * Excel Formatter
 * JSONデータをExcel（xlsx）形式に変換
 *
 * 脆弱性修正: xlsx@0.18.5 → exceljs@4.4.0
 * 修正日: 2026-01-05
 * 理由: xlsxパッケージの高リスク脆弱性（CVSS 7.8/7.5）解消
 */

const ExcelJS = require('exceljs');

/**
 * JSONデータをExcel形式に変換
 * @param {Array<Object>} data - 変換対象のJSONデータ
 * @param {Object} options - オプション設定
 * @param {string} options.sheetName - ワークシート名
 * @returns {Promise<Buffer>} Excelファイルのバッファ
 */
async function jsonToExcel(data, options = {}) {
  const { sheetName = 'Sheet1' } = options;

  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  if (data.length === 0) {
    throw new Error('Data array is empty');
  }

  // ワークブックを作成
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // ヘッダー行を自動生成（最初のデータオブジェクトのキーから）
  const columns = Object.keys(data[0]).map((key) => ({
    header: key,
    key,
    width: 15
  }));
  worksheet.columns = columns;

  // データ行を追加
  data.forEach((row) => {
    worksheet.addRow(row);
  });

  // ヘッダー行のスタイル設定
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // バッファとして出力
  const buffer = await workbook.xlsx.writeBuffer({
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
