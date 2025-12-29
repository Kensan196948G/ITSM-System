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

---
### 更新メモ (2025-12-29)
- 監査ダッシュボード/コンプライアンス管理のUI詳細を反映
- 脆弱性管理の編集・削除を有効化
- ドキュメント参照先をDocs/に統一（docs/フォルダ削除）

