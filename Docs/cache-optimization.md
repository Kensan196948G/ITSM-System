# キャッシュ最適化ドキュメント

## 概要

ITSM-Systemのチャートデータキャッシュ戦略を最適化し、パフォーマンスと監視機能を強化しました。

## 実装内容

### 1. ダッシュボードチャートAPIのTTL最適化

#### 追加されたTTL設定

```javascript
// ダッシュボード関連（リアルタイム性重視）
'/api/v1/dashboard/charts': 30秒    // チャートデータ：リアルタイム性重視
'/api/v1/dashboard/widgets': 60秒   // ウィジェットデータ：頻繁に変更されない

// SLA管理（レポート生成時に無効化）
'/api/v1/sla-agreements': 300秒
'/api/v1/sla-statistics': 120秒
'/api/v1/sla-reports': 180秒
'/api/v1/sla-alerts': 60秒
```

### 2. ユーザーロール別キャッシュキー戦略

#### 実装詳細

- ダッシュボード、レポート、統計エンドポイントでロール別キャッシュを適用
- キャッシュキー形式: `[role]path?query`
- 対応ロール: admin, manager, analyst, viewer, anonymous

#### コード例

```javascript
// ユーザーロール別にキャッシュを分離
if (
  path.includes('/dashboard') ||
  path.includes('/reports') ||
  path.includes('/statistics')
) {
  cacheKey = `[${userRole}]${cacheKey}`;
}
```

### 3. キャッシュインバリデーション強化

#### インバリデーションマップ

```javascript
// インシデント作成/更新時：ダッシュボードキャッシュをクリア
incidents: [
  '/api/v1/incidents',
  '/api/v1/dashboard/charts',
  '/api/v1/dashboard/widgets',
  '/api/v1/dashboard/kpi',
  '/api/v1/security/dashboard'
]

// SLA更新時：ウィジェットとレポートキャッシュをクリア
'sla-agreements': [
  '/api/v1/sla-agreements',
  '/api/v1/sla-statistics',
  '/api/v1/sla-reports',
  '/api/v1/dashboard/charts',
  '/api/v1/dashboard/widgets'
]

// レポート生成時：統計キャッシュをクリア
'sla-reports': [
  '/api/v1/sla-reports',
  '/api/v1/sla-statistics',
  '/api/v1/dashboard/charts'
]
```

### 4. キャッシュメモリ上限設定

#### 設定内容

- デフォルトメモリ上限: 100MB
- 最大キー数: 10,000
- 環境変数での制御: `CACHE_MAX_SIZE_MB`

#### 自動エビクション機能

メモリ上限を超えた場合、自動的に古いキャッシュの20%を削除します。

```javascript
function checkMemoryLimit() {
  const stats = cache.getStats();
  const currentSize = stats.vsize || 0;

  if (currentSize > MAX_CACHE_SIZE_BYTES) {
    const keys = cache.keys();
    const deleteCount = Math.ceil(keys.length * 0.2); // 20%のキーを削除
    for (let i = 0; i < deleteCount; i += 1) {
      cache.del(keys[i]);
    }
    trackCacheEviction(deleteCount);
  }
}
```

### 5. レスポンスタイムのロギング

#### 実装内容

キャッシュヒット時とキャッシュミス時のレスポンスタイムを記録します。

```javascript
const startTime = Date.now();
// ... キャッシュ処理 ...
const responseTime = Date.now() - startTime;
console.log(`[Cache] HIT: ${cacheKey} (${responseTime}ms)`);
```

### 6. Prometheusメトリクス統合

#### 追加されたメトリクス

```javascript
// キャッシュヒット/ミスカウンター
itsm_cache_hits_total{endpoint="/api/v1/dashboard/charts"}
itsm_cache_misses_total{endpoint="/api/v1/dashboard/charts"}

// キャッシュヒット率ゲージ
itsm_cache_hit_rate

// キャッシュキー数ゲージ
itsm_cache_keys_total

// キャッシュメモリ使用量ゲージ（バイト単位）
itsm_cache_memory_bytes

// キャッシュエビクションカウンター
itsm_cache_evictions_total
```

#### メトリクス自動同期

30秒ごとにキャッシュ統計をPrometheusメトリクスに同期します。

### 7. キャッシュ統計の拡張

#### 取得可能な統計情報

```json
{
  "enabled": true,
  "keys": 0,
  "maxKeys": 10000,
  "hits": 0,
  "misses": 0,
  "hitRate": "0.00%",
  "hitRateNumeric": 0,
  "ksize": 0,
  "vsize": 0,
  "memorySizeMB": "0.00 MB",
  "memoryLimit": "100 MB",
  "memoryUsagePercent": "0.00%"
}
```

## 環境変数設定

`.env`ファイルに以下の設定を追加してください：

```bash
# Cache Configuration
CACHE_ENABLED=true
CACHE_MAX_SIZE_MB=100
```

## 使用方法

### キャッシュ統計の取得

```javascript
const { getCacheStats } = require('./middleware/cache');
const stats = getCacheStats();
console.log(stats);
```

### 手動キャッシュ無効化

```javascript
const { invalidateCache } = require('./middleware/cache');

// インシデント関連キャッシュをクリア
invalidateCache('incidents');

// SLA関連キャッシュをクリア
invalidateCache('sla-agreements');
```

### 全キャッシュクリア

```javascript
const { clearAllCache } = require('./middleware/cache');
clearAllCache();
```

## パフォーマンス指標

### 期待される改善

1. **ダッシュボードチャートAPI**
   - キャッシュヒット時: < 5ms
   - キャッシュミス時: 100-500ms
   - ヒット率目標: 80%以上

2. **ウィジェットデータAPI**
   - キャッシュヒット時: < 5ms
   - キャッシュミス時: 50-200ms
   - ヒット率目標: 85%以上

3. **メモリ使用量**
   - 平均: 20-50MB
   - 最大: 100MB
   - エビクション頻度: < 1回/時間

## 監視とアラート

### Prometheusクエリ例

```promql
# キャッシュヒット率
rate(itsm_cache_hits_total[5m]) / (rate(itsm_cache_hits_total[5m]) + rate(itsm_cache_misses_total[5m]))

# メモリ使用率
itsm_cache_memory_bytes / (100 * 1024 * 1024)

# エビクション頻度
rate(itsm_cache_evictions_total[1h])
```

### アラート条件（推奨）

```yaml
- alert: LowCacheHitRate
  expr: itsm_cache_hit_rate < 50
  for: 10m
  annotations:
    summary: "キャッシュヒット率が50%未満です"

- alert: HighCacheMemoryUsage
  expr: itsm_cache_memory_bytes > 90 * 1024 * 1024
  for: 5m
  annotations:
    summary: "キャッシュメモリ使用量が90MBを超えています"
```

## トラブルシューティング

### キャッシュが効かない場合

1. `CACHE_ENABLED=true`が設定されているか確認
2. ログで`[Cache] HIT`/`[Cache] MISS`メッセージを確認
3. キャッシュ統計APIで状態を確認: `GET /api/v1/cache/stats`

### メモリ使用量が多い場合

1. `CACHE_MAX_SIZE_MB`の値を下げる
2. TTL設定を短くする
3. キャッシュ対象エンドポイントを見直す

## 今後の改善案

1. Redis統合によるクラスタ環境対応
2. 条件付きキャッシュ（ETag対応）
3. キャッシュウォームアップ機能
4. キャッシュプリロード機能
5. より細かいTTL制御（動的TTL）

## 変更ファイル一覧

- `/mnt/LinuxHDD/ITSM-System/backend/middleware/cache.js` - キャッシュミドルウェア拡張
- `/mnt/LinuxHDD/ITSM-System/backend/middleware/metrics.js` - Prometheusメトリクス追加
- `/mnt/LinuxHDD/ITSM-System/.env.example` - 環境変数設定追加

## 参考資料

- [node-cache Documentation](https://www.npmjs.com/package/node-cache)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [HTTP Caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
