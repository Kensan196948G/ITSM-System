# 🔗 共通ドキュメント (Shared Documentation)

開発・本番環境で共通して使用するAPI仕様、設計書、参照情報のドキュメント集です。

---

## 📂 ファイル一覧

### API仕様
| ファイル | 説明 |
|---------|------|
| [openapi.yaml](openapi.yaml) | OpenAPI 3.0.3仕様書 |
| [postman-collection.json](postman-collection.json) | Postmanコレクション（119リクエスト） |
| [API_DOCS_QUICK_REFERENCE.md](API_DOCS_QUICK_REFERENCE.md) | API即座アクセスガイド |
| [API_DOCUMENTATION_GUIDE.md](API_DOCUMENTATION_GUIDE.md) | APIドキュメント作成ガイド |
| [API_DOCUMENTATION_SUMMARY.md](API_DOCUMENTATION_SUMMARY.md) | API実装完了サマリー |

### 参照情報
| ファイル | 説明 |
|---------|------|
| [ACCESS_INFO.md](ACCESS_INFO.md) | アクセス情報（IP/URL） |
| [DOCS_REORGANIZATION.md](DOCS_REORGANIZATION.md) | ドキュメント再構成計画 |
| [GITHUB_ISSUES_P0_TO_P2.md](GITHUB_ISSUES_P0_TO_P2.md) | GitHub Issues登録テンプレート |

### サブフォルダ
| フォルダ | 説明 |
|---------|------|
| [static/](static/) | 静的APIドキュメント（Swagger UI, ReDoc） |
| [api/](api/) | API関連追加ドキュメント |

## 🌐 APIドキュメントアクセス

| ツール | URL |
|--------|-----|
| Swagger UI | http://localhost:5000/api-docs |
| ReDoc | http://localhost:5000/api-docs/redoc |
| OpenAPI JSON | http://localhost:5000/api-docs/openapi.json |

## 🔗 関連ドキュメント

- [開発環境ドキュメント](../docs-dev/README.md)
- [本番環境ドキュメント](../docs-prod/README.md)

---

## 🗂️ 旧ディレクトリ構造（参照用）

```
docs-shared/  (このフォルダ: 共通ドキュメント)
docs-dev/     (開発環境ドキュメント)
docs-prod/    (本番環境ドキュメント)
```

---

## 🎯 目的別ドキュメント

### 🚀 初めてのセットアップ

1. **[ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)** - 環境別セットアップガイド
2. **[SYSTEMD_SERVICE_SETUP.md](SYSTEMD_SERVICE_SETUP.md)** - Systemdサービス管理
3. **[HTTPS_QUICKSTART.md](HTTPS_QUICKSTART.md)** - HTTPS設定

### 💻 日常的な開発作業

1. **[DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)** ⭐️ - 開発ワークフロー
2. **[DATABASE_DESIGN.md](DATABASE_DESIGN.md)** - データベース構造
3. **[API_DOCUMENTATION_GUIDE.md](API_DOCUMENTATION_GUIDE.md)** - API仕様

### 🔧 運用・メンテナンス

1. **[OPERATIONS.md](OPERATIONS.md)** - 運用ガイド
2. **[DATA_MIGRATION_PLAN.md](DATA_MIGRATION_PLAN.md)** - データ移行
3. **[EMAIL_NOTIFICATION_SETUP.md](EMAIL_NOTIFICATION_SETUP.md)** - 通知設定

### 🌐 API開発

1. **[openapi.yaml](openapi.yaml)** - OpenAPI仕様書
2. **[postman-collection.json](postman-collection.json)** - Postmanコレクション
3. **[API_DOCUMENTATION_SUMMARY.md](API_DOCUMENTATION_SUMMARY.md)** - API概要

---

## 📖 必読ドキュメント

### 🌟 最重要（開発者必読）

| No | ドキュメント | 対象 | 内容 |
|----|------------|------|------|
| 1 | **DEVELOPMENT_WORKFLOW.md** | 全員 | 環境分離の運用方法 |
| 2 | **ENVIRONMENT_SETUP.md** | 新規開発者 | 環境セットアップ |
| 3 | **DATABASE_DESIGN.md** | バックエンド開発者 | DB構造 |
| 4 | **API_DOCUMENTATION_SUMMARY.md** | フロントエンド開発者 | API仕様 |

---

## 🎓 学習パス

### 新規開発者向け

```
1. ENVIRONMENT_SETUP.md
   ↓
2. DEVELOPMENT_WORKFLOW.md
   ↓
3. DATABASE_DESIGN.md
   ↓
4. API_DOCUMENTATION_SUMMARY.md
   ↓
5. 開発開始！
```

### システム管理者向け

```
1. SYSTEMD_SERVICE_SETUP.md
   ↓
2. OPERATIONS.md
   ↓
3. DATA_MIGRATION_PLAN.md
   ↓
4. 運用開始！
```

---

## 🔍 ドキュメント検索

### よくある質問

| 質問 | ドキュメント |
|------|------------|
| 開発環境と本番環境をどう使い分ける？ | `DEVELOPMENT_WORKFLOW.md` |
| サービスの起動方法は？ | `ENVIRONMENT_SETUP.md` |
| DBのテーブル構造は？ | `DATABASE_DESIGN.md` |
| APIエンドポイント一覧は？ | `openapi.yaml` |
| HTTPSの設定方法は？ | `HTTPS_SETUP.md` |
| バックアップ方法は？ | `OPERATIONS.md` |

---

## ✏️ ドキュメントの更新

新しい機能を追加した際は、関連ドキュメントも更新してください：

```bash
# 新しいAPIエンドポイントを追加した場合
nano docs/openapi.yaml
nano docs/API_DOCUMENTATION_SUMMARY.md

# 新しいデータベーステーブルを追加した場合
nano docs/DATABASE_DESIGN.md

# 新しい運用手順を追加した場合
nano docs/OPERATIONS.md
```

---

## 🌐 アクセス情報

### 環境別URL

| 環境 | URL | ブラウザタブ |
|------|-----|------------|
| **開発環境** | `https://192.168.0.187:5443` | `[開発] ITSM-Sec Nexus` |
| **本番環境** | `https://192.168.0.187:6443` | `[本番] ITSM-Sec Nexus` |

---

## 📝 ドキュメント作成ガイドライン

### 新しいドキュメントを作成する場合

1. **適切なサブディレクトリに配置**
   - 開発関連 → `development/`
   - デプロイ関連 → `deployment/`
   - 運用関連 → `operations/`
   - API関連 → `api/`

2. **ファイル名規則**
   - 大文字のスネークケース: `FEATURE_NAME.md`
   - 簡潔で説明的な名前

3. **必須セクション**
   - 目次
   - 概要
   - 詳細説明
   - 例
   - トラブルシューティング

---

**最終更新**: 2026-01-16
**バージョン**: v2.1.0
