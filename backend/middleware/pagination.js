/**
 * Pagination Middleware
 * Phase C-2: ページネーション機能実装
 *
 * 機能:
 * - クエリパラメータ ?page=1&limit=50 をパース
 * - SQL LIMIT/OFFSET生成
 * - ページネーションメタデータ生成
 *
 * 使用例:
 * const { page, limit, offset } = parsePaginationParams(req);
 * const sql = buildPaginationSQL('SELECT * FROM incidents', { limit, offset });
 * const meta = createPaginationMeta(totalCount, page, limit);
 */

/**
 * クエリパラメータからページネーション設定を抽出
 * @param {Object} req - Express request object
 * @returns {Object} { page, limit, offset }
 */
function parsePaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * ベースSQLにLIMIT/OFFSET句を追加
 * @param {string} baseQuery - ベースSQLクエリ
 * @param {Object} params - { limit, offset }
 * @returns {string} LIMIT/OFFSET付きSQL
 */
function buildPaginationSQL(baseQuery, { limit, offset }) {
  return `${baseQuery} LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * ページネーションメタデータを生成
 * @param {number} total - 総件数
 * @param {number} page - 現在のページ
 * @param {number} limit - 1ページあたりの件数
 * @returns {Object} pagination metadata
 */
function createPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page * limit < total,
    hasPrev: page > 1
  };
}

module.exports = {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
};
