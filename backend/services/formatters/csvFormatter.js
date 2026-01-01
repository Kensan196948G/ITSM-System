/**
 * CSV Formatter
 * JSONデータをCSV形式に変換
 */

/**
 * JSONデータをCSV形式に変換
 * @param {Array<Object>} data - 変換対象のJSONデータ
 * @param {Object} options - オプション設定
 * @param {boolean} options.includeBOM - UTF-8 BOMを含める（Excel互換性のため）
 * @returns {string} CSV形式の文字列
 */
function jsonToCsv(data, options = {}) {
  const { includeBOM = true } = options;

  if (!Array.isArray(data)) {
    throw new Error('Data must be an array');
  }

  if (data.length === 0) {
    return includeBOM ? '\uFEFF' : ''; // 空データの場合はBOMのみ
  }

  // ヘッダー行の生成
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  // データ行の生成
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];

      // null/undefined を空文字列に変換
      if (value === null || value === undefined) {
        return '""';
      }

      // オブジェクトや配列はJSON文字列化
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }

      // 文字列のエスケープ処理
      const stringValue = String(value);
      // カンマ、改行、ダブルクォートを含む場合はクォートで囲む
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });

    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');

  // UTF-8 BOM を付加（Excelで文字化けしないように）
  return includeBOM ? `\uFEFF${csvContent}` : csvContent;
}

/**
 * CSVフォーマット用のメタデータを生成
 * @param {string} entityName - エンティティ名
 * @returns {Object} Content-Type と Content-Disposition
 */
function getCsvHeaders(entityName) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `${entityName}_${timestamp}.csv`;

  return {
    contentType: 'text/csv; charset=utf-8',
    contentDisposition: `attachment; filename="${filename}"`
  };
}

module.exports = {
  jsonToCsv,
  getCsvHeaders
};
