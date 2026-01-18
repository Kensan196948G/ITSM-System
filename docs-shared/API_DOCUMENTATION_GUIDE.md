# ITSM-Sec Nexus API ドキュメントガイド

## 概要

ITSM-Sec Nexus APIの完全なドキュメントサイトが利用可能です。このガイドでは、各ドキュメントツールの使い方と特徴を説明します。

## アクセス方法

サーバーを起動後、以下のURLにアクセスしてください：

```bash
# サーバー起動
npm start

# または開発モード
npm run dev
```

ドキュメントサイト: `http://localhost:5000/api-docs`

## ドキュメントの種類

### 1. ランディングページ

**URL:** `http://localhost:5000/api-docs`

APIドキュメントのポータルページです。以下の情報が含まれます：

- 各ドキュメントツールへのリンク
- クイックスタートガイド
- 主な機能の概要
- 認証方法の説明

### 2. Swagger UI（インタラクティブドキュメント）

**URL:** `http://localhost:5000/api-docs/swagger`

**特徴:**
- インタラクティブなAPI探索
- ブラウザから直接APIをテスト可能
- リクエスト/レスポンスのサンプル表示
- 認証トークンの永続化
- リクエスト時間の表示

**使い方:**
1. 右上の "Authorize" ボタンをクリック
2. `/api/v1/auth/login` でログインして取得したJWTトークンを入力
3. 各エンドポイントの "Try it out" ボタンでAPIを実行
4. レスポンスを確認

**カスタマイズ機能:**
- タイトル: ITSM-Sec Nexus API ドキュメント
- トークン認証: 自動保存
- シンタックスハイライト: Monokai テーマ
- フィルター機能: エンドポイント検索

### 3. ReDoc（美しいドキュメント）

**URL:** `http://localhost:5000/api-docs/redoc`

**特徴:**
- 読みやすいレイアウト
- 印刷に最適
- サイドバーナビゲーション
- レスポンシブデザイン
- 検索機能

**使い方:**
- 左サイドバーからエンドポイントを選択
- 右側でリクエスト/レスポンスの詳細を確認
- ブラウザの印刷機能でPDF保存可能

### 4. サンプルコード

**URL:** `http://localhost:5000/api-docs/examples`

**特徴:**
- 複数言語のサンプルコード
- タブ切り替えで言語変更
- シンタックスハイライト付き
- コピー＆ペースト可能

**対応言語:**
- cURL
- JavaScript (Fetch API)
- Python (requests)
- Java (HttpClient)

**サンプル内容:**
- 認証とトークン取得
- インシデント一覧取得
- 新しいインシデント作成

## ダウンロード可能なリソース

### OpenAPI仕様書（JSON）

**URL:** `http://localhost:5000/api-docs/openapi.json`

OpenAPI 3.0.3形式の完全な仕様書です。

**用途:**
- API クライアント生成（Swagger Codegen、OpenAPI Generator）
- 自動テスト生成
- API ゲートウェイ設定
- サードパーティツールとの統合

### Postman Collection

**URL:** `http://localhost:5000/api-docs/postman-collection.json`

**特徴:**
- すべてのAPIエンドポイントを含む
- タグごとにフォルダ分け
- サンプルリクエストボディ付き
- 環境変数設定済み（baseUrl、jwt_token）

**インポート方法:**

1. **Postmanでインポート:**
   ```
   Postman → Import → Link タブ
   http://localhost:5000/api-docs/postman-collection.json
   ```

2. **ファイルとして保存:**
   ```bash
   curl -o ITSM-API-Collection.json \
     http://localhost:5000/api-docs/postman-collection.json
   ```

3. **NPMスクリプトで生成:**
   ```bash
   npm run docs:postman
   # 出力: docs/postman-collection.json
   ```

**使用方法:**
1. Postmanにコレクションをインポート
2. コレクション変数 `jwt_token` を設定
   - `/api/v1/auth/login` でログイン
   - レスポンスから `token` をコピー
   - コレクション変数 `jwt_token` に貼り付け
3. 各エンドポイントを実行

## 認証方法

### 1. トークン取得

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

**レスポンス:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### 2. トークン使用

取得したトークンを `Authorization` ヘッダーに含めます：

```bash
curl -X GET http://localhost:5000/api/v1/incidents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## セキュリティ設定

### 本番環境での注意点

1. **アクセス制御:**
   - APIドキュメントへのアクセスを制限する場合は、`backend/server.js` の該当部分に認証ミドルウェアを追加

   ```javascript
   // 例: 管理者のみアクセス可能
   app.get('/api-docs', authenticateJWT, authorize(['admin']), (req, res) => {
     // ...
   });
   ```

2. **環境変数による制御:**
   - `.env` ファイルでドキュメント公開を制御

   ```env
   # ドキュメント公開フラグ
   ENABLE_API_DOCS=false
   ```

   `server.js`:
   ```javascript
   if (process.env.ENABLE_API_DOCS !== 'false') {
     // ドキュメントエンドポイントを設定
   }
   ```

3. **HTTPS使用:**
   - 本番環境では必ずHTTPSを使用してください
   - 詳細は `docs/HTTPS_SETUP.md` を参照

## カスタマイズ

### Swagger UIのカスタマイズ

`backend/server.js` の `swaggerUiOptions` を編集：

```javascript
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    // カスタムCSSを追加
  `,
  customSiteTitle: 'カスタムタイトル',
  swaggerOptions: {
    persistAuthorization: true,
    // その他のオプション
  }
};
```

### OpenAPI仕様の更新

`docs/openapi.yaml` を編集後、サーバーを再起動：

```bash
npm start
```

変更は即座に反映されます。

## トラブルシューティング

### ドキュメントが表示されない

1. サーバーが起動しているか確認
   ```bash
   curl http://localhost:5000/health
   ```

2. `docs/openapi.yaml` の構文エラーを確認
   ```bash
   # YAMLのバリデーション
   node -e "console.log(require('js-yaml').load(require('fs').readFileSync('docs/openapi.yaml', 'utf8')))"
   ```

3. サーバーログを確認
   ```bash
   # ログに "[Swagger] Loaded OpenAPI specification" が表示されるか確認
   ```

### Postman Collectionがインポートできない

1. JSON形式が正しいか確認
   ```bash
   curl http://localhost:5000/api-docs/postman-collection.json | jq .
   ```

2. ブラウザで直接ダウンロード
   - `http://localhost:5000/api-docs/postman-collection.json` にアクセス
   - 右クリック → "名前を付けて保存"

### API実行時に401エラー

1. トークンが正しいか確認
2. トークンの有効期限を確認（デフォルト: 24時間）
3. 再ログインして新しいトークンを取得

## 更新履歴

- **2025-01-07**: 初版作成
  - ランディングページ追加
  - Swagger UI カスタマイズ
  - ReDoc統合
  - サンプルコードページ追加
  - Postman Collection動的生成

## 関連ドキュメント

- [運用マニュアル](OPERATIONS.md)
- [データベース設計](DATABASE_DESIGN.md)
- [HTTPS設定](HTTPS_SETUP.md)
- [マイグレーションツール](MIGRATION_TOOLS_IMPLEMENTATION.md)

## サポート

質問や問題がある場合は、以下にお問い合わせください：

- Email: dev@itsm.local
- Issue Tracker: GitHub Issues（プロジェクトリポジトリ）
