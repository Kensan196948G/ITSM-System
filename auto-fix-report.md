# 🤖 自動エラー検知・修復システム実行レポート

## 実行情報

| 項目 | 値 |
|------|-----|
| **実行日時** | 2026-02-15 01:23:37 UTC |
| **Run ID** | 22027461531 |
| **サイクル数** | 1/15 |
| **最終ステータス** | success |
| **ヘルスステータス** | critical |
| **検出エラー数** | 0 |
| **修復試行数** | 0 |

## ヘルスチェック結果

```json
{
  "timestamp": "2026-02-15T01:22:50.115541",
  "checks": {
    "database_connection": {
      "status": "unhealthy",
      "message": "Database file not found: /home/runner/work/ITSM-System/ITSM-System/backend/itsm_nexus.db",
      "critical": true
    },
    "http_endpoint": {
      "status": "unhealthy",
      "message": "Connection refused",
      "critical": true
    },
    "disk_space": {
      "status": "healthy",
      "usage_percent": 37,
      "message": "Disk usage normal: 37%",
      "critical": true,
      "details": {
        "filesystem": "/dev/root",
        "size": "145G",
        "used": "54G",
        "available": "91G",
        "use_percent": 37,
        "mounted_on": "/"
      }
    },
    "memory_usage": {
      "status": "healthy",
      "usage_percent": 7.0,
      "message": "Memory usage normal: 7.0%",
      "critical": false,
      "details": {
        "total_mb": 15990,
        "used_mb": 1125,
        "available_mb": 14864,
        "total_gb": 15.6,
        "used_gb": 1.1,
        "available_gb": 14.5
      }
    }
  },
  "overall_status": "critical",
  "metrics": {
    "cpu": {
      "usage_percent": 4.5,
      "idle_percent": 95.5
    },
    "processes": {
      "count": 149
    },
    "network": {
      "bytes_received": 139581320,
      "bytes_sent": 1025728,
      "bytes_received_mb": 133.12,
      "bytes_sent_mb": 0.98
    }
  }
}
```

## テスト出力（最新）

```

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/vulnerabilities?format=json [32m200[0m 5.497 ms - 4593[0m
  console.log
    [Export] Exporting changes (format: csv, filters: { from_date: undefined, to_date: undefined } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 7 records from changes

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/changes?format=csv [32m200[0m 8.677 ms - 866[0m
  console.log
    [Export] Exporting assets (format: csv, filters: { from_date: undefined, to_date: undefined } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 12 records from assets

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/assets?format=csv [32m200[0m 5.657 ms - 947[0m
  console.log
    [Export] Exporting assets (format: xlsx, filters: { from_date: undefined, to_date: undefined } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 12 records from assets

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/assets?format=xlsx [32m200[0m 16.832 ms - 7275[0m
  console.log
    [Export] Exporting incidents (format: csv, filters: {
      from_date: undefined,
      to_date: undefined,
      from: '2025-01-01',
      to: '2025-12-31'
    } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 17 records from incidents

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/incidents?format=csv&from=2025-01-01&to=2025-12-31 [32m200[0m 5.938 ms - 1516[0m
PASS backend/__tests__/integration/export.test.js
  Export API Integration Tests
    GET /api/v1/export/incidents
      ✓ 認証なしで401エラー (5 ms)
      ✓ CSV形式でインシデントエクスポート（200） (13 ms)
      ✓ JSON形式でインシデントエクスポート（200） (12 ms)
      ✓ Excel形式でインシデントエクスポート（200） (50 ms)
    GET /api/v1/export/vulnerabilities
      ✓ CSV形式で脆弱性エクスポート（200） (10 ms)
      ✓ JSON形式で脆弱性エクスポート（200） (8 ms)
    GET /api/v1/export/changes
      ✓ CSV形式で変更管理エクスポート（200） (11 ms)
    GET /api/v1/export/assets
      ✓ CSV形式で資産エクスポート（200） (8 ms)
      ✓ Excel形式で資産エクスポート（200） (20 ms)
    Export with date filters
      ✓ 日付フィルタ付きでエクスポート (9 ms)

  console.log
    [dotenv@17.2.3] injecting env (0) from .env.test -- tip: 📡 add observability to secrets: https://dotenvx.com/ops

      at _log (node_modules/dotenv/lib/main.js:142:11)

PASS backend/__tests__/unit/middleware/cache.test.js
  Cache Middleware
    ✓ generateCacheKey sorts query params (2 ms)
    ✓ getTTL returns configured values or default (1 ms)
    ✓ cacheMiddleware caches GET responses and serves from cache (3 ms)
    ✓ invalidateCacheMiddleware clears matching patterns after success (2 ms)
    ✓ manual invalidation and stats access are available (1 ms)

  console.log
    [dotenv@17.2.3] injecting env (0) from .env.test -- tip: ⚙️  override existing env vars with { override: true }

      at _log (node_modules/dotenv/lib/main.js:142:11)

PASS backend/__tests__/unit/middleware/metrics.test.js
  Metrics Middleware Helpers
    ✓ updates custom metrics without errors (6 ms)
    ✓ metricsEndpoint returns Prometheus payload (6 ms)

Test Suites: 1 skipped, 47 passed, 47 of 48 total
Tests:       49 skipped, 950 passed, 999 total
Snapshots:   0 total
Time:        45.794 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

---
📋 **ルール遵守**: CLAUDE.md に基づいて修復
📖 **仕様保護**: README.md は変更されていません
💾 **状態管理**: state.json (スキーマv3.0)
⏰ **実行間隔**: 5分
🔄 **ループ回数**: 15 回
