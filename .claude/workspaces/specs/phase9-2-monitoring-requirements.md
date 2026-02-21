# Phase 9.2: 監視・ヘルスチェック強化 - 要件定義書

**作成日**: 2026-01-31
**バージョン**: 1.0
**ステータス**: Draft
**担当**: spec-planner SubAgent

---

## 目次

1. [機能要件](#1-機能要件)
2. [非機能要件](#2-非機能要件)
3. [制約事項](#3-制約事項)
4. [受入基準](#4-受入基準)

---

## 1. 機能要件

### 1.1 監視ダッシュボードUI

#### FR-1.1.1: ダッシュボード画面構成

**要件**:
監視ダッシュボード画面（`/views/monitoring.html`）は以下のセクションで構成されなければならない：

**画面レイアウト**:
```
┌─────────────────────────────────────────────────────────────┐
│ [ヘッダー] ITSM-Sec Nexus - 監視ダッシュボード                │
├─────────────────────────────────────────────────────────────┤
│ [アクティブアラート バー]                                    │
│ 🔴 Critical: 2件 | ⚠️ Warning: 5件 | ℹ️ Info: 1件         │
├─────────────────────────────────────────────────────────────┤
│ [システムステータス概要]                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ CPU      │ │ Memory   │ │ Disk     │ │ Uptime   │      │
│ │ 45.2%    │ │ 62.3%    │ │ 55.1%    │ │ 5d 12h   │      │
│ │ [ゲージ] │ │ [ゲージ] │ │ [ゲージ] │ │          │      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│ [ビジネスメトリクス]                                         │
│ ┌───────────────────┐ ┌───────────────────┐              │
│ │ SLA達成率         │ │ オープンインシデント│              │
│ │ 98.5%             │ │ 12件              │              │
│ │ [折れ線グラフ]    │ │ [棒グラフ]        │              │
│ └───────────────────┘ └───────────────────┘              │
├─────────────────────────────────────────────────────────────┤
│ [パフォーマンスメトリクス]                                   │
│ ┌───────────────────┐ ┌───────────────────┐              │
│ │ APIレスポンスタイム│ │ キャッシュヒット率 │              │
│ │ 125ms (P95)       │ │ 85.2%             │              │
│ │ [折れ線グラフ]    │ │ [折れ線グラフ]    │              │
│ └───────────────────┘ └───────────────────┘              │
├─────────────────────────────────────────────────────────────┤
│ [最近のアラート履歴]                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ 2026-01-31 10:15 | Critical | SLA違反: incident-123  │   │
│ │ 2026-01-31 09:45 | Warning  | CPU使用率高: 85%       │   │
│ │ 2026-01-31 09:30 | Info     | バックアップ完了       │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**データ更新頻度**:
- システムステータス: 10秒ごと自動更新
- ビジネスメトリクス: 30秒ごと自動更新
- パフォーマンスメトリクス: 15秒ごと自動更新
- アラート履歴: 5秒ごと自動更新

**優先度**: P0（必須）

---

#### FR-1.1.2: システムメトリクス表示

**要件**:
システムメトリクスセクションは以下の項目を表示しなければならない：

| メトリクス名 | 表示形式 | データソース | 閾値表示 |
|------------|---------|-------------|---------|
| **CPU使用率** | ゲージ（0-100%）+ 数値 | `process.cpuUsage()` | 80%以上で黄色、90%以上で赤色 |
| **メモリ使用率** | ゲージ（0-100%）+ 数値 | `os.freemem() / os.totalmem()` | 80%以上で黄色、90%以上で赤色 |
| **ディスク使用率** | ゲージ（0-100%）+ 数値 | `fs.statfsSync()` | 80%以上で黄色、90%以上で赤色 |
| **稼働時間** | テキスト（d:hh:mm:ss形式） | `process.uptime()` | - |
| **アクティブユーザー数** | 数値 + トレンドアイコン | `itsm_active_users_total` | - |
| **リクエスト数/分** | 数値 + トレンドアイコン | `itsm_http_requests_total` （差分計算） | - |

**API仕様**:
```
GET /api/v1/monitoring/metrics/system
```

**レスポンス例**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "cpu": {
      "usage_percent": 45.2,
      "threshold_status": "normal"  // 'normal', 'warning', 'critical'
    },
    "memory": {
      "total_mb": 4096,
      "used_mb": 2560,
      "usage_percent": 62.5,
      "threshold_status": "normal"
    },
    "disk": {
      "total_gb": 500,
      "used_gb": 275,
      "free_gb": 225,
      "usage_percent": 55.0,
      "threshold_status": "normal"
    },
    "uptime": {
      "seconds": 475200,
      "formatted": "5d 12h 00m 00s"
    },
    "active_users": {
      "current": 23,
      "trend": "up"  // 'up', 'down', 'stable'
    },
    "requests_per_minute": {
      "current": 145,
      "trend": "stable"
    }
  }
}
```

**優先度**: P0（必須）

---

#### FR-1.1.3: ビジネスメトリクス表示

**要件**:
ビジネスメトリクスセクションは以下の項目を表示しなければならない：

| メトリクス名 | 表示形式 | データソース | 更新頻度 |
|------------|---------|-------------|---------|
| **SLA達成率** | 折れ線グラフ（過去24時間） + 現在値 | `itsm_sla_compliance_rate` | 30秒 |
| **オープンインシデント数** | 棒グラフ（優先度別） + 総数 | `itsm_incidents_open` | 30秒 |
| **インシデント作成数/日** | 折れ線グラフ（過去7日間） | `itsm_incidents_total` （差分計算） | 30秒 |
| **セキュリティインシデント数** | 数値 + トレンドアイコン | `itsm_incidents_total{is_security=true}` | 30秒 |
| **平均解決時間（MTTR）** | 数値（時間単位） + トレンド | `incidents` テーブルから計算 | 5分 |

**API仕様**:
```
GET /api/v1/monitoring/metrics/business
```

**レスポンス例**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "sla_compliance": {
      "current_rate": 98.5,
      "history_24h": [
        {"timestamp": "2026-01-30T10:00:00Z", "value": 98.2},
        {"timestamp": "2026-01-30T11:00:00Z", "value": 98.4},
        // ... 24時間分
      ]
    },
    "incidents_open": {
      "total": 12,
      "by_priority": {
        "critical": 2,
        "high": 5,
        "medium": 3,
        "low": 2
      }
    },
    "incidents_created_daily": {
      "history_7d": [
        {"date": "2026-01-25", "count": 8},
        {"date": "2026-01-26", "count": 12},
        // ... 7日分
      ]
    },
    "security_incidents": {
      "current": 3,
      "trend": "down"
    },
    "mttr_hours": {
      "current": 4.5,
      "trend": "down"  // 改善傾向
    }
  }
}
```

**優先度**: P0（必須）

---

#### FR-1.1.4: パフォーマンスメトリクス表示

**要件**:
パフォーマンスメトリクスセクションは以下の項目を表示しなければならない：

| メトリクス名 | 表示形式 | データソース | 更新頻度 |
|------------|---------|-------------|---------|
| **APIレスポンスタイム** | 折れ線グラフ（P50/P95/P99） | `itsm_http_request_duration_seconds` | 15秒 |
| **キャッシュヒット率** | 折れ線グラフ + 現在値 | `itsm_cache_hit_rate` | 15秒 |
| **データベースクエリ数/分** | 折れ線グラフ | `itsm_database_queries_total` （差分計算） | 15秒 |
| **認証エラー率** | 折れ線グラフ + 現在値 | `itsm_auth_errors_total / itsm_http_requests_total` | 15秒 |
| **エラー率（4xx/5xx）** | 折れ線グラフ（2系統） | `itsm_http_requests_total{status_code=~"4..|5.."}` | 15秒 |

**API仕様**:
```
GET /api/v1/monitoring/metrics/performance
```

**レスポンス例**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "response_time": {
      "p50_ms": 85,
      "p95_ms": 125,
      "p99_ms": 250,
      "history_1h": [
        {"timestamp": "2026-01-31T09:00:00Z", "p95": 130},
        // ... 1時間分
      ]
    },
    "cache_hit_rate": {
      "current_percent": 85.2,
      "history_1h": [
        {"timestamp": "2026-01-31T09:00:00Z", "value": 84.5},
        // ... 1時間分
      ]
    },
    "db_queries_per_minute": {
      "current": 320,
      "history_1h": [
        {"timestamp": "2026-01-31T09:00:00Z", "value": 305},
        // ... 1時間分
      ]
    },
    "auth_error_rate": {
      "current_percent": 0.5,
      "history_1h": [...]
    },
    "http_error_rate": {
      "4xx_percent": 2.1,
      "5xx_percent": 0.3,
      "history_1h": [...]
    }
  }
}
```

**優先度**: P0（必須）

---

#### FR-1.1.5: アクティブアラート表示

**要件**:
ダッシュボード上部にアクティブアラートバーを表示しなければならない：

**表示内容**:
- Critical（重大）アラート数: 赤色バッジ
- Warning（警告）アラート数: 黄色バッジ
- Info（情報）アラート数: 青色バッジ

**動作**:
- クリックすると、アラート詳細モーダルを表示
- 新規アラート発生時、デスクトップ通知（オプション）
- アラート数が変化した場合、視覚的フィードバック（アニメーション）

**API仕様**:
```
GET /api/v1/monitoring/alerts?status=firing
```

**レスポンス例**:
```json
{
  "total": 8,
  "by_severity": {
    "critical": 2,
    "warning": 5,
    "info": 1
  },
  "alerts": [
    {
      "id": 123,
      "rule_name": "SLA Compliance Low",
      "severity": "critical",
      "message": "SLA達成率が95%を下回りました（現在: 93.2%）",
      "current_value": 93.2,
      "threshold": 95.0,
      "fired_at": "2026-01-31T10:15:00Z",
      "duration_seconds": 300
    },
    // ...
  ]
}
```

**優先度**: P0（必須）

---

### 1.2 アラートルール管理

#### FR-1.2.1: アラートルール一覧表示

**要件**:
アラートルール管理画面（`/views/monitoring-alerts.html`）でルール一覧を表示しなければならない：

**テーブル列**:
| 列名 | 説明 | ソート可否 |
|------|------|----------|
| ルール名 | ルールの識別名 | ✓ |
| メトリクス | 監視対象メトリクス名 | ✓ |
| 条件 | 閾値条件（`>`, `<`, `>=`, `<=`, `==`, `!=`） | - |
| 閾値 | 判定閾値 | ✓ |
| 重要度 | Critical / Warning / Info | ✓ |
| ステータス | 有効 / 無効 | ✓ |
| 最終発火 | 最後にアラートが発火した日時 | ✓ |
| 操作 | 編集 / 削除 / トグルボタン | - |

**フィルタリング**:
- 重要度でフィルター（Critical / Warning / Info / 全て）
- ステータスでフィルター（有効 / 無効 / 全て）
- メトリクス名で検索（部分一致）

**API仕様**:
```
GET /api/v1/monitoring/alert-rules?severity=critical&enabled=true&sort=rule_name&order=asc
```

**レスポンス例**:
```json
{
  "total": 25,
  "rules": [
    {
      "id": 1,
      "rule_name": "High CPU Usage",
      "metric_name": "itsm_cpu_usage_percent",
      "condition": ">",
      "threshold": 80.0,
      "duration": 300,  // 5分継続で発火
      "severity": "warning",
      "enabled": true,
      "notification_channels": ["email-ops", "slack-alerts"],
      "last_fired_at": "2026-01-31T09:45:00Z",
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-20T14:30:00Z"
    },
    // ...
  ]
}
```

**優先度**: P0（必須）

---

#### FR-1.2.2: アラートルール作成・編集

**要件**:
アラートルールの作成・編集フォームを提供しなければならない：

**フォーム項目**:
```html
<form id="alert-rule-form">
  <!-- ルール名 -->
  <input type="text" name="rule_name" required maxlength="100"
         placeholder="例: High CPU Usage">

  <!-- メトリクス選択 -->
  <select name="metric_name" required>
    <option value="">-- メトリクスを選択 --</option>
    <option value="itsm_cpu_usage_percent">CPU使用率 (%)</option>
    <option value="itsm_memory_usage_percent">メモリ使用率 (%)</option>
    <option value="itsm_sla_compliance_rate">SLA達成率 (%)</option>
    <!-- 他のメトリクス -->
  </select>

  <!-- 条件 -->
  <select name="condition" required>
    <option value=">">より大きい (&gt;)</option>
    <option value=">=">以上 (&gt;=)</option>
    <option value="<">より小さい (&lt;)</option>
    <option value="<=">以下 (&lt;=)</option>
    <option value="==">等しい (==)</option>
    <option value="!=">等しくない (!=)</option>
  </select>

  <!-- 閾値 -->
  <input type="number" name="threshold" required step="0.01"
         placeholder="例: 80.0">

  <!-- 継続時間 -->
  <input type="number" name="duration" required min="60" step="60"
         placeholder="秒数 (例: 300 = 5分)">

  <!-- 重要度 -->
  <select name="severity" required>
    <option value="critical">🔴 Critical（重大）</option>
    <option value="warning">⚠️ Warning（警告）</option>
    <option value="info">ℹ️ Info（情報）</option>
  </select>

  <!-- 通知チャネル（複数選択） -->
  <select name="notification_channels" multiple required>
    <option value="email-ops">メール: ops@example.com</option>
    <option value="slack-alerts">Slack: #alerts</option>
    <option value="webhook-pagerduty">Webhook: PagerDuty</option>
  </select>

  <!-- 有効/無効 -->
  <label>
    <input type="checkbox" name="enabled" checked> ルールを有効にする
  </label>

  <button type="submit">ルールを保存</button>
</form>
```

**バリデーション**:
- ルール名: 必須、最大100文字、重複不可
- メトリクス名: 必須、存在するメトリクスのみ
- 閾値: 必須、数値型
- 継続時間: 必須、60秒以上
- 通知チャネル: 最低1つ選択必須

**API仕様**:
```
POST /api/v1/monitoring/alert-rules
PUT /api/v1/monitoring/alert-rules/:id
```

**リクエスト例**:
```json
{
  "rule_name": "High CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 80.0,
  "duration": 300,
  "severity": "warning",
  "enabled": true,
  "notification_channels": ["email-ops", "slack-alerts"]
}
```

**レスポンス（成功）**:
```json
{
  "id": 1,
  "rule_name": "High CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 80.0,
  "duration": 300,
  "severity": "warning",
  "enabled": true,
  "notification_channels": ["email-ops", "slack-alerts"],
  "created_at": "2026-01-31T10:00:00Z",
  "updated_at": "2026-01-31T10:00:00Z"
}
```

**優先度**: P0（必須）

---

#### FR-1.2.3: アラートルール削除

**要件**:
アラートルールを削除できなければならない：

**動作**:
1. 削除ボタンクリック時、確認ダイアログを表示
   ```
   本当にこのアラートルールを削除しますか？

   ルール名: High CPU Usage

   この操作は元に戻せません。
   [キャンセル] [削除]
   ```
2. 削除実行時、関連するアラート履歴は保持（ルール名のみ記録）

**API仕様**:
```
DELETE /api/v1/monitoring/alert-rules/:id
```

**レスポンス（成功）**:
```json
{
  "status": "success",
  "deleted": {
    "id": 1,
    "rule_name": "High CPU Usage"
  }
}
```

**優先度**: P0（必須）

---

#### FR-1.2.4: アラートルールのテスト評価

**要件**:
ルール作成/編集時、現在のメトリクス値でテスト評価できなければならない：

**動作**:
1. フォーム下部に「ルールをテスト」ボタンを配置
2. クリック時、現在のメトリクス値を取得
3. ルール条件で評価
4. 結果を表示:
   ```
   ✅ テスト結果: アラートは発火しません
   現在値: 45.2% < 閾値: 80.0%
   ```
   または
   ```
   ⚠️ テスト結果: アラートが発火します
   現在値: 85.3% > 閾値: 80.0%
   ```

**API仕様**:
```
POST /api/v1/monitoring/alert-rules/test
```

**リクエスト例**:
```json
{
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 80.0
}
```

**レスポンス例**:
```json
{
  "would_fire": false,
  "current_value": 45.2,
  "threshold": 80.0,
  "condition": ">",
  "message": "アラートは発火しません（45.2% < 80.0%）"
}
```

**優先度**: P1（高）

---

### 1.3 アラート履歴管理

#### FR-1.3.1: アラート履歴一覧表示

**要件**:
アラート履歴画面（`/views/monitoring-alert-history.html`）でアラート履歴を表示しなければならない：

**テーブル列**:
| 列名 | 説明 | ソート可否 |
|------|------|----------|
| 発火日時 | アラートが発火した日時 | ✓ |
| ルール名 | アラートルール名 | ✓ |
| 重要度 | Critical / Warning / Info | ✓ |
| メッセージ | アラート内容 | - |
| 現在値 | メトリクスの現在値 | - |
| ステータス | Firing / Acknowledged / Resolved | ✓ |
| 確認者 | アラートを確認したユーザー | - |
| 操作 | 確認 / 解決ボタン | - |

**フィルタリング**:
- 日付範囲（From-To）
- 重要度（Critical / Warning / Info / 全て）
- ステータス（Firing / Acknowledged / Resolved / 全て）
- ルール名検索（部分一致）

**ページネーション**:
- 1ページあたり20件
- ページャーコントロール

**API仕様**:
```
GET /api/v1/monitoring/alerts?status=firing&severity=critical&from=2026-01-25&to=2026-01-31&limit=20&offset=0&sort=created_at&order=desc
```

**レスポンス例**:
```json
{
  "total": 150,
  "limit": 20,
  "offset": 0,
  "alerts": [
    {
      "id": 123,
      "rule_id": 1,
      "rule_name": "High CPU Usage",
      "metric_name": "itsm_cpu_usage_percent",
      "current_value": 85.3,
      "threshold": 80.0,
      "severity": "warning",
      "status": "acknowledged",
      "message": "CPU使用率が80%を超えました（現在: 85.3%）",
      "acknowledged_by": 5,
      "acknowledged_by_username": "admin",
      "acknowledged_at": "2026-01-31T10:20:00Z",
      "resolved_at": null,
      "created_at": "2026-01-31T10:15:00Z"
    },
    // ...
  ]
}
```

**優先度**: P0（必須）

---

#### FR-1.3.2: アラート確認（Acknowledge）

**要件**:
発火中のアラートを「確認済み」としてマークできなければならない：

**動作**:
1. アラート履歴テーブルの「確認」ボタンをクリック
2. 確認コメント入力モーダルを表示（任意）
   ```
   アラートを確認します

   ルール名: High CPU Usage
   発火日時: 2026-01-31 10:15

   コメント（任意）:
   [テキストエリア]

   [キャンセル] [確認]
   ```
3. ステータスを `acknowledged` に更新
4. 確認者、確認日時を記録

**API仕様**:
```
PUT /api/v1/monitoring/alerts/:id/acknowledge
```

**リクエスト例**:
```json
{
  "comment": "調査中。CPU使用率のスパイクを確認。"
}
```

**レスポンス（成功）**:
```json
{
  "id": 123,
  "status": "acknowledged",
  "acknowledged_by": 5,
  "acknowledged_by_username": "admin",
  "acknowledged_at": "2026-01-31T10:20:00Z",
  "comment": "調査中。CPU使用率のスパイクを確認。"
}
```

**優先度**: P0（必須）

---

#### FR-1.3.3: アラート解決（Resolve）

**要件**:
アラートを「解決済み」としてマークできなければならない：

**動作**:
1. アラート履歴テーブルの「解決」ボタンをクリック
2. 解決コメント入力モーダルを表示（必須）
   ```
   アラートを解決します

   ルール名: High CPU Usage
   発火日時: 2026-01-31 10:15

   解決内容（必須）:
   [テキストエリア - 必須フィールド]

   [キャンセル] [解決]
   ```
3. ステータスを `resolved` に更新
4. 解決日時を記録

**バリデーション**:
- 解決コメントは必須（最低10文字）

**API仕様**:
```
PUT /api/v1/monitoring/alerts/:id/resolve
```

**リクエスト例**:
```json
{
  "resolution": "不要なプロセスを停止し、CPU使用率が正常値に戻りました。"
}
```

**レスポンス（成功）**:
```json
{
  "id": 123,
  "status": "resolved",
  "resolved_at": "2026-01-31T10:30:00Z",
  "resolution": "不要なプロセスを停止し、CPU使用率が正常値に戻りました。"
}
```

**優先度**: P0（必須）

---

### 1.4 通知チャネル管理

#### FR-1.4.1: 通知チャネル一覧表示

**要件**:
通知設定画面（`/views/monitoring-notifications.html`）で通知チャネル一覧を表示しなければならない：

**テーブル列**:
| 列名 | 説明 |
|------|------|
| チャネル名 | 識別名 |
| タイプ | Email / Slack / Webhook |
| 設定 | 宛先（メールアドレス、Webhook URL等） |
| ステータス | 有効 / 無効 |
| 最終送信 | 最後に通知を送信した日時 |
| 操作 | 編集 / 削除 / テスト送信 |

**API仕様**:
```
GET /api/v1/monitoring/notification-channels
```

**レスポンス例**:
```json
{
  "total": 5,
  "channels": [
    {
      "id": 1,
      "channel_name": "email-ops",
      "channel_type": "email",
      "config": {
        "recipients": ["ops@example.com", "admin@example.com"]
      },
      "enabled": true,
      "last_sent_at": "2026-01-31T10:15:00Z",
      "created_at": "2026-01-15T10:00:00Z"
    },
    {
      "id": 2,
      "channel_name": "slack-alerts",
      "channel_type": "slack",
      "config": {
        "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
      },
      "enabled": true,
      "last_sent_at": "2026-01-31T10:15:00Z",
      "created_at": "2026-01-20T14:00:00Z"
    },
    // ...
  ]
}
```

**優先度**: P0（必須）

---

#### FR-1.4.2: メール通知チャネル登録

**要件**:
メール通知チャネルを登録できなければならない：

**フォーム項目**:
```html
<form id="email-channel-form">
  <input type="text" name="channel_name" required
         placeholder="例: email-ops">

  <textarea name="recipients" required rows="3"
            placeholder="メールアドレス（カンマ区切りまたは改行区切り）&#10;例:&#10;ops@example.com&#10;admin@example.com"></textarea>

  <label>
    <input type="checkbox" name="enabled" checked> チャネルを有効にする
  </label>

  <button type="submit">チャネルを登録</button>
</form>
```

**バリデーション**:
- チャネル名: 必須、英数字とハイフンのみ、重複不可
- 受信者: 最低1件、有効なメールアドレス形式

**API仕様**:
```
POST /api/v1/monitoring/notification-channels
```

**リクエスト例**:
```json
{
  "channel_name": "email-ops",
  "channel_type": "email",
  "config": {
    "recipients": ["ops@example.com", "admin@example.com"]
  },
  "enabled": true
}
```

**優先度**: P0（必須）

---

#### FR-1.4.3: Slack通知チャネル登録

**要件**:
Slack Webhook通知チャネルを登録できなければならない：

**フォーム項目**:
```html
<form id="slack-channel-form">
  <input type="text" name="channel_name" required
         placeholder="例: slack-alerts">

  <input type="url" name="webhook_url" required
         placeholder="Webhook URL: https://hooks.slack.com/services/...">

  <input type="text" name="username"
         placeholder="Bot名（任意、デフォルト: ITSM Alert Bot）">

  <input type="text" name="icon_emoji"
         placeholder="アイコン絵文字（任意、デフォルト: :warning:）">

  <label>
    <input type="checkbox" name="enabled" checked> チャネルを有効にする
  </label>

  <button type="submit">チャネルを登録</button>
</form>
```

**バリデーション**:
- Webhook URL: 必須、`https://hooks.slack.com/` で始まるURL

**API仕様**:
```
POST /api/v1/monitoring/notification-channels
```

**リクエスト例**:
```json
{
  "channel_name": "slack-alerts",
  "channel_type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
    "username": "ITSM Alert Bot",
    "icon_emoji": ":warning:"
  },
  "enabled": true
}
```

**Slack通知フォーマット例**:
```json
{
  "username": "ITSM Alert Bot",
  "icon_emoji": ":warning:",
  "attachments": [
    {
      "color": "warning",
      "title": "⚠️ Alert: High CPU Usage",
      "text": "CPU使用率が80%を超えました",
      "fields": [
        {
          "title": "現在値",
          "value": "85.3%",
          "short": true
        },
        {
          "title": "閾値",
          "value": "80.0%",
          "short": true
        },
        {
          "title": "発火日時",
          "value": "2026-01-31 10:15:00",
          "short": true
        },
        {
          "title": "ダッシュボード",
          "value": "<https://192.168.0.187:6443/views/monitoring.html|View Dashboard>",
          "short": false
        }
      ]
    }
  ]
}
```

**優先度**: P0（必須）

---

#### FR-1.4.4: カスタムWebhook通知チャネル登録

**要件**:
カスタムWebhook通知チャネルを登録できなければならない：

**フォーム項目**:
```html
<form id="webhook-channel-form">
  <input type="text" name="channel_name" required
         placeholder="例: webhook-pagerduty">

  <input type="url" name="webhook_url" required
         placeholder="Webhook URL">

  <select name="http_method">
    <option value="POST">POST</option>
    <option value="PUT">PUT</option>
  </select>

  <textarea name="custom_headers" rows="3"
            placeholder="カスタムヘッダー（JSON形式、任意）&#10;例: {&quot;Authorization&quot;: &quot;Bearer token123&quot;}"></textarea>

  <textarea name="payload_template" rows="5" required
            placeholder="ペイロードテンプレート（JSON形式）&#10;変数: {{rule_name}}, {{severity}}, {{current_value}}, {{threshold}}, {{message}}"></textarea>

  <label>
    <input type="checkbox" name="enabled" checked> チャネルを有効にする
  </label>

  <button type="submit">チャネルを登録</button>
</form>
```

**ペイロードテンプレート例**:
```json
{
  "severity": "{{severity}}",
  "summary": "{{rule_name}}: {{message}}",
  "details": {
    "current_value": {{current_value}},
    "threshold": {{threshold}}
  },
  "timestamp": "{{timestamp}}"
}
```

**API仕様**:
```
POST /api/v1/monitoring/notification-channels
```

**リクエスト例**:
```json
{
  "channel_name": "webhook-pagerduty",
  "channel_type": "webhook",
  "config": {
    "webhook_url": "https://api.pagerduty.com/incidents",
    "http_method": "POST",
    "custom_headers": {
      "Authorization": "Bearer token123"
    },
    "payload_template": "{\"severity\":\"{{severity}}\",\"summary\":\"{{rule_name}}: {{message}}\"}"
  },
  "enabled": true
}
```

**優先度**: P1（高）

---

#### FR-1.4.5: 通知チャネルのテスト送信

**要件**:
通知チャネル登録時、テスト送信で動作確認できなければならない：

**動作**:
1. 通知チャネル一覧の「テスト送信」ボタンをクリック
2. テストメッセージを送信
3. 送信結果を表示

**テストメッセージ内容**:
```
件名（メール）: [TEST] ITSM Monitoring Alert Test
本文:
これはITSM-Sec Nexus監視システムからのテスト通知です。

チャネル名: email-ops
送信日時: 2026-01-31 10:30:00

この通知が届いた場合、通知チャネルは正しく設定されています。
```

**API仕様**:
```
POST /api/v1/monitoring/notification-channels/:id/test
```

**レスポンス（成功）**:
```json
{
  "status": "success",
  "message": "テスト通知を送信しました",
  "channel_name": "email-ops",
  "sent_at": "2026-01-31T10:30:00Z"
}
```

**レスポンス（失敗）**:
```json
{
  "status": "error",
  "message": "テスト通知の送信に失敗しました",
  "error": "SMTP接続エラー: Connection timeout"
}
```

**優先度**: P1（高）

---

### 1.5 メトリクス履歴保存

#### FR-1.5.1: メトリクススナップショット保存

**要件**:
システムは定期的に全メトリクスのスナップショットを保存しなければならない：

**保存頻度**: 5分ごと

**保存対象メトリクス**:
- すべてのPrometheusメトリクス（`itsm_*`）
- システムメトリクス（CPU、メモリ、ディスク）
- ビジネスメトリクス（SLA、インシデント統計）

**データベーステーブル**:
```sql
CREATE TABLE metric_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  labels TEXT,  -- JSON形式（例: {"priority": "high"}）
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metric_timestamp (metric_name, timestamp)
);
```

**保存例**:
```sql
INSERT INTO metric_history (metric_name, metric_value, labels, timestamp) VALUES
('itsm_cpu_usage_percent', 45.2, NULL, '2026-01-31 10:00:00'),
('itsm_memory_usage_percent', 62.5, NULL, '2026-01-31 10:00:00'),
('itsm_sla_compliance_rate', 98.5, '{"service_name": "incident_management"}', '2026-01-31 10:00:00'),
('itsm_incidents_open', 12, '{"priority": "high"}', '2026-01-31 10:00:00');
```

**スケジューリング**:
```javascript
// backend/services/schedulerService.js
cron.schedule('*/5 * * * *', async () => {
  await monitoringService.saveMetricsSnapshot();
});
```

**優先度**: P0（必須）

---

#### FR-1.5.2: メトリクス履歴取得API

**要件**:
指定期間のメトリクス履歴を取得できなければならない：

**API仕様**:
```
GET /api/v1/monitoring/metrics/history?metric_name=itsm_cpu_usage_percent&from=2026-01-30T00:00:00Z&to=2026-01-31T00:00:00Z&interval=5m
```

**クエリパラメータ**:
- `metric_name`: 必須、メトリクス名
- `from`: 必須、開始日時（ISO 8601形式）
- `to`: 必須、終了日時（ISO 8601形式）
- `interval`: 任意、集約間隔（5m, 15m, 1h, 1d）、デフォルト: 5m
- `labels`: 任意、ラベルフィルター（JSON形式）

**レスポンス例**:
```json
{
  "metric_name": "itsm_cpu_usage_percent",
  "from": "2026-01-30T00:00:00Z",
  "to": "2026-01-31T00:00:00Z",
  "interval": "5m",
  "data_points": [
    {
      "timestamp": "2026-01-30T00:00:00Z",
      "value": 42.5
    },
    {
      "timestamp": "2026-01-30T00:05:00Z",
      "value": 45.2
    },
    // ... 最大288ポイント（24時間 × 12回/時）
  ]
}
```

**優先度**: P0（必須）

---

#### FR-1.5.3: 古いメトリクス履歴の自動削除

**要件**:
システムは保存期間を超えた古いメトリクス履歴を自動削除しなければならない：

**保存期間**: 30日間

**削除タイミング**: 毎日 01:00 AM

**削除ロジック**:
```sql
DELETE FROM metric_history
WHERE timestamp < datetime('now', '-30 days');
```

**スケジューリング**:
```javascript
// backend/services/schedulerService.js
cron.schedule('0 1 * * *', async () => {
  await monitoringService.cleanOldMetrics();
});
```

**ログ出力**:
```
[2026-01-31 01:00:00] [INFO] [MonitoringService] Cleaning old metric history (older than 30 days)
[2026-01-31 01:00:05] [INFO] [MonitoringService] Deleted 12345 old metric records
```

**優先度**: P0（必須）

---

### 1.6 ヘルスチェック拡張

#### FR-1.6.1: 詳細ヘルスチェックAPI

**要件**:
既存の `/api/v1/health/ready` を拡張し、詳細ヘルスチェックを提供しなければならない：

**新規エンドポイント**:
```
GET /api/v1/health/detailed
```

**レスポンス例**:
```json
{
  "status": "UP",
  "timestamp": "2026-01-31T10:00:00Z",
  "checks": {
    "database": {
      "status": "UP",
      "response_time_ms": 5,
      "details": {
        "tables": 42,
        "size_mb": 12.5,
        "connections": 3
      }
    },
    "disk": {
      "status": "UP",
      "free_space_percent": 45.2,
      "free_space_gb": 220,
      "threshold_warning": 80,
      "threshold_critical": 90
    },
    "memory": {
      "status": "UP",
      "total_mb": 4096,
      "used_mb": 2560,
      "used_percent": 62.5,
      "threshold_warning": 80,
      "threshold_critical": 90
    },
    "cache": {
      "status": "UP",
      "hit_rate": 85.2,
      "keys": 1234,
      "memory_mb": 50
    },
    "scheduler": {
      "status": "UP",
      "active_jobs": 3,
      "last_run": {
        "backup_daily": "2026-01-31T02:00:15Z",
        "metrics_snapshot": "2026-01-31T09:55:00Z",
        "alert_evaluation": "2026-01-31T09:59:00Z"
      }
    },
    "external_services": {
      "prometheus": {
        "status": "UP",
        "url": "http://localhost:9090"
      },
      "smtp": {
        "status": "UP",
        "host": "smtp.example.com"
      },
      "slack": {
        "status": "NOT_CONFIGURED"
      }
    }
  },
  "uptime_seconds": 475200,
  "version": "2.1.0"
}
```

**ステータス値**:
- `UP`: 正常
- `DOWN`: 異常
- `DEGRADED`: 部分的な問題
- `NOT_CONFIGURED`: 未設定

**優先度**: P1（高）

---

## 2. 非機能要件

### 2.1 パフォーマンス

#### NFR-2.1.1: メトリクスAPI応答時間

**要件**:
メトリクス取得APIは以下の応答時間を満たさなければならない：

| API | 目標応答時間 | 測定基準 | データ量 |
|-----|------------|---------|---------|
| GET /api/v1/monitoring/metrics/system | ≤ 100ms | P95 | リアルタイム値のみ |
| GET /api/v1/monitoring/metrics/business | ≤ 200ms | P95 | リアルタイム値 + 集計 |
| GET /api/v1/monitoring/metrics/performance | ≤ 150ms | P95 | リアルタイム値のみ |
| GET /api/v1/monitoring/metrics/history | ≤ 500ms | P95 | 最大288ポイント（24時間） |

**優先度**: P0

---

#### NFR-2.1.2: ダッシュボード描画時間

**要件**:
監視ダッシュボードの初回描画は以下の時間以内に完了しなければならない：

| フェーズ | 目標時間 | 測定方法 |
|---------|---------|---------|
| 初回HTMLロード | ≤ 500ms | DOMContentLoaded |
| APIデータ取得 | ≤ 800ms | 並列3リクエスト |
| グラフ描画 | ≤ 700ms | Chart.jsレンダリング |
| **合計（初回表示）** | **≤ 2秒** | ページロード完了まで |

**優先度**: P0

---

#### NFR-2.1.3: アラート評価遅延

**要件**:
アラートルール評価は以下の遅延以内に完了しなければならない：

| 項目 | 目標値 | 測定方法 |
|------|--------|---------|
| 評価間隔 | 1分 | スケジューラー設定 |
| 全ルール評価時間 | ≤ 30秒 | 最大100ルールの場合 |
| 1ルールあたりの評価時間 | ≤ 300ms | P95 |
| アラート発火から通知送信まで | ≤ 60秒 | エンドツーエンド |

**優先度**: P0

---

#### NFR-2.1.4: 通知送信時間

**要件**:
通知送信は以下の時間以内に完了しなければならない：

| 通知タイプ | 目標送信時間 | タイムアウト |
|-----------|------------|------------|
| メール | ≤ 5秒 | 10秒 |
| Slack Webhook | ≤ 3秒 | 5秒 |
| カスタムWebhook | ≤ 3秒 | 5秒 |

**失敗時の動作**:
- タイムアウト発生時、エラーログを記録
- リトライは行わない（通知履歴に失敗を記録）

**優先度**: P1

---

### 2.2 可用性

#### NFR-2.2.1: 監視システムの稼働率

**要件**:
監視システム自体の稼働率は以下を満たさなければならない：

**目標**: ≥ 99.9%（月間ダウンタイム: 43分以内）

**測定方法**:
- ヘルスチェックエンドポイント（`/api/v1/health/detailed`）の可用性
- 1分ごとのアップタイム監視

**優先度**: P0

---

#### NFR-2.2.2: アラート評価の継続性

**要件**:
アラート評価エンジンは以下の継続性を保たなければならない：

**目標**: 評価失敗率 < 1%

**測定方法**:
- 評価成功回数 / 総評価試行回数 × 100
- スケジューラーの実行ログで追跡

**優先度**: P0

---

#### NFR-2.2.3: 通知送信の成功率

**要件**:
通知送信の成功率は以下を満たさなければならない：

**目標**: ≥ 95%

**測定方法**:
- 送信成功回数 / 総送信試行回数 × 100
- `notification_history` テーブルの `status` で追跡

**優先度**: P1

---

### 2.3 スケーラビリティ

#### NFR-2.3.1: メトリクス数のスケーラビリティ

**要件**:
システムは以下のメトリクス数に対応しなければならない：

| 項目 | 初期値 | 最大値 |
|------|--------|--------|
| Prometheusメトリクス総数 | 50 | 200 |
| アラートルール数 | 20 | 100 |
| 通知チャネル数 | 5 | 20 |
| 同時アクティブアラート数 | 10 | 50 |

**優先度**: P1

---

#### NFR-2.3.2: メトリクス履歴のスケーラビリティ

**要件**:
メトリクス履歴保存は以下のデータ量に対応しなければならない：

**想定データ量**:
- メトリクス数: 50項目
- 保存頻度: 5分ごと（12回/時間）
- 保存期間: 30日間
- **総レコード数**: 50 × 12 × 24 × 30 = **432,000件**

**ディスク使用量見積もり**:
- 1レコードあたり平均100バイト
- 総容量: 432,000 × 100 / 1024 / 1024 ≈ **41 MB**

**優先度**: P1

---

#### NFR-2.3.3: 同時接続数

**要件**:
監視ダッシュボードは以下の同時接続数に対応しなければならない：

| 項目 | 目標値 |
|------|--------|
| 同時接続ユーザー数 | 50 |
| リアルタイム更新（ポーリング） | 10秒間隔 |
| 同時APIリクエスト数 | 150リクエスト/秒 |

**優先度**: P1

---

### 2.4 セキュリティ

#### NFR-2.4.1: 認証・認可

**要件**:
すべての監視API・UIは以下のセキュリティ要件を満たさなければならない：

| 項目 | 要件 |
|------|------|
| 認証方式 | JWTトークン必須 |
| 権限レベル | Admin権限のみアクセス可能 |
| トークン検証 | 全APIリクエストで検証 |
| セッション管理 | トークン有効期限24時間 |

**API権限マトリクス**:
| API | Admin | Manager | Analyst | Viewer |
|-----|-------|---------|---------|--------|
| GET /api/v1/monitoring/metrics/* | ✓ | ✓ | ✓ | ✓ |
| GET /api/v1/monitoring/alerts | ✓ | ✓ | ✓ | ✓ |
| PUT /api/v1/monitoring/alerts/:id/acknowledge | ✓ | ✓ | ✗ | ✗ |
| POST /api/v1/monitoring/alert-rules | ✓ | ✗ | ✗ | ✗ |
| DELETE /api/v1/monitoring/alert-rules/:id | ✓ | ✗ | ✗ | ✗ |
| POST /api/v1/monitoring/notification-channels | ✓ | ✗ | ✗ | ✗ |

**優先度**: P0（セキュリティ要件）

---

#### NFR-2.4.2: 監査ログ記録

**要件**:
すべての監視操作を監査ログに記録しなければならない：

**記録対象操作**:
- アラートルール作成/編集/削除
- アラート確認/解決
- 通知チャネル作成/編集/削除
- 通知送信（成功/失敗）

**監査ログテーブル**:
```sql
CREATE TABLE monitoring_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,  -- 'create_rule', 'acknowledge_alert', 'send_notification' 等
  resource_type TEXT NOT NULL,  -- 'alert_rule', 'alert', 'notification_channel'
  resource_id INTEGER,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,  -- JSON形式
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**優先度**: P0（コンプライアンス要件）

---

#### NFR-2.4.3: 機密情報の保護

**要件**:
通知チャネル設定内の機密情報を保護しなければならない：

**保護対象**:
- Slack Webhook URL
- カスタムWebhook認証トークン
- SMTPパスワード（既存実装）

**保護方法**:
- データベース保存時: AES-256暗号化（環境変数のキーで暗号化）
- API取得時: マスク表示（`https://hooks.slack.com/services/T****/B****/****`）
- ログ出力時: 機密情報を除外

**優先度**: P0（セキュリティ要件）

---

### 2.5 保守性

#### NFR-2.5.1: ログ出力

**要件**:
監視システムは以下のログを出力しなければならない：

**ログレベル**:
- **INFO**: 正常な操作（メトリクス保存、アラート評価完了、通知送信成功）
- **WARN**: 警告（通知送信遅延、メトリクス取得失敗）
- **ERROR**: エラー（アラート評価失敗、通知送信失敗）
- **CRITICAL**: 致命的エラー（スケジューラー停止、データベース接続失敗）

**ログフォーマット**:
```
[2026-01-31 10:00:00] [INFO] [MonitoringService] Metrics snapshot saved (50 metrics, duration: 1.2s)
[2026-01-31 10:01:00] [INFO] [AlertService] Alert rules evaluated (25 rules, 2 firing, duration: 5.3s)
[2026-01-31 10:01:05] [INFO] [NotificationService] Alert notification sent (channel: email-ops, alert_id: 123, status: success)
[2026-01-31 10:02:00] [ERROR] [NotificationService] Failed to send Slack notification (channel: slack-alerts, error: Connection timeout)
```

**優先度**: P0

---

#### NFR-2.5.2: エラーハンドリング

**要件**:
すべてのエラーは適切にハンドリングし、ユーザーフレンドリーなメッセージを返す：

**エラーメッセージ例**:
```json
{
  "error": "metric_not_found",
  "message": "指定されたメトリクスが見つかりません。",
  "user_action": "メトリクス名を確認してください。利用可能なメトリクスはAPIドキュメントを参照してください。",
  "details": {
    "metric_name": "invalid_metric_name"
  }
}
```

**優先度**: P1

---

#### NFR-2.5.3: 設定の外部化

**要件**:
監視システムの設定は環境変数で外部化しなければならない：

**環境変数**:
```bash
# メトリクス履歴保存
METRICS_RETENTION_DAYS=30  # メトリクス履歴保存期間（デフォルト: 30日）
METRICS_SNAPSHOT_INTERVAL=5  # スナップショット保存間隔（分、デフォルト: 5）

# アラート評価
ALERT_EVALUATION_INTERVAL=1  # 評価間隔（分、デフォルト: 1）
ALERT_EVALUATION_TIMEOUT=30  # 評価タイムアウト（秒、デフォルト: 30）

# 通知
NOTIFICATION_TIMEOUT=5  # 通知送信タイムアウト（秒、デフォルト: 5）

# ヘルスチェック閾値
HEALTH_DISK_WARNING_THRESHOLD=80  # ディスク使用率警告閾値（%、デフォルト: 80）
HEALTH_DISK_CRITICAL_THRESHOLD=90  # ディスク使用率危険閾値（%、デフォルト: 90）
HEALTH_MEMORY_WARNING_THRESHOLD=80  # メモリ使用率警告閾値（%、デフォルト: 80）
HEALTH_MEMORY_CRITICAL_THRESHOLD=90  # メモリ使用率危険閾値（%、デフォルト: 90）
```

**優先度**: P1

---

### 2.6 アクセシビリティ

#### NFR-2.6.1: WCAG 2.1 Level AA準拠

**要件**:
監視ダッシュボードUIはWCAG 2.1 Level AA準拠でなければならない：

| 項目 | 要件 | 実装方法 |
|------|------|---------|
| **カラーコントラスト** | 4.5:1以上 | テキストと背景色のコントラスト確保 |
| **キーボードナビゲーション** | 全機能操作可能 | Tab、Enter、Escapeキー対応 |
| **スクリーンリーダー対応** | ARIA属性使用 | aria-label, aria-live, role属性 |
| **フォーカス表示** | 明確なフォーカスインジケーター | アウトライン表示（青色、2px） |

**アラート重要度の色覚対応**:
- Critical: 🔴 赤色 + "Critical" テキスト + アイコン
- Warning: ⚠️ 黄色 + "Warning" テキスト + アイコン
- Info: ℹ️ 青色 + "Info" テキスト + アイコン

**優先度**: P0（WCAG準拠要件）

---

#### NFR-2.6.2: レスポンシブデザイン

**要件**:
監視ダッシュボードは以下の画面サイズに対応しなければならない：

| デバイス | 画面幅 | レイアウト |
|---------|--------|----------|
| デスクトップ | ≥ 1200px | 2カラム（グラフ横並び） |
| タブレット | 768px - 1199px | 1-2カラム（可変） |
| モバイル | < 768px | 1カラム（縦積み） |

**優先度**: P2（将来実装）

---

### 2.7 コンプライアンス

#### NFR-2.7.1: ISO 20000準拠

**要件**:
ISO/IEC 20000-1:2018の以下の要求事項に準拠：

| 要求事項 | Phase 9.2 での対応 | 証跡 |
|---------|------------------|------|
| **6.2 サービス継続性および可用性管理** | 可用性メトリクス監視、アラート機能 | メトリクス履歴、アラート履歴 |
| **9.1 サービスレベル管理** | SLA達成率のリアルタイム監視、違反アラート | SLAメトリクス、アラートログ |
| **9.2 サービス報告** | ダッシュボードによる可視化、メトリクス履歴 | メトリクス履歴、グラフ |

**証跡保存**:
- メトリクス履歴: 30日間
- アラート履歴: 無期限（削除機能なし）
- 監査ログ: 無期限

**優先度**: P0（監査要件）

---

#### NFR-2.7.2: NIST CSF 2.0準拠

**要件**:
NIST CSF 2.0の以下の要求事項に準拠：

| Function | Category | Phase 9.2 での対応 | 証跡 |
|----------|----------|------------------|------|
| **DETECT (DE)** | DE.CM-1: ネットワークとシステムを監視 | システムリソース監視、パフォーマンス監視 | メトリクス履歴、アラート履歴 |
| **DETECT (DE)** | DE.CM-7: セキュリティイベントを監視 | 認証エラー監視、セキュリティインシデント監視 | セキュリティメトリクス |
| **RESPOND (RS)** | RS.AN-1: 通知を分析 | アラート管理、確認/解決ワークフロー | アラート履歴、監査ログ |
| **GOVERN (GV)** | GV.OC-3: 運用メトリクスの追跡 | ビジネスメトリクス、SLAメトリクス | メトリクス履歴 |

**優先度**: P0（監査要件）

---

## 3. 制約事項

### 3.1 技術的制約

| 制約 | 詳細 |
|------|------|
| **リアルタイム更新方式** | ポーリング方式（10秒間隔）のみ対応。WebSocketは将来実装。 |
| **グラフライブラリ** | Chart.js 3.9+のみ対応。D3.jsは未対応。 |
| **メトリクス保存期間** | 30日間に制限（ディスク容量節約のため） |
| **アラートルール数** | 最大100ルール（評価時間制約のため） |
| **通知リトライ** | 失敗時のリトライ機能なし（将来実装） |
| **分散トレーシング** | Phase 9.2では未対応（Phase 10で実装予定） |

---

### 3.2 運用上の制約

| 制約 | 詳細 |
|------|------|
| **メトリクススナップショット** | 5分間隔に制限（DB負荷軽減のため） |
| **アラート評価頻度** | 1分間隔に制限（CPU負荷軽減のため） |
| **通知送信タイムアウト** | 5秒に制限（レスポンス性確保のため） |
| **同時接続数** | 50ユーザーまで（本番環境スケールアウトで対応） |

---

### 3.3 環境制約

| 制約 | 詳細 |
|------|------|
| **OS** | Linux（Ubuntu 20.04+ 推奨）、Windows（WSL2経由） |
| **Node.js** | v20.x LTS |
| **ブラウザ** | Chrome 90+、Firefox 88+、Safari 14+（ES6必須） |
| **ディスク** | メトリクス履歴用に最低500MB推奨 |

---

## 4. 受入基準

### 4.1 機能テスト

**テストケース**: 60件以上

**主要テストシナリオ**:
1. 監視ダッシュボード表示（システム/ビジネス/パフォーマンスメトリクス）
2. リアルタイム更新動作確認
3. アラートルール作成/編集/削除
4. アラートルールのテスト評価
5. アラート発火・通知送信
6. アラート確認/解決ワークフロー
7. メール通知チャネル登録・テスト送信
8. Slack通知チャネル登録・テスト送信
9. カスタムWebhook通知チャネル登録・テスト送信
10. メトリクス履歴保存・取得
11. 詳細ヘルスチェック
12. 権限チェック（Admin以外はアクセス拒否）

**合格基準**: 全テストケースPASS

---

### 4.2 非機能テスト

**パフォーマンステスト**:
- メトリクスAPI応答時間 ≤ 200ms（P95）
- ダッシュボード初回描画 ≤ 2秒
- アラート評価遅延 ≤ 60秒

**セキュリティテスト**:
- Admin権限なしでAPI呼び出し → 403エラー
- 不正なJWTトークン → 401エラー
- Webhook URLの暗号化確認

**負荷テスト**:
- 同時接続50ユーザーで安定動作
- 100アラートルール評価が30秒以内に完了

**合格基準**: 全非機能要件を満たす

---

### 4.3 統合テスト

**テストシナリオ**:
1. アラート発火 → 通知送信（メール/Slack） → アラート履歴記録
2. メトリクス履歴保存 → グラフ表示
3. ヘルスチェック異常 → アラート発火 → 通知送信

**合格基準**:
- エンドツーエンドで動作確認
- 通知が正しく送信される
- 監査ログに全操作が記録される

---

### 4.4 アクセシビリティテスト

**テストツール**: axe-core 4.8.2

**合格基準**:
- WCAG 2.1 Level AA違反ゼロ
- キーボードのみで全機能操作可能
- スクリーンリーダー（NVDA/JAWS）で読み上げ確認

---

### 4.5 ドキュメント

**必須ドキュメント**:
- [ ] 運用ガイド（`docs-prod/MONITORING_OPERATIONS.md`）
- [ ] アラート設定ガイド（`docs-prod/ALERT_CONFIGURATION.md`）
- [ ] トラブルシューティングガイド（`docs-prod/MONITORING_TROUBLESHOOTING.md`）
- [ ] 技術仕様書（`docs-dev/MONITORING_ARCHITECTURE.md`）
- [ ] README更新

**合格基準**: 全ドキュメント作成完了、レビューPASS

---

## 5. 優先順位マトリクス

| 要件ID | 要件名 | 優先度 | 実装Week |
|--------|--------|--------|---------|
| FR-1.1.1 | ダッシュボード画面構成 | P0 | Week 3 |
| FR-1.1.2 | システムメトリクス表示 | P0 | Week 3 |
| FR-1.1.3 | ビジネスメトリクス表示 | P0 | Week 3 |
| FR-1.1.4 | パフォーマンスメトリクス表示 | P0 | Week 3 |
| FR-1.1.5 | アクティブアラート表示 | P0 | Week 3 |
| FR-1.2.1 | アラートルール一覧表示 | P0 | Week 1 |
| FR-1.2.2 | アラートルール作成・編集 | P0 | Week 1 |
| FR-1.2.3 | アラートルール削除 | P0 | Week 1 |
| FR-1.2.4 | アラートルールのテスト評価 | P1 | Week 2 |
| FR-1.3.1 | アラート履歴一覧表示 | P0 | Week 2 |
| FR-1.3.2 | アラート確認 | P0 | Week 2 |
| FR-1.3.3 | アラート解決 | P0 | Week 2 |
| FR-1.4.1 | 通知チャネル一覧表示 | P0 | Week 4 |
| FR-1.4.2 | メール通知チャネル登録 | P0 | Week 4 |
| FR-1.4.3 | Slack通知チャネル登録 | P0 | Week 4 |
| FR-1.4.4 | カスタムWebhook通知チャネル登録 | P1 | Week 4 |
| FR-1.4.5 | 通知チャネルのテスト送信 | P1 | Week 4 |
| FR-1.5.1 | メトリクススナップショット保存 | P0 | Week 2 |
| FR-1.5.2 | メトリクス履歴取得API | P0 | Week 2 |
| FR-1.5.3 | 古いメトリクス履歴の自動削除 | P0 | Week 2 |
| FR-1.6.1 | 詳細ヘルスチェックAPI | P1 | Week 2 |

---

**承認履歴**:
- 2026-01-31: 初版作成（spec-planner）
- 承認待ち

**次のステップ**:
- arch-reviewer による設計レビュー
- アーキテクチャ設計書の作成
- 実装着手（Week 1: バックエンドAPI）
