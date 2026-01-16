# Docsフォルダ 再構成計画

## 🎯 目的

ドキュメントを目的別に整理し、必要な情報を素早く見つけられるようにする。

---

## 📁 新しいフォルダ構成

```
docs/
├── README.md                           # ドキュメントインデックス
│
├── 01-getting-started/                 # 🚀 はじめに
│   ├── QUICKSTART.md                  # クイックスタートガイド
│   ├── ENVIRONMENT_SETUP.md           # 環境セットアップ
│   └── HTTPS_QUICKSTART.md            # HTTPS設定
│
├── 02-development/                     # 💻 開発ガイド
│   ├── DEVELOPMENT_WORKFLOW.md        # 開発ワークフロー ⭐️
│   ├── BEST_PRACTICES.md              # ベストプラクティス ⭐️
│   ├── DATABASE_DESIGN.md             # DB設計
│   ├── ACCESSIBILITY.md               # アクセシビリティ
│   └── github-secrets-setup.md        # GitHub設定
│
├── 03-deployment/                      # 🚀 デプロイ
│   ├── DEPLOYMENT_CHECKLIST.md        # デプロイチェックリスト ⭐️
│   ├── SYSTEMD_SERVICE_SETUP.md       # Systemd管理
│   ├── HTTPS_SETUP.md                 # HTTPS詳細設定
│   └── DATA_MIGRATION_PLAN.md         # データ移行
│
├── 04-operations/                      # ⚙️ 運用
│   ├── OPERATIONS.md                  # 運用ガイド
│   ├── MONITORING.md                  # 監視・アラート
│   ├── BACKUP_STRATEGY.md             # バックアップ戦略
│   └── TROUBLESHOOTING.md             # トラブルシューティング
│
├── 05-api/                             # 🔌 API仕様
│   ├── openapi.yaml                   # OpenAPI仕様書
│   ├── postman-collection.json        # Postmanコレクション
│   ├── API_DOCUMENTATION_GUIDE.md     # APIドキュメントガイド
│   ├── API_DOCUMENTATION_SUMMARY.md   # API概要
│   └── API_EXAMPLES.md                # APIサンプルコード
│
├── 06-integrations/                    # 🔗 外部統合
│   ├── EMAIL_NOTIFICATION_SETUP.md    # メール通知
│   ├── M365_INTEGRATION.md            # Microsoft 365統合
│   └── WEBHOOK_SETUP.md               # Webhook設定
│
└── static/                             # 📊 静的リソース
    ├── images/
    ├── diagrams/
    └── README.md
```

---

## 🔄 移行スクリプト

既存のドキュメントを新しい構造に移動：

```bash
#!/bin/bash
# reorganize-docs.sh

cd docs

# サブディレクトリを作成
mkdir -p 01-getting-started 02-development 03-deployment 04-operations 05-api 06-integrations

# はじめにガイド
mv ENVIRONMENT_SETUP.md 01-getting-started/ 2>/dev/null
mv HTTPS_QUICKSTART.md 01-getting-started/ 2>/dev/null

# 開発ガイド
mv DEVELOPMENT_WORKFLOW.md 02-development/ 2>/dev/null
mv BEST_PRACTICES.md 02-development/ 2>/dev/null
mv DATABASE_DESIGN.md 02-development/ 2>/dev/null
mv ACCESSIBILITY.md 02-development/ 2>/dev/null
mv github-secrets-setup.md 02-development/ 2>/dev/null

# デプロイ
mv DEPLOYMENT_CHECKLIST.md 03-deployment/ 2>/dev/null
mv SYSTEMD_SERVICE_SETUP.md 03-deployment/ 2>/dev/null
mv HTTPS_SETUP.md 03-deployment/ 2>/dev/null
mv HTTPS_DESIGN.md 03-deployment/ 2>/dev/null
mv HTTPS_IMPLEMENTATION_SUMMARY.md 03-deployment/ 2>/dev/null
mv DATA_MIGRATION_PLAN.md 03-deployment/ 2>/dev/null
mv MIGRATION_TOOLS_IMPLEMENTATION.md 03-deployment/ 2>/dev/null

# 運用
mv OPERATIONS.md 04-operations/ 2>/dev/null

# API
mv openapi.yaml 05-api/ 2>/dev/null
mv postman-collection.json 05-api/ 2>/dev/null
mv API_DOCUMENTATION_GUIDE.md 05-api/ 2>/dev/null
mv API_DOCUMENTATION_SUMMARY.md 05-api/ 2>/dev/null

# 統合
mv EMAIL_NOTIFICATION_SETUP.md 06-integrations/ 2>/dev/null

echo "✅ ドキュメント再構成完了"
```

---

## 📝 各カテゴリの説明

### 01-getting-started（はじめに）

**対象**: 新規開発者、システム管理者

初めてプロジェクトに触れる人向けの導入ガイド。環境セットアップからHTTPS設定まで。

### 02-development（開発）

**対象**: 開発者

日常的な開発作業で参照するドキュメント。ワークフロー、ベストプラクティス、DB設計など。

### 03-deployment（デプロイ）

**対象**: DevOps、システム管理者

デプロイプロセス、システム設定、マイグレーション手順など。

### 04-operations（運用）

**対象**: 運用担当者

日々の運用、監視、トラブルシューティング、バックアップなど。

### 05-api（API仕様）

**対象**: フロントエンド開発者、外部開発者

API仕様書、サンプルコード、Postmanコレクションなど。

### 06-integrations（外部統合）

**対象**: システム管理者、開発者

メール通知、Microsoft 365、Webhookなどの外部サービス統合。

---

## 🎯 推奨される読み方

### 新規開発者

```
1. README.md（このドキュメント）
   ↓
2. 01-getting-started/ENVIRONMENT_SETUP.md
   ↓
3. 02-development/DEVELOPMENT_WORKFLOW.md
   ↓
4. 02-development/BEST_PRACTICES.md
   ↓
5. 02-development/DATABASE_DESIGN.md
   ↓
6. 05-api/API_DOCUMENTATION_SUMMARY.md
```

### システム管理者

```
1. README.md
   ↓
2. 03-deployment/SYSTEMD_SERVICE_SETUP.md
   ↓
3. 04-operations/OPERATIONS.md
   ↓
4. 03-deployment/DEPLOYMENT_CHECKLIST.md
```

---

## ✅ 実装推奨事項

### 今すぐ実施

1. **README.mdの配置** - docsフォルダのトップに配置済み
2. **DEVELOPMENT_WORKFLOW.md** - 作成済み ✅
3. **BEST_PRACTICES.md** - 作成済み ✅
4. **DEPLOYMENT_CHECKLIST.md** - 作成済み ✅

### 今後実施（オプション）

1. サブディレクトリへの移動（`reorganize-docs.sh`を実行）
2. 各カテゴリのREADME追加
3. 図表の追加（アーキテクチャ図など）

---

**ITSM-Sec Nexus Documentation Team**
