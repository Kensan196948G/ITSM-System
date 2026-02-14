/**
 * Cache Middleware
 * Phase C-3: node-cache を使用したインメモリキャッシュ
 *
 * 機能:
 * - GET リクエストのレスポンスキャッシュ
 * - CUD 操作時のキャッシュ無効化
 * - TTL ベースの自動期限切れ
 * - 環境変数でのON/OFF切り替え
 * - キャッシュ統計監視
 */

const NodeCache = require('node-cache');
const logger = require('../utils/logger');
const {
  trackCacheHit,
  trackCacheMiss,
  trackCacheEviction,
  updateCacheStats
} = require('./metrics');

// ============================================================
// 設定
// ============================================================

// 環境変数でキャッシュ有効/無効を制御
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false';

// デフォルトTTL (秒)
const DEFAULT_TTL = 60;

// エンドポイント別TTL設定（秒）
const TTL_CONFIG = {
  // ダッシュボード関連（リアルタイム性重視）
  '/api/v1/dashboard/kpi': 30,
  '/api/v1/dashboard/charts': 30, // チャートデータ：30秒（リアルタイム性重視）
  '/api/v1/dashboard/widgets': 60, // ウィジェットデータ：60秒（頻繁に変更されない）

  // セキュリティ関連
  '/api/v1/security/dashboard/overview': 30,
  '/api/v1/security/alerts': 60,
  '/api/v1/security/audit-logs': 120,
  '/api/v1/security/user-activity': 120,
  '/api/v1/security/activity-stats': 60,

  // コアリソース
  '/api/v1/incidents': 60,
  '/api/v1/assets': 300,
  '/api/v1/problems': 120,
  '/api/v1/releases': 300,
  '/api/v1/service-requests': 60,
  '/api/v1/changes': 120,
  '/api/v1/users': 300,

  // SLA管理（レポート生成時に無効化）
  '/api/v1/sla-agreements': 300,
  '/api/v1/sla-statistics': 120,
  '/api/v1/sla-reports': 180,
  '/api/v1/sla-alerts': 60,

  // ナレッジベース（長めのTTL）
  '/api/v1/knowledge-articles': 600,

  // キャパシティ・脆弱性管理
  '/api/v1/capacity-metrics': 120,
  '/api/v1/vulnerabilities': 120
};

// リソースから無効化対象パターンへのマッピング
const INVALIDATION_MAP = {
  // テスト用パターン
  test: ['/api/v1/test'],

  // インシデント作成/更新時：ダッシュボードキャッシュをクリア
  incidents: [
    '/api/v1/incidents',
    '/api/v1/dashboard/charts',
    '/api/v1/dashboard/widgets',
    '/api/v1/dashboard/kpi',
    '/api/v1/security/dashboard'
  ],

  // SLA更新時：ウィジェットとレポートキャッシュをクリア
  'sla-agreements': [
    '/api/v1/sla-agreements',
    '/api/v1/sla-statistics',
    '/api/v1/sla-reports',
    '/api/v1/dashboard/charts',
    '/api/v1/dashboard/widgets'
  ],

  // SLAアラート作成時
  'sla-alerts': ['/api/v1/sla-alerts', '/api/v1/dashboard/widgets'],

  // レポート生成時：統計キャッシュをクリア
  'sla-reports': ['/api/v1/sla-reports', '/api/v1/sla-statistics', '/api/v1/dashboard/charts'],

  // その他のリソース
  assets: ['/api/v1/assets'],
  changes: ['/api/v1/changes', '/api/v1/dashboard/charts', '/api/v1/dashboard/widgets'],
  problems: ['/api/v1/problems', '/api/v1/dashboard/widgets'],
  releases: ['/api/v1/releases'],
  'service-requests': ['/api/v1/service-requests'],
  'knowledge-articles': ['/api/v1/knowledge-articles'],
  'capacity-metrics': ['/api/v1/capacity-metrics'],
  vulnerabilities: [
    '/api/v1/vulnerabilities',
    '/api/v1/security/dashboard',
    '/api/v1/dashboard/widgets'
  ],
  users: ['/api/v1/users'],

  // セキュリティ関連
  'security-alerts': [
    '/api/v1/security/alerts',
    '/api/v1/security/dashboard',
    '/api/v1/security/activity-stats'
  ],
  'audit-logs': ['/api/v1/security/audit-logs', '/api/v1/security/activity-stats'],
  'user-activities': [
    '/api/v1/security/user-activity',
    '/api/v1/security/activity-stats',
    '/api/v1/security/dashboard'
  ]
};

// ============================================================
// キャッシュインスタンス
// ============================================================

// メモリ上限設定（MB単位で指定、デフォルト: 100MB）
const MAX_CACHE_SIZE_MB = parseInt(process.env.CACHE_MAX_SIZE_MB || '100', 10);
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;

const cache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 30, // 30秒ごとに期限切れチェック
  useClones: false, // パフォーマンス最適化（メモリ節約）
  deleteOnExpire: true,
  maxKeys: 10000 // 最大キー数制限
});

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * キャッシュキー生成（クエリパラメータとユーザーロール別）
 * @param {Object} req - Express request object
 * @returns {string} キャッシュキー
 */
function generateCacheKey(req) {
  // originalUrl を使用して完全なパスを取得（ルーター内でも正しく動作）
  // クエリ文字列を除去したパス部分のみを使用
  const fullPath = req.originalUrl.split('?')[0];
  const queryKeys = Object.keys(req.query).sort();

  // ユーザーロール情報を含める（認証済みの場合）
  const userRole = req.user?.role || 'anonymous';

  // ベースキー作成
  let cacheKey = fullPath;

  // クエリパラメータを追加
  if (queryKeys.length > 0) {
    const queryString = queryKeys.map((k) => `${k}=${req.query[k]}`).join('&');
    cacheKey = `${cacheKey}?${queryString}`;
  }

  // ユーザーロール別にキャッシュを分離（admin/manager/analyst）
  // ダッシュボードやレポート系エンドポイントでロール別キャッシュを適用
  if (
    fullPath.includes('/dashboard') ||
    fullPath.includes('/reports') ||
    fullPath.includes('/statistics')
  ) {
    cacheKey = `[${userRole}]${cacheKey}`;
  }

  return cacheKey;
}

/**
 * パスに対応するTTLを取得
 * @param {string} path - リクエストパス
 * @returns {number} TTL (秒)
 */
function getTTL(path) {
  // 完全一致を優先
  if (TTL_CONFIG[path]) {
    return TTL_CONFIG[path];
  }

  // ベースパスで検索
  const configKeys = Object.keys(TTL_CONFIG);
  for (let i = 0; i < configKeys.length; i += 1) {
    const configPath = configKeys[i];
    if (path.startsWith(configPath)) {
      return TTL_CONFIG[configPath];
    }
  }

  return DEFAULT_TTL;
}

/**
 * パターンに一致するキャッシュを無効化
 * @param {string[]} patterns - 無効化パターン配列
 */
function invalidateByPatterns(patterns) {
  const keys = cache.keys();

  keys.forEach((key) => {
    for (let i = 0; i < patterns.length; i += 1) {
      const pattern = patterns[i];
      if (key.startsWith(pattern)) {
        cache.del(key);
        logger.info(`[Cache] Invalidated: ${key}`);
        break;
      }
    }
  });
}

// ============================================================
// ミドルウェア
// ============================================================

/**
 * メモリ使用量チェック
 * @returns {boolean} メモリ上限を超えているかどうか
 */
function checkMemoryLimit() {
  const stats = cache.getStats();
  // vsizeはバイト単位のメモリ使用量の推定値
  const currentSize = stats.vsize || 0;

  if (currentSize > MAX_CACHE_SIZE_BYTES) {
    logger.warn(
      `[Cache] Memory limit exceeded: ${(currentSize / 1024 / 1024).toFixed(2)}MB / ${MAX_CACHE_SIZE_MB}MB`
    );
    // 古いキャッシュを削除（LRU的動作）
    const keys = cache.keys();
    const deleteCount = Math.ceil(keys.length * 0.2); // 20%のキーを削除
    for (let i = 0; i < deleteCount; i += 1) {
      cache.del(keys[i]);
    }
    logger.info(`[Cache] Evicted ${deleteCount} keys to free memory`);
    // Prometheusメトリクスに記録
    trackCacheEviction(deleteCount);
    return true;
  }
  return false;
}

/**
 * GETリクエスト用キャッシュミドルウェア
 * authenticateJWT の後に適用
 */
function cacheMiddleware(req, res, next) {
  // キャッシュ無効時はスキップ
  if (!CACHE_ENABLED) {
    return next();
  }

  // GET以外はスキップ
  if (req.method !== 'GET') {
    return next();
  }

  const startTime = Date.now(); // レスポンスタイム計測開始
  const fullPath = req.originalUrl.split('?')[0]; // 完全なパスを取得
  const cacheKey = generateCacheKey(req);
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    const responseTime = Date.now() - startTime;
    logger.info(`[Cache] HIT: ${cacheKey} (${responseTime}ms)`);
    // Prometheusメトリクスに記録
    trackCacheHit(fullPath);
    return res.json(cachedData);
  }

  logger.info(`[Cache] MISS: ${cacheKey}`);
  // Prometheusメトリクスに記録
  trackCacheMiss(fullPath);

  // オリジナルの res.json をオーバーライド
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    // 成功レスポンスのみキャッシュ
    if (res.statusCode === 200) {
      // メモリ上限チェック
      checkMemoryLimit();

      const ttl = getTTL(fullPath);
      cache.set(cacheKey, data, ttl);

      const responseTime = Date.now() - startTime;
      logger.info(`[Cache] SET: ${cacheKey} (TTL: ${ttl}s, Time: ${responseTime}ms)`);
    }
    return originalJson(data);
  };

  return next();
}

/**
 * CUD操作後のキャッシュ無効化ミドルウェア
 * POST/PUT/DELETE ルートの最後に適用
 */
function invalidateCacheMiddleware(resourceName) {
  return (req, res, next) => {
    // キャッシュ無効時はスキップ
    if (!CACHE_ENABLED) {
      return next();
    }

    // オリジナルの res.json をオーバーライド
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // 成功レスポンス時のみ無効化
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const patterns = INVALIDATION_MAP[resourceName] || [];
        if (patterns.length > 0) {
          invalidateByPatterns(patterns);
          logger.info(`[Cache] Invalidated patterns for: ${resourceName}`);
        }
      }
      return originalJson(data);
    };

    return next();
  };
}

/**
 * 手動キャッシュ無効化
 * @param {string} resourceName - リソース名
 */
function invalidateCache(resourceName) {
  const patterns = INVALIDATION_MAP[resourceName] || [];
  if (patterns.length > 0) {
    invalidateByPatterns(patterns);
  }
}

/**
 * 全キャッシュクリア
 */
function clearAllCache() {
  cache.flushAll();
  logger.info('[Cache] All cache cleared');
}

/**
 * 直接キャッシュに値を設定
 * @param {string} key - キャッシュキー
 * @param {*} value - 値
 * @param {number} ttl - TTL（秒）
 * @returns {boolean} 成功時true
 */
function setCache(key, value, ttl = DEFAULT_TTL) {
  return cache.set(key, value, ttl);
}

/**
 * 直接キャッシュから値を取得
 * @param {string} key - キャッシュキー
 * @returns {*} キャッシュされた値、存在しない場合はnull
 */
function getCache(key) {
  const value = cache.get(key);
  return value === undefined ? null : value;
}

// ============================================================
// 統計・監視
// ============================================================

/**
 * キャッシュ統計を取得（拡張版）
 * @returns {Object} 統計情報
 */
function getCacheStats() {
  const stats = cache.getStats();
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;
  const memorySizeMB = (stats.vsize || 0) / 1024 / 1024;

  return {
    enabled: CACHE_ENABLED,
    keys: cache.keys().length,
    maxKeys: 10000,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: `${hitRate.toFixed(2)}%`,
    hitRateNumeric: hitRate,
    ksize: stats.ksize,
    vsize: stats.vsize,
    memorySizeMB: `${memorySizeMB.toFixed(2)} MB`,
    memoryLimit: `${MAX_CACHE_SIZE_MB} MB`,
    memoryUsagePercent: `${((memorySizeMB / MAX_CACHE_SIZE_MB) * 100).toFixed(2)}%`
  };
}

// ============================================================
// 定期的なメトリクス更新
// ============================================================

/**
 * キャッシュ統計をPrometheusメトリクスに定期的に送信
 */
function syncCacheMetrics() {
  const stats = getCacheStats();
  updateCacheStats(stats);
}

// 30秒ごとにキャッシュ統計を更新
if (CACHE_ENABLED) {
  setInterval(syncCacheMetrics, 30000);
  logger.info('[Cache] Metrics sync initialized (every 30s)');
}

// ============================================================
// エクスポート
// ============================================================

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
  invalidateCache,
  clearAllCache,
  getCacheStats,
  generateCacheKey,
  getTTL,
  syncCacheMetrics,
  setCache,
  getCache,
  cache, // テスト用に公開
  CACHE_ENABLED
};
