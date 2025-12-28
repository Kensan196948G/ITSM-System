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

// ============================================================
// 設定
// ============================================================

// 環境変数でキャッシュ有効/無効を制御
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false';

// デフォルトTTL (秒)
const DEFAULT_TTL = 60;

// エンドポイント別TTL設定
const TTL_CONFIG = {
  '/api/v1/dashboard/kpi': 30,
  '/api/v1/incidents': 60,
  '/api/v1/assets': 300,
  '/api/v1/problems': 120,
  '/api/v1/releases': 300,
  '/api/v1/service-requests': 60,
  '/api/v1/sla-agreements': 300,
  '/api/v1/knowledge-articles': 600,
  '/api/v1/capacity-metrics': 120,
  '/api/v1/vulnerabilities': 120,
  '/api/v1/changes': 120,
  '/api/v1/users': 300
};

// リソースから無効化対象パターンへのマッピング
const INVALIDATION_MAP = {
  incidents: ['/api/v1/incidents', '/api/v1/dashboard'],
  assets: ['/api/v1/assets'],
  changes: ['/api/v1/changes'],
  problems: ['/api/v1/problems'],
  releases: ['/api/v1/releases'],
  'service-requests': ['/api/v1/service-requests'],
  'sla-agreements': ['/api/v1/sla-agreements'],
  'knowledge-articles': ['/api/v1/knowledge-articles'],
  'capacity-metrics': ['/api/v1/capacity-metrics'],
  vulnerabilities: ['/api/v1/vulnerabilities'],
  users: ['/api/v1/users']
};

// ============================================================
// キャッシュインスタンス
// ============================================================

const cache = new NodeCache({
  stdTTL: DEFAULT_TTL,
  checkperiod: 30, // 30秒ごとに期限切れチェック
  useClones: false, // パフォーマンス最適化
  deleteOnExpire: true
});

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * キャッシュキー生成
 * @param {Object} req - Express request object
 * @returns {string} キャッシュキー
 */
function generateCacheKey(req) {
  const { path } = req;
  const queryKeys = Object.keys(req.query).sort();

  if (queryKeys.length === 0) {
    return path;
  }

  const queryString = queryKeys.map((k) => `${k}=${req.query[k]}`).join('&');

  return `${path}?${queryString}`;
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
        console.log(`[Cache] Invalidated: ${key}`);
        break;
      }
    }
  });
}

// ============================================================
// ミドルウェア
// ============================================================

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

  const cacheKey = generateCacheKey(req);
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    console.log(`[Cache] HIT: ${cacheKey}`);
    return res.json(cachedData);
  }

  console.log(`[Cache] MISS: ${cacheKey}`);

  // オリジナルの res.json をオーバーライド
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    // 成功レスポンスのみキャッシュ
    if (res.statusCode === 200) {
      const ttl = getTTL(req.path);
      cache.set(cacheKey, data, ttl);
      console.log(`[Cache] SET: ${cacheKey} (TTL: ${ttl}s)`);
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
          console.log(`[Cache] Invalidated patterns for: ${resourceName}`);
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
  console.log('[Cache] All cache cleared');
}

// ============================================================
// 統計・監視
// ============================================================

/**
 * キャッシュ統計を取得
 * @returns {Object} 統計情報
 */
function getCacheStats() {
  const stats = cache.getStats();
  return {
    enabled: CACHE_ENABLED,
    keys: cache.keys().length,
    hits: stats.hits,
    misses: stats.misses,
    hitRate:
      stats.hits + stats.misses > 0
        ? `${((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2)}%`
        : '0%',
    ksize: stats.ksize,
    vsize: stats.vsize
  };
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
  cache, // テスト用に公開
  CACHE_ENABLED
};
