# ITSM-Sec Nexus API ドキュメント - クイックリファレンス

## 🚀 即座にアクセス

サーバーを起動したら、以下のURLにアクセスしてください：

```bash
# サーバー起動
npm start
```

### 📚 ドキュメントサイト

| ドキュメント | URL | 説明 |
|------------|-----|------|
| **ランディングページ** | http://localhost:5000/api-docs | すべてのドキュメントへの入口 |
| **Swagger UI** | http://localhost:5000/api-docs/swagger | インタラクティブにAPIをテスト |
| **ReDoc** | http://localhost:5000/api-docs/redoc | 美しく読みやすいドキュメント |
| **サンプルコード** | http://localhost:5000/api-docs/examples | 4言語のコードサンプル |

### 📥 ダウンロード

| リソース | URL | 用途 |
|---------|-----|------|
| **OpenAPI JSON** | http://localhost:5000/api-docs/openapi.json | API仕様書（OpenAPI 3.0.3） |
| **Postman Collection** | http://localhost:5000/api-docs/postman-collection.json | Postmanで全APIをテスト（119リクエスト） |

## 🔑 認証の流れ

### 1. トークン取得

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

### 2. トークンを使ってAPI呼び出し

```bash
curl -X GET http://localhost:5000/api/v1/incidents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📦 Postman Collectionの使い方

### インポート方法

1. **Postmanを開く**
2. **Import** ボタンをクリック
3. **Link** タブを選択
4. URLを入力: `http://localhost:5000/api-docs/postman-collection.json`
5. **Continue** → **Import**

### トークン設定

1. コレクションの **Variables** タブを開く
2. `jwt_token` 変数に取得したトークンを設定
3. すべてのリクエストで自動的に認証ヘッダーが追加される

## 🛠️ コマンド一覧

```bash
# サーバー起動
npm start

# Postman Collection生成（ファイル出力）
npm run docs:postman

# 静的ドキュメント生成（GitHub Pages用）
./scripts/generate-static-docs.sh

# ドキュメントエンドポイントのテスト
./scripts/test-api-docs.sh
```

## 📊 API統計

- **総エンドポイント数:** 119
- **カテゴリ数:** 24
- **Postman Collectionサイズ:** 106KB
- **OpenAPI仕様サイズ:** 147KB

## 🎯 主要カテゴリ

| カテゴリ | エンドポイント数 | 説明 |
|---------|----------------|------|
| Authentication | 10 | ログイン、ユーザー登録、2FA |
| Incidents | 5 | インシデント管理 |
| Changes | 4 | 変更管理 |
| SLA | 5 | SLA管理 |
| Vulnerabilities | 7 | 脆弱性管理 |
| Security | 6 | 監査ログ、セキュリティ |
| Microsoft365 | 6 | SharePoint、Teams統合 |
| Notifications | 9 | 通知設定 |

## 🌐 外部公開（GitHub Pages）

### 1. 静的ドキュメント生成

```bash
./scripts/generate-static-docs.sh
```

### 2. GitHubにプッシュ

```bash
git add docs/static
git commit -m "Add static API documentation"
git push
```

### 3. GitHub Pages設定

- リポジトリ → Settings → Pages
- Source: Deploy from a branch
- Branch: main, Folder: /docs/static
- Save

### 4. アクセス

公開URL: `https://[username].github.io/[repository]/`

## 📖 詳細ドキュメント

- [完全ガイド](docs/API_DOCUMENTATION_GUIDE.md) - 詳細な使用方法
- [実装サマリー](docs/API_DOCUMENTATION_SUMMARY.md) - 実装内容の詳細
- [OpenAPI仕様](docs/openapi.yaml) - API仕様書（YAML）

## 💡 ヒント

### Swagger UIでのテスト

1. 右上の **Authorize** ボタンをクリック
2. トークンを入力（`Bearer` は不要）
3. **Authorize** をクリック
4. 各エンドポイントの **Try it out** でテスト

### ReDocでの印刷

1. ReDocページにアクセス
2. ブラウザの印刷機能（Ctrl+P / Cmd+P）
3. 「PDFに保存」を選択

### ローカルで静的ドキュメント確認

```bash
cd docs/static
python3 -m http.server 8000
open http://localhost:8000
```

## 🔒 セキュリティ

### 本番環境での注意

- **HTTPS使用:** 必ずHTTPSで公開
- **アクセス制限:** 必要に応じて認証を追加
- **環境変数:** `ENABLE_API_DOCS=false` で無効化可能

## 📞 サポート

- Email: dev@itsm.local
- ドキュメント: `docs/` ディレクトリ
- Issue Tracker: GitHubリポジトリ

---

**最終更新:** 2025-01-07
**バージョン:** 1.0.0
