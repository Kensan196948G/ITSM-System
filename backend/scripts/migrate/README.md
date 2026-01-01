# データ移行ツール

本番環境へのデータ移行ツール群です。

## ドキュメント

詳細は以下のドキュメントを参照してください：

- **[データ移行計画書](/mnt/LinuxHDD/ITSM-System/docs/DATA_MIGRATION_PLAN.md)**: 移行戦略、手順、リスク管理
- **[移行ツール実装計画書](/mnt/LinuxHDD/ITSM-System/docs/MIGRATION_TOOLS_IMPLEMENTATION.md)**: 実装すべきツールの詳細仕様

## ディレクトリ構造

```
backend/scripts/migrate/
├── README.md                    # このファイル
├── config/
│   ├── migration.config.js      # 移行設定
│   └── mappings/                # データマッピング定義
│       ├── users.json
│       ├── incidents.json
│       └── ...
├── extractors/                  # データ抽出ツール
│   ├── base-extractor.js
│   ├── m365-user-extractor.js
│   ├── csv-extractor.js
│   └── ...
├── transformers/                # データ変換ツール
│   ├── base-transformer.js
│   ├── date-transformer.js
│   └── ...
├── loaders/                     # データ投入ツール
│   ├── base-loader.js
│   ├── user-loader.js
│   └── ...
├── validators/                  # データ検証ツール
│   ├── schema-validator.js
│   └── ...
├── utils/                       # ユーティリティ
│   ├── logger.js
│   ├── retry.js
│   └── ...
├── cli/                         # CLIコマンド
│   ├── extract.js
│   ├── transform.js
│   ├── load.js
│   └── validate.js
└── workflows/                   # 移行ワークフロー
    ├── full-migration.js
    └── phased-migration.js
```

## クイックスタート

### 1. 環境変数の設定

```bash
cp .env.example .env.migration
vi .env.migration  # 必要な認証情報を入力
```

### 2. CSV/Excelからの移行（最も簡単）

```bash
# データ抽出
node backend/scripts/migrate/cli/extract.js \
  --source=csv \
  --file=assets.csv \
  --output=data/migrate/extracted/assets.json

# データ変換
node backend/scripts/migrate/cli/transform.js \
  --input=data/migrate/extracted/assets.json \
  --mapping=backend/scripts/migrate/config/mappings/assets.json \
  --output=data/migrate/transformed/assets.json

# データ投入
node backend/scripts/migrate/cli/load.js \
  --entity=assets \
  --file=data/migrate/transformed/assets.json \
  --mode=upsert \
  --key=asset_tag
```

### 3. Microsoft 365からの移行

```bash
# ユーザー抽出
node backend/scripts/migrate/cli/extract.js \
  --source=m365-users \
  --output=data/migrate/extracted/users.json

# 変換・投入（上記と同様）
```

### 4. 完全移行ワークフロー

```bash
# ドライラン（実際には投入しない）
node backend/scripts/migrate/workflows/full-migration.js --dry-run

# 本番実行
node backend/scripts/migrate/workflows/full-migration.js
```

## 実装状況

現在、このディレクトリは空です。以下のステップで実装を進めてください：

1. **フェーズ1**: 共通モジュール（logger, retry, base-extractor等）
2. **フェーズ2**: CSV移行ツール
3. **フェーズ3**: Microsoft 365連携
4. **フェーズ4**: 既存ITSM連携
5. **フェーズ5**: 検証・ワークフロー

詳細は[移行ツール実装計画書](/mnt/LinuxHDD/ITSM-System/docs/MIGRATION_TOOLS_IMPLEMENTATION.md)を参照してください。

## 必要なパッケージのインストール

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
```

## トラブルシューティング

### Microsoft 365認証エラー

```bash
# 接続テスト
node backend/scripts/migrate/cli/test-connection.js --source=m365
```

### データ投入エラー

```bash
# スキーマ検証
node backend/scripts/migrate/cli/validate.js \
  --type=schema \
  --entity=users \
  --file=data/migrate/transformed/users.json
```

### ロールバック

```bash
# 移行前のバックアップから復元
npm run restore backend/backups/migration/pre_migration_YYYYMMDD_HHMMSS.db
```

## サポート

問題が発生した場合は、以下を確認してください：

1. データ移行計画書のリスク管理セクション
2. 移行ツール実装計画書のトラブルシューティングセクション
3. システムログ（data/migrate/logs/）
