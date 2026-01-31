# Phase 9.2: 監視・ヘルスチェック強化 - 概要書

**作成日**: 2026-01-31
**バージョン**: 1.0
**ステータス**: Draft
**担当**: spec-planner SubAgent

---

## 目次

1. [概要](#1-概要)
2. [目的と背景](#2-目的と背景)
3. [スコープ](#3-スコープ)
4. [既存実装との統合](#4-既存実装との統合)
5. [アーキテクチャ方針](#5-アーキテクチャ方針)
6. [実装計画](#6-実装計画)

---

## 1. 概要

### 1.1 フェーズ目標

Phase 9.2は、ITSM-Sec Nexusの運用監視機能を強化し、ISO 20000およびNIST CSF 2.0の要求事項に準拠した包括的な監視・ヘルスチェック基盤を構築します。

### 1.2 主要成果物

| カテゴリ | 成果物 |
|---------|--------|
| **バックエンド** | - 監視メトリクスAPI拡張<br>- アラートルール管理サービス<br>- 通知サービス強化<br>- ヘルスチェック拡張 |
| **フロントエンド** | - 監視ダッシュボードUI<br>- リアルタイムメトリクス表示<br>- アラートルール管理画面 |
| **統合** | - Prometheus/Grafana連携強化<br>- 通知チャネル統合（メール/Slack/Webhook） |
| **ドキュメント** | - 運用ガイド<br>- アラート設定ガイド<br>- トラブルシューティングガイド |

### 1.3 主要機能

1. **監視ダッシュボード**
   - システムメトリクスのリアルタイム表示
   - ビジネスメトリクス（SLA、インシデント統計）の可視化
   - アラート履歴と現在のアラート状態

2. **メトリクスAPI拡張**
   - 既存Prometheusメトリクスの活用
   - 追加ビジネスメトリクス（変更管理、問題管理）
   - カスタムメトリクス登録機能

3. **アラート管理**
   - ルールベースのアラート定義
   - 閾値設定（静的/動的）
   - アラートの優先度分類

4. **通知機能**
   - マルチチャネル通知（メール、Slack、Webhook）
   - 通知テンプレート管理
   - エスカレーションルール

---

## 2. 目的と背景

### 2.1 ビジネス目的

| 目的 | 説明 |
|------|------|
| **サービス品質向上** | リアルタイム監視により、問題の早期検知と迅速な対応を実現 |
| **コンプライアンス準拠** | ISO 20000、NIST CSF 2.0の監視要件を満たす |
| **運用効率化** | 自動化されたアラートと通知により、手動監視の負担を軽減 |
| **可視性向上** | 経営層・運用チームへの透明性提供 |

### 2.2 ISO 20000 要件マッピング

ITSM-Sec Nexusは ISO/IEC 20000-1:2018 の以下の要求事項に対応します：

| 要求事項 | Phase 9.2 での対応 |
|---------|------------------|
| **6.2 サービス継続性および可用性管理** | ヘルスチェック強化、可用性メトリクス監視 |
| **9.1 サービスレベル管理** | SLAメトリクスのリアルタイム監視、違反アラート |
| **8.1 構成管理** | CMDB変更の監視、資産メトリクス |
| **7.2 問題管理** | 問題トレンド分析、根本原因メトリクス |

### 2.3 NIST CSF 2.0 要件マッピング

NIST Cybersecurity Framework 2.0 の以下の要求事項に対応します：

| Function | Category | Phase 9.2 での対応 |
|----------|----------|------------------|
| **DETECT (DE)** | DE.CM-1: ネットワークとシステムを監視 | システムリソース監視、異常検知アラート |
| **DETECT (DE)** | DE.CM-7: セキュリティイベントを監視 | セキュリティメトリクス、認証エラー監視 |
| **RESPOND (RS)** | RS.AN-1: 通知を分析 | アラート管理、エスカレーション機能 |
| **GOVERN (GV)** | GV.OC-3: 運用メトリクスの追跡 | ビジネスメトリクス、コンプライアンスメトリクス |

### 2.4 既存の課題

現状（Phase 9.1完了時点）の課題：

| 課題 | 影響 | Phase 9.2での解決 |
|------|------|------------------|
| **メトリクスの可視化不足** | Prometheusメトリクスは収集されているが、管理画面からアクセス不可 | 監視ダッシュボードUIの実装 |
| **アラート機能の不在** | 閾値超過を自動検知できない | アラートルール管理機能の実装 |
| **通知の限定** | メール通知のみ（Slack統合は未実装） | マルチチャネル通知の実装 |
| **ビジネスメトリクス不足** | 変更管理、問題管理のメトリクスが不足 | 追加メトリクスの実装 |
| **履歴データの不在** | メトリクスの長期保存・トレンド分析が不可 | メトリクス履歴保存機能の実装 |

---

## 3. スコープ

### 3.1 実装対象（In Scope）

#### 3.1.1 バックエンド機能

- **メトリクスAPI拡張**
  - `GET /api/v1/monitoring/metrics/system` - システムメトリクス取得
  - `GET /api/v1/monitoring/metrics/business` - ビジネスメトリクス取得
  - `GET /api/v1/monitoring/metrics/history` - 履歴データ取得
  - `POST /api/v1/monitoring/metrics/custom` - カスタムメトリクス登録

- **アラートルール管理API**
  - `GET /api/v1/monitoring/alert-rules` - ルール一覧取得
  - `POST /api/v1/monitoring/alert-rules` - ルール作成
  - `PUT /api/v1/monitoring/alert-rules/:id` - ルール更新
  - `DELETE /api/v1/monitoring/alert-rules/:id` - ルール削除

- **アラート履歴API**
  - `GET /api/v1/monitoring/alerts` - アラート一覧取得
  - `PUT /api/v1/monitoring/alerts/:id/acknowledge` - アラート確認
  - `PUT /api/v1/monitoring/alerts/:id/resolve` - アラート解決

- **通知設定API**
  - `GET /api/v1/monitoring/notification-channels` - 通知チャネル一覧
  - `POST /api/v1/monitoring/notification-channels` - チャネル登録
  - `POST /api/v1/monitoring/notification-channels/:id/test` - 送信テスト

#### 3.1.2 フロントエンド機能

- **監視ダッシュボード** (`/views/monitoring.html`)
  - リアルタイムメトリクス表示（自動更新: 10秒間隔）
  - システムステータス概要（CPU、メモリ、ディスク）
  - ビジネスメトリクス（SLA達成率、インシデント統計）
  - アクティブアラート表示
  - メトリクス履歴グラフ（Chart.js使用）

- **アラートルール管理画面** (`/views/monitoring-alerts.html`)
  - ルール一覧表示（テーブル形式）
  - ルール作成/編集フォーム
  - ルール有効化/無効化トグル
  - テスト評価機能

- **アラート履歴画面** (`/views/monitoring-alert-history.html`)
  - アラート履歴一覧（フィルタリング対応）
  - アラート詳細表示
  - 確認/解決操作

- **通知設定画面** (`/views/monitoring-notifications.html`)
  - 通知チャネル一覧
  - チャネル登録フォーム（メール、Slack、Webhook）
  - 送信テスト機能

#### 3.1.3 サービス層

- **MonitoringService** (`backend/services/monitoringService.js`)
  - メトリクス収集・集計
  - メトリクス履歴保存（SQLite）
  - カスタムメトリクス管理

- **AlertService** (`backend/services/alertService.js`)
  - アラートルール評価エンジン
  - アラート発火・解決ロジック
  - アラート履歴管理

- **NotificationService 拡張** (`backend/services/notificationService.js`)
  - 既存実装に Slack Webhook、カスタム Webhook を追加
  - 通知テンプレート管理
  - 通知送信履歴記録

#### 3.1.4 データベーススキーマ拡張

```sql
-- メトリクス履歴テーブル
CREATE TABLE metric_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  labels TEXT,  -- JSON形式
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metric_timestamp (metric_name, timestamp)
);

-- アラートルールテーブル
CREATE TABLE alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  metric_name TEXT NOT NULL,
  condition TEXT NOT NULL,  -- '>', '<', '>=', '<=', '==', '!='
  threshold REAL NOT NULL,
  duration INTEGER,  -- 継続時間（秒）
  severity TEXT NOT NULL,  -- 'critical', 'warning', 'info'
  enabled BOOLEAN DEFAULT 1,
  notification_channels TEXT,  -- JSON配列
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- アラート履歴テーブル
CREATE TABLE alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  rule_name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  current_value REAL NOT NULL,
  threshold REAL NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'firing', 'acknowledged', 'resolved'
  message TEXT,
  acknowledged_by INTEGER,
  acknowledged_at DATETIME,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id),
  FOREIGN KEY (acknowledged_by) REFERENCES users(id)
);

-- 通知チャネルテーブル
CREATE TABLE notification_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_name TEXT NOT NULL UNIQUE,
  channel_type TEXT NOT NULL,  -- 'email', 'slack', 'webhook'
  config TEXT NOT NULL,  -- JSON形式（受信者、URL等）
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 通知履歴テーブル
CREATE TABLE notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  alert_id INTEGER,
  subject TEXT,
  message TEXT,
  status TEXT NOT NULL,  -- 'sent', 'failed'
  error_message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id),
  FOREIGN KEY (alert_id) REFERENCES alert_history(id)
);
```

### 3.2 実装対象外（Out of Scope）

以下の機能は Phase 9.3 以降で実装予定：

| 機能 | 理由 | 実装予定フェーズ |
|------|------|-----------------|
| **分散トレーシング（OpenTelemetry）** | 複雑度が高く、マイクロサービス化が前提 | Phase 10 |
| **APM（Application Performance Monitoring）** | 商用サービス統合が必要 | Phase 10 |
| **ログ集約（ELK Stack）** | インフラ要件が大きい | Phase 10 |
| **Machine Learning異常検知** | データ蓄積期間が不足 | Phase 11 |
| **ユーザー定義カスタムダッシュボード** | Phase 9.2では固定レイアウト | Phase 9.3 |
| **モバイルアプリ対応** | Phase 9.2ではWebのみ | Phase 12 |

---

## 4. 既存実装との統合

### 4.1 既存メトリクス活用

Phase 9.2 は、既に実装されている以下のメトリクスを最大限活用します：

#### 4.1.1 既存Prometheusメトリクス（`backend/middleware/metrics.js`）

| メトリクス名 | タイプ | 説明 | Phase 9.2での活用 |
|------------|--------|------|------------------|
| `itsm_http_requests_total` | Counter | HTTPリクエスト総数 | リクエスト統計、トラフィック監視 |
| `itsm_http_request_duration_seconds` | Histogram | リクエスト処理時間 | レスポンスタイム監視、パフォーマンス分析 |
| `itsm_active_users_total` | Gauge | アクティブユーザー数 | 同時利用状況監視 |
| `itsm_database_queries_total` | Counter | DBクエリ総数 | DB負荷監視 |
| `itsm_auth_errors_total` | Counter | 認証エラー数 | セキュリティ監視、ブルートフォース検知 |
| `itsm_incidents_total` | Counter | インシデント作成総数 | ビジネスメトリクス |
| `itsm_incidents_open` | Gauge | オープンインシデント数 | サービスレベル監視 |
| `itsm_sla_compliance_rate` | Gauge | SLA達成率 | コンプライアンス監視 |
| `itsm_cache_hits_total` | Counter | キャッシュヒット数 | キャッシュ効率監視 |
| `itsm_cache_misses_total` | Counter | キャッシュミス数 | キャッシュ効率監視 |
| `itsm_cache_hit_rate` | Gauge | キャッシュヒット率 | パフォーマンス監視 |

**統合方針**:
- これらのメトリクスを `/api/v1/monitoring/metrics/system` と `/api/v1/monitoring/metrics/business` から取得可能にする
- Prometheusレジストリから値を読み取り、JSON形式でフロントエンドに提供
- アラートルールで閾値監視できるようにする

#### 4.1.2 既存ヘルスチェック（`backend/routes/health.js`）

| エンドポイント | 説明 | Phase 9.2での拡張 |
|--------------|------|------------------|
| `GET /api/v1/health` | 基本ヘルスチェック | 変更なし |
| `GET /api/v1/health/live` | Liveness Probe | 変更なし |
| `GET /api/v1/health/ready` | Readiness Probe | ディスク容量閾値を環境変数化 |

**拡張内容**:
```javascript
// backend/routes/health.js に以下を追加
// GET /api/v1/health/detailed - 詳細ヘルスチェック
{
  "status": "UP",
  "timestamp": "2026-01-31T10:00:00Z",
  "checks": {
    "database": {
      "status": "UP",
      "response_time_ms": 5,
      "details": {
        "tables": 42,
        "size_mb": 12.5
      }
    },
    "disk": {
      "status": "UP",
      "free_space_percent": 45.2,
      "free_space_gb": 220
    },
    "memory": {
      "status": "UP",
      "used_percent": 62.3,
      "used_mb": 2400
    },
    "cache": {
      "status": "UP",
      "hit_rate": 85.2,
      "keys": 1234
    },
    "scheduler": {
      "status": "UP",
      "active_jobs": 3
    }
  },
  "uptime_seconds": 123456
}
```

### 4.2 既存サービスとの統合

#### 4.2.1 NotificationService 拡張

既存の `backend/services/notificationService.js` を拡張：

**現状**:
- メール通知のみ実装済み（SMTP）
- インシデント、SLA違反通知に使用

**Phase 9.2での拡張**:
```javascript
// 新規メソッド追加
class NotificationService {
  // 既存メソッド
  async sendEmail(to, subject, body) { ... }

  // 追加メソッド
  async sendSlackNotification(webhookUrl, message) {
    // Slack Webhook統合
  }

  async sendWebhookNotification(url, payload, headers) {
    // カスタムWebhook統合
  }

  async sendAlertNotification(alert, channels) {
    // アラート通知（マルチチャネル対応）
    for (const channel of channels) {
      switch (channel.type) {
        case 'email':
          await this.sendEmail(...);
          break;
        case 'slack':
          await this.sendSlackNotification(...);
          break;
        case 'webhook':
          await this.sendWebhookNotification(...);
          break;
      }
    }
  }
}
```

#### 4.2.2 SchedulerService 統合

既存の `backend/services/schedulerService.js` を活用：

**現状**:
- バックアップスケジューリング（Phase 9.1で実装）
- node-cron を使用

**Phase 9.2での追加スケジュール**:
```javascript
// メトリクス履歴保存（5分ごと）
cron.schedule('*/5 * * * *', async () => {
  await monitoringService.saveMetricsSnapshot();
});

// アラートルール評価（1分ごと）
cron.schedule('* * * * *', async () => {
  await alertService.evaluateAllRules();
});

// 古いメトリクス履歴削除（毎日 01:00）
cron.schedule('0 1 * * *', async () => {
  await monitoringService.cleanOldMetrics();
});
```

---

## 5. アーキテクチャ方針

### 5.1 システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                         フロントエンド (SPA)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ 監視        │  │ アラート    │  │ 通知設定    │            │
│  │ ダッシュボード│  │ 管理画面    │  │ 画面        │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS (REST API)
┌───────────────────────┴─────────────────────────────────────────┐
│                      バックエンド (Express.js)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    APIルート層                             │ │
│  │  /api/v1/monitoring/metrics                               │ │
│  │  /api/v1/monitoring/alert-rules                           │ │
│  │  /api/v1/monitoring/alerts                                │ │
│  │  /api/v1/monitoring/notification-channels                 │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   サービス層                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │ │
│  │  │ Monitoring   │  │ Alert        │  │ Notification    │ │ │
│  │  │ Service      │→ │ Service      │→ │ Service (拡張) │ │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘ │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Prometheusメトリクス層                     │ │
│  │  既存実装: backend/middleware/metrics.js                   │ │
│  │  - itsm_http_requests_total                               │ │
│  │  - itsm_sla_compliance_rate                               │ │
│  │  - itsm_incidents_open など                                │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────────────┐
│                      データ永続化層                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ SQLite       │  │ Prometheus   │  │ 外部通知先           │  │
│  │ - metric_    │  │ (外部)       │  │ - メール (SMTP)      │  │
│  │   history    │  │ - 長期保存   │  │ - Slack Webhook     │  │
│  │ - alert_     │  │ - グラフ表示 │  │ - カスタムWebhook   │  │
│  │   rules      │  │              │  │                     │  │
│  │ - alert_     │  │              │  │                     │  │
│  │   history    │  │              │  │                     │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 データフロー

#### 5.2.1 メトリクス収集・表示フロー

```
1. HTTPリクエスト受信
   ↓
2. metricsMiddleware がメトリクス記録
   ↓
3. Prometheusレジストリに保存（インメモリ）
   ↓
4. (5分ごと) MonitoringService がスナップショット取得
   ↓
5. metric_history テーブルに保存
   ↓
6. フロントエンドが GET /api/v1/monitoring/metrics/system を呼び出し
   ↓
7. MonitoringService がPrometheusレジストリから現在値を取得
   ↓
8. JSON形式でレスポンス
   ↓
9. フロントエンドがグラフ描画（Chart.js）
```

#### 5.2.2 アラート評価・通知フロー

```
1. (1分ごと) SchedulerService がアラート評価をトリガー
   ↓
2. AlertService が全アラートルールを取得
   ↓
3. 各ルールについてメトリクス値を取得
   ↓
4. 閾値と比較評価
   ↓
5. 閾値超過が継続時間を満たした場合、アラート発火
   ↓
6. alert_history テーブルに記録
   ↓
7. NotificationService にアラート通知を依頼
   ↓
8. 設定された通知チャネルに送信（メール/Slack/Webhook）
   ↓
9. notification_history テーブルに送信結果を記録
   ↓
10. フロントエンドがアクティブアラートを表示（リアルタイム更新）
```

### 5.3 技術スタック

| レイヤー | 技術 | 用途 |
|---------|------|------|
| **フロントエンド** | Vanilla JavaScript | 既存実装との一貫性 |
| **グラフ描画** | Chart.js 3.9+ | メトリクス可視化 |
| **リアルタイム更新** | setInterval (10秒) | ポーリング方式（WebSocketは将来実装） |
| **バックエンド** | Express.js 4.x | 既存実装 |
| **メトリクス収集** | prom-client 14.x | 既存実装（Prometheus互換） |
| **スケジューラー** | node-cron 3.x | 既存実装 |
| **データベース** | better-sqlite3 8.x | 既存実装 |
| **通知** | nodemailer (既存) + @slack/webhook (新規) | メール・Slack統合 |

---

## 6. 実装計画

### 6.1 実装スケジュール

| Week | 実装内容 | 成果物 |
|------|---------|--------|
| **Week 1** | バックエンドAPI実装 | - メトリクスAPI<br>- アラートルールAPI<br>- DBマイグレーション |
| **Week 2** | サービス層実装 | - MonitoringService<br>- AlertService<br>- NotificationService拡張 |
| **Week 3** | フロントエンドUI実装 | - 監視ダッシュボード<br>- アラート管理画面 |
| **Week 4** | 通知統合・テスト | - Slack統合<br>- Webhook統合<br>- 統合テスト |
| **Week 5** | ドキュメント・調整 | - 運用ガイド<br>- バグ修正<br>- パフォーマンス調整 |

### 6.2 マイルストーン

| マイルストーン | 完了条件 | 期日 |
|--------------|---------|------|
| **M1: API完成** | 全APIエンドポイントが実装され、単体テストがPASS | Week 1終了時 |
| **M2: サービス完成** | アラート評価エンジンが動作し、通知が送信される | Week 2終了時 |
| **M3: UI完成** | 監視ダッシュボードが表示され、リアルタイム更新が動作 | Week 3終了時 |
| **M4: 統合完了** | Slack/Webhook統合が動作し、E2Eテストが完了 | Week 4終了時 |
| **M5: リリース準備** | ドキュメント完成、本番環境でのスモークテストPASS | Week 5終了時 |

### 6.3 依存関係

```
graph TD
    A[Phase 9.1: バックアップ機能] --> B[Phase 9.2: 監視強化]
    B --> C[既存Prometheusメトリクス]
    B --> D[既存NotificationService]
    B --> E[既存SchedulerService]
    B --> F[Phase 9.3: 高度な分析機能]
```

### 6.4 リスク管理

| リスク | 影響度 | 発生確率 | 対策 |
|-------|--------|---------|------|
| **Prometheusメトリクスのパフォーマンス問題** | 高 | 中 | - メトリクス数を制限（最大100項目）<br>- 履歴保存を5分間隔に制限 |
| **アラート評価の負荷** | 中 | 中 | - ルール評価を1分間隔に制限<br>- 非同期処理の徹底 |
| **通知の遅延** | 中 | 低 | - 通知キューイング（将来実装）<br>- タイムアウト設定（5秒） |
| **Chart.jsのレンダリング遅延** | 低 | 中 | - データポイント数を制限（最大100点）<br>- レイジーロード実装 |

---

## 7. 成功基準

### 7.1 機能要件達成基準

- [ ] 監視ダッシュボードが全メトリクスを表示
- [ ] アラートルールが正しく評価され、通知が送信される
- [ ] メール、Slack、Webhook通知がすべて動作
- [ ] アラート履歴が記録され、検索可能
- [ ] メトリクス履歴が30日間保存される

### 7.2 非機能要件達成基準

- [ ] メトリクスAPI応答時間 < 200ms（P95）
- [ ] アラート評価遅延 < 60秒
- [ ] ダッシュボード描画時間 < 2秒（初回ロード）
- [ ] 同時接続数 50ユーザーで安定動作

### 7.3 コンプライアンス達成基準

- [ ] ISO 20000 要求事項への準拠を証跡で証明
- [ ] NIST CSF 2.0 DETECT 機能のカバレッジ > 80%
- [ ] 監査ログに全操作が記録される

---

**承認履歴**:
- 2026-01-31: 初版作成（spec-planner）
- 承認待ち

**次のステップ**:
- Phase 9.2 詳細要件定義書の作成
- アーキテクチャレビュー
- 実装着手
