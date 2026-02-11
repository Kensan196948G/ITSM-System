# 🤖 自動エラー検知・修復システム実行レポート

## 実行情報

| 項目 | 値 |
|------|-----|
| **実行日時** | 2026-02-11 19:58:11 UTC |
| **Run ID** | 21920840064 |
| **サイクル数** | 1/15 |
| **最終ステータス** | success |
| **ヘルスステータス** | critical |
| **検出エラー数** | 0 |
| **修復試行数** | 0 |

## ヘルスチェック結果

```json
{
  "timestamp": "2026-02-11T19:57:23.078620",
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
      "usage_percent": 70,
      "message": "Disk usage normal: 70%",
      "critical": true,
      "details": {
        "filesystem": "/dev/root",
        "size": "72G",
        "used": "50G",
        "available": "22G",
        "use_percent": 70,
        "mounted_on": "/"
      }
    },
    "memory_usage": {
      "status": "healthy",
      "usage_percent": 5.6,
      "message": "Memory usage normal: 5.6%",
      "critical": false,
      "details": {
        "total_mb": 15994,
        "used_mb": 897,
        "available_mb": 15097,
        "total_gb": 15.6,
        "used_gb": 0.9,
        "available_gb": 14.7
      }
    }
  },
  "overall_status": "critical",
  "metrics": {
    "cpu": {
      "usage_percent": 22.2,
      "idle_percent": 77.8
    },
    "processes": {
      "count": 153
    },
    "network": {
      "bytes_received": 140449630,
      "bytes_sent": 842984,
      "bytes_received_mb": 133.94,
      "bytes_sent_mb": 0.8
    }
  }
}
```

## テスト出力（最新）

```

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/vulnerabilities?format=json [32m200[0m 6.060 ms - 4593[0m
  console.log
    [Export] Exporting changes (format: csv, filters: { from_date: undefined, to_date: undefined } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 7 records from changes

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/changes?format=csv [32m200[0m 6.211 ms - 866[0m
  console.log
    [Export] Exporting assets (format: csv, filters: { from_date: undefined, to_date: undefined } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 12 records from assets

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/assets?format=csv [32m200[0m 6.146 ms - 947[0m
  console.log
    [Export] Exporting assets (format: xlsx, filters: { from_date: undefined, to_date: undefined } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 12 records from assets

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/assets?format=xlsx [32m200[0m 17.797 ms - 7279[0m
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

[0mGET /api/v1/export/incidents?format=csv&from=2025-01-01&to=2025-12-31 [32m200[0m 6.381 ms - 1516[0m
PASS backend/__tests__/integration/export.test.js
  Export API Integration Tests
    GET /api/v1/export/incidents
      ✓ 認証なしで401エラー (6 ms)
      ✓ CSV形式でインシデントエクスポート（200） (13 ms)
      ✓ JSON形式でインシデントエクスポート（200） (9 ms)
      ✓ Excel形式でインシデントエクスポート（200） (55 ms)
    GET /api/v1/export/vulnerabilities
      ✓ CSV形式で脆弱性エクスポート（200） (13 ms)
      ✓ JSON形式で脆弱性エクスポート（200） (9 ms)
    GET /api/v1/export/changes
      ✓ CSV形式で変更管理エクスポート（200） (9 ms)
    GET /api/v1/export/assets
      ✓ CSV形式で資産エクスポート（200） (9 ms)
      ✓ Excel形式で資産エクスポート（200） (25 ms)
    Export with date filters
      ✓ 日付フィルタ付きでエクスポート (10 ms)

  console.log
    [dotenv@17.2.3] injecting env (0) from .env.test -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild

      at _log (node_modules/dotenv/lib/main.js:142:11)

PASS backend/__tests__/unit/middleware/cache.test.js
  Cache Middleware
    ✓ generateCacheKey sorts query params (2 ms)
    ✓ getTTL returns configured values or default (1 ms)
    ✓ cacheMiddleware caches GET responses and serves from cache (3 ms)
    ✓ invalidateCacheMiddleware clears matching patterns after success (2 ms)
    ✓ manual invalidation and stats access are available (2 ms)

  console.log
    [dotenv@17.2.3] injecting env (0) from .env.test -- tip: ✅ audit secrets and track compliance: https://dotenvx.com/ops

      at _log (node_modules/dotenv/lib/main.js:142:11)

PASS backend/__tests__/unit/middleware/metrics.test.js
  Metrics Middleware Helpers
    ✓ updates custom metrics without errors (6 ms)
    ✓ metricsEndpoint returns Prometheus payload (4 ms)

Test Suites: 1 skipped, 47 passed, 47 of 48 total
Tests:       49 skipped, 950 passed, 999 total
Snapshots:   0 total
Time:        46.53 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

---
📋 **ルール遵守**: CLAUDE.md に基づいて修復
📖 **仕様保護**: README.md は変更されていません
💾 **状態管理**: state.json (スキーマv3.0)
⏰ **実行間隔**: 5分
🔄 **ループ回数**: 15 回
