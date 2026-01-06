# ITSM-Sec Nexus クイックスタートガイド（Windows版）

## 🚀 簡単起動手順

### 方法1: バッチファイルで起動（推奨）

プロジェクトルートで以下のバッチファイルをダブルクリックするだけ：

```
scripts\startup\start-dev.bat
```

**自動実行される処理:**
1. ✅ 環境チェック（Node.js、npm）
2. ✅ 依存関係チェック（node_modules）
3. ✅ 環境変数チェック（.env）
4. ✅ データベースマイグレーション実行
5. ✅ バックエンドAPI起動（ポート5000）
6. ✅ フロントエンドHTTPサーバー起動（ポート8080）
7. ✅ ブラウザ自動起動

### 方法2: 手動起動

**ターミナル1（バックエンド）:**
```bash
npm start
```

**ターミナル2（フロントエンド）:**
```bash
npx http-server -p 8080 -a 0.0.0.0 --cors
```

---

## 🌐 アクセスURL

### ローカルアクセス

- **フロントエンド**: http://localhost:8080/index.html
- **バックエンドAPI**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/v1/health
- **API Documentation**: http://localhost:5000/api-docs

### ネットワークアクセス（他のデバイスから）

- **フロントエンド**: http://172.23.10.109:8080/index.html
- **バックエンドAPI**: http://172.23.10.109:5000

> **注意**: IPアドレス（172.23.10.109）は環境によって異なります。
> 起動時のコンソール出力で確認してください。

---

## 👤 デフォルトユーザー

| ユーザー名 | パスワード | ロール | 権限 |
|-----------|----------|--------|------|
| admin | admin123 | admin | 全権限 |
| analyst | analyst123 | analyst | 閲覧・作成・更新 |

> ⚠️ **セキュリティ警告**: 本番環境では必ずデフォルトパスワードを変更してください

---

## 🛑 サーバー停止方法

### 方法1: バッチファイルで停止（推奨）

```
scripts\startup\stop-dev.bat
```

**自動実行される処理:**
1. ポート5000のプロセス停止（バックエンドAPI）
2. ポート8080のプロセス停止（フロントエンドHTTP）

### 方法2: 手動停止

各サーバーウィンドウで **Ctrl + C** を押す

---

## 📋 起動後の初期設定

### 1. システム設定確認

ログイン後、画面右上のユーザーメニュー → 「システム設定」で以下を確認：

- システム名
- 組織情報
- メール通知設定（オプション）

### 2. ユーザー管理

「設定」→「ユーザー・権限管理」で：

- デフォルトパスワード変更
- 新規ユーザー追加
- ロール・権限設定

### 3. Microsoft 365連携（オプション）

`.env`ファイルで以下を設定：

```env
M365_TENANT_ID=your-tenant-id
M365_CLIENT_ID=your-client-id
M365_CLIENT_SECRET=your-client-secret
```

---

## 🔧 トラブルシューティング

### 問題1: ポートが既に使用中

**エラー:** `EADDRINUSE: address already in use`

**解決策:**
```bash
# scripts\startup\stop-dev.bat を実行してから再起動
scripts\startup\stop-dev.bat
scripts\startup\start-dev.bat
```

### 問題2: データベースエラー

**エラー:** `SQLITE_ERROR: no such table`

**解決策:**
```bash
npm run migrate:latest
```

### 問題3: CORS エラー

**エラー:** `Access to fetch at ... has been blocked by CORS policy`

**解決策:**
`.env`ファイルの`CORS_ORIGIN`を確認：
```env
CORS_ORIGIN=http://localhost:8080,http://YOUR_IP:8080
```

### 問題4: API接続エラー

**エラー:** `Failed to fetch`

**確認事項:**
1. バックエンドサーバーが起動しているか確認
   ```bash
   curl http://localhost:5000/api/v1/health
   ```
2. app.jsのAPI_BASE設定が正しいか確認（行11-14）

---

## 📁 関連ファイル

| ファイル | 用途 |
|---------|------|
| `scripts\startup\start-dev.bat` | 開発環境起動スクリプト |
| `scripts\startup\stop-dev.bat` | サーバー停止スクリプト |
| `.env` | 環境変数設定 |
| `.env.example` | 環境変数テンプレート |

---

## 🔗 詳細ドキュメント

- 📖 [README.md](README.md) - プロジェクト概要
- 📖 [デプロイメントガイド](Docs/デプロイメントガイド.md) - 本番環境デプロイ
- 📖 [運用マニュアル](Docs/運用マニュアル.md) - 日常運用手順
- 📖 [開発者ガイド](Docs/開発者ガイド.md) - 開発環境構築

---

## 💡 Tips

### ポート番号変更

デフォルトポートを変更したい場合：

**バックエンド（.env）:**
```env
PORT=5000  # お好みのポート番号に変更
```

**フロントエンド（scripts\startup\start-dev.bat）:**
```batch
npx http-server -p 8080  # お好みのポート番号に変更
```

### ログレベル変更

`.env`ファイルで設定：
```env
LOG_LEVEL=debug  # debug, info, warn, error
```

### HTTPS化（本番環境）

詳細は [デプロイメントガイド](Docs/デプロイメントガイド.md) を参照

---

**最終更新**: 2026-01-05
**バージョン**: 1.0.0
