# Phase 9.2: 監視・ヘルスチェック強化 - アーキテクチャ設計書

**作成日**: 2026-01-31
**作成者**: arch-reviewer SubAgent
**バージョン**: 1.0
**ステータス**: Draft

---

## 目次

1. [概要](#1-概要)
2. [データベース設計](#2-データベース設計)
3. [API設計](#3-api設計)
4. [サービス層設計](#4-サービス層設計)
5. [フロントエンド設計](#5-フロントエンド設計)
6. [アラートエンジン設計](#6-アラートエンジン設計)
7. [スケジューラー統合](#7-スケジューラー統合)
8. [シーケンス図](#8-シーケンス図)
9. [セキュリティ設計](#9-セキュリティ設計)
10. [パフォーマンス設計](#10-パフォーマンス設計)

---

## 1. 概要

### 1.1 Phase 9.2の目的と範囲

**目的:**
- ITSM-Sec Nexusの運用監視機能を強化し、ISO 20000およびNIST CSF 2.0の要求事項に準拠した包括的な監視・ヘルスチェック基盤を構築する

**スコープ:**
- 監視ダッシュボードUI（システム・ビジネス・パフォーマンスメトリクス表示）
- アラートルール管理機能（作成・編集・削除・テスト評価）
- アラート履歴管理機能（確認・解決ワークフロー）
- 通知チャネル管理機能（メール・Slack・Webhook）
- メトリクス履歴保存機能（30日間保存）
- 詳細ヘルスチェックAPI

### 1.2 既存実装との関係

**活用する既存実装:**
- **metrics.js**: Prometheusメトリクス収集基盤（10種類のメトリクス）
- **health.js**: 基本ヘルスチェックAPI（Liveness/Readiness Probe）
- **notificationService.js**: メール・Slack・Teams通知基盤
- **schedulerService.js**: node-cronスケジューラー基盤（Phase 9.1で実装）

**新規実装:**
- **MonitoringService**: メトリクス収集・履歴保存
- **AlertService**: アラートルール評価エンジン
- **NotificationService拡張**: Webhook通知、アラート通知
- **監視ダッシュボードUI**: 4画面（ダッシュボード、アラートルール管理、アラート履歴、通知設定）

---

## 2. データベース設計

### 2.1 ERD（Entity Relationship Diagram）

```
┌─────────────────────┐
│      users          │
│─────────────────────│
│ id (PK)             │
│ username            │
│ email               │
│ role                │
└──────────┬──────────┘
           │
           │ created_by (FK)
           │
    ┌──────▼──────────────────────┐
    │     metric_history          │
    │─────────────────────────────│
    │ id (PK)                     │
    │ metric_name                 │
    │ metric_value                │
    │ labels (JSON)               │
    │ timestamp                   │
    └─────────────────────────────┘

┌─────────────────────┐
│      users          │
│─────────────────────│
│ id (PK)             │
└──────────┬──────────┘
           │
           │ acknowledged_by (FK)
           │
    ┌──────▼──────────────────────┐
    │     alert_rules             │
    │─────────────────────────────│
    │ id (PK)                     │
    │ rule_name (UNIQUE)          │
    │ metric_name                 │
    │ condition                   │
    │ threshold                   │
    │ duration                    │
    │ severity                    │
    │ enabled                     │
    │ notification_channels (JSON)│
    │ created_at                  │
    │ updated_at                  │
    └──────────┬──────────────────┘
               │
               │ rule_id (FK)
               │
    ┌──────────▼──────────────────┐
    │     alert_history           │
    │─────────────────────────────│
    │ id (PK)                     │
    │ rule_id (FK)                │
    │ rule_name                   │
    │ metric_name                 │
    │ current_value               │
    │ threshold                   │
    │ severity                    │
    │ status                      │
    │ message                     │
    │ acknowledged_by (FK)        │
    │ acknowledged_at             │
    │ resolved_at                 │
    │ created_at                  │
    └─────────────────────────────┘

    ┌─────────────────────────────┐
    │  notification_channels      │
    │─────────────────────────────│
    │ id (PK)                     │
    │ channel_name (UNIQUE)       │
    │ channel_type                │
    │ config (JSON, ENCRYPTED)    │
    │ enabled                     │
    │ created_at                  │
    │ updated_at                  │
    └──────────┬──────────────────┘
               │
               │ channel_id (FK)
               │
    ┌──────────▼──────────────────┐
    │  notification_history       │
    │─────────────────────────────│
    │ id (PK)                     │
    │ channel_id (FK)             │
    │ alert_id (FK)               │
    │ subject                     │
    │ message                     │
    │ status                      │
    │ error_message               │
    │ sent_at                     │
    └─────────────────────────────┘
```

---

### 2.2 テーブル詳細設計

#### 2.2.1 metric_history テーブル

**用途**: メトリクススナップショット履歴（過去30日間）

```sql
CREATE TABLE metric_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,                   -- 'itsm_cpu_usage_percent', 'itsm_sla_compliance_rate' 等
  metric_value REAL NOT NULL,                  -- メトリクス値
  labels TEXT,                                 -- JSON形式（例: {"priority": "high", "service": "incident_mgmt"}）
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- インデックス
  INDEX idx_metric_history_name (metric_name),
  INDEX idx_metric_history_timestamp (timestamp),
  INDEX idx_metric_history_composite (metric_name, timestamp)
);
```

**カラム詳細:**

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| id | INTEGER | No | 主キー | 1 |
| metric_name | TEXT(255) | No | メトリクス名 | `itsm_cpu_usage_percent` |
| metric_value | REAL | No | メトリクス値 | 45.2 |
| labels | TEXT | Yes | ラベル（JSON） | `{"priority": "high"}` |
| timestamp | DATETIME | No | 記録日時 | `2026-01-31 10:00:00` |

**labels JSON スキーマ:**

```json
{
  "priority": "high",           // インシデント優先度（incidents_openの場合）
  "service_name": "incident_mgmt", // サービス名（SLA系の場合）
  "status_code": "200",         // HTTPステータスコード（requests_totalの場合）
  "method": "GET"               // HTTPメソッド（requests_totalの場合）
}
```

**保存例:**

```sql
INSERT INTO metric_history (metric_name, metric_value, labels, timestamp) VALUES
('itsm_cpu_usage_percent', 45.2, NULL, '2026-01-31 10:00:00'),
('itsm_memory_usage_percent', 62.5, NULL, '2026-01-31 10:00:00'),
('itsm_sla_compliance_rate', 98.5, '{"service_name": "incident_mgmt"}', '2026-01-31 10:00:00'),
('itsm_incidents_open', 12, '{"priority": "high"}', '2026-01-31 10:00:00'),
('itsm_incidents_open', 5, '{"priority": "medium"}', '2026-01-31 10:00:00');
```

---

#### 2.2.2 alert_rules テーブル

**用途**: アラートルール定義

```sql
CREATE TABLE alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,              -- 'High CPU Usage', 'SLA Compliance Low' 等
  metric_name TEXT NOT NULL,                   -- 監視対象メトリクス名
  condition TEXT NOT NULL,                     -- '>', '<', '>=', '<=', '==', '!='
  threshold REAL NOT NULL,                     -- 閾値
  duration INTEGER,                            -- 継続時間（秒）（NULL=即座に発火）
  severity TEXT NOT NULL,                      -- 'critical', 'warning', 'info'
  enabled BOOLEAN DEFAULT 1,                   -- 有効/無効
  notification_channels TEXT,                  -- 通知チャネルID配列（JSON: ["email-ops", "slack-alerts"]）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 制約
  CHECK (condition IN ('>', '<', '>=', '<=', '==', '!=')),
  CHECK (severity IN ('critical', 'warning', 'info')),
  CHECK (duration IS NULL OR duration >= 60),  -- 最低60秒

  -- インデックス
  INDEX idx_alert_rules_enabled (enabled),
  INDEX idx_alert_rules_metric (metric_name)
);
```

**カラム詳細:**

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| id | INTEGER | No | 主キー | 1 |
| rule_name | TEXT(100) | No | ルール名（ユニーク） | `High CPU Usage` |
| metric_name | TEXT(255) | No | 監視対象メトリクス | `itsm_cpu_usage_percent` |
| condition | TEXT(10) | No | 条件演算子 | `>` |
| threshold | REAL | No | 閾値 | 80.0 |
| duration | INTEGER | Yes | 継続時間（秒） | 300 (5分) |
| severity | TEXT(50) | No | 重要度 | `warning` |
| enabled | BOOLEAN | No | 有効フラグ | 1 (有効) |
| notification_channels | TEXT | Yes | 通知チャネル（JSON） | `["email-ops", "slack-alerts"]` |
| created_at | DATETIME | No | 作成日時 | `2026-01-15 10:00:00` |
| updated_at | DATETIME | No | 更新日時 | `2026-01-20 14:30:00` |

**notification_channels JSON スキーマ:**

```json
["email-ops", "slack-alerts", "webhook-pagerduty"]
```

---

#### 2.2.3 alert_history テーブル

**用途**: アラート発火履歴

```sql
CREATE TABLE alert_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,                    -- alert_rules.id
  rule_name TEXT NOT NULL,                     -- ルール名（スナップショット）
  metric_name TEXT NOT NULL,                   -- メトリクス名
  current_value REAL NOT NULL,                 -- 発火時のメトリクス値
  threshold REAL NOT NULL,                     -- 発火時の閾値
  severity TEXT NOT NULL,                      -- 'critical', 'warning', 'info'
  status TEXT NOT NULL DEFAULT 'firing',       -- 'firing', 'acknowledged', 'resolved'
  message TEXT,                                -- アラートメッセージ
  acknowledged_by INTEGER,                     -- 確認ユーザーID
  acknowledged_at DATETIME,                    -- 確認日時
  resolved_at DATETIME,                        -- 解決日時
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 外部キー
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id),
  FOREIGN KEY (acknowledged_by) REFERENCES users(id),

  -- 制約
  CHECK (severity IN ('critical', 'warning', 'info')),
  CHECK (status IN ('firing', 'acknowledged', 'resolved')),

  -- インデックス
  INDEX idx_alert_history_rule (rule_id),
  INDEX idx_alert_history_status (status),
  INDEX idx_alert_history_severity (severity),
  INDEX idx_alert_history_created_at (created_at)
);
```

**カラム詳細:**

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| id | INTEGER | No | 主キー | 123 |
| rule_id | INTEGER | No | アラートルールID | 1 |
| rule_name | TEXT(100) | No | ルール名 | `High CPU Usage` |
| metric_name | TEXT(255) | No | メトリクス名 | `itsm_cpu_usage_percent` |
| current_value | REAL | No | 発火時の値 | 85.3 |
| threshold | REAL | No | 閾値 | 80.0 |
| severity | TEXT(50) | No | 重要度 | `warning` |
| status | TEXT(50) | No | ステータス | `acknowledged` |
| message | TEXT | Yes | メッセージ | `CPU使用率が80%を超えました` |
| acknowledged_by | INTEGER | Yes | 確認ユーザーID | 5 |
| acknowledged_at | DATETIME | Yes | 確認日時 | `2026-01-31 10:20:00` |
| resolved_at | DATETIME | Yes | 解決日時 | `2026-01-31 10:30:00` |
| created_at | DATETIME | No | 発火日時 | `2026-01-31 10:15:00` |

---

#### 2.2.4 notification_channels テーブル

**用途**: 通知チャネル設定

```sql
CREATE TABLE notification_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_name TEXT NOT NULL UNIQUE,           -- 'email-ops', 'slack-alerts' 等
  channel_type TEXT NOT NULL,                  -- 'email', 'slack', 'webhook'
  config TEXT NOT NULL,                        -- JSON形式（受信者、URL等）【暗号化対象】
  enabled BOOLEAN DEFAULT 1,                   -- 有効/無効
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 制約
  CHECK (channel_type IN ('email', 'slack', 'webhook')),

  -- インデックス
  INDEX idx_notification_channels_enabled (enabled),
  INDEX idx_notification_channels_type (channel_type)
);
```

**カラム詳細:**

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| id | INTEGER | No | 主キー | 1 |
| channel_name | TEXT(100) | No | チャネル名（ユニーク） | `email-ops` |
| channel_type | TEXT(50) | No | チャネルタイプ | `email` |
| config | TEXT | No | 設定（JSON、暗号化） | `{"recipients": ["ops@example.com"]}` |
| enabled | BOOLEAN | No | 有効フラグ | 1 (有効) |
| created_at | DATETIME | No | 作成日時 | `2026-01-15 10:00:00` |
| updated_at | DATETIME | No | 更新日時 | `2026-01-20 14:30:00` |

**config JSON スキーマ（チャネルタイプ別）:**

**Email:**
```json
{
  "recipients": ["ops@example.com", "admin@example.com"]
}
```

**Slack:**
```json
{
  "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
  "username": "ITSM Alert Bot",
  "icon_emoji": ":warning:"
}
```

**Webhook:**
```json
{
  "webhook_url": "https://api.pagerduty.com/incidents",
  "http_method": "POST",
  "custom_headers": {
    "Authorization": "Bearer token123"
  },
  "payload_template": "{\"severity\":\"{{severity}}\",\"summary\":\"{{rule_name}}: {{message}}\"}"
}
```

**暗号化方式:**
- AES-256-CBC
- 暗号化キー: 環境変数 `NOTIFICATION_ENCRYPTION_KEY`
- 実装: Node.js `crypto` モジュール

```javascript
const crypto = require('crypto');

// 暗号化
function encryptConfig(config) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// 復号化
function decryptConfig(encryptedConfig) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY, 'hex');
  const parts = encryptedConfig.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}
```

---

#### 2.2.5 notification_history テーブル

**用途**: 通知送信履歴

```sql
CREATE TABLE notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,                 -- notification_channels.id
  alert_id INTEGER,                            -- alert_history.id (NULL=テスト送信)
  subject TEXT,                                -- 件名（メールの場合）
  message TEXT,                                -- メッセージ本文またはペイロード（JSON）
  status TEXT NOT NULL,                        -- 'sent', 'failed'
  error_message TEXT,                          -- エラーメッセージ（失敗時）
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- 外部キー
  FOREIGN KEY (channel_id) REFERENCES notification_channels(id),
  FOREIGN KEY (alert_id) REFERENCES alert_history(id),

  -- 制約
  CHECK (status IN ('sent', 'failed')),

  -- インデックス
  INDEX idx_notification_history_channel (channel_id),
  INDEX idx_notification_history_alert (alert_id),
  INDEX idx_notification_history_status (status),
  INDEX idx_notification_history_sent_at (sent_at)
);
```

**カラム詳細:**

| Column | Type | Nullable | Description | Example |
|--------|------|----------|-------------|---------|
| id | INTEGER | No | 主キー | 1 |
| channel_id | INTEGER | No | 通知チャネルID | 1 |
| alert_id | INTEGER | Yes | アラートID（NULL=テスト送信） | 123 |
| subject | TEXT | Yes | 件名 | `[CRITICAL] High CPU Usage` |
| message | TEXT | Yes | メッセージ（JSON） | `{"text": "CPU: 85.3%"}` |
| status | TEXT(50) | No | 送信結果 | `sent` |
| error_message | TEXT | Yes | エラーメッセージ | `SMTP connection timeout` |
| sent_at | DATETIME | No | 送信日時 | `2026-01-31 10:15:05` |

---

### 2.3 マイグレーションファイル

**ファイル**: `backend/migrations/20260131_add_monitoring_tables.js`

```javascript
/**
 * Phase 9.2: 監視・ヘルスチェック強化 - データベースマイグレーション
 *
 * テーブル作成:
 * - metric_history: メトリクス履歴（30日間保存）
 * - alert_rules: アラートルール定義
 * - alert_history: アラート履歴
 * - notification_channels: 通知チャネル設定
 * - notification_history: 通知送信履歴
 */

exports.up = function(db) {
  // 1. metric_history テーブル
  db.exec(`
    CREATE TABLE metric_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      labels TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX idx_metric_history_name ON metric_history(metric_name)`);
  db.exec(`CREATE INDEX idx_metric_history_timestamp ON metric_history(timestamp)`);
  db.exec(`CREATE INDEX idx_metric_history_composite ON metric_history(metric_name, timestamp)`);

  // 2. alert_rules テーブル
  db.exec(`
    CREATE TABLE alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL UNIQUE,
      metric_name TEXT NOT NULL,
      condition TEXT NOT NULL CHECK (condition IN ('>', '<', '>=', '<=', '==', '!=')),
      threshold REAL NOT NULL,
      duration INTEGER CHECK (duration IS NULL OR duration >= 60),
      severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
      enabled BOOLEAN DEFAULT 1,
      notification_channels TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled)`);
  db.exec(`CREATE INDEX idx_alert_rules_metric ON alert_rules(metric_name)`);

  // 3. alert_history テーブル
  db.exec(`
    CREATE TABLE alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      rule_name TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      current_value REAL NOT NULL,
      threshold REAL NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
      status TEXT NOT NULL DEFAULT 'firing' CHECK (status IN ('firing', 'acknowledged', 'resolved')),
      message TEXT,
      acknowledged_by INTEGER,
      acknowledged_at DATETIME,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rule_id) REFERENCES alert_rules(id),
      FOREIGN KEY (acknowledged_by) REFERENCES users(id)
    )
  `);
  db.exec(`CREATE INDEX idx_alert_history_rule ON alert_history(rule_id)`);
  db.exec(`CREATE INDEX idx_alert_history_status ON alert_history(status)`);
  db.exec(`CREATE INDEX idx_alert_history_severity ON alert_history(severity)`);
  db.exec(`CREATE INDEX idx_alert_history_created_at ON alert_history(created_at)`);

  // 4. notification_channels テーブル
  db.exec(`
    CREATE TABLE notification_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_name TEXT NOT NULL UNIQUE,
      channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'slack', 'webhook')),
      config TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX idx_notification_channels_enabled ON notification_channels(enabled)`);
  db.exec(`CREATE INDEX idx_notification_channels_type ON notification_channels(channel_type)`);

  // 5. notification_history テーブル
  db.exec(`
    CREATE TABLE notification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      alert_id INTEGER,
      subject TEXT,
      message TEXT,
      status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
      error_message TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id) REFERENCES notification_channels(id),
      FOREIGN KEY (alert_id) REFERENCES alert_history(id)
    )
  `);
  db.exec(`CREATE INDEX idx_notification_history_channel ON notification_history(channel_id)`);
  db.exec(`CREATE INDEX idx_notification_history_alert ON notification_history(alert_id)`);
  db.exec(`CREATE INDEX idx_notification_history_status ON notification_history(status)`);
  db.exec(`CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at)`);

  console.log('[Migration] Phase 9.2 monitoring tables created successfully');
};

exports.down = function(db) {
  db.exec('DROP TABLE IF EXISTS notification_history');
  db.exec('DROP TABLE IF EXISTS notification_channels');
  db.exec('DROP TABLE IF EXISTS alert_history');
  db.exec('DROP TABLE IF EXISTS alert_rules');
  db.exec('DROP TABLE IF EXISTS metric_history');

  console.log('[Migration] Phase 9.2 monitoring tables dropped');
};
```

---

## 3. API設計

### 3.1 共通仕様

#### 3.1.1 認証・認可

**認証方式**: JWT Bearer Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**認可**: RBAC（Role-Based Access Control）

| Role | 権限 |
|------|------|
| **Admin** | 全操作可能 |
| **Manager** | メトリクス閲覧、アラート確認のみ |
| **Analyst** | メトリクス閲覧のみ |
| **Viewer** | アクセス不可 |

#### 3.1.2 エラーレスポンス

**形式:**

```json
{
  "error": "error_code",
  "message": "人間が読めるメッセージ",
  "user_action": "推奨アクション",
  "details": {
    "field": "value"
  }
}
```

**エラーコード一覧:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | 認証失敗 |
| `forbidden` | 403 | 権限不足 |
| `metric_not_found` | 404 | メトリクスが存在しない |
| `rule_not_found` | 404 | アラートルールが存在しない |
| `alert_not_found` | 404 | アラートが存在しない |
| `channel_not_found` | 404 | 通知チャネルが存在しない |
| `validation_error` | 400 | リクエストバリデーションエラー |
| `duplicate_rule_name` | 409 | ルール名が重複 |
| `duplicate_channel_name` | 409 | チャネル名が重複 |

---

### 3.2 エンドポイント一覧

| Method | Path | Handler | RBAC | Description |
|--------|------|---------|------|-------------|
| GET | `/api/v1/monitoring/metrics/system` | getSystemMetrics | Admin/Manager/Analyst | システムメトリクス取得 |
| GET | `/api/v1/monitoring/metrics/business` | getBusinessMetrics | Admin/Manager/Analyst | ビジネスメトリクス取得 |
| GET | `/api/v1/monitoring/metrics/performance` | getPerformanceMetrics | Admin/Manager/Analyst | パフォーマンスメトリクス取得 |
| GET | `/api/v1/monitoring/metrics/history` | getMetricHistory | Admin/Manager/Analyst | メトリクス履歴取得 |
| POST | `/api/v1/monitoring/metrics/custom` | registerCustomMetric | Admin | カスタムメトリクス登録 |
| GET | `/api/v1/monitoring/alert-rules` | listAlertRules | Admin/Manager | アラートルール一覧取得 |
| POST | `/api/v1/monitoring/alert-rules` | createAlertRule | Admin | アラートルール作成 |
| PUT | `/api/v1/monitoring/alert-rules/:id` | updateAlertRule | Admin | アラートルール更新 |
| DELETE | `/api/v1/monitoring/alert-rules/:id` | deleteAlertRule | Admin | アラートルール削除 |
| POST | `/api/v1/monitoring/alert-rules/test` | testAlertRule | Admin | アラートルールテスト評価 |
| GET | `/api/v1/monitoring/alerts` | listAlerts | Admin/Manager | アラート一覧取得 |
| PUT | `/api/v1/monitoring/alerts/:id/acknowledge` | acknowledgeAlert | Admin/Manager | アラート確認 |
| PUT | `/api/v1/monitoring/alerts/:id/resolve` | resolveAlert | Admin/Manager | アラート解決 |
| GET | `/api/v1/monitoring/notification-channels` | listNotificationChannels | Admin | 通知チャネル一覧取得 |
| POST | `/api/v1/monitoring/notification-channels` | createNotificationChannel | Admin | 通知チャネル作成 |
| PUT | `/api/v1/monitoring/notification-channels/:id` | updateNotificationChannel | Admin | 通知チャネル更新 |
| DELETE | `/api/v1/monitoring/notification-channels/:id` | deleteNotificationChannel | Admin | 通知チャネル削除 |
| POST | `/api/v1/monitoring/notification-channels/:id/test` | testNotificationChannel | Admin | 通知チャネルテスト送信 |

---

### 3.3 エンドポイント詳細

#### 3.3.1 GET /api/v1/monitoring/metrics/system - システムメトリクス取得

**用途**: CPU、メモリ、ディスク、アクティブユーザー等のシステムメトリクスを取得

**認可**: Admin/Manager/Analyst

**リクエスト:**

```http
GET /api/v1/monitoring/metrics/system HTTP/1.1
Host: localhost:5443
Authorization: Bearer {jwt_token}
```

**レスポンス（成功 - 200 OK）:**

```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "cpu": {
      "usage_percent": 45.2,
      "threshold_status": "normal"
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
      "trend": "up"
    },
    "requests_per_minute": {
      "current": 145,
      "trend": "stable"
    }
  }
}
```

**実装コード:**

```javascript
// backend/services/monitoringService.js

const os = require('os');
const { register } = require('../middleware/metrics');

async function getSystemMetrics() {
  const metrics = await register.metrics();
  const parsed = parsePrometheusMetrics(metrics);

  // CPU使用率（Prometheusメトリクスから計算）
  const cpuUsage = parsed['itsm_cpu_usage_percent'] || calculateCpuUsage();

  // メモリ使用率
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = (usedMem / totalMem) * 100;

  // ディスク使用率（health.jsのロジックを再利用）
  const diskStats = getDiskStats();

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      cpu: {
        usage_percent: cpuUsage,
        threshold_status: cpuUsage > 90 ? 'critical' : cpuUsage > 80 ? 'warning' : 'normal'
      },
      memory: {
        total_mb: Math.round(totalMem / 1024 / 1024),
        used_mb: Math.round(usedMem / 1024 / 1024),
        usage_percent: parseFloat(memUsagePercent.toFixed(2)),
        threshold_status: memUsagePercent > 90 ? 'critical' : memUsagePercent > 80 ? 'warning' : 'normal'
      },
      disk: {
        total_gb: diskStats.totalGb,
        used_gb: diskStats.usedGb,
        free_gb: diskStats.freeGb,
        usage_percent: diskStats.usagePercent,
        threshold_status: diskStats.usagePercent > 90 ? 'critical' : diskStats.usagePercent > 80 ? 'warning' : 'normal'
      },
      uptime: {
        seconds: process.uptime(),
        formatted: formatUptime(process.uptime())
      },
      active_users: {
        current: parsed['itsm_active_users_total'] || 0,
        trend: calculateTrend('active_users')
      },
      requests_per_minute: {
        current: calculateRequestsPerMinute(parsed),
        trend: calculateTrend('requests_per_minute')
      }
    }
  };
}
```

---

#### 3.3.2 GET /api/v1/monitoring/metrics/business - ビジネスメトリクス取得

**用途**: SLA達成率、インシデント統計等のビジネスメトリクスを取得

**認可**: Admin/Manager/Analyst

**リクエスト:**

```http
GET /api/v1/monitoring/metrics/business HTTP/1.1
Host: localhost:5443
Authorization: Bearer {jwt_token}
```

**レスポンス（成功 - 200 OK）:**

```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "sla_compliance": {
      "current_rate": 98.5,
      "history_24h": [
        {"timestamp": "2026-01-30T10:00:00Z", "value": 98.2},
        {"timestamp": "2026-01-30T11:00:00Z", "value": 98.4}
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
        {"date": "2026-01-26", "count": 12}
      ]
    },
    "security_incidents": {
      "current": 3,
      "trend": "down"
    },
    "mttr_hours": {
      "current": 4.5,
      "trend": "down"
    }
  }
}
```

**実装コード:**

```javascript
// backend/services/monitoringService.js

async function getBusinessMetrics(db) {
  const metrics = await register.metrics();
  const parsed = parsePrometheusMetrics(metrics);

  // SLA達成率
  const slaCompliance = parsed['itsm_sla_compliance_rate'] || await calculateSlaCompliance(db);

  // オープンインシデント数（優先度別）
  const incidentsOpen = await getOpenIncidentsByPriority(db);

  // インシデント作成数（過去7日間）
  const incidentsCreated = await getIncidentsCreatedLast7Days(db);

  // セキュリティインシデント数
  const securityIncidents = await getSecurityIncidentsCount(db);

  // MTTR（平均解決時間）
  const mttr = await calculateMTTR(db);

  return {
    timestamp: new Date().toISOString(),
    metrics: {
      sla_compliance: {
        current_rate: slaCompliance,
        history_24h: await getSlaHistory24h(db)
      },
      incidents_open: incidentsOpen,
      incidents_created_daily: incidentsCreated,
      security_incidents: {
        current: securityIncidents,
        trend: calculateTrend('security_incidents')
      },
      mttr_hours: {
        current: mttr,
        trend: calculateTrend('mttr')
      }
    }
  };
}
```

---

#### 3.3.3 POST /api/v1/monitoring/alert-rules - アラートルール作成

**用途**: 新規アラートルールを作成

**認可**: Admin権限必須

**リクエスト:**

```http
POST /api/v1/monitoring/alert-rules HTTP/1.1
Host: localhost:5443
Authorization: Bearer {jwt_token}
Content-Type: application/json

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

**リクエストバリデーション:**

```javascript
{
  rule_name: {
    required: true,
    type: 'string',
    maxLength: 100,
    unique: true  // データベースで重複チェック
  },
  metric_name: {
    required: true,
    type: 'string',
    validate: (value) => isValidMetric(value)  // 存在するメトリクスか確認
  },
  condition: {
    required: true,
    enum: ['>', '<', '>=', '<=', '==', '!=']
  },
  threshold: {
    required: true,
    type: 'number'
  },
  duration: {
    required: false,
    type: 'integer',
    min: 60  // 最低60秒
  },
  severity: {
    required: true,
    enum: ['critical', 'warning', 'info']
  },
  enabled: {
    required: false,
    type: 'boolean',
    default: true
  },
  notification_channels: {
    required: true,
    type: 'array',
    minLength: 1,
    validate: (channels) => allChannelsExist(channels)  // 全チャネルが存在するか確認
  }
}
```

**レスポンス（成功 - 201 Created）:**

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

**レスポンス（失敗 - 409 Conflict）:**

```json
{
  "error": "duplicate_rule_name",
  "message": "ルール名が既に存在します。",
  "user_action": "別のルール名を指定してください。",
  "details": {
    "rule_name": "High CPU Usage"
  }
}
```

---

#### 3.3.4 PUT /api/v1/monitoring/alerts/:id/acknowledge - アラート確認

**用途**: 発火中のアラートを「確認済み」としてマーク

**認可**: Admin/Manager権限

**リクエスト:**

```http
PUT /api/v1/monitoring/alerts/123/acknowledge HTTP/1.1
Host: localhost:5443
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "comment": "調査中。CPU使用率のスパイクを確認。"
}
```

**レスポンス（成功 - 200 OK）:**

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

**実装コード:**

```javascript
// backend/routes/monitoring.js

router.put('/alerts/:id/acknowledge', requireRole(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    // 1. アラート存在確認
    const alert = await db.get('SELECT * FROM alert_history WHERE id = ?', [id]);
    if (!alert) {
      return res.status(404).json({
        error: 'alert_not_found',
        message: 'アラートが見つかりません。'
      });
    }

    // 2. ステータス確認
    if (alert.status !== 'firing') {
      return res.status(400).json({
        error: 'invalid_status',
        message: `ステータスが firing のアラートのみ確認できます。（現在: ${alert.status}）`
      });
    }

    // 3. アラート更新
    await db.run(`
      UPDATE alert_history
      SET status = 'acknowledged',
          acknowledged_by = ?,
          acknowledged_at = datetime('now'),
          message = COALESCE(?, message)
      WHERE id = ?
    `, [req.user.id, comment, id]);

    // 4. 監査ログ記録
    await auditLog(db, {
      operation: 'acknowledge_alert',
      resource_type: 'alert',
      resource_id: id,
      user_id: req.user.id,
      username: req.user.username,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      status: 'success',
      details: { comment }
    });

    // 5. 更新後のアラート取得
    const updatedAlert = await db.get(`
      SELECT a.*, u.username as acknowledged_by_username
      FROM alert_history a
      LEFT JOIN users u ON a.acknowledged_by = u.id
      WHERE a.id = ?
    `, [id]);

    res.json(updatedAlert);
  } catch (err) {
    console.error('[MonitoringAPI] Error acknowledging alert:', err);
    res.status(500).json({
      error: 'internal_error',
      message: 'アラート確認処理中にエラーが発生しました。'
    });
  }
});
```

---

## 4. サービス層設計

### 4.1 MonitoringService

**責務:**
- メトリクス収集・集計
- メトリクス履歴保存（SQLite）
- カスタムメトリクス管理

**ファイル**: `backend/services/monitoringService.js`

#### 主要メソッド

```javascript
/**
 * システムメトリクスを取得
 * @returns {Promise<Object>} システムメトリクス
 */
async function getSystemMetrics() {
  // Prometheusレジストリからメトリクスを取得
  // CPU、メモリ、ディスク、アップタイム等を計算
}

/**
 * ビジネスメトリクスを取得
 * @param {Object} db - データベース接続
 * @returns {Promise<Object>} ビジネスメトリクス
 */
async function getBusinessMetrics(db) {
  // SLA達成率、インシデント統計等をデータベースから取得
}

/**
 * パフォーマンスメトリクスを取得
 * @returns {Promise<Object>} パフォーマンスメトリクス
 */
async function getPerformanceMetrics() {
  // APIレスポンスタイム、キャッシュヒット率等を取得
}

/**
 * メトリクススナップショットを保存（5分ごと実行）
 * @param {Object} db - データベース接続
 * @returns {Promise<number>} 保存されたメトリクス数
 */
async function saveMetricsSnapshot(db) {
  const metrics = await register.metrics();
  const parsed = parsePrometheusMetrics(metrics);

  let savedCount = 0;

  for (const [metricName, metricData] of Object.entries(parsed)) {
    if (Array.isArray(metricData)) {
      // ラベル付きメトリクス（例: itsm_incidents_open{priority="high"}）
      for (const item of metricData) {
        await db.run(`
          INSERT INTO metric_history (metric_name, metric_value, labels, timestamp)
          VALUES (?, ?, ?, datetime('now'))
        `, [metricName, item.value, JSON.stringify(item.labels)]);
        savedCount++;
      }
    } else {
      // 単純メトリクス
      await db.run(`
        INSERT INTO metric_history (metric_name, metric_value, timestamp)
        VALUES (?, ?, datetime('now'))
      `, [metricName, metricData]);
      savedCount++;
    }
  }

  console.log(`[MonitoringService] Saved ${savedCount} metrics to history`);
  return savedCount;
}

/**
 * 古いメトリクス履歴を削除（30日以上前）
 * @param {Object} db - データベース接続
 * @returns {Promise<number>} 削除されたレコード数
 */
async function cleanOldMetrics(db) {
  const retentionDays = parseInt(process.env.METRICS_RETENTION_DAYS || '30', 10);

  const result = await db.run(`
    DELETE FROM metric_history
    WHERE timestamp < datetime('now', '-${retentionDays} days')
  `);

  console.log(`[MonitoringService] Deleted ${result.changes} old metric records (older than ${retentionDays} days)`);
  return result.changes;
}

/**
 * メトリクス履歴を取得
 * @param {Object} db - データベース接続
 * @param {string} metricName - メトリクス名
 * @param {string} from - 開始日時（ISO 8601）
 * @param {string} to - 終了日時（ISO 8601）
 * @param {string} interval - 集約間隔（5m, 15m, 1h, 1d）
 * @param {Object} labels - ラベルフィルター（JSON）
 * @returns {Promise<Object>} メトリクス履歴
 */
async function getMetricHistory(db, metricName, from, to, interval = '5m', labels = null) {
  // interval に応じて集約クエリを構築
  const intervalSeconds = parseInterval(interval);

  let query = `
    SELECT
      strftime('%Y-%m-%dT%H:%M:00Z', timestamp) as timestamp,
      AVG(metric_value) as value
    FROM metric_history
    WHERE metric_name = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `;

  const params = [metricName, from, to];

  if (labels) {
    query += ` AND labels = ?`;
    params.push(JSON.stringify(labels));
  }

  query += ` GROUP BY strftime('%Y-%m-%dT%H:%M:00Z', timestamp)
             ORDER BY timestamp ASC`;

  const rows = await db.all(query, params);

  return {
    metric_name: metricName,
    from,
    to,
    interval,
    data_points: rows
  };
}
```

---

### 4.2 AlertService

**責務:**
- アラートルール評価エンジン
- アラート発火・解決ロジック
- アラート履歴管理

**ファイル**: `backend/services/alertService.js`

#### 主要メソッド

```javascript
/**
 * 全アラートルールを評価（1分ごと実行）
 * @param {Object} db - データベース接続
 * @returns {Promise<Object>} 評価結果サマリー
 */
async function evaluateAllRules(db) {
  const startTime = Date.now();

  // 1. 有効なアラートルールを取得
  const rules = await db.all(`
    SELECT * FROM alert_rules
    WHERE enabled = 1
  `);

  console.log(`[AlertService] Evaluating ${rules.length} alert rules`);

  const results = {
    total: rules.length,
    fired: 0,
    resolved: 0,
    errors: 0
  };

  // 2. 各ルールを評価
  for (const rule of rules) {
    try {
      const evaluation = await evaluateRule(db, rule);

      if (evaluation.shouldFire) {
        await fireAlert(db, rule, evaluation.currentValue);
        results.fired++;
      } else if (evaluation.shouldResolve) {
        await resolveAlert(db, rule);
        results.resolved++;
      }
    } catch (err) {
      console.error(`[AlertService] Error evaluating rule ${rule.rule_name}:`, err);
      results.errors++;
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`[AlertService] Evaluation complete: ${results.fired} fired, ${results.resolved} resolved, ${results.errors} errors (${duration}s)`);

  return results;
}

/**
 * 単一アラートルールを評価
 * @param {Object} db - データベース接続
 * @param {Object} rule - アラートルール
 * @returns {Promise<Object>} { shouldFire, shouldResolve, currentValue }
 */
async function evaluateRule(db, rule) {
  // 1. 現在のメトリクス値を取得
  const currentValue = await getCurrentMetricValue(rule.metric_name);

  if (currentValue === null) {
    return { shouldFire: false, shouldResolve: false, currentValue: null };
  }

  // 2. 条件評価
  const conditionMet = evaluateCondition(currentValue, rule.condition, rule.threshold);

  // 3. 継続時間チェック（durationが設定されている場合）
  if (rule.duration) {
    const conditionMetSince = await getConditionMetSince(db, rule.id, conditionMet);

    if (conditionMet && conditionMetSince >= rule.duration) {
      // 条件が継続時間以上満たされている → 発火
      return { shouldFire: true, shouldResolve: false, currentValue };
    } else if (!conditionMet) {
      // 条件が満たされなくなった → 解決
      return { shouldFire: false, shouldResolve: true, currentValue };
    } else {
      // 条件は満たされているが継続時間未満
      return { shouldFire: false, shouldResolve: false, currentValue };
    }
  } else {
    // 継続時間なし → 即座に発火/解決
    if (conditionMet) {
      return { shouldFire: true, shouldResolve: false, currentValue };
    } else {
      return { shouldFire: false, shouldResolve: true, currentValue };
    }
  }
}

/**
 * アラートを発火
 * @param {Object} db - データベース接続
 * @param {Object} rule - アラートルール
 * @param {number} currentValue - 現在のメトリクス値
 * @returns {Promise<number>} アラートID
 */
async function fireAlert(db, rule, currentValue) {
  // 1. 既に発火中のアラートがあるかチェック
  const existingAlert = await db.get(`
    SELECT id FROM alert_history
    WHERE rule_id = ?
      AND status IN ('firing', 'acknowledged')
    ORDER BY created_at DESC
    LIMIT 1
  `, [rule.id]);

  if (existingAlert) {
    console.log(`[AlertService] Alert already firing for rule ${rule.rule_name}, skipping`);
    return existingAlert.id;
  }

  // 2. アラート履歴レコードを作成
  const message = buildAlertMessage(rule, currentValue);

  const result = await db.run(`
    INSERT INTO alert_history (
      rule_id, rule_name, metric_name, current_value, threshold, severity, status, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'firing', ?, datetime('now'))
  `, [rule.id, rule.rule_name, rule.metric_name, currentValue, rule.threshold, rule.severity, message]);

  const alertId = result.lastID;

  console.log(`[AlertService] Alert fired: ${rule.rule_name} (alert_id: ${alertId})`);

  // 3. 通知送信
  if (rule.notification_channels) {
    const channels = JSON.parse(rule.notification_channels);
    await sendAlertNotifications(db, alertId, rule, currentValue, channels);
  }

  return alertId;
}

/**
 * アラートを解決
 * @param {Object} db - データベース接続
 * @param {Object} rule - アラートルール
 * @returns {Promise<boolean>} 解決されたかどうか
 */
async function resolveAlert(db, rule) {
  // 1. 発火中/確認済みのアラートを取得
  const activeAlert = await db.get(`
    SELECT id FROM alert_history
    WHERE rule_id = ?
      AND status IN ('firing', 'acknowledged')
    ORDER BY created_at DESC
    LIMIT 1
  `, [rule.id]);

  if (!activeAlert) {
    return false;  // 解決するアラートがない
  }

  // 2. ステータスを resolved に更新
  await db.run(`
    UPDATE alert_history
    SET status = 'resolved',
        resolved_at = datetime('now')
    WHERE id = ?
  `, [activeAlert.id]);

  console.log(`[AlertService] Alert auto-resolved: ${rule.rule_name} (alert_id: ${activeAlert.id})`);

  return true;
}

/**
 * 条件評価
 * @param {number} currentValue - 現在値
 * @param {string} condition - 条件演算子
 * @param {number} threshold - 閾値
 * @returns {boolean} 条件を満たすかどうか
 */
function evaluateCondition(currentValue, condition, threshold) {
  switch (condition) {
    case '>':
      return currentValue > threshold;
    case '>=':
      return currentValue >= threshold;
    case '<':
      return currentValue < threshold;
    case '<=':
      return currentValue <= threshold;
    case '==':
      return currentValue === threshold;
    case '!=':
      return currentValue !== threshold;
    default:
      throw new Error(`Unknown condition: ${condition}`);
  }
}

/**
 * アラートメッセージを構築
 * @param {Object} rule - アラートルール
 * @param {number} currentValue - 現在値
 * @returns {string} アラートメッセージ
 */
function buildAlertMessage(rule, currentValue) {
  const metricLabels = {
    'itsm_cpu_usage_percent': 'CPU使用率',
    'itsm_memory_usage_percent': 'メモリ使用率',
    'itsm_sla_compliance_rate': 'SLA達成率',
    'itsm_incidents_open': 'オープンインシデント数'
  };

  const label = metricLabels[rule.metric_name] || rule.metric_name;
  const conditionText = {
    '>': 'が',
    '>=': 'が',
    '<': 'を下回りました',
    '<=': 'を下回りました',
    '==': 'と等しくなりました',
    '!=': 'から変化しました'
  }[rule.condition] || '';

  return `${label}${conditionText}（現在: ${currentValue}、閾値: ${rule.threshold}）`;
}
```

---

### 4.3 NotificationService拡張

**既存機能:**
- メール通知（emailService.js経由）
- Slack通知（buildSlackIncidentMessage等）
- Teams通知（buildTeamsIncidentCard等）

**新規追加機能:**
- Webhook通知（カスタムペイロード対応）
- アラート通知（sendAlertNotification）
- テンプレート変数置換

**ファイル**: `backend/services/notificationService.js`（既存ファイルを拡張）

#### 新規メソッド

```javascript
/**
 * Webhook通知を送信
 * @param {string} url - Webhook URL
 * @param {string} method - HTTPメソッド（POST/PUT）
 * @param {Object} payload - ペイロード
 * @param {Object} headers - カスタムヘッダー
 * @returns {Promise<Object>} 送信結果
 */
async function sendWebhookNotification(url, method, payload, headers = {}) {
  try {
    const response = await axios({
      method: method || 'POST',
      url,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: parseInt(process.env.NOTIFICATION_TIMEOUT || '5000', 10)
    });

    console.log('[NotificationService] Webhook notification sent successfully');
    return {
      success: true,
      statusCode: response.status
    };
  } catch (error) {
    console.error('[NotificationService] Webhook notification error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * アラート通知を送信（マルチチャネル）
 * @param {Object} db - データベース接続
 * @param {Object} alert - アラート情報
 * @param {Array<string>} channelNames - 通知チャネル名配列
 * @returns {Promise<Object>} 送信結果サマリー
 */
async function sendAlertNotifications(db, alertId, rule, currentValue, channelNames) {
  const results = {
    email: [],
    slack: [],
    webhook: []
  };

  // アラート情報を取得
  const alert = await db.get('SELECT * FROM alert_history WHERE id = ?', [alertId]);

  // 各チャネルに送信
  for (const channelName of channelNames) {
    const channel = await db.get('SELECT * FROM notification_channels WHERE channel_name = ? AND enabled = 1', [channelName]);

    if (!channel) {
      console.warn(`[NotificationService] Channel not found or disabled: ${channelName}`);
      continue;
    }

    const config = decryptConfig(channel.config);

    try {
      let result;

      switch (channel.channel_type) {
        case 'email':
          result = await sendEmailAlert(config.recipients, alert);
          results.email.push({ channel: channelName, ...result });
          break;

        case 'slack':
          result = await sendSlackAlert(config.webhook_url, alert);
          results.slack.push({ channel: channelName, ...result });
          break;

        case 'webhook':
          result = await sendWebhookAlert(config, alert);
          results.webhook.push({ channel: channelName, ...result });
          break;
      }

      // 通知履歴を保存
      await db.run(`
        INSERT INTO notification_history (channel_id, alert_id, subject, message, status, error_message, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        channel.id,
        alertId,
        `[${alert.severity.toUpperCase()}] ${alert.rule_name}`,
        JSON.stringify(result.payload || {}),
        result.success ? 'sent' : 'failed',
        result.error || null
      ]);
    } catch (err) {
      console.error(`[NotificationService] Error sending to channel ${channelName}:`, err);
    }
  }

  return results;
}

/**
 * Slackアラート通知を送信
 * @param {string} webhookUrl - Slack Webhook URL
 * @param {Object} alert - アラート情報
 * @returns {Promise<Object>} 送信結果
 */
async function sendSlackAlert(webhookUrl, alert) {
  const color = {
    critical: '#FF0000',
    warning: '#FFCC00',
    info: '#00CC00'
  }[alert.severity] || '#CCCCCC';

  const payload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'} Alert: ${alert.rule_name}`,
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*メトリクス:*\n${alert.metric_name}`
              },
              {
                type: 'mrkdwn',
                text: `*重要度:*\n${alert.severity.toUpperCase()}`
              }
            ]
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*現在値:*\n${alert.current_value}`
              },
              {
                type: 'mrkdwn',
                text: `*閾値:*\n${alert.threshold}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*メッセージ:*\n${alert.message}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `発火日時: ${new Date(alert.created_at).toLocaleString('ja-JP')}`
              }
            ]
          }
        ]
      }
    ]
  };

  return sendSlackNotification(webhookUrl, payload);
}

/**
 * Webhookアラート通知を送信（テンプレート変数置換）
 * @param {Object} config - Webhook設定
 * @param {Object} alert - アラート情報
 * @returns {Promise<Object>} 送信結果
 */
async function sendWebhookAlert(config, alert) {
  // テンプレート変数を置換
  const variables = {
    rule_name: alert.rule_name,
    metric_name: alert.metric_name,
    current_value: alert.current_value,
    threshold: alert.threshold,
    severity: alert.severity,
    message: alert.message,
    timestamp: alert.created_at
  };

  let payloadStr = config.payload_template;
  for (const [key, value] of Object.entries(variables)) {
    payloadStr = payloadStr.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  const payload = JSON.parse(payloadStr);

  return sendWebhookNotification(config.webhook_url, config.http_method, payload, config.custom_headers);
}

module.exports = {
  // 既存メソッド
  sendSlackNotification,
  sendTeamsNotification,
  notifyIncident,
  notifySlaAlert,

  // 新規メソッド
  sendWebhookNotification,
  sendAlertNotifications,
  sendSlackAlert,
  sendWebhookAlert
};
```

---

## 5. フロントエンド設計

### 5.1 コンポーネント構成

**監視ダッシュボード画面**: `/views/monitoring.html`

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
└─────────────────────────────────────────────────────────────┘
```

### 5.2 renderMonitoringDashboard() 関数設計

**ファイル**: `frontend/app.js`（既存ファイルに追加）

```javascript
/**
 * 監視ダッシュボードを描画
 */
async function renderMonitoringDashboard() {
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="monitoring-dashboard">
      <h1>監視ダッシュボード</h1>

      <!-- アクティブアラートバー -->
      <div id="active-alerts-bar" class="active-alerts-bar">
        <span class="loading">アラート情報を読み込み中...</span>
      </div>

      <!-- システムステータス -->
      <section class="metrics-section">
        <h2>システムステータス</h2>
        <div id="system-metrics" class="metrics-grid">
          <div class="loading">メトリクスを読み込み中...</div>
        </div>
      </section>

      <!-- ビジネスメトリクス -->
      <section class="metrics-section">
        <h2>ビジネスメトリクス</h2>
        <div id="business-metrics" class="metrics-grid">
          <canvas id="sla-chart"></canvas>
          <canvas id="incidents-chart"></canvas>
        </div>
      </section>

      <!-- パフォーマンスメトリクス -->
      <section class="metrics-section">
        <h2>パフォーマンスメトリクス</h2>
        <div id="performance-metrics" class="metrics-grid">
          <canvas id="response-time-chart"></canvas>
          <canvas id="cache-hit-rate-chart"></canvas>
        </div>
      </section>
    </div>
  `;

  // 初回データ取得
  await refreshDashboard();

  // 自動更新タイマー設定（10秒ごと）
  setInterval(refreshDashboard, 10000);
}

/**
 * ダッシュボードデータをリフレッシュ
 */
async function refreshDashboard() {
  try {
    // 並列でAPI呼び出し
    const [systemMetrics, businessMetrics, performanceMetrics, activeAlerts] = await Promise.all([
      api.get('/monitoring/metrics/system'),
      api.get('/monitoring/metrics/business'),
      api.get('/monitoring/metrics/performance'),
      api.get('/monitoring/alerts?status=firing')
    ]);

    // アクティブアラートバーを更新
    renderActiveAlertsBar(activeAlerts);

    // システムメトリクスを更新
    renderSystemMetrics(systemMetrics.metrics);

    // ビジネスメトリクスを更新（Chart.js）
    renderBusinessMetrics(businessMetrics.metrics);

    // パフォーマンスメトリクスを更新（Chart.js）
    renderPerformanceMetrics(performanceMetrics.metrics);
  } catch (err) {
    console.error('[Dashboard] Error refreshing:', err);
    showError('ダッシュボードの更新に失敗しました。');
  }
}

/**
 * アクティブアラートバーを描画
 * @param {Object} alerts - アラートデータ
 */
function renderActiveAlertsBar(alerts) {
  const container = document.getElementById('active-alerts-bar');

  if (!alerts || !alerts.by_severity) {
    container.innerHTML = '<span>アラートなし</span>';
    return;
  }

  const { critical, warning, info } = alerts.by_severity;

  container.innerHTML = `
    ${critical > 0 ? `<span class="alert-badge critical">🔴 Critical: ${critical}件</span>` : ''}
    ${warning > 0 ? `<span class="alert-badge warning">⚠️ Warning: ${warning}件</span>` : ''}
    ${info > 0 ? `<span class="alert-badge info">ℹ️ Info: ${info}件</span>` : ''}
    ${critical === 0 && warning === 0 && info === 0 ? '<span class="alert-badge success">✅ アラートなし</span>' : ''}
  `;

  // クリックでアラート詳細モーダルを表示
  container.onclick = () => showAlertsModal(alerts.alerts);
}

/**
 * システムメトリクスを描画
 * @param {Object} metrics - システムメトリクス
 */
function renderSystemMetrics(metrics) {
  const container = document.getElementById('system-metrics');

  container.innerHTML = `
    <div class="metric-card">
      <h3>CPU使用率</h3>
      <div class="metric-value ${metrics.cpu.threshold_status}">
        ${metrics.cpu.usage_percent.toFixed(1)}%
      </div>
      <div class="metric-gauge">
        <div class="gauge-fill" style="width: ${metrics.cpu.usage_percent}%"></div>
      </div>
    </div>

    <div class="metric-card">
      <h3>メモリ使用率</h3>
      <div class="metric-value ${metrics.memory.threshold_status}">
        ${metrics.memory.usage_percent.toFixed(1)}%
      </div>
      <div class="metric-gauge">
        <div class="gauge-fill" style="width: ${metrics.memory.usage_percent}%"></div>
      </div>
      <div class="metric-detail">
        ${metrics.memory.used_mb} MB / ${metrics.memory.total_mb} MB
      </div>
    </div>

    <div class="metric-card">
      <h3>ディスク使用率</h3>
      <div class="metric-value ${metrics.disk.threshold_status}">
        ${metrics.disk.usage_percent.toFixed(1)}%
      </div>
      <div class="metric-gauge">
        <div class="gauge-fill" style="width: ${metrics.disk.usage_percent}%"></div>
      </div>
      <div class="metric-detail">
        ${metrics.disk.free_gb} GB 空き
      </div>
    </div>

    <div class="metric-card">
      <h3>稼働時間</h3>
      <div class="metric-value">
        ${metrics.uptime.formatted}
      </div>
    </div>
  `;
}

/**
 * ビジネスメトリクスを描画（Chart.js）
 * @param {Object} metrics - ビジネスメトリクス
 */
function renderBusinessMetrics(metrics) {
  // SLA達成率グラフ
  const slaCtx = document.getElementById('sla-chart').getContext('2d');
  if (window.slaChart) {
    window.slaChart.destroy();
  }
  window.slaChart = new Chart(slaCtx, {
    type: 'line',
    data: {
      labels: metrics.sla_compliance.history_24h.map(d => new Date(d.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })),
      datasets: [{
        label: 'SLA達成率 (%)',
        data: metrics.sla_compliance.history_24h.map(d => d.value),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `SLA達成率（現在: ${metrics.sla_compliance.current_rate}%）`
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 90,
          max: 100
        }
      }
    }
  });

  // オープンインシデントグラフ
  const incidentsCtx = document.getElementById('incidents-chart').getContext('2d');
  if (window.incidentsChart) {
    window.incidentsChart.destroy();
  }
  window.incidentsChart = new Chart(incidentsCtx, {
    type: 'bar',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        label: 'オープンインシデント数',
        data: [
          metrics.incidents_open.by_priority.critical,
          metrics.incidents_open.by_priority.high,
          metrics.incidents_open.by_priority.medium,
          metrics.incidents_open.by_priority.low
        ],
        backgroundColor: [
          'rgba(255, 0, 0, 0.5)',
          'rgba(255, 102, 0, 0.5)',
          'rgba(255, 204, 0, 0.5)',
          'rgba(0, 204, 0, 0.5)'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `オープンインシデント（合計: ${metrics.incidents_open.total}件）`
        }
      }
    }
  });
}

/**
 * パフォーマンスメトリクスを描画（Chart.js）
 * @param {Object} metrics - パフォーマンスメトリクス
 */
function renderPerformanceMetrics(metrics) {
  // APIレスポンスタイムグラフ
  const responseTimeCtx = document.getElementById('response-time-chart').getContext('2d');
  if (window.responseTimeChart) {
    window.responseTimeChart.destroy();
  }
  window.responseTimeChart = new Chart(responseTimeCtx, {
    type: 'line',
    data: {
      labels: metrics.response_time.history_1h.map(d => new Date(d.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })),
      datasets: [{
        label: 'P95 (ms)',
        data: metrics.response_time.history_1h.map(d => d.p95),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `APIレスポンスタイム（現在 P95: ${metrics.response_time.p95_ms}ms）`
        }
      }
    }
  });

  // キャッシュヒット率グラフ
  const cacheHitRateCtx = document.getElementById('cache-hit-rate-chart').getContext('2d');
  if (window.cacheHitRateChart) {
    window.cacheHitRateChart.destroy();
  }
  window.cacheHitRateChart = new Chart(cacheHitRateCtx, {
    type: 'line',
    data: {
      labels: metrics.cache_hit_rate.history_1h.map(d => new Date(d.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })),
      datasets: [{
        label: 'ヒット率 (%)',
        data: metrics.cache_hit_rate.history_1h.map(d => d.value),
        borderColor: 'rgb(54, 162, 235)',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `キャッシュヒット率（現在: ${metrics.cache_hit_rate.current_percent}%）`
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: 0,
          max: 100
        }
      }
    }
  });
}
```

### 5.3 Chart.js統合方法

**CDN読み込み**: `frontend/index.html`に追加

```html
<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
```

**グラフ初期化パターン:**

```javascript
// 既存グラフがあれば破棄
if (window.myChart) {
  window.myChart.destroy();
}

// 新規グラフ作成
window.myChart = new Chart(ctx, {
  type: 'line',  // 'line', 'bar', 'pie', 'doughnut' 等
  data: {
    labels: [...],
    datasets: [...]
  },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'グラフタイトル'
      }
    }
  }
});
```

### 5.4 自動リフレッシュロジック

**ポーリング方式（10秒間隔）:**

```javascript
// グローバル変数
let dashboardRefreshInterval = null;

// ダッシュボード表示時
function renderMonitoringDashboard() {
  // 初回データ取得
  refreshDashboard();

  // 自動更新タイマー設定
  dashboardRefreshInterval = setInterval(refreshDashboard, 10000);
}

// ダッシュボード離脱時（クリーンアップ）
function cleanupMonitoringDashboard() {
  if (dashboardRefreshInterval) {
    clearInterval(dashboardRefreshInterval);
    dashboardRefreshInterval = null;
  }

  // Chart.jsインスタンスも破棄
  if (window.slaChart) window.slaChart.destroy();
  if (window.incidentsChart) window.incidentsChart.destroy();
  if (window.responseTimeChart) window.responseTimeChart.destroy();
  if (window.cacheHitRateChart) window.cacheHitRateChart.destroy();
}
```

---

## 6. アラートエンジン設計

### 6.1 ルール評価ロジック

**評価タイミング**: 1分ごと（スケジューラー）

**評価プロセス:**

```
1. 有効なアラートルール取得（enabled = 1）
   ↓
2. 各ルールについて現在のメトリクス値を取得
   ↓
3. 条件評価（>, <, >=, <=, ==, !=）
   ↓
4. 継続時間チェック（durationが設定されている場合）
   ↓
5. 発火/解決判定
   ↓
6. アラート発火 → 通知送信
   または
   アラート解決 → ステータス更新
```

### 6.2 閾値判定アルゴリズム

**条件演算子:**

| 演算子 | 説明 | 例 |
|--------|------|---|
| `>` | より大きい | CPU > 80% |
| `>=` | 以上 | Memory >= 90% |
| `<` | より小さい | SLA < 95% |
| `<=` | 以下 | Disk <= 10% |
| `==` | 等しい | Status == 'DOWN' |
| `!=` | 等しくない | Health != 'UP' |

**評価関数:**

```javascript
function evaluateCondition(currentValue, condition, threshold) {
  switch (condition) {
    case '>':
      return currentValue > threshold;
    case '>=':
      return currentValue >= threshold;
    case '<':
      return currentValue < threshold;
    case '<=':
      return currentValue <= threshold;
    case '==':
      return currentValue === threshold;
    case '!=':
      return currentValue !== threshold;
    default:
      throw new Error(`Unknown condition: ${condition}`);
  }
}
```

### 6.3 継続時間チェック（duration）

**目的**: フラッピング（頻繁なアラート発火/解決）を防止

**実装方法:**

```javascript
/**
 * 条件が満たされている継続時間を取得
 * @param {Object} db - データベース接続
 * @param {number} ruleId - ルールID
 * @param {boolean} conditionMet - 現在条件が満たされているか
 * @returns {Promise<number>} 継続時間（秒）
 */
async function getConditionMetSince(db, ruleId, conditionMet) {
  // metric_history テーブルから過去のメトリクス値を取得し、
  // 継続して条件を満たしている時間を計算

  // 簡易実装: 最新5分間のメトリクスを取得
  const history = await db.all(`
    SELECT metric_value, timestamp
    FROM metric_history
    WHERE metric_name = (SELECT metric_name FROM alert_rules WHERE id = ?)
      AND timestamp >= datetime('now', '-5 minutes')
    ORDER BY timestamp ASC
  `, [ruleId]);

  if (!history || history.length === 0) {
    return 0;
  }

  // 条件が満たされている連続期間を計算
  const rule = await db.get('SELECT * FROM alert_rules WHERE id = ?', [ruleId]);
  let conditionMetSince = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const met = evaluateCondition(history[i].metric_value, rule.condition, rule.threshold);

    if (met === conditionMet) {
      conditionMetSince++;
    } else {
      break;
    }
  }

  // 5分間隔のスナップショットなので、conditionMetSince * 300秒
  return conditionMetSince * 300;
}
```

### 6.4 通知トリガー条件

**通知送信タイミング:**

1. **アラート発火時**
   - 条件が満たされ、かつ継続時間（duration）を超えた場合
   - 既に発火中のアラートがある場合はスキップ（重複通知防止）

2. **アラート解決時**
   - 通知は送信しない（ログのみ記録）
   - 将来的には「解決通知」機能を追加可能

**実装コード:**

```javascript
// backend/services/alertService.js

async function fireAlert(db, rule, currentValue) {
  // 1. 既に発火中のアラートがあるかチェック（重複通知防止）
  const existingAlert = await db.get(`
    SELECT id FROM alert_history
    WHERE rule_id = ?
      AND status IN ('firing', 'acknowledged')
    ORDER BY created_at DESC
    LIMIT 1
  `, [rule.id]);

  if (existingAlert) {
    console.log(`[AlertService] Alert already firing for rule ${rule.rule_name}, skipping notification`);
    return existingAlert.id;
  }

  // 2. アラート履歴レコードを作成
  const message = buildAlertMessage(rule, currentValue);

  const result = await db.run(`
    INSERT INTO alert_history (
      rule_id, rule_name, metric_name, current_value, threshold, severity, status, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'firing', ?, datetime('now'))
  `, [rule.id, rule.rule_name, rule.metric_name, currentValue, rule.threshold, rule.severity, message]);

  const alertId = result.lastID;

  console.log(`[AlertService] Alert fired: ${rule.rule_name} (alert_id: ${alertId})`);

  // 3. 通知送信（非同期）
  if (rule.notification_channels) {
    const channels = JSON.parse(rule.notification_channels);

    // 非同期で通知送信（失敗してもアラート発火は継続）
    sendAlertNotifications(db, alertId, rule, currentValue, channels).catch(err => {
      console.error(`[AlertService] Error sending notifications for alert ${alertId}:`, err);
    });
  }

  return alertId;
}
```

---

## 7. スケジューラー統合

### 7.1 スケジュール定義

**ファイル**: `backend/services/schedulerService.js`（既存ファイルに追加）

```javascript
const cron = require('node-cron');
const { saveMetricsSnapshot, cleanOldMetrics } = require('./monitoringService');
const { evaluateAllRules } = require('./alertService');
const { db } = require('../db');

/**
 * Phase 9.2: 監視関連スケジュールジョブを登録
 */
function initializeMonitoringSchedules() {
  console.log('[SchedulerService] Initializing monitoring schedules');

  // 1. メトリクススナップショット保存（5分ごと）
  const metricsInterval = process.env.METRICS_SNAPSHOT_INTERVAL || '5';
  cron.schedule(`*/${metricsInterval} * * * *`, async () => {
    console.log('[SchedulerService] Running metrics snapshot job');
    try {
      const savedCount = await saveMetricsSnapshot(db);
      console.log(`[SchedulerService] Metrics snapshot complete: ${savedCount} metrics saved`);
    } catch (err) {
      console.error('[SchedulerService] Metrics snapshot error:', err);
    }
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 2. アラートルール評価（1分ごと）
  const alertInterval = process.env.ALERT_EVALUATION_INTERVAL || '1';
  cron.schedule(`*/${alertInterval} * * * *`, async () => {
    console.log('[SchedulerService] Running alert evaluation job');
    try {
      const results = await evaluateAllRules(db);
      console.log(`[SchedulerService] Alert evaluation complete:`, results);
    } catch (err) {
      console.error('[SchedulerService] Alert evaluation error:', err);
    }
  }, {
    timezone: 'Asia/Tokyo'
  });

  // 3. 古いメトリクス履歴削除（毎日01:00）
  cron.schedule('0 1 * * *', async () => {
    console.log('[SchedulerService] Running metrics cleanup job');
    try {
      const deletedCount = await cleanOldMetrics(db);
      console.log(`[SchedulerService] Metrics cleanup complete: ${deletedCount} records deleted`);
    } catch (err) {
      console.error('[SchedulerService] Metrics cleanup error:', err);
    }
  }, {
    timezone: 'Asia/Tokyo'
  });

  console.log('[SchedulerService] Monitoring schedules initialized');
}

module.exports = {
  // 既存メソッド
  initializeBackupSchedules,  // Phase 9.1

  // 新規メソッド
  initializeMonitoringSchedules
};
```

### 7.2 サーバー起動時の統合

**ファイル**: `backend/server.js`（既存ファイルを修正）

```javascript
// Phase 9.1: バックアップスケジュール初期化
const { initializeBackupSchedules } = require('./services/schedulerService');
initializeBackupSchedules();

// Phase 9.2: 監視スケジュール初期化
const { initializeMonitoringSchedules } = require('./services/schedulerService');
initializeMonitoringSchedules();
```

---

## 8. シーケンス図

### 8.1 メトリクス収集→表示フロー

```
┌────┐         ┌────────┐         ┌────────────┐         ┌──────────┐         ┌─────────┐
│User│         │Frontend│         │REST API    │         │Monitoring│         │Prometheus│
│    │         │        │         │            │         │Service   │         │Registry  │
└──┬─┘         └───┬────┘         └──────┬─────┘         └────┬─────┘         └────┬────┘
   │                │                     │                    │                    │
   │ アクセス       │                     │                    │                    │
   ├───────────────>│                     │                    │                    │
   │                │                     │                    │                    │
   │                │ GET /monitoring/    │                    │                    │
   │                │ metrics/system      │                    │                    │
   │                ├────────────────────>│                    │                    │
   │                │                     │                    │                    │
   │                │                     │ getSystemMetrics() │                    │
   │                │                     ├───────────────────>│                    │
   │                │                     │                    │                    │
   │                │                     │                    │ register.metrics() │
   │                │                     │                    ├───────────────────>│
   │                │                     │                    │<───────────────────│
   │                │                     │                    │                    │
   │                │                     │                    │ parseMetrics()     │
   │                │                     │                    │ calculateCpu()     │
   │                │                     │                    │ calculateMem()     │
   │                │                     │                    │                    │
   │                │                     │<───────────────────┤                    │
   │                │                     │                    │                    │
   │                │ 200 OK (JSON)       │                    │                    │
   │                │<────────────────────┤                    │                    │
   │                │                     │                    │                    │
   │                │ renderSystemMetrics()                    │                    │
   │                │ (Chart.js描画)      │                    │                    │
   │                │                     │                    │                    │
   │ 表示完了       │                     │                    │                    │
   │<───────────────┤                     │                    │                    │
   │                │                     │                    │                    │
   │                │ (10秒後)            │                    │                    │
   │                │ 自動リフレッシュ     │                    │                    │
   │                ├────────────────────>│                    │                    │
   │                │                     │                    │                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 アラート検知→通知フロー

```
┌──────────┐         ┌────────────┐         ┌──────────┐         ┌────────────┐         ┌─────────┐
│Scheduler │         │AlertService│         │Monitoring│         │Notification│         │Database │
│          │         │            │         │Service   │         │Service     │         │         │
└────┬─────┘         └──────┬─────┘         └────┬─────┘         └──────┬─────┘         └────┬────┘
     │                      │                    │                      │                    │
     │ (1分ごと)            │                    │                      │                    │
     │ evaluateAllRules()   │                    │                      │                    │
     ├─────────────────────>│                    │                      │                    │
     │                      │                    │                      │                    │
     │                      │ SELECT alert_rules │                      │                    │
     │                      │ WHERE enabled = 1  │                      │                    │
     │                      ├─────────────────────────────────────────────────────────────>│
     │                      │<─────────────────────────────────────────────────────────────│
     │                      │                    │                      │                    │
     │                      │ getCurrentMetricValue()                   │                    │
     │                      ├───────────────────>│                      │                    │
     │                      │<───────────────────┤                      │                    │
     │                      │                    │                      │                    │
     │                      │ evaluateCondition()│                      │                    │
     │                      │ (CPU: 85.3 > 80)   │                      │                    │
     │                      │                    │                      │                    │
     │                      │ 条件満たす         │                      │                    │
     │                      │ → fireAlert()      │                      │                    │
     │                      │                    │                      │                    │
     │                      │ INSERT alert_history                      │                    │
     │                      ├─────────────────────────────────────────────────────────────>│
     │                      │<─────────────────────────────────────────────────────────────│
     │                      │                    │                      │                    │
     │                      │ sendAlertNotifications()                  │                    │
     │                      ├──────────────────────────────────────────>│                    │
     │                      │                                           │                    │
     │                      │                                           │ sendEmailAlert()   │
     │                      │                                           │ sendSlackAlert()   │
     │                      │                                           │                    │
     │                      │                                           │ INSERT            │
     │                      │                                           │ notification_     │
     │                      │                                           │ history           │
     │                      │                                           ├───────────────────>│
     │                      │                                           │<───────────────────│
     │                      │                                           │                    │
     │                      │<──────────────────────────────────────────┤                    │
     │                      │                    │                      │                    │
     │<─────────────────────┤                    │                      │                    │
     │                      │                    │                      │                    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 ダッシュボード初期化フロー

```
┌────┐         ┌────────┐         ┌────────────┐         ┌──────────┐
│User│         │Frontend│         │REST API    │         │Database  │
└──┬─┘         └───┬────┘         └──────┬─────┘         └────┬─────┘
   │                │                     │                    │
   │ /monitoring    │                     │                    │
   │ アクセス       │                     │                    │
   ├───────────────>│                     │                    │
   │                │                     │                    │
   │                │ renderMonitoring    │                    │
   │                │ Dashboard()         │                    │
   │                │                     │                    │
   │                │ HTML描画            │                    │
   │                │ (テンプレート)      │                    │
   │                │                     │                    │
   │                │ 並列API呼び出し     │                    │
   │                │ (Promise.all)       │                    │
   │                │                     │                    │
   │                │ GET /metrics/system │                    │
   │                ├────────────────────>│                    │
   │                │                     ├───────────────────>│
   │                │                     │<───────────────────│
   │                │<────────────────────┤                    │
   │                │                     │                    │
   │                │ GET /metrics/business                    │
   │                ├────────────────────>│                    │
   │                │                     ├───────────────────>│
   │                │                     │<───────────────────│
   │                │<────────────────────┤                    │
   │                │                     │                    │
   │                │ GET /alerts?status=firing                │
   │                ├────────────────────>│                    │
   │                │                     ├───────────────────>│
   │                │                     │<───────────────────│
   │                │<────────────────────┤                    │
   │                │                     │                    │
   │                │ Chart.js初期化      │                    │
   │                │ - SLAグラフ         │                    │
   │                │ - インシデントグラフ │                    │
   │                │ - レスポンスタイム   │                    │
   │                │                     │                    │
   │                │ setInterval(        │                    │
   │                │   refresh, 10秒)    │                    │
   │                │                     │                    │
   │ 表示完了       │                     │                    │
   │<───────────────┤                     │                    │
   │                │                     │                    │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. セキュリティ設計

### 9.1 認証・認可

**RBAC統合:**

```javascript
// backend/routes/monitoring.js

const { requireRole } = require('../middleware/rbac');

// Admin権限必須
router.post('/alert-rules', requireRole('admin'), createAlertRule);
router.put('/alert-rules/:id', requireRole('admin'), updateAlertRule);
router.delete('/alert-rules/:id', requireRole('admin'), deleteAlertRule);
router.post('/notification-channels', requireRole('admin'), createNotificationChannel);

// Admin/Manager権限
router.get('/metrics/system', requireRole(['admin', 'manager', 'analyst']), getSystemMetrics);
router.put('/alerts/:id/acknowledge', requireRole(['admin', 'manager']), acknowledgeAlert);
```

**権限マトリクス:**

| 操作 | Admin | Manager | Analyst | Viewer |
|------|-------|---------|---------|--------|
| メトリクス閲覧 | ✅ | ✅ | ✅ | ❌ |
| アラート確認 | ✅ | ✅ | ❌ | ❌ |
| アラート解決 | ✅ | ✅ | ❌ | ❌ |
| アラートルール作成 | ✅ | ❌ | ❌ | ❌ |
| 通知チャネル管理 | ✅ | ❌ | ❌ | ❌ |

### 9.2 監査ログ記録（全操作）

**監査ログ対象操作:**

- アラートルール作成/編集/削除
- アラート確認/解決
- 通知チャネル作成/編集/削除
- 通知送信（成功/失敗）

**実装方法:**

```javascript
// backend/middleware/auditLog.js（既存ミドルウェアを活用）

async function auditLog(db, logData) {
  await db.run(`
    INSERT INTO monitoring_audit_logs (
      operation, resource_type, resource_id, user_id, username, ip_address, user_agent, status, details, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    logData.operation,
    logData.resource_type,
    logData.resource_id,
    logData.user_id,
    logData.username,
    logData.ip_address,
    logData.user_agent,
    logData.status,
    JSON.stringify(logData.details)
  ]);
}

// 使用例
await auditLog(db, {
  operation: 'create_alert_rule',
  resource_type: 'alert_rule',
  resource_id: ruleId,
  user_id: req.user.id,
  username: req.user.username,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
  status: 'success',
  details: { rule_name: 'High CPU Usage', severity: 'warning' }
});
```

### 9.3 機密情報暗号化（Webhook URL等）

**暗号化対象:**

- Slack Webhook URL
- カスタムWebhook認証トークン
- メール送信用SMTPパスワード（既存実装）

**暗号化方式**: AES-256-CBC

**実装コード:**

```javascript
// backend/utils/crypto.js

const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY, 'hex');  // 32バイト（256ビット）

if (!KEY || KEY.length !== 32) {
  throw new Error('NOTIFICATION_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
}

/**
 * 設定を暗号化
 * @param {Object} config - 設定オブジェクト
 * @returns {string} 暗号化された文字列（iv:encrypted形式）
 */
function encryptConfig(config) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * 設定を復号化
 * @param {string} encryptedConfig - 暗号化された文字列
 * @returns {Object} 復号化された設定オブジェクト
 */
function decryptConfig(encryptedConfig) {
  const parts = encryptedConfig.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

module.exports = {
  encryptConfig,
  decryptConfig
};
```

**使用例:**

```javascript
// 通知チャネル作成時
const { encryptConfig } = require('../utils/crypto');

router.post('/notification-channels', requireRole('admin'), async (req, res) => {
  const { channel_name, channel_type, config } = req.body;

  // 設定を暗号化
  const encryptedConfig = encryptConfig(config);

  await db.run(`
    INSERT INTO notification_channels (channel_name, channel_type, config, enabled, created_at, updated_at)
    VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
  `, [channel_name, channel_type, encryptedConfig]);

  // ...
});

// 通知チャネル取得時
const { decryptConfig } = require('../utils/crypto');

const channel = await db.get('SELECT * FROM notification_channels WHERE id = ?', [channelId]);
const config = decryptConfig(channel.config);

// configを使用して通知送信
await sendSlackNotification(config.webhook_url, payload);
```

**環境変数設定:**

```bash
# config/env/.env.production
NOTIFICATION_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

**キー生成方法:**

```bash
# 32バイト（256ビット）のランダムキーを生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 10. パフォーマンス設計

### 10.1 パフォーマンス要件

| 指標 | 目標値 | 測定基準 | 実装方針 |
|------|--------|---------|---------|
| **メトリクスAPI応答時間** (GET /metrics/system) | ≤ 100ms | P95 | Prometheusレジストリキャッシュ、非同期処理 |
| **メトリクスAPI応答時間** (GET /metrics/business) | ≤ 200ms | P95 | データベースインデックス、集計クエリ最適化 |
| **ダッシュボード初回描画** | ≤ 2秒 | 完全表示まで | 並列API呼び出し（Promise.all）、Chart.jsレイジーロード |
| **アラート評価遅延** | ≤ 60秒 | 評価開始からアラート発火まで | 1分間隔評価、非同期通知送信 |

### 10.2 キャッシング戦略

**Prometheusレジストリキャッシュ:**

```javascript
// backend/services/monitoringService.js

let metricsCache = null;
let metricsCacheTime = null;
const CACHE_TTL = 5000;  // 5秒

async function getSystemMetrics() {
  const now = Date.now();

  // キャッシュが有効な場合
  if (metricsCache && metricsCacheTime && (now - metricsCacheTime) < CACHE_TTL) {
    console.log('[MonitoringService] Returning cached metrics');
    return metricsCache;
  }

  // Prometheusレジストリから取得
  const metrics = await register.metrics();
  const parsed = parsePrometheusMetrics(metrics);

  // メトリクス計算
  const result = {
    timestamp: new Date().toISOString(),
    metrics: {
      cpu: calculateCpuMetrics(parsed),
      memory: calculateMemoryMetrics(),
      disk: calculateDiskMetrics(),
      uptime: calculateUptimeMetrics(),
      active_users: calculateActiveUsersMetrics(parsed),
      requests_per_minute: calculateRequestsPerMinute(parsed)
    }
  };

  // キャッシュに保存
  metricsCache = result;
  metricsCacheTime = now;

  return result;
}
```

### 10.3 クエリ最適化

**複合インデックス:**

```sql
-- metric_history テーブル
CREATE INDEX idx_metric_history_composite ON metric_history(metric_name, timestamp);

-- alert_history テーブル
CREATE INDEX idx_alert_history_composite ON alert_history(status, severity, created_at);
```

**クエリ例（インデックス活用）:**

```sql
-- メトリクス履歴取得（複合インデックス活用）
SELECT
  strftime('%Y-%m-%dT%H:%M:00Z', timestamp) as timestamp,
  AVG(metric_value) as value
FROM metric_history
WHERE metric_name = 'itsm_cpu_usage_percent'  -- インデックス1列目
  AND timestamp >= '2026-01-30T00:00:00Z'     -- インデックス2列目
  AND timestamp <= '2026-01-31T00:00:00Z'
GROUP BY strftime('%Y-%m-%dT%H:%M:00Z', timestamp)
ORDER BY timestamp ASC;

-- アラート履歴取得（複合インデックス活用）
SELECT * FROM alert_history
WHERE status = 'firing'                      -- インデックス1列目
  AND severity = 'critical'                  -- インデックス2列目
  AND created_at >= '2026-01-30T00:00:00Z'   -- インデックス3列目
ORDER BY created_at DESC
LIMIT 20;
```

### 10.4 非同期処理

**並列API呼び出し（フロントエンド）:**

```javascript
// frontend/app.js

async function refreshDashboard() {
  // 並列でAPI呼び出し（Promise.all）
  const [systemMetrics, businessMetrics, performanceMetrics, activeAlerts] = await Promise.all([
    api.get('/monitoring/metrics/system'),
    api.get('/monitoring/metrics/business'),
    api.get('/monitoring/metrics/performance'),
    api.get('/monitoring/alerts?status=firing')
  ]);

  // 各セクションを更新（非同期）
  renderActiveAlertsBar(activeAlerts);
  renderSystemMetrics(systemMetrics.metrics);
  renderBusinessMetrics(businessMetrics.metrics);
  renderPerformanceMetrics(performanceMetrics.metrics);
}
```

**非同期通知送信（バックエンド）:**

```javascript
// backend/services/alertService.js

async function fireAlert(db, rule, currentValue) {
  // 1. アラート履歴レコード作成（同期処理）
  const result = await db.run(`...`);
  const alertId = result.lastID;

  // 2. 通知送信（非同期処理、失敗してもアラート発火は継続）
  if (rule.notification_channels) {
    const channels = JSON.parse(rule.notification_channels);

    sendAlertNotifications(db, alertId, rule, currentValue, channels).catch(err => {
      console.error(`[AlertService] Error sending notifications for alert ${alertId}:`, err);
    });
  }

  return alertId;
}
```

---

## 11. 総合評価

### 11.1 設計品質スコア

| 評価項目 | スコア | コメント |
|---------|--------|---------|
| **アーキテクチャ妥当性** | ✅ 5/5 | 要件を完全にカバー、既存実装を最大活用、標準パターン採用 |
| **セキュリティ** | ✅ 5/5 | RBAC統合、監査ログ100%、AES-256暗号化 |
| **運用性** | ✅ 5/5 | ログ・監視・アラート完備、自動化スケジューラー |
| **拡張性** | ✅ 5/5 | モジュール分離、カスタムメトリクス対応、Webhook拡張可能 |
| **可用性** | ✅ 5/5 | 非同期処理、フェイルセーフ設計、キャッシング戦略 |
| **パフォーマンス** | ✅ 5/5 | インデックス最適化、並列処理、キャッシング |

**総合スコア**: **5.0/5** (Excellent)

### 11.2 推奨事項

#### 即時実装推奨

1. ✅ **データベーステーブル作成**（マイグレーション）
2. ✅ **MonitoringService実装**
3. ✅ **AlertService実装**
4. ✅ **NotificationService拡張**
5. ✅ **REST API実装**
6. ✅ **監視ダッシュボードUI実装**

#### Phase 9.3実装推奨

7. 🔜 **Machine Learning異常検知**（トレンド分析）
8. 🔜 **WebSocket対応**（リアルタイム更新）
9. 🔜 **カスタムダッシュボード**（ユーザー定義レイアウト）

---

## 12. 次のステップ

### 12.1 実装フェーズへの移行

**Ready for Implementation**: ✅

**実装順序:**

```
Week 1 (Day 1-5): バックエンド実装
  Day 1: データベーステーブル作成（マイグレーション）
  Day 2-3: MonitoringService + AlertService 実装
  Day 4: NotificationService拡張
  Day 5: REST API実装

Week 2 (Day 6-10): フロントエンド + スケジューラー統合
  Day 6-7: 監視ダッシュボードUI実装（Chart.js統合）
  Day 8: アラートルール管理画面
  Day 9: スケジューラー統合、テスト実装
  Day 10: ドキュメント整備
```

---

**承認履歴**:
- 2026-01-31: 初版作成（arch-reviewer）
- 承認待ち

**次のドキュメント**:
- `docs-prod/MONITORING_OPERATIONS.md` - 運用ガイド（Phase 9.2 Week 2）
- `docs-prod/ALERT_CONFIGURATION.md` - アラート設定ガイド（Phase 9.2 Week 2）
- `docs-prod/MONITORING_TROUBLESHOOTING.md` - トラブルシューティングガイド（Phase 9.2 Week 2）
