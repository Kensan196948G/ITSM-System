# 🤖 自動エラー検知・修復システム実行レポート

## 実行情報

| 項目 | 値 |
|------|-----|
| **実行日時** | 2026-02-03 23:55:52 UTC |
| **Run ID** | 21652508271 |
| **サイクル数** | 1/15 |
| **最終ステータス** | success |
| **ヘルスステータス** | critical |
| **検出エラー数** | 0 |
| **修復試行数** | 0 |

## ヘルスチェック結果

```json
{
  "timestamp": "2026-02-03T23:55:05.007571",
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
        "used": "53G",
        "available": "92G",
        "use_percent": 37,
        "mounted_on": "/"
      }
    },
    "memory_usage": {
      "status": "healthy",
      "usage_percent": 6.3,
      "message": "Memory usage normal: 6.3%",
      "critical": false,
      "details": {
        "total_mb": 15990,
        "used_mb": 1011,
        "available_mb": 14979,
        "total_gb": 15.6,
        "used_gb": 1.0,
        "available_gb": 14.6
      }
    }
  },
  "overall_status": "critical",
  "metrics": {
    "cpu": {
      "usage_percent": 54.2,
      "idle_percent": 45.8
    },
    "processes": {
      "count": 146
    },
    "network": {
      "bytes_received": 106364905,
      "bytes_sent": 865487,
      "bytes_received_mb": 101.44,
      "bytes_sent_mb": 0.83
    }
  }
}
```

## テスト出力（最新）

```
  console.log
    [Export] Retrieved 12 records from assets

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/assets?format=csv [32m200[0m 5.294 ms - 947[0m
  console.log
    [Export] Exporting assets (format: xlsx, filters: { from_date: undefined, to_date: undefined } )

      at Object.log (backend/__tests__/setup.js:68:21)

  console.log
    [Export] Retrieved 12 records from assets

      at Object.log (backend/__tests__/setup.js:68:21)

[0mGET /api/v1/export/assets?format=xlsx [32m200[0m 20.725 ms - 7277[0m
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

[0mGET /api/v1/export/incidents?format=csv&from=2025-01-01&to=2025-12-31 [32m200[0m 5.900 ms - 1516[0m
PASS backend/__tests__/integration/export.test.js
  Export API Integration Tests
    GET /api/v1/export/incidents
      ✓ 認証なしで401エラー (10 ms)
      ✓ CSV形式でインシデントエクスポート（200） (13 ms)
      ✓ JSON形式でインシデントエクスポート（200） (8 ms)
      ✓ Excel形式でインシデントエクスポート（200） (52 ms)
    GET /api/v1/export/vulnerabilities
      ✓ CSV形式で脆弱性エクスポート（200） (15 ms)
      ✓ JSON形式で脆弱性エクスポート（200） (8 ms)
    GET /api/v1/export/changes
      ✓ CSV形式で変更管理エクスポート（200） (8 ms)
    GET /api/v1/export/assets
      ✓ CSV形式で資産エクスポート（200） (8 ms)
      ✓ Excel形式で資産エクスポート（200） (24 ms)
    Export with date filters
      ✓ 日付フィルタ付きでエクスポート (9 ms)

  console.log
    [dotenv@17.2.3] injecting env (0) from .env.test -- tip: 🔄 add secrets lifecycle management: https://dotenvx.com/ops

      at _log (node_modules/dotenv/lib/main.js:142:11)

PASS backend/__tests__/unit/middleware/cache.test.js
  Cache Middleware
    ✓ generateCacheKey sorts query params (5 ms)
    ✓ getTTL returns configured values or default (1 ms)
    ✓ cacheMiddleware caches GET responses and serves from cache (3 ms)
    ✓ invalidateCacheMiddleware clears matching patterns after success (2 ms)
    ✓ manual invalidation and stats access are available (1 ms)

  console.log
    [dotenv@17.2.3] injecting env (0) from .env.test -- tip: 🔐 encrypt with Dotenvx: https://dotenvx.com

      at _log (node_modules/dotenv/lib/main.js:142:11)

PASS backend/__tests__/unit/middleware/metrics.test.js
  Metrics Middleware Helpers
    ✓ updates custom metrics without errors (6 ms)
    ✓ metricsEndpoint returns Prometheus payload (3 ms)

Summary of all failing tests
FAIL backend/__tests__/integration/auto-fix.test.js
  ● Auto-Fix API Integration Tests › POST /api/v1/auto-fix/cooldown/reset › 管理者がクールダウンをリセットできる

    expect(received).toEqual(expected) // deep equality

    Expected: 200
    Received: 404

    [0m [90m 382 |[39m         })[33m;[39m
     [90m 383 |[39m
    [31m[1m>[22m[39m[90m 384 |[39m       expect(res[33m.[39mstatusCode)[33m.[39mtoEqual([35m200[39m)[33m;[39m
     [90m     |[39m                              [31m[1m^[22m[39m
     [90m 385 |[39m       expect(res[33m.[39mbody)[33m.[39mtoHaveProperty([32m'message'[39m[33m,[39m [32m'Cooldown reset successfully'[39m)[33m;[39m
     [90m 386 |[39m       expect(res[33m.[39mbody)[33m.[39mtoHaveProperty([32m'data'[39m)[33m;[39m
     [90m 387 |[39m       expect(res[33m.[39mbody[33m.[39mdata)[33m.[39mtoHaveProperty([32m'error_hash'[39m[33m,[39m testErrorHash)[33m;[39m[0m

      at Object.toEqual (backend/__tests__/integration/auto-fix.test.js:384:30)


Test Suites: 1 failed, 1 skipped, 46 passed, 47 of 48 total
Tests:       1 failed, 49 skipped, 949 passed, 999 total
Snapshots:   0 total
Time:        45.403 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

---
📋 **ルール遵守**: CLAUDE.md に基づいて修復
📖 **仕様保護**: README.md は変更されていません
💾 **状態管理**: state.json (スキーマv3.0)
⏰ **実行間隔**: 5分
🔄 **ループ回数**: 15 回
