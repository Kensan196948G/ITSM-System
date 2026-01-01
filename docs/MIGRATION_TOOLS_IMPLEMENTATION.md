# データ移行ツール実装計画書

**プロジェクト**: ITSM-Sec Nexus
**バージョン**: 1.0.0
**作成日**: 2026-01-01

---

## 目次

1. [概要](#1-概要)
2. [ディレクトリ構造](#2-ディレクトリ構造)
3. [実装ツール一覧](#3-実装ツール一覧)
4. [共通モジュール](#4-共通モジュール)
5. [実装優先順位](#5-実装優先順位)
6. [開発ガイドライン](#6-開発ガイドライン)
7. [テスト要件](#7-テスト要件)

---

## 1. 概要

このドキュメントは、データ移行計画書（DATA_MIGRATION_PLAN.md）に基づき、実装が必要なツール・スクリプトの詳細仕様を定義します。

### 1.1 開発原則

- **モジュール化**: 再利用可能なコンポーネントとして設計
- **エラーハンドリング**: すべての外部接続でリトライ・タイムアウト実装
- **ロギング**: 詳細なログ出力（winston使用）
- **検証**: データ投入前後の検証を必須化
- **べき等性**: 同じスクリプトを複数回実行しても安全

---

## 2. ディレクトリ構造

```
backend/
├── scripts/
│   └── migrate/
│       ├── README.md                    # 移行ツール使用方法
│       ├── config/
│       │   ├── migration.config.js      # 移行設定
│       │   └── mappings/
│       │       ├── users.json
│       │       ├── incidents.json
│       │       ├── assets.json
│       │       └── ...
│       ├── extractors/
│       │   ├── base-extractor.js        # 抽出基底クラス
│       │   ├── m365-user-extractor.js   # Microsoft 365ユーザー抽出
│       │   ├── intune-device-extractor.js
│       │   ├── servicenow-extractor.js
│       │   ├── csv-extractor.js
│       │   └── ...
│       ├── transformers/
│       │   ├── base-transformer.js      # 変換基底クラス
│       │   ├── date-transformer.js
│       │   ├── status-mapper.js
│       │   ├── html-cleaner.js
│       │   ├── encoding-converter.js
│       │   └── ...
│       ├── loaders/
│       │   ├── base-loader.js           # 投入基底クラス
│       │   ├── user-loader.js
│       │   ├── incident-loader.js
│       │   ├── asset-loader.js
│       │   └── ...
│       ├── validators/
│       │   ├── schema-validator.js
│       │   ├── integrity-validator.js
│       │   ├── duplicate-checker.js
│       │   └── foreign-key-validator.js
│       ├── utils/
│       │   ├── logger.js                # ロギング
│       │   ├── db-helper.js             # DB操作ヘルパー
│       │   ├── retry.js                 # リトライロジック
│       │   └── file-helper.js
│       ├── cli/
│       │   ├── extract.js               # 抽出CLIコマンド
│       │   ├── transform.js             # 変換CLIコマンド
│       │   ├── load.js                  # 投入CLIコマンド
│       │   ├── validate.js              # 検証CLIコマンド
│       │   └── rollback.js              # ロールバックCLIコマンド
│       └── workflows/
│           ├── full-migration.js        # 完全移行ワークフロー
│           ├── phased-migration.js      # 段階的移行ワークフロー
│           └── test-migration.js        # テスト移行
└── data/
    └── migrate/
        ├── extracted/                   # 抽出データ保存
        ├── transformed/                 # 変換データ保存
        ├── logs/                        # 移行ログ
        └── reports/                     # 移行レポート
```

---

## 3. 実装ツール一覧

### 3.1 データ抽出ツール（Extractors）

#### 3.1.1 Microsoft 365ユーザー抽出（m365-user-extractor.js）

**ファイル**: `backend/scripts/migrate/extractors/m365-user-extractor.js`

**機能**:
- Microsoft Graph APIからユーザー一覧を取得
- OAuth2 Client Credentials Flowで認証
- ページネーション対応（デフォルト999件/ページ）

**依存パッケージ**:
```json
{
  "@microsoft/microsoft-graph-client": "^3.0.7",
  "isomorphic-fetch": "^3.0.0"
}
```

**環境変数**:
```bash
M365_TENANT_ID=your-tenant-id
M365_CLIENT_ID=your-client-id
M365_CLIENT_SECRET=your-client-secret
```

**使用方法**:
```bash
node backend/scripts/migrate/cli/extract.js \
  --source=m365-users \
  --output=data/migrate/extracted/users.json
```

**実装スケルトン**:
```javascript
// backend/scripts/migrate/extractors/m365-user-extractor.js
const { Client } = require('@microsoft/microsoft-graph-client');
const BaseExtractor = require('./base-extractor');

class M365UserExtractor extends BaseExtractor {
  constructor(config) {
    super(config);
    this.client = null;
  }

  async authenticate() {
    // OAuth2 Client Credentials Flow
    const authProvider = {
      getAccessToken: async () => {
        // トークン取得ロジック
      }
    };
    this.client = Client.initWithMiddleware({ authProvider });
  }

  async extract() {
    this.logger.info('Starting M365 user extraction...');
    await this.authenticate();

    let users = [];
    let nextLink = '/users?$top=999';

    while (nextLink) {
      const response = await this.client.api(nextLink).get();
      users = users.concat(response.value);
      nextLink = response['@odata.nextLink'];
      this.logger.info(`Extracted ${users.length} users so far...`);
    }

    this.logger.info(`Total users extracted: ${users.length}`);
    return users;
  }
}

module.exports = M365UserExtractor;
```

#### 3.1.2 ServiceNowインシデント抽出（servicenow-extractor.js）

**ファイル**: `backend/scripts/migrate/extractors/servicenow-extractor.js`

**機能**:
- ServiceNow REST APIからインシデント取得
- 基本認証またはOAuth対応
- フィルタリング（直近6ヶ月のみなど）

**環境変数**:
```bash
SERVICENOW_INSTANCE=your-instance
SERVICENOW_USER=admin
SERVICENOW_PASSWORD=your-password
# または
SERVICENOW_OAUTH_TOKEN=your-token
```

**使用方法**:
```bash
node backend/scripts/migrate/cli/extract.js \
  --source=servicenow-incidents \
  --filter="sys_created_on>=2025-07-01" \
  --output=data/migrate/extracted/incidents.json
```

#### 3.1.3 CSV/Excel抽出（csv-extractor.js）

**ファイル**: `backend/scripts/migrate/extractors/csv-extractor.js`

**機能**:
- CSV/Excelファイルを読み込み、JSON形式に変換
- 文字コード自動判定（UTF-8, Shift_JIS）
- ヘッダー行の自動検出

**依存パッケージ**:
```json
{
  "xlsx": "^0.18.5",       // 既にインストール済み
  "csv-parser": "^3.0.0",
  "iconv-lite": "^0.6.3",
  "chardet": "^1.6.0"
}
```

**使用方法**:
```bash
# CSVファイル
node backend/scripts/migrate/cli/extract.js \
  --source=csv \
  --file=assets.csv \
  --output=data/migrate/extracted/assets.json

# Excelファイル
node backend/scripts/migrate/cli/extract.js \
  --source=excel \
  --file=assets.xlsx \
  --sheet="資産一覧" \
  --output=data/migrate/extracted/assets.json
```

**実装スケルトン**:
```javascript
// backend/scripts/migrate/extractors/csv-extractor.js
const xlsx = require('xlsx');
const iconv = require('iconv-lite');
const chardet = require('chardet');
const fs = require('fs');
const BaseExtractor = require('./base-extractor');

class CSVExtractor extends BaseExtractor {
  async extract(filePath, options = {}) {
    this.logger.info(`Extracting from: ${filePath}`);

    // 文字コード検出
    const buffer = fs.readFileSync(filePath);
    const encoding = chardet.detect(buffer);
    this.logger.info(`Detected encoding: ${encoding}`);

    // ExcelまたはCSVとして読み込み
    const workbook = xlsx.readFile(filePath, { encoding });
    const sheetName = options.sheet || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    this.logger.info(`Extracted ${data.length} records from ${sheetName}`);
    return data;
  }
}

module.exports = CSVExtractor;
```

#### 3.1.4 その他の抽出ツール

| ファイル名 | データソース | 優先度 |
|----------|------------|-------|
| intune-device-extractor.js | Microsoft Intune（デバイス） | P0 |
| tenable-vulnerability-extractor.js | Tenable.io（脆弱性） | P1 |
| qualys-vulnerability-extractor.js | Qualys（脆弱性） | P1 |
| sharepoint-knowledge-extractor.js | SharePoint（ナレッジ） | P2 |
| prometheus-metrics-extractor.js | Prometheus（メトリクス） | P2 |

---

### 3.2 データ変換ツール（Transformers）

#### 3.2.1 汎用データ変換（transform-data.js）

**ファイル**: `backend/scripts/migrate/cli/transform.js`

**機能**:
- マッピング定義ファイルに基づいてデータ変換
- 複数の変換関数を適用
- エラー時の詳細ログ

**使用方法**:
```bash
node backend/scripts/migrate/cli/transform.js \
  --input=data/migrate/extracted/users.json \
  --mapping=backend/scripts/migrate/config/mappings/users.json \
  --output=data/migrate/transformed/users.json
```

**マッピング定義例**（users.json）:
```json
{
  "sourceType": "microsoft365",
  "targetTable": "users",
  "mappings": [
    {
      "source": "userPrincipalName",
      "target": "username",
      "transform": "lowercase",
      "required": true
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
      "target": "is_active",
      "transform": "boolean"
    }
  ],
  "defaults": {
    "role": "viewer",
    "password_hash": "$2a$10$defaultHashForInitialPassword"
  },
  "computed": [
    {
      "target": "created_at",
      "value": "{{NOW}}"
    }
  ]
}
```

#### 3.2.2 日付変換（date-transformer.js）

**ファイル**: `backend/scripts/migrate/transformers/date-transformer.js`

**機能**:
- 各種日付フォーマットをISO 8601に変換
- タイムゾーン処理

**対応フォーマット**:
- ISO 8601: `2025-12-31T23:59:59Z`
- ServiceNow: `2025-12-31 23:59:59`
- Excel: シリアル値（44927）
- UNIX timestamp: `1735689599`

#### 3.2.3 ステータスマッピング（status-mapper.js）

**ファイル**: `backend/scripts/migrate/transformers/status-mapper.js`

**機能**:
- 外部システムのステータスを内部ステータスに変換

**マッピング例**（ServiceNow → ITSM-Sec Nexus）:
```json
{
  "incidents": {
    "1": "Identified",
    "2": "Analyzing",
    "3": "In-Progress",
    "6": "Resolved",
    "7": "Closed"
  },
  "priorities": {
    "1": "Critical",
    "2": "High",
    "3": "Medium",
    "4": "Low",
    "5": "Low"
  }
}
```

#### 3.2.4 HTMLクリーナー（html-cleaner.js）

**ファイル**: `backend/scripts/migrate/transformers/html-cleaner.js`

**機能**:
- HTMLタグを除去してプレーンテキストに変換
- XSS対策としても機能

**依存パッケージ**:
```json
{
  "sanitize-html": "^2.11.0"
}
```

---

### 3.3 データ投入ツール（Loaders）

#### 3.3.1 汎用データ投入（load-data.js）

**ファイル**: `backend/scripts/migrate/cli/load.js`

**機能**:
- 変換済みJSONデータをデータベースに投入
- モード選択: `insert` / `upsert` / `replace`
- トランザクション処理
- バッチ投入（1000件単位）

**使用方法**:
```bash
# 新規挿入モード
node backend/scripts/migrate/cli/load.js \
  --entity=users \
  --file=data/migrate/transformed/users.json \
  --mode=insert

# Upsertモード（存在すれば更新、なければ挿入）
node backend/scripts/migrate/cli/load.js \
  --entity=incidents \
  --file=data/migrate/transformed/incidents.json \
  --mode=upsert \
  --key=ticket_id

# Dryrunモード（実際には投入しない）
node backend/scripts/migrate/cli/load.js \
  --entity=assets \
  --file=data/migrate/transformed/assets.json \
  --mode=upsert \
  --dry-run
```

**実装スケルトン**:
```javascript
// backend/scripts/migrate/cli/load.js
const BaseLoader = require('../loaders/base-loader');
const { db } = require('../../../db');

class DataLoader {
  constructor(entity, mode = 'insert') {
    this.entity = entity;
    this.mode = mode;
    this.batchSize = 1000;
  }

  async load(data) {
    const total = data.length;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    console.log(`Starting load: ${total} records`);

    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);

      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          batch.forEach((record) => {
            const sql = this.buildSQL(record);
            db.run(sql, (err) => {
              if (err) {
                console.error(`Error loading record:`, err);
                failed++;
              } else {
                succeeded++;
              }
            });
          });

          db.run('COMMIT', (err) => {
            if (err) {
              db.run('ROLLBACK');
              reject(err);
            } else {
              processed += batch.length;
              console.log(`Progress: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
              resolve();
            }
          });
        });
      });
    }

    return { total, succeeded, failed };
  }

  buildSQL(record) {
    // モードに応じたSQL生成
    if (this.mode === 'upsert') {
      return this.buildUpsertSQL(record);
    } else if (this.mode === 'replace') {
      return this.buildReplaceSQL(record);
    } else {
      return this.buildInsertSQL(record);
    }
  }
}
```

#### 3.3.2 エンティティ別ローダー

各エンティティに特化したローダーを実装：

| ファイル名 | エンティティ | 特殊処理 |
|----------|------------|---------|
| user-loader.js | users | パスワードハッシュ生成 |
| incident-loader.js | incidents | ticket_id自動生成対応 |
| asset-loader.js | assets | 重複チェック強化 |
| vulnerability-loader.js | vulnerabilities | CVSS計算 |

---

### 3.4 検証ツール（Validators）

#### 3.4.1 スキーマ検証（schema-validator.js）

**ファイル**: `backend/scripts/migrate/validators/schema-validator.js`

**機能**:
- JSONスキーマを使用したデータ検証
- 必須フィールドチェック
- データ型チェック
- 値の範囲チェック

**依存パッケージ**:
```json
{
  "ajv": "^8.12.0"
}
```

**使用方法**:
```bash
node backend/scripts/migrate/cli/validate.js \
  --type=schema \
  --entity=users \
  --file=data/migrate/transformed/users.json
```

#### 3.4.2 整合性検証（integrity-validator.js）

**ファイル**: `backend/scripts/migrate/validators/integrity-validator.js`

**機能**:
- レコード数の一致確認
- 外部キー参照の検証
- 一意制約の検証
- ビジネスルール検証

**検証項目例**:
```javascript
const validationRules = {
  incidents: [
    {
      rule: 'foreign_key',
      field: 'asset_tag',
      references: 'assets.asset_tag',
      nullable: true
    },
    {
      rule: 'enum',
      field: 'status',
      values: ['Identified', 'Analyzing', 'In-Progress', 'Resolved', 'Closed']
    },
    {
      rule: 'date_order',
      field: 'created_at',
      beforeField: 'resolved_at',
      nullable: true
    }
  ]
};
```

#### 3.4.3 重複チェック（duplicate-checker.js）

**ファイル**: `backend/scripts/migrate/validators/duplicate-checker.js`

**機能**:
- 一意キーの重複検出
- 類似レコードの検出（ファジーマッチング）

---

### 3.5 ユーティリティ

#### 3.5.1 ロガー（logger.js）

**ファイル**: `backend/scripts/migrate/utils/logger.js`

**機能**:
- 構造化ロギング
- ログレベル: DEBUG, INFO, WARN, ERROR
- ファイル出力（data/migrate/logs/）

**依存パッケージ**:
```json
{
  "winston": "^3.11.0"
}
```

**実装例**:
```javascript
// backend/scripts/migrate/utils/logger.js
const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../../data/migrate/logs/error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../../data/migrate/logs/combined.log')
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = logger;
```

#### 3.5.2 リトライロジック（retry.js）

**ファイル**: `backend/scripts/migrate/utils/retry.js`

**機能**:
- 失敗時の自動リトライ
- エクスポネンシャルバックオフ
- 最大試行回数の設定

**実装例**:
```javascript
// backend/scripts/migrate/utils/retry.js
async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    onRetry = null
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        if (onRetry) {
          onRetry(attempt, waitTime, error);
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

module.exports = { retry };
```

---

### 3.6 ワークフロー

#### 3.6.1 完全移行ワークフロー（full-migration.js）

**ファイル**: `backend/scripts/migrate/workflows/full-migration.js`

**機能**:
- すべてのフェーズを順次実行
- エラー時の自動ロールバック
- 進捗レポート生成

**使用方法**:
```bash
node backend/scripts/migrate/workflows/full-migration.js \
  --config=backend/scripts/migrate/config/migration.config.js \
  --dry-run
```

**ワークフローステップ**:
1. 事前バックアップ
2. データ抽出（全ソース）
3. データ変換（全エンティティ）
4. データ投入（優先度順）
5. 検証
6. レポート生成

#### 3.6.2 段階的移行ワークフロー（phased-migration.js）

**ファイル**: `backend/scripts/migrate/workflows/phased-migration.js`

**機能**:
- フェーズごとの移行実行
- フェーズ間の検証

**使用方法**:
```bash
# フェーズ1のみ実行
node backend/scripts/migrate/workflows/phased-migration.js --phase=1

# フェーズ2から実行
node backend/scripts/migrate/workflows/phased-migration.js --phase=2 --resume
```

---

## 4. 共通モジュール

### 4.1 基底クラス

#### BaseExtractor（base-extractor.js）

```javascript
// backend/scripts/migrate/extractors/base-extractor.js
const logger = require('../utils/logger');
const { retry } = require('../utils/retry');

class BaseExtractor {
  constructor(config = {}) {
    this.config = config;
    this.logger = logger;
  }

  async extract() {
    throw new Error('extract() must be implemented by subclass');
  }

  async save(data, outputPath) {
    const fs = require('fs');
    const path = require('path');

    // ディレクトリ作成
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // JSON保存
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    this.logger.info(`Data saved to: ${outputPath}`);
  }
}

module.exports = BaseExtractor;
```

#### BaseTransformer（base-transformer.js）

```javascript
// backend/scripts/migrate/transformers/base-transformer.js
class BaseTransformer {
  constructor(mapping) {
    this.mapping = mapping;
  }

  transform(data) {
    return data.map((record) => this.transformRecord(record));
  }

  transformRecord(record) {
    const transformed = {};

    // マッピング定義に基づいて変換
    this.mapping.mappings.forEach((map) => {
      const sourceValue = record[map.source];
      let value = sourceValue;

      // 変換関数適用
      if (map.transform) {
        value = this.applyTransform(value, map.transform);
      }

      // 必須チェック
      if (map.required && (value === null || value === undefined)) {
        throw new Error(`Required field missing: ${map.target}`);
      }

      transformed[map.target] = value;
    });

    // デフォルト値適用
    Object.entries(this.mapping.defaults || {}).forEach(([key, value]) => {
      if (transformed[key] === undefined) {
        transformed[key] = value;
      }
    });

    return transformed;
  }

  applyTransform(value, transform) {
    switch (transform) {
      case 'lowercase':
        return value?.toLowerCase();
      case 'uppercase':
        return value?.toUpperCase();
      case 'boolean':
        return Boolean(value);
      case 'trim':
        return value?.trim();
      default:
        return value;
    }
  }
}

module.exports = BaseTransformer;
```

#### BaseLoader（base-loader.js）

```javascript
// backend/scripts/migrate/loaders/base-loader.js
class BaseLoader {
  constructor(entity, db) {
    this.entity = entity;
    this.db = db;
  }

  async load(data, mode = 'insert') {
    // 実装は3.3.1参照
  }

  buildInsertSQL(record) {
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.entity} (${columns.join(', ')}) VALUES (${placeholders})`;
    return { sql, values: Object.values(record) };
  }

  buildUpsertSQL(record, key) {
    // SQLite UPSERT構文
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const updates = columns.filter(c => c !== key).map(c => `${c}=excluded.${c}`).join(', ');
    const sql = `INSERT INTO ${this.entity} (${columns.join(', ')}) VALUES (${placeholders})
                 ON CONFLICT(${key}) DO UPDATE SET ${updates}`;
    return { sql, values: Object.values(record) };
  }
}

module.exports = BaseLoader;
```

---

## 5. 実装優先順位

### フェーズ1: 基盤実装（1週間）

**優先度: P0（最優先）**

- [ ] ディレクトリ構造作成
- [ ] 共通モジュール実装
  - [ ] logger.js
  - [ ] retry.js
  - [ ] db-helper.js
  - [ ] base-extractor.js
  - [ ] base-transformer.js
  - [ ] base-loader.js
- [ ] 設定ファイル実装
  - [ ] migration.config.js

### フェーズ2: CSV移行実装（3日）

**優先度: P0**

- [ ] csv-extractor.js
- [ ] transform.js（汎用変換CLI）
- [ ] load.js（汎用投入CLI）
- [ ] マッピング定義ファイル（users.json, incidents.json, assets.json）
- [ ] schema-validator.js

### フェーズ3: Microsoft 365連携（5日）

**優先度: P1**

- [ ] m365-user-extractor.js
- [ ] intune-device-extractor.js
- [ ] OAuth2認証ヘルパー
- [ ] Graph API接続テスト

### フェーズ4: 既存ITSM連携（5日）

**優先度: P1**

- [ ] servicenow-extractor.js
- [ ] date-transformer.js
- [ ] status-mapper.js
- [ ] html-cleaner.js

### フェーズ5: 検証・ワークフロー（3日）

**優先度: P1**

- [ ] integrity-validator.js
- [ ] duplicate-checker.js
- [ ] validate.js（検証CLI）
- [ ] full-migration.js（完全移行ワークフロー）
- [ ] rollback.js（ロールバックCLI）

### フェーズ6: 追加機能（5日）

**優先度: P2**

- [ ] phased-migration.js（段階的移行）
- [ ] test-migration.js（テスト移行）
- [ ] generate-migration-report.js（レポート生成）
- [ ] その他の抽出ツール（Tenable, Qualys, SharePoint等）

**合計開発期間**: 約24日（3〜4週間）

---

## 6. 開発ガイドライン

### 6.1 コーディング規約

- **言語**: Node.js（CommonJS）
- **スタイル**: ESLint + Prettier（既存設定に準拠）
- **命名規則**:
  - クラス: PascalCase（例: `M365UserExtractor`）
  - 関数: camelCase（例: `extractUsers`）
  - ファイル: kebab-case（例: `m365-user-extractor.js`）

### 6.2 エラーハンドリング

すべての外部接続（API、ファイルI/O）でエラーハンドリングを実装：

```javascript
try {
  const result = await retry(async () => {
    return await externalAPI.call();
  }, {
    maxAttempts: 3,
    delay: 1000,
    onRetry: (attempt, waitTime, error) => {
      logger.warn(`Retry attempt ${attempt}, waiting ${waitTime}ms`, { error });
    }
  });
} catch (error) {
  logger.error('Failed after retries', { error });
  throw error;
}
```

### 6.3 ロギング

すべてのスクリプトで構造化ロギングを使用：

```javascript
const logger = require('./utils/logger');

logger.info('Starting extraction', { source: 'm365', count: users.length });
logger.error('Extraction failed', { error: err.message, stack: err.stack });
```

### 6.4 テスト

各モジュールにユニットテストを実装：

```javascript
// backend/scripts/migrate/__tests__/csv-extractor.test.js
const CSVExtractor = require('../extractors/csv-extractor');

describe('CSVExtractor', () => {
  it('should extract data from CSV file', async () => {
    const extractor = new CSVExtractor();
    const data = await extractor.extract('test/fixtures/sample.csv');
    expect(data).toHaveLength(10);
    expect(data[0]).toHaveProperty('username');
  });
});
```

---

## 7. テスト要件

### 7.1 ユニットテスト

各モジュールの単体テスト：

```bash
npm run test -- backend/scripts/migrate/__tests__/
```

**カバレッジ目標**: 80%以上

### 7.2 統合テスト

エンドツーエンドの移行テスト：

```bash
# テストデータを使用した移行
node backend/scripts/migrate/workflows/test-migration.js \
  --test-data=backend/scripts/migrate/__tests__/fixtures/
```

### 7.3 接続テスト

外部システムへの接続確認：

```bash
# Microsoft 365接続テスト
node backend/scripts/migrate/cli/test-connection.js --source=m365

# ServiceNow接続テスト
node backend/scripts/migrate/cli/test-connection.js --source=servicenow
```

---

## 8. 必要なnpmパッケージ

以下のパッケージをインストール：

```bash
npm install --save \
  @microsoft/microsoft-graph-client \
  isomorphic-fetch \
  csv-parser \
  iconv-lite \
  chardet \
  sanitize-html \
  winston \
  ajv

# 開発依存
npm install --save-dev \
  @types/node
```

---

## 9. 実装チェックリスト

### 9.1 開発前チェック

- [ ] 環境変数テンプレート（.env.migration.example）を作成
- [ ] ディレクトリ構造を作成
- [ ] package.jsonに新しい依存関係を追加
- [ ] README.mdに移行ツールの説明を追加

### 9.2 開発中チェック

- [ ] ESLint/Prettierエラーがゼロであること
- [ ] すべての関数にJSDocコメントを追加
- [ ] エラーハンドリングが適切であること
- [ ] ロギングが適切であること

### 9.3 開発後チェック

- [ ] ユニットテストが成功すること
- [ ] テストデータでのドライランが成功すること
- [ ] ドキュメントが更新されていること
- [ ] コードレビューが完了していること

---

## 10. 成果物

実装完了時の成果物：

1. **実装済みスクリプト**: 上記すべてのツール
2. **設定ファイル**: マッピング定義、接続設定
3. **テストコード**: ユニットテスト、統合テスト
4. **ドキュメント**: README.md、APIドキュメント
5. **サンプルデータ**: テスト用フィクスチャ
6. **移行手順書**: ステップバイステップガイド

---

## 承認欄

| 役割 | 氏名 | 署名 | 日付 |
|-----|------|------|------|
| 開発責任者 | | | |
| システム管理者 | | | |
