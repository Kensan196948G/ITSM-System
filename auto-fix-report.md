# 🤖 自動エラー検知・修復システム実行レポート

## 実行情報

| 項目 | 値 |
|------|-----|
| **実行日時** | 2026-02-27 20:01:51 UTC |
| **Run ID** | 22501646752 |
| **サイクル数** | 1/15 |
| **最終ステータス** | success |
| **ヘルスステータス** | critical |
| **検出エラー数** | 0 |
| **修復試行数** | 0 |

## ヘルスチェック結果

```json
{
  "timestamp": "2026-02-27T19:58:39.292981",
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
      "usage_percent": 38,
      "message": "Disk usage normal: 38%",
      "critical": true,
      "details": {
        "filesystem": "/dev/root",
        "size": "145G",
        "used": "54G",
        "available": "91G",
        "use_percent": 38,
        "mounted_on": "/"
      }
    },
    "memory_usage": {
      "status": "healthy",
      "usage_percent": 8.1,
      "message": "Memory usage normal: 8.1%",
      "critical": false,
      "details": {
        "total_mb": 15989,
        "used_mb": 1293,
        "available_mb": 14695,
        "total_gb": 15.6,
        "used_gb": 1.3,
        "available_gb": 14.4
      }
    }
  },
  "overall_status": "critical",
  "metrics": {
    "cpu": {
      "usage_percent": 16.7,
      "idle_percent": 83.3
    },
    "processes": {
      "count": 161
    },
    "network": {
      "bytes_received": 731846349,
      "bytes_sent": 5540989,
      "bytes_received_mb": 697.94,
      "bytes_sent_mb": 5.28
    }
  }
}
```

## テスト出力（最新）

```
     [90m 933 |[39m         password[33m:[39m flowPassword[33m,[39m
    [31m[1m>[22m[39m[90m 934 |[39m         totpToken[33m:[39m flowBackupCodes[[35m0[39m] [90m// Use first new code to verify it works[39m
     [90m     |[39m                                   [31m[1m^[22m[39m
     [90m 935 |[39m       })[33m;[39m
     [90m 936 |[39m
     [90m 937 |[39m       expect(res[33m.[39mstatusCode)[33m.[39mtoEqual([35m200[39m)[33m;[39m[0m

      at Object.<anonymous> (backend/__tests__/integration/2fa.test.js:934:35)

  ● 2FA Security Enhancement Tests › Edge Cases › should handle multiple sequential 2FA setups (overwrite secret)

    expect(received).toEqual(expected) // deep equality

    Expected: 200
    Received: 500

    [0m [90m 1028 |[39m         [33m.[39m[36mset[39m([32m'Authorization'[39m[33m,[39m [32m`Bearer ${edgeToken}`[39m)[33m;[39m
     [90m 1029 |[39m
    [31m[1m>[22m[39m[90m 1030 |[39m       expect(res1[33m.[39mstatusCode)[33m.[39mtoEqual([35m200[39m)[33m;[39m
     [90m      |[39m                               [31m[1m^[22m[39m
     [90m 1031 |[39m       [36mconst[39m secret1 [33m=[39m res1[33m.[39mbody[33m.[39msecret[33m;[39m
     [90m 1032 |[39m
     [90m 1033 |[39m       [90m// Second setup (should overwrite)[39m[0m

      at Object.toEqual (backend/__tests__/integration/2fa.test.js:1030:31)

  ● 2FA Security Enhancement Tests › Edge Cases › should only accept the latest TOTP secret after re-setup

    expect(received).toEqual(expected) // deep equality

    Expected: 200
    Received: 400

    [0m [90m 1057 |[39m         [33m.[39msend({ token })[33m;[39m
     [90m 1058 |[39m
    [31m[1m>[22m[39m[90m 1059 |[39m       expect(res[33m.[39mstatusCode)[33m.[39mtoEqual([35m200[39m)[33m;[39m
     [90m      |[39m                              [31m[1m^[22m[39m
     [90m 1060 |[39m     })[33m;[39m
     [90m 1061 |[39m
     [90m 1062 |[39m     afterAll([36masync[39m () [33m=>[39m {[0m

      at Object.toEqual (backend/__tests__/integration/2fa.test.js:1059:30)

  ● 2FA Security Enhancement Tests › Encryption Verification › should encrypt and decrypt TOTP secret consistently

    TOTP_ENCRYPTION_KEY environment variable is not set

    [0m [90m 18 |[39m   [36mconst[39m keyBase64 [33m=[39m process[33m.[39menv[33m.[39m[33mTOTP_ENCRYPTION_KEY[39m[33m;[39m
     [90m 19 |[39m   [36mif[39m ([33m![39mkeyBase64) {
    [31m[1m>[22m[39m[90m 20 |[39m     [36mthrow[39m [36mnew[39m [33mError[39m([32m'TOTP_ENCRYPTION_KEY environment variable is not set'[39m)[33m;[39m
     [90m    |[39m           [31m[1m^[22m[39m
     [90m 21 |[39m   }
     [90m 22 |[39m   [36mconst[39m key [33m=[39m [33mBuffer[39m[33m.[39m[36mfrom[39m(keyBase64[33m,[39m [32m'base64'[39m)[33m;[39m
     [90m 23 |[39m   [36mif[39m (key[33m.[39mlength [33m!==[39m [35m32[39m) {[0m

      at getEncryptionKey (backend/utils/encryption.js:20:11)
      at getEncryptionKey (backend/utils/encryption.js:36:25)
      at Object.encrypt (backend/__tests__/integration/2fa.test.js:1082:42)

  ● 2FA Security Enhancement Tests › Encryption Verification › should produce different ciphertexts for same input (random IV)

    TOTP_ENCRYPTION_KEY environment variable is not set

    [0m [90m 18 |[39m   [36mconst[39m keyBase64 [33m=[39m process[33m.[39menv[33m.[39m[33mTOTP_ENCRYPTION_KEY[39m[33m;[39m
     [90m 19 |[39m   [36mif[39m ([33m![39mkeyBase64) {
    [31m[1m>[22m[39m[90m 20 |[39m     [36mthrow[39m [36mnew[39m [33mError[39m([32m'TOTP_ENCRYPTION_KEY environment variable is not set'[39m)[33m;[39m
     [90m    |[39m           [31m[1m^[22m[39m
     [90m 21 |[39m   }
     [90m 22 |[39m   [36mconst[39m key [33m=[39m [33mBuffer[39m[33m.[39m[36mfrom[39m(keyBase64[33m,[39m [32m'base64'[39m)[33m;[39m
     [90m 23 |[39m   [36mif[39m (key[33m.[39mlength [33m!==[39m [35m32[39m) {[0m

      at getEncryptionKey (backend/utils/encryption.js:20:11)
      at getEncryptionKey (backend/utils/encryption.js:36:25)
      at Object.encrypt (backend/__tests__/integration/2fa.test.js:1091:23)

FAIL backend/__tests__/performance/performance.test.js (9.254 s)
  ● Performance Test Suite › Memory Usage Performance › should not have memory leaks during sustained operations

    expect(received).toBeLessThan(expected)

    Expected: < 52428800
    Received:   80795840

    [0m [90m 135 |[39m
     [90m 136 |[39m       [90m// Allow some memory increase but not excessive[39m
    [31m[1m>[22m[39m[90m 137 |[39m       expect(memoryIncrease)[33m.[39mtoBeLessThan([35m50[39m [33m*[39m [35m1024[39m [33m*[39m [35m1024[39m)[33m;[39m [90m// 50MB max increase[39m
     [90m     |[39m                              [31m[1m^[22m[39m
     [90m 138 |[39m     })[33m;[39m
     [90m 139 |[39m   })[33m;[39m
     [90m 140 |[39m[0m

      at Object.toBeLessThan (backend/__tests__/performance/performance.test.js:137:30)


Test Suites: 2 failed, 1 skipped, 79 passed, 81 of 82 total
Tests:       33 failed, 57 skipped, 2242 passed, 2332 total
Snapshots:   0 total
Time:        190.597 s
Ran all test suites.
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
```

---
📋 **ルール遵守**: CLAUDE.md に基づいて修復
📖 **仕様保護**: README.md は変更されていません
💾 **状態管理**: state.json (スキーマv3.0)
⏰ **実行間隔**: 5分
🔄 **ループ回数**: 15 回
