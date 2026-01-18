# データ移行計画書（Data Migration Plan）

**プロジェクト**: ITSM-Sec Nexus
**バージョン**: 1.0.0
**作成日**: 2026-01-01
**ステータス**: ドラフト

---

## 目次

1. [概要](#1-概要)
2. [移行対象データ](#2-移行対象データ)
3. [データソースの選定](#3-データソースの選定)
4. [移行戦略](#4-移行戦略)
5. [移行手順](#5-移行手順)
6. [必要なツール・スクリプト](#6-必要なツールスクリプト)
7. [リスク管理](#7-リスク管理)
8. [検証・テスト計画](#8-検証テスト計画)
9. [ロールバック計画](#9-ロールバック計画)
10. [スケジュール](#10-スケジュール)

---

## 1. 概要

### 1.1 目的

本計画書は、ITSM-Sec Nexusシステムにおいて、開発環境のダミーデータから本番環境の実際のデータへ移行するための戦略、手順、ツールを定義します。

### 1.2 背景

現在のシステムは以下のダミーデータで運用されています：
- デフォルトユーザー（admin/analyst/viewer）
- サンプルインシデント（3件）
- サンプル資産（6件）
- サンプルRFC（2件）
- その他のダミーデータ

本番環境では、既存システムまたは実データソースから正確なデータを移行する必要があります。

### 1.3 スコープ

**対象範囲（In-Scope）**:
- 全エンティティの本番データ移行
- データ検証・整合性チェック
- 移行ツール開発
- ロールバック手順策定

**対象外（Out-of-Scope）**:
- データクレンジング（移行前に完了していることが前提）
- システムアーキテクチャの変更
- 新機能の追加

---

## 2. 移行対象データ

### 2.1 主要エンティティ一覧

| エンティティ | テーブル名 | 優先度 | データソース候補 |
|-------------|-----------|-------|---------------|
| **ユーザー** | `users` | P0（最優先） | Active Directory / Microsoft 365 |
| **インシデント** | `incidents` | P0 | 既存ITSM / ServiceNow / CSV |
| **資産** | `assets` | P0 | CMDB / Excel / Microsoft Intune |
| **変更管理** | `changes` | P1 | 既存ITSM / ServiceNow / CSV |
| **問題管理** | `problems` | P1 | 既存ITSM / CSV |
| **脆弱性** | `vulnerabilities` | P0 | 脆弱性スキャナー / Qualys / Tenable |
| **サービス要求** | `service_requests` | P2 | 既存ITSM / CSV |
| **リリース** | `releases` | P2 | 既存ITSM / CSV |
| **SLA** | `sla_agreements` | P2 | 既存ITSM / 手動入力 |
| **ナレッジ** | `knowledge_articles` | P2 | SharePoint / Confluence / CSV |
| **キャパシティ** | `capacity_metrics` | P2 | 監視システム / Zabbix / Prometheus |
| **コンプライアンス** | `compliance` | P1 | 監査資料 / 手動入力 |
| **監査ログ** | `audit_logs` | P3 | 既存システム / 不要なら削除 |
| **セキュリティアラート** | `security_alerts` | P1 | SIEM / 手動入力 |

### 2.2 データ量推定

| エンティティ | 推定レコード数 | データサイズ（概算） |
|-------------|--------------|-------------------|
| users | 50〜500 | 50KB〜500KB |
| incidents | 1,000〜10,000 | 1MB〜10MB |
| assets | 500〜5,000 | 500KB〜5MB |
| changes | 500〜5,000 | 500KB〜5MB |
| problems | 100〜1,000 | 100KB〜1MB |
| vulnerabilities | 100〜1,000 | 100KB〜1MB |
| **合計** | **2,250〜22,500** | **2.5MB〜25MB** |

---

## 3. データソースの選定

### 3.1 データソース戦略

本番データの取得方法として、以下の4つの戦略を検討します。

#### 戦略1: Microsoft 365非対話型認証（推奨）

**概要**:
Microsoft Graph APIを使用し、OAuth2 Client Credentials Flowで認証を行い、以下のデータを取得：

- **ユーザー**: Azure AD / Microsoft Entra ID
- **資産**: Microsoft Intune（デバイス管理）
- **セキュリティアラート**: Microsoft Defender for Endpoint

**メリット**:
- 自動化が容易
- リアルタイムデータ取得
- Microsoft環境との親和性が高い

**デメリット**:
- Microsoft 365テナントの管理者権限が必要
- Graph API権限設定が必要

**必要な権限**:
```
User.Read.All           # ユーザー情報の読み取り
Device.Read.All         # デバイス情報の読み取り
SecurityEvents.Read.All # セキュリティイベントの読み取り
```

**実装例**:
```javascript
// backend/utils/microsoft-graph.js
const axios = require('axios');

async function getAccessToken() {
  const response = await axios.post(
    `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
    new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  );
  return response.data.access_token;
}

async function getUsers() {
  const token = await getAccessToken();
  const response = await axios.get('https://graph.microsoft.com/v1.0/users', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.value;
}
```

#### 戦略2: 既存システムAPI接続

**概要**:
既存のITSMシステム（ServiceNow、Jira Service Management等）のREST APIに接続してデータを取得。

**対象データ**:
- インシデント
- 変更管理（RFC）
- 問題管理
- サービス要求

**メリット**:
- 既存データの正確な移行
- 履歴データの保持

**デメリット**:
- 既存システムのAPI仕様調査が必要
- APIキー/認証情報の管理

**実装例（ServiceNow）**:
```javascript
// backend/utils/servicenow-connector.js
const axios = require('axios');

async function getIncidents() {
  const response = await axios.get(
    `https://${process.env.SERVICENOW_INSTANCE}.service-now.com/api/now/table/incident`,
    {
      auth: {
        username: process.env.SERVICENOW_USER,
        password: process.env.SERVICENOW_PASSWORD
      },
      params: {
        sysparm_limit: 1000,
        sysparm_query: 'state!=7' // 7=Closed
      }
    }
  );
  return response.data.result;
}
```

#### 戦略3: CSV/Excelファイルからのインポート

**概要**:
既存システムからエクスポートしたCSV/Excelファイルを読み込み、データベースに投入。

**メリット**:
- システム連携不要
- 既存システムがAPIを持たない場合に有効
- データクレンジングが容易

**デメリット**:
- 手動作業が発生
- リアルタイム性なし
- データフォーマット統一が必要

**対応フォーマット**:
- CSV（UTF-8 / Shift_JIS対応）
- Excel（.xlsx）
- JSON

**実装例**:
```javascript
// backend/utils/csv-importer.js
const xlsx = require('xlsx');
const fs = require('fs');

function importFromExcel(filePath, sheetName) {
  const workbook = xlsx.readFile(filePath);
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);
  return data;
}

function importFromCSV(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(worksheet);
}
```

#### 戦略4: 手動データ入力支援ツール

**概要**:
管理画面から直接データを入力するためのバッチ登録機能を提供。

**対象データ**:
- コンプライアンス設定
- SLA定義
- ポリシー・プロシージャー

**メリット**:
- データソースが存在しない場合の最終手段
- 小規模データに適する

**デメリット**:
- 時間がかかる
- 入力ミスのリスク

**実装機能**:
- 一括登録フォーム
- CSVテンプレートダウンロード
- バリデーション機能

### 3.2 推奨データソースマッピング

| エンティティ | 推奨データソース | 代替手段 |
|-------------|---------------|---------|
| users | Microsoft 365 Graph API | CSV（ADエクスポート） |
| incidents | 既存ITSM API | CSV |
| assets | Microsoft Intune API | CSV（資産管理台帳） |
| changes | 既存ITSM API | CSV |
| problems | 既存ITSM API | CSV |
| vulnerabilities | 脆弱性スキャナーAPI | CSV |
| service_requests | 既存ITSM API | CSV |
| knowledge_articles | SharePoint API | CSV |
| capacity_metrics | 監視システムAPI | 手動入力 |
| compliance | 手動入力 | CSV |

---

## 4. 移行戦略

### 4.1 移行アプローチ

**段階的移行（Phased Migration）** を採用します。

#### フェーズ1: マスターデータ移行（P0）
- ユーザー
- 資産
- インシデント（直近6ヶ月）

#### フェーズ2: トランザクションデータ移行（P1）
- 変更管理
- 問題管理
- 脆弱性

#### フェーズ3: 参照データ移行（P2）
- ナレッジベース
- SLA
- キャパシティメトリクス

### 4.2 移行方式

**方式**: **ETL（Extract, Transform, Load）**

1. **Extract（抽出）**: データソースからデータを取得
2. **Transform（変換）**: ITSM-Sec Nexusのスキーマに変換
3. **Load（投入）**: データベースに投入
4. **Validate（検証）**: データ整合性チェック

### 4.3 データ変換マッピング

#### 例: インシデントデータの変換

**ソース（ServiceNow）** → **ターゲット（ITSM-Sec Nexus）**

| ServiceNow | ITSM-Sec Nexus | 変換ルール |
|-----------|----------------|----------|
| number | ticket_id | そのまま |
| short_description | title | そのまま |
| description | description | HTMLタグ除去 |
| state | status | マッピング: 1=Analyzing, 2=In-Progress, 6=Resolved |
| priority | priority | マッピング: 1=Critical, 2=High, 3=Medium, 4=Low |
| category | is_security_incident | category='Security' → true |
| sys_created_on | created_at | ISO 8601形式に変換 |

---

## 5. 移行手順

### 5.1 移行前準備

#### ステップ1: データソース確認
```bash
# 既存システムの接続確認
curl -X GET https://instance.service-now.com/api/now/table/incident \
  -u "username:password" \
  --header "Accept: application/json"

# Microsoft Graph API接続確認
node backend/scripts/test-graph-connection.js
```

#### ステップ2: バックアップ取得
```bash
# 現在のデータベースをバックアップ
npm run backup

# バックアップファイルを確認
ls -lh backend/backups/daily/
```

#### ステップ3: 環境変数設定
```bash
# .env.migration ファイルを作成
cat > .env.migration <<EOF
# Microsoft 365 Graph API
TENANT_ID=your-tenant-id
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret

# ServiceNow（既存ITSM）
SERVICENOW_INSTANCE=your-instance
SERVICENOW_USER=admin
SERVICENOW_PASSWORD=your-password

# 脆弱性スキャナー（Tenable）
TENABLE_ACCESS_KEY=your-access-key
TENABLE_SECRET_KEY=your-secret-key
EOF
```

### 5.2 移行実行

#### ステップ1: データ抽出
```bash
# Microsoft 365からユーザーを抽出
node backend/scripts/migrate/extract-users-from-m365.js

# ServiceNowからインシデントを抽出
node backend/scripts/migrate/extract-incidents-from-servicenow.js

# CSVファイルから資産を抽出
node backend/scripts/migrate/extract-assets-from-csv.js --file=assets.csv
```

#### ステップ2: データ変換
```bash
# 抽出データを変換
node backend/scripts/migrate/transform-data.js \
  --input=data/extracted/users.json \
  --output=data/transformed/users.json \
  --mapping=config/mappings/users.json
```

#### ステップ3: データ投入
```bash
# 変換データをデータベースに投入
node backend/scripts/migrate/load-data.js \
  --entity=users \
  --file=data/transformed/users.json \
  --mode=upsert  # insert | upsert | replace
```

#### ステップ4: 検証
```bash
# データ整合性チェック
node backend/scripts/migrate/validate-data.js --entity=users
node backend/scripts/migrate/validate-data.js --entity=incidents
node backend/scripts/migrate/validate-data.js --all
```

### 5.3 移行後処理

#### ステップ1: インデックス再構築
```bash
# SQLiteのインデックスを最適化
node backend/scripts/optimize-db.js
```

#### ステップ2: 初期パスワードリセット通知
```bash
# 新規ユーザーにパスワードリセット通知を送信
node backend/scripts/send-password-reset-emails.js
```

#### ステップ3: 監査ログ記録
```bash
# 移行操作を監査ログに記録
node backend/scripts/log-migration-audit.js
```

---

## 6. 必要なツール・スクリプト

### 6.1 開発が必要なスクリプト一覧

#### データ抽出スクリプト
```
backend/scripts/migrate/
├── extract-users-from-m365.js          # Microsoft 365ユーザー抽出
├── extract-devices-from-intune.js      # Intuneデバイス抽出
├── extract-incidents-from-servicenow.js # ServiceNowインシデント抽出
├── extract-vulnerabilities-from-tenable.js # Tenable脆弱性抽出
├── extract-assets-from-csv.js          # CSV資産抽出
└── extract-generic-from-csv.js         # 汎用CSVインポーター
```

#### データ変換スクリプト
```
backend/scripts/migrate/
├── transform-data.js                   # 汎用データ変換
├── mappings/
│   ├── users.json                     # ユーザーマッピング定義
│   ├── incidents.json                 # インシデントマッピング定義
│   ├── assets.json                    # 資産マッピング定義
│   └── ...
└── transformers/
    ├── date-transformer.js            # 日付変換
    ├── status-mapper.js               # ステータスマッピング
    └── html-cleaner.js                # HTMLタグ除去
```

#### データ投入スクリプト
```
backend/scripts/migrate/
├── load-data.js                       # 汎用データ投入
├── loaders/
│   ├── user-loader.js                # ユーザー投入
│   ├── incident-loader.js            # インシデント投入
│   └── ...
└── validators/
    ├── schema-validator.js           # スキーマ検証
    ├── integrity-validator.js        # 整合性検証
    └── duplicate-checker.js          # 重複チェック
```

#### 検証・ユーティリティスクリプト
```
backend/scripts/migrate/
├── validate-data.js                   # データ検証
├── test-connections.js                # 接続テスト
├── rollback.js                        # ロールバック
├── optimize-db.js                     # DB最適化
└── generate-migration-report.js       # 移行レポート生成
```

### 6.2 設定ファイル

#### マッピング定義例（users.json）
```json
{
  "sourceType": "microsoft365",
  "targetTable": "users",
  "mappings": [
    {
      "source": "userPrincipalName",
      "target": "username",
      "transform": "lowercase"
    },
    {
      "source": "mail",
      "target": "email",
      "required": true
    },
    {
      "source": "displayName",
      "target": "full_name"
    },
    {
      "source": "accountEnabled",
      "target": "is_active"
    }
  ],
  "defaults": {
    "role": "viewer",
    "password_hash": "$generated$"
  }
}
```

### 6.3 必要なnpmパッケージ

```json
{
  "dependencies": {
    "xlsx": "^0.18.5",              // 既にインストール済み
    "axios": "^1.6.0",              // HTTP通信
    "@microsoft/microsoft-graph-client": "^3.0.7",  // Microsoft Graph
    "node-fetch": "^3.3.2",         // Fetch API
    "csv-parser": "^3.0.0",         // CSV解析
    "iconv-lite": "^0.6.3"          // 文字コード変換（Shift_JIS対応）
  }
}
```

---

## 7. リスク管理

### 7.1 リスク識別

| リスクID | リスク内容 | 影響度 | 発生確率 | 対策 |
|---------|----------|-------|---------|-----|
| R-001 | データ損失 | 高 | 低 | 移行前バックアップ必須 |
| R-002 | データ形式不一致 | 中 | 高 | 事前スキーマ検証 |
| R-003 | 移行時間超過 | 中 | 中 | 段階的移行 |
| R-004 | 重複データ投入 | 低 | 中 | ユニークキー制約・upsert使用 |
| R-005 | 文字コード問題 | 低 | 高 | UTF-8統一・iconv-lite使用 |
| R-006 | API認証失敗 | 高 | 中 | 接続テストスクリプト実装 |
| R-007 | 参照整合性違反 | 中 | 中 | 外部キー検証 |

### 7.2 リスク対応策

#### R-001: データ損失対策
```bash
# 自動バックアップスクリプト
#!/bin/bash
BACKUP_DIR="backend/backups/migration"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp backend/itsm_nexus.db "$BACKUP_DIR/pre_migration_$TIMESTAMP.db"
echo "Backup created: pre_migration_$TIMESTAMP.db"
```

#### R-002: データ形式検証
```javascript
// スキーマ検証例
const Ajv = require('ajv');
const ajv = new Ajv();

const userSchema = {
  type: 'object',
  required: ['username', 'email', 'role'],
  properties: {
    username: { type: 'string', minLength: 3 },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['admin', 'manager', 'analyst', 'viewer'] }
  }
};

const validate = ajv.compile(userSchema);
if (!validate(data)) {
  console.error('Validation failed:', validate.errors);
}
```

---

## 8. 検証・テスト計画

### 8.1 検証項目

#### レベル1: データ投入検証
- [ ] レコード数が一致すること
- [ ] 必須フィールドがすべて埋まっていること
- [ ] データ型が正しいこと

#### レベル2: 整合性検証
- [ ] 外部キー参照が正しいこと（例: incidents.asset_tag → assets.asset_tag）
- [ ] ステータス値が許可された値のみであること
- [ ] 日付の整合性（created_at ≤ resolved_at）

#### レベル3: ビジネスロジック検証
- [ ] 優先度がCriticalのインシデントが正しく表示されること
- [ ] SLA達成率が正しく計算されること
- [ ] ダッシュボードKPIが正しく集計されること

### 8.2 検証スクリプト例

```javascript
// backend/scripts/migrate/validate-data.js
const { db } = require('../../db');

async function validateIncidents() {
  return new Promise((resolve, reject) => {
    const checks = {
      recordCount: 0,
      missingTitle: 0,
      invalidStatus: 0,
      orphanedAssets: 0
    };

    db.all('SELECT COUNT(*) as count FROM incidents', (err, rows) => {
      if (err) return reject(err);
      checks.recordCount = rows[0].count;

      db.all('SELECT COUNT(*) as count FROM incidents WHERE title IS NULL OR title = ""', (err2, rows2) => {
        if (err2) return reject(err2);
        checks.missingTitle = rows2[0].count;

        db.all(`SELECT COUNT(*) as count FROM incidents WHERE status NOT IN
          ('Identified', 'Analyzing', 'In-Progress', 'Resolved', 'Closed')`, (err3, rows3) => {
          if (err3) return reject(err3);
          checks.invalidStatus = rows3[0].count;

          resolve(checks);
        });
      });
    });
  });
}

async function runValidation() {
  const results = await validateIncidents();
  console.log('Validation Results:', results);

  if (results.missingTitle > 0) {
    console.error(`ERROR: ${results.missingTitle} incidents have missing titles`);
    process.exit(1);
  }

  console.log('Validation passed!');
}

runValidation();
```

### 8.3 テストデータセット

移行前にテストデータを使用して検証を行います。

```bash
# テスト環境でのドライラン
NODE_ENV=test DATABASE_PATH=backend/test_migration.db \
  node backend/scripts/migrate/load-data.js \
  --entity=users \
  --file=data/test/users_sample.json \
  --dry-run
```

---

## 9. ロールバック計画

### 9.1 ロールバック条件

以下のいずれかが発生した場合、ロールバックを実施：
- データ整合性エラーが10%以上
- 必須フィールドの欠損が1%以上
- 移行時間が予定の2倍を超過
- システムが起動不可

### 9.2 ロールバック手順

#### 手順1: サービス停止
```bash
sudo systemctl stop itsm-system
sudo systemctl stop itsm-frontend
```

#### 手順2: データベース復元
```bash
# バックアップから復元
cp backend/backups/migration/pre_migration_20260101_090000.db \
   backend/itsm_nexus.db

# または restore.sh スクリプト使用
npm run restore backend/backups/migration/pre_migration_20260101_090000.db
```

#### 手順3: サービス再起動
```bash
sudo systemctl start itsm-system
sudo systemctl start itsm-frontend
```

#### 手順4: 検証
```bash
curl http://localhost:5000/api/v1/health/ready
```

### 9.3 ロールバックスクリプト

```bash
#!/bin/bash
# backend/scripts/migrate/rollback.sh

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "Starting rollback..."
sudo systemctl stop itsm-system 2>/dev/null || true
cp "$BACKUP_FILE" backend/itsm_nexus.db
sudo systemctl start itsm-system
echo "Rollback completed!"
```

---

## 10. スケジュール

### 10.1 移行タイムライン

| フェーズ | タスク | 期間 | 担当 | 状態 |
|---------|-------|-----|------|-----|
| **準備** | データソース調査 | 3日 | システム管理者 | 未着手 |
| | スクリプト開発 | 5日 | 開発者 | 未着手 |
| | テスト環境構築 | 2日 | インフラ担当 | 未着手 |
| **フェーズ1** | ユーザー移行 | 1日 | 開発者 | 未着手 |
| | 資産移行 | 1日 | 開発者 | 未着手 |
| | インシデント移行 | 2日 | 開発者 | 未着手 |
| | 検証 | 1日 | QA | 未着手 |
| **フェーズ2** | 変更管理移行 | 1日 | 開発者 | 未着手 |
| | 問題管理移行 | 1日 | 開発者 | 未着手 |
| | 脆弱性移行 | 1日 | 開発者 | 未着手 |
| | 検証 | 1日 | QA | 未着手 |
| **フェーズ3** | その他データ移行 | 2日 | 開発者 | 未着手 |
| | 最終検証 | 2日 | QA | 未着手 |
| **本番移行** | 本番環境移行 | 1日 | 全員 | 未着手 |
| **合計** | | **24日** | | |

### 10.2 推奨移行タイミング

**平日夜間または週末**を推奨：
- 金曜日 19:00 - 日曜日 12:00（36時間ウィンドウ）
- 影響を受けるユーザーが最小限
- 問題発生時の対応時間確保

### 10.3 移行当日のタイムテーブル

```
【移行当日スケジュール例】

18:00 - 事前ミーティング（関係者全員）
19:00 - サービス停止告知
19:30 - システム停止
19:45 - データベースバックアップ
20:00 - 移行開始（フェーズ1）
21:00 - フェーズ1検証
22:00 - 移行継続（フェーズ2）
23:00 - フェーズ2検証
00:00 - 移行継続（フェーズ3）
01:00 - 最終検証
02:00 - システム起動
02:30 - 動作確認
03:00 - サービス再開
04:00 - 監視継続（翌朝まで）
```

---

## 11. 成功基準

移行が成功したと判断する基準：

- [ ] すべてのテーブルにデータが投入されている
- [ ] データ整合性チェックがすべてパスしている
- [ ] ダッシュボードが正常に表示される
- [ ] ユーザーがログインできる
- [ ] インシデント作成・更新が正常に動作する
- [ ] APIエンドポイントがすべて正常に応答する（200 OK）
- [ ] ロールバックが不要と判断される

---

## 12. 連絡先・エスカレーション

### 12.1 移行チーム

| 役割 | 担当者 | 連絡先 | 責任範囲 |
|-----|-------|-------|---------|
| プロジェクトマネージャー | [氏名] | [メール/電話] | 全体統括 |
| システム管理者 | [氏名] | [メール/電話] | インフラ・データソース |
| 開発者 | [氏名] | [メール/電話] | スクリプト開発・実行 |
| QAエンジニア | [氏名] | [メール/電話] | 検証・テスト |

### 12.2 エスカレーションフロー

```
問題発生
  ↓
開発者が対応（30分以内）
  ↓（解決しない場合）
システム管理者にエスカレーション
  ↓（解決しない場合）
プロジェクトマネージャーが判断
  ↓
ロールバック決定
```

---

## 13. 付録

### 13.1 用語集

| 用語 | 説明 |
|-----|------|
| ETL | Extract, Transform, Load（抽出・変換・投入） |
| CMDB | Configuration Management Database（構成管理データベース） |
| RFC | Request for Change（変更要求） |
| ITSM | IT Service Management（ITサービス管理） |
| Upsert | Update + Insert（存在すれば更新、なければ挿入） |

### 13.2 参考資料

- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/)
- [ServiceNow REST API](https://developer.servicenow.com/dev.do#!/reference/api/vancouver/rest/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [ITSM-Sec Nexus README](/mnt/LinuxHDD/ITSM-System/README.md)

### 13.3 変更履歴

| 版数 | 日付 | 変更内容 | 承認者 |
|-----|------|---------|-------|
| 1.0.0 | 2026-01-01 | 初版作成 | - |

---

## 承認欄

| 役割 | 氏名 | 署名 | 日付 |
|-----|------|------|------|
| プロジェクトマネージャー | | | |
| システム管理者 | | | |
| 開発責任者 | | | |
