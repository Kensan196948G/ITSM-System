/**
 * JSON Formatter
 * データを整形済みJSON形式で出力
 */

/**
 * データを整形済みJSON形式に変換
 * @param {Array<Object>|Object} data - 変換対象のデータ
 * @param {Object} options - オプション設定
 * @param {number} options.indent - インデントスペース数
 * @returns {string} 整形済みJSON文字列
 */
function formatJson(data, options = {}) {
  const { indent = 2 } = options;

  return JSON.stringify(data, null, indent);
}

/**
 * JSONフォーマット用のメタデータを生成
 * @param {string} entityName - エンティティ名
 * @returns {Object} Content-Type と Content-Disposition
 */
function getJsonHeaders(entityName) {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `${entityName}_${timestamp}.json`;

  return {
    contentType: 'application/json; charset=utf-8',
    contentDisposition: `attachment; filename="${filename}"`
  };
}

module.exports = {
  formatJson,
  getJsonHeaders
};
