# API仕様書（API-Specification）

## 1. 共通事項
- **Base URL**: `/api/v1`
- **Format**: JSON
- **Auth**: JWT (将来実装予定)

## 2. エンドポイント

### 2.1 インシデント管理
- `GET /incidents`: インシデント一覧の取得
- `POST /incidents`: 新規インシデントの作成
- `GET /incidents/:id`: 特定インシデントの詳細取得
- `PUT /incidents/:id`: インシデントの更新

### 2.2 構成管理 (CMDB)
- `GET /assets`: 資産一覧の取得
- `GET /assets/:id`: 資産詳細の取得

### 2.3 セキュリティ・コンプライアンス
- `GET /compliance/stats`: NIST CSF 2.0 準拠状況のサマリー取得
- `GET /vulnerabilities`: 脆弱性一覧の取得

### 2.4 ダッシュボード用サマリー
- `GET /dashboard/kpi`: ITSM/Security統合KPIの取得

### 2.5 SLA管理
- `GET /sla-agreements`: SLA契約一覧の取得
- `POST /sla-agreements`: 新規SLA契約の作成
- `GET /sla-agreements/:id`: 特定SLA契約の詳細取得
- `PUT /sla-agreements/:id`: SLA契約の更新（違反検出・アラート送信）
- `DELETE /sla-agreements/:id`: SLA契約の削除（admin権限必須）
- `GET /sla-statistics`: SLA統計情報の取得
- `GET /sla-reports/generate`: SLAレポート生成（下記参照）

## 3. レスポンス例 (GET /dashboard/kpi)
```json
{
  "active_incidents": 12,
  "sla_compliance": 99.8,
  "vulnerabilities": {
    "critical": 2,
    "high": 5
  },
  "csf_progress": {
    "govern": 85,
    "identify": 90,
    "protect": 75,
    "detect": 60,
    "respond": 85,
    "recover": 95
  }
}
```

## 4. レスポンス例 (GET /sla-reports/generate)

### クエリパラメータ
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| from_date | string | No | 開始日（YYYY-MM-DD） |
| to_date | string | No | 終了日（YYYY-MM-DD） |

### レスポンス
```json
{
  "report_generated_at": "2026-01-07T12:00:00.000Z",
  "report_generated_by": "admin",
  "date_range": {
    "from": "2026-01-01",
    "to": "2026-01-07"
  },
  "summary": {
    "total_slas": 15,
    "met": 12,
    "at_risk": 2,
    "violated": 1,
    "compliance_rate": 80,
    "avg_achievement_rate": 92.5,
    "min_achievement_rate": 75.0,
    "max_achievement_rate": 100.0
  },
  "by_service": [
    {
      "service_name": "インシデント管理",
      "count": 5,
      "avg_achievement": 95.2,
      "met": 4,
      "at_risk": 1,
      "violated": 0
    }
  ],
  "details": [...],
  "alerts": [...]
}
```

## 5. SLA違反アラート

SLA契約更新時（PUT /sla-agreements/:id）に以下の条件でアラートが発生：

| 条件 | トリガー |
|------|----------|
| ステータス違反 | Met から Violated/Breached に変化 |
| リスク検出 | Met から At-Risk に変化 |
| 閾値割れ | 達成率がSLA_ALERT_THRESHOLD（デフォルト90%）を下回る |

アラート発生時のレスポンス：
```json
{
  "message": "SLA契約が正常に更新されました",
  "changes": 1,
  "updated_by": "admin",
  "alert_triggered": true
}
```

---
### 更新メモ (2026-01-07)
- SLA管理エンドポイント追加（2.5節）
- SLAレポート生成APIの仕様追加（4節）
- SLA違反アラート機能の説明追加（5節）

### 更新メモ (2025-12-29)
- 監査ダッシュボード/コンプライアンス管理のUI詳細を反映
- 脆弱性管理の編集・削除を有効化
- ドキュメント参照先をDocs/に統一（docs/フォルダ削除）

