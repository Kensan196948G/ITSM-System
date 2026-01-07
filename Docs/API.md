# ITSM-Sec Nexus API ドキュメント

**バージョン**: 2.0.0
**最終更新**: 2026-01-07

## 概要

ITSM-Sec NexusのREST APIドキュメントです。すべてのAPIエンドポイント、リクエスト/レスポンス形式、認証方法を記載しています。

**ベースURL**: `http://localhost:5000/api/v1`
**プロトコル**: HTTP/HTTPS
**データ形式**: JSON

## 認証

### JWT認証

すべての保護されたエンドポイントはJWT（JSON Web Token）認証が必要です。

#### 認証ヘッダー

```http
Authorization: Bearer <your-jwt-token>
```

#### トークン取得

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**レスポンス例**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

## ロール権限

| ロール | 説明 | 権限 |
|--------|------|------|
| **admin** | システム管理者 | 全操作可能 |
| **manager** | マネージャー | 承認、削除以外の全操作 |
| **analyst** | アナリスト | CRUD操作（削除除く） |
| **viewer** | 閲覧者 | 読み取りのみ |

---

## エンドポイント一覧

### 1. 認証 (Authentication)

#### 1.1 ログイン

```http
POST /api/v1/auth/login
```

**リクエスト**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### 1.2 ユーザー登録

```http
POST /api/v1/auth/register
Authorization: Bearer <admin-token>
```

**必要権限**: admin

**リクエスト**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "role": "analyst"
}
```

**レスポンス** (201 Created):
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

#### 1.3 現在のユーザー情報取得

```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "user": {
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "twoFactorEnabled": false
  }
}
```

#### 1.4 2FA設定開始

```http
POST /api/v1/auth/2fa/setup
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCodeUrl": "data:image/png;base64,..."
}
```

#### 1.5 2FA検証

```http
POST /api/v1/auth/2fa/verify
Authorization: Bearer <token>
```

**リクエスト**:
```json
{
  "token": "123456"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "2FA enabled successfully"
}
```

#### 1.6 パスワードリセット要求

```http
POST /api/v1/auth/password-reset/request
```

**リクエスト**:
```json
{
  "email": "user@example.com"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### 2. ダッシュボード (Dashboard)

#### 2.1 KPI統計取得

```http
GET /api/v1/dashboard/kpi
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalIncidents": 150,
    "openIncidents": 25,
    "criticalIncidents": 3,
    "avgResolutionTime": 4.5,
    "slaCompliance": 95.2,
    "securityEvents": 42
  }
}
```

#### 2.2 ダッシュボードウィジェット一覧

```http
GET /api/v1/dashboard/widgets
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "widgets": [
    {
      "id": "widget-1",
      "type": "chart",
      "title": "インシデント推移",
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 }
    },
    {
      "id": "widget-2",
      "type": "stat",
      "title": "SLA達成率",
      "position": { "x": 6, "y": 0, "w": 3, "h": 2 }
    }
  ]
}
```

#### 2.3 チャートデータ取得

```http
GET /api/v1/dashboard/charts/:type
Authorization: Bearer <token>
```

**パラメータ**:
- `type`: chart type (incident-trend, sla-performance, security-events)

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": {
    "labels": ["2026-01-01", "2026-01-02", "2026-01-03"],
    "datasets": [
      {
        "label": "Open",
        "data": [10, 12, 8]
      },
      {
        "label": "Resolved",
        "data": [5, 7, 9]
      }
    ]
  }
}
```

---

### 3. インシデント管理 (Incidents)

#### 3.1 インシデント一覧取得

```http
GET /api/v1/incidents?page=1&limit=20&status=Open&priority=High
Authorization: Bearer <token>
```

**クエリパラメータ**:
- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 20）
- `status`: ステータスフィルタ (Open, In Progress, Resolved, Closed)
- `priority`: 優先度フィルタ (Low, Medium, High, Critical)

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "INC-001",
      "title": "サーバーダウン",
      "description": "Webサーバーが応答しません",
      "priority": "Critical",
      "status": "Open",
      "assignedTo": "engineer1",
      "createdAt": "2026-01-07T10:00:00Z",
      "updatedAt": "2026-01-07T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

#### 3.2 インシデント詳細取得

```http
GET /api/v1/incidents/:id
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "INC-001",
    "title": "サーバーダウン",
    "description": "Webサーバーが応答しません",
    "priority": "Critical",
    "status": "Open",
    "assignedTo": "engineer1",
    "createdBy": "admin",
    "createdAt": "2026-01-07T10:00:00Z",
    "updatedAt": "2026-01-07T10:30:00Z",
    "history": [
      {
        "timestamp": "2026-01-07T10:00:00Z",
        "action": "created",
        "user": "admin"
      }
    ]
  }
}
```

#### 3.3 インシデント作成

```http
POST /api/v1/incidents
Authorization: Bearer <token>
```

**必要権限**: analyst以上

**リクエスト**:
```json
{
  "title": "ネットワーク遅延",
  "description": "社内ネットワークの応答が遅い",
  "priority": "High",
  "category": "Infrastructure",
  "assignedTo": "network-team"
}
```

**レスポンス** (201 Created):
```json
{
  "success": true,
  "id": "INC-002",
  "message": "Incident created successfully"
}
```

#### 3.4 インシデント更新

```http
PUT /api/v1/incidents/:id
Authorization: Bearer <token>
```

**必要権限**: analyst以上

**リクエスト**:
```json
{
  "status": "In Progress",
  "assignedTo": "engineer2",
  "notes": "調査を開始しました"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "Incident updated successfully"
}
```

#### 3.5 インシデント削除

```http
DELETE /api/v1/incidents/:id
Authorization: Bearer <token>
```

**必要権限**: manager以上

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "Incident deleted successfully"
}
```

---

### 4. SLA管理 (SLA)

#### 4.1 SLAターゲット一覧

```http
GET /api/v1/sla/targets
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "sla-1",
      "serviceName": "Webサービス",
      "targetAvailability": 99.9,
      "currentAvailability": 99.95,
      "responseTime": 200,
      "resolutionTime": 24
    }
  ]
}
```

#### 4.2 SLA違反アラート一覧

```http
GET /api/v1/sla/alerts
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-1",
      "slaId": "sla-1",
      "type": "availability",
      "severity": "High",
      "message": "可用性が目標値を下回っています",
      "triggeredAt": "2026-01-07T08:00:00Z"
    }
  ]
}
```

#### 4.3 SLAレポート生成

```http
POST /api/v1/sla/reports/generate
Authorization: Bearer <token>
```

**リクエスト**:
```json
{
  "slaId": "sla-1",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "format": "pdf"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "reportId": "report-123",
  "downloadUrl": "/api/v1/reports/report-123"
}
```

---

### 5. レポート (Reports)

#### 5.1 レポート生成

```http
POST /api/v1/reports/generate
Authorization: Bearer <token>
```

**リクエスト**:
```json
{
  "type": "incident",
  "format": "pdf",
  "filters": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "priority": "Critical"
  }
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "reportId": "report-456",
  "status": "generating",
  "estimatedTime": 30
}
```

#### 5.2 レポート取得

```http
GET /api/v1/reports/:id
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "report": {
    "id": "report-456",
    "type": "incident",
    "format": "pdf",
    "status": "completed",
    "downloadUrl": "/api/v1/reports/report-456/download",
    "createdAt": "2026-01-07T10:00:00Z"
  }
}
```

#### 5.3 スケジュールレポート一覧

```http
GET /api/v1/reports/scheduled
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "schedule-1",
      "name": "日次インシデントレポート",
      "type": "incident",
      "format": "pdf",
      "schedule": "0 9 * * *",
      "recipients": ["manager@example.com"],
      "active": true
    }
  ]
}
```

#### 5.4 スケジュールレポート作成

```http
POST /api/v1/reports/scheduled
Authorization: Bearer <token>
```

**必要権限**: manager以上

**リクエスト**:
```json
{
  "name": "週次SLAレポート",
  "type": "sla",
  "format": "excel",
  "schedule": "0 10 * * 1",
  "recipients": ["management@example.com"]
}
```

**レスポンス** (201 Created):
```json
{
  "success": true,
  "id": "schedule-2",
  "message": "Scheduled report created successfully"
}
```

---

### 6. 通知 (Notifications)

#### 6.1 通知一覧取得

```http
GET /api/v1/notifications?unreadOnly=true
Authorization: Bearer <token>
```

**クエリパラメータ**:
- `unreadOnly`: 未読のみ取得（デフォルト: false）

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-1",
      "type": "incident.created",
      "title": "新規インシデント作成",
      "message": "INC-001が作成されました",
      "priority": "High",
      "read": false,
      "createdAt": "2026-01-07T10:00:00Z"
    }
  ],
  "unreadCount": 5
}
```

#### 6.2 通知送信

```http
POST /api/v1/notifications
Authorization: Bearer <token>
```

**リクエスト**:
```json
{
  "type": "custom",
  "channel": "email",
  "recipient": "user@example.com",
  "subject": "テスト通知",
  "message": "これはテスト通知です",
  "priority": "Medium"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "Notification sent successfully"
}
```

#### 6.3 既読マーク

```http
PUT /api/v1/notifications/:id/read
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

#### 6.4 通知設定取得

```http
GET /api/v1/notifications/settings
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "settings": {
    "channels": {
      "email": true,
      "slack": true,
      "webhook": false
    },
    "preferences": {
      "incidentCreated": "high",
      "slaViolation": "high",
      "reportGenerated": "low"
    }
  }
}
```

---

### 7. 統合 (Integrations)

#### 7.1 統合設定一覧

```http
GET /api/v1/integrations
Authorization: Bearer <token>
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "integrations": [
    {
      "id": "m365",
      "name": "Microsoft 365",
      "type": "user-sync",
      "status": "active",
      "lastSync": "2026-01-07T06:00:00Z"
    },
    {
      "id": "servicenow",
      "name": "ServiceNow",
      "type": "incident-sync",
      "status": "active",
      "lastSync": "2026-01-07T05:30:00Z"
    }
  ]
}
```

#### 7.2 Microsoft 365同期実行

```http
POST /api/v1/integrations/m365/sync
Authorization: Bearer <token>
```

**必要権限**: admin

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "Sync started",
  "syncId": "sync-123"
}
```

#### 7.3 ServiceNow同期実行

```http
POST /api/v1/integrations/servicenow/sync
Authorization: Bearer <token>
```

**必要権限**: manager以上

**リクエスト**:
```json
{
  "incidentId": "INC-001",
  "direction": "push"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "message": "Incident synced to ServiceNow",
  "serviceNowId": "INC0010001"
}
```

---

### 8. エクスポート (Export)

#### 8.1 データエクスポート

```http
GET /api/v1/export/:resource?format=csv
Authorization: Bearer <token>
```

**パラメータ**:
- `resource`: incidents, assets, sla, vulnerabilities
- `format`: csv, excel, json

**レスポンス** (200 OK):
```
Content-Type: text/csv
Content-Disposition: attachment; filename="incidents_2026-01-07.csv"

id,title,priority,status,created_at
INC-001,サーバーダウン,Critical,Open,2026-01-07T10:00:00Z
INC-002,ネットワーク遅延,High,Resolved,2026-01-06T15:30:00Z
```

---

### 9. ヘルスチェック (Health)

#### 9.1 基本ヘルスチェック

```http
GET /api/v1/health
```

**レスポンス** (200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-01-07T10:00:00Z",
  "uptime": 86400,
  "version": "2.0.0"
}
```

#### 9.2 Liveness Probe

```http
GET /api/v1/health/live
```

**レスポンス** (200 OK):
```json
{
  "status": "alive"
}
```

#### 9.3 Readiness Probe

```http
GET /api/v1/health/ready
```

**レスポンス** (200 OK):
```json
{
  "status": "ready",
  "database": "connected",
  "cache": "operational"
}
```

---

## エラーレスポンス

### エラー形式

```json
{
  "success": false,
  "error": "エラーメッセージ",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTPステータスコード

| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | リクエストエラー |
| 401 | 認証エラー |
| 403 | 権限不足 |
| 404 | リソースが見つからない |
| 409 | リソースの競合 |
| 422 | バリデーションエラー |
| 429 | レートリミット超過 |
| 500 | サーバーエラー |

### エラーコード一覧

| コード | 説明 |
|--------|------|
| `INVALID_TOKEN` | JWTトークンが無効 |
| `TOKEN_EXPIRED` | JWTトークンの有効期限切れ |
| `INSUFFICIENT_PERMISSIONS` | 権限不足 |
| `VALIDATION_ERROR` | バリデーションエラー |
| `RESOURCE_NOT_FOUND` | リソースが見つからない |
| `DUPLICATE_RESOURCE` | リソースの重複 |
| `DATABASE_ERROR` | データベースエラー |

---

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| `/api/v1/auth/login` | 5リクエスト/15分/IP |
| `/api/v1/auth/register` | 3リクエスト/時間/IP |
| その他すべて | 100リクエスト/15分/IP |

**レート制限超過時のレスポンス** (429 Too Many Requests):
```json
{
  "success": false,
  "error": "Too many requests",
  "retryAfter": 900
}
```

---

## Webhookペイロード

### インシデント作成イベント

```json
{
  "event": "incident.created",
  "timestamp": "2026-01-07T10:00:00Z",
  "data": {
    "id": "INC-001",
    "title": "サーバーダウン",
    "priority": "Critical",
    "status": "Open"
  }
}
```

### SLA違反イベント

```json
{
  "event": "sla.violated",
  "timestamp": "2026-01-07T08:00:00Z",
  "data": {
    "slaId": "sla-1",
    "serviceName": "Webサービス",
    "type": "availability",
    "currentValue": 99.5,
    "targetValue": 99.9
  }
}
```

---

## OpenAPI仕様

完全なOpenAPI仕様は以下から参照できます：

**Swagger UI**: `http://localhost:5000/api-docs`

**OpenAPI JSON**: `http://localhost:5000/api-docs.json`

---

## サポート

- **ドキュメント**: [開発者ガイド](./開発者ガイド.md)
- **運用マニュアル**: [運用マニュアル](./運用マニュアル.md)
- **Swagger UI**: http://localhost:5000/api-docs

---

**最終更新**: 2026-01-07
**バージョン**: 2.0.0
