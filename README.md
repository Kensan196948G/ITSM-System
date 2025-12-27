# ITSM-Sec Nexus: 次世代運用・セキュリティ統合管理システム

ISO 20000 (ITSM) と NIST CSF 2.0 (Security) を高度に統合した、プロフェッショナルなITサービスマネジメントシステムです。

## 概要

本システムは、従来のITSM機能に加え、最新のサイバーセキュリティフレームワークであるNIST CSF 2.0の理念を取り込み、攻めと守りの運用を一つのプラットフォームで実現します。

## 主な機能

### 1. ITSM (ISO 20000-1:2018 準拠)
- サービスレベル管理 (SLM/SLA)
- インシデント管理
- 問題管理
- 構成管理 (CMDB)
- 変更・リリース管理

### 2. セキュリティ (NIST CSF 2.0 準拠)
- GOVERN (統治)
- IDENTIFY (識別)
- PROTECT (保護)
- DETECT (検知)
- RESPOND (対応)
- RECOVER (復旧)

## ドキュメント

詳細は `Docs/` フォルダ内の各ドキュメントを参照してください。

## 開発ステータス

- [x] プロジェクト初期化
- [x] 要件定義（Docs 01）
- [x] システム設計（Docs 02）
- [x] 開発計画策定（Docs 03）
- [x] プロトタイプ実装（Docs 04）
- [x] バックエンド/データベース構築 (SQLite + Express)
- [x] **JWT認証・RBAC実装（2025-12-27完了）**
- [x] **入力バリデーション実装（2025-12-27完了）**
- [x] **XSS対策完了（2025-12-27完了）**
- [x] **セキュリティヘッダー実装（2025-12-27完了）**
- [x] 承認ワークフローの実装（基本機能完了）
- [ ] 脆弱性管理の完全統合
- [ ] 統合テスト

## セキュリティ機能

### 認証・認可
- **JWT認証**: JSON Web Tokenによる安全な認証
- **RBAC**: 4つのロール（admin, manager, analyst, viewer）
- **パスワードハッシング**: bcrypt（10ラウンド）
- **トークン有効期限**: 24時間（環境変数で設定可能）

### 入力検証
- **express-validator**: 全APIエンドポイントで厳格なバリデーション
- **SQLインジェクション対策**: パラメータ化クエリ
- **XSS対策**: DOM API使用（innerHTML完全排除）

### セキュリティヘッダー
- **helmet**: Express.jsセキュリティヘッダー
- **CORS**: ホワイトリスト方式（環境変数で設定）

## セットアップ手順

### 1. 依存関係のインストール
```bash
npm install
```

### 2. 環境変数の設定
```bash
cp .env.example .env
# .envファイルを編集してJWT_SECRETなどを設定
```

### 3. データベース初期化
データベースは初回起動時に自動的に作成されます。

### 4. サーバー起動

**ターミナル1: バックエンドAPI起動**
```bash
npm start
# または
node backend/server.js
```

**ターミナル2: フロントエンドHTTPサーバー起動**
```bash
# Python 3使用（全ネットワークインターフェースでリスン）
python3 -m http.server 5050 --bind 0.0.0.0

# または Node.js http-server使用
npx http-server -p 5050 -a 0.0.0.0
```

### 5. フロントエンドアクセス

ブラウザで以下のURLにアクセス:
```
# ネットワークアクセス（他のデバイスから）
http://192.168.0.187:5050/index.html

# ローカルアクセス
http://localhost:5050/index.html
```

⚠️ **重要**: file://プロトコルで直接index.htmlを開くとCORSエラーが発生します。必ずHTTPサーバー経由でアクセスしてください。

## デフォルトユーザー

| ユーザー名 | パスワード | ロール | 権限 |
|-----------|----------|--------|------|
| admin | admin123 | admin | 全権限 |
| analyst | analyst123 | analyst | 閲覧・インシデント作成・RFC作成 |

⚠️ **本番環境では必ずパスワードを変更してください**

## API エンドポイント

### 認証
- `POST /api/v1/auth/login` - ログイン
- `POST /api/v1/auth/register` - ユーザー登録
- `GET /api/v1/auth/me` - 現在のユーザー情報

### ダッシュボード
- `GET /api/v1/dashboard/kpi` - KPI統計（要認証）

### インシデント管理
- `GET /api/v1/incidents` - 一覧取得（要認証）
- `GET /api/v1/incidents/:id` - 詳細取得（要認証）
- `POST /api/v1/incidents` - 新規作成（要認証、analyst以上）
- `PUT /api/v1/incidents/:id` - 更新（要認証、analyst以上）

### 変更管理
- `GET /api/v1/changes` - 一覧取得（要認証）
- `POST /api/v1/changes` - RFC作成（要認証、analyst以上）
- `PUT /api/v1/changes/:id` - RFC更新・承認（要認証、manager以上）

### 構成管理
- `GET /api/v1/assets` - 資産一覧（要認証）

### ヘルスチェック
- `GET /api/v1/health` - サーバー状態確認（認証不要）
