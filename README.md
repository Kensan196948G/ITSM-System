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
- GOVERN (統治) - 方針・責任・意思決定の枠組み
- IDENTIFY (識別) - 資産/リスク/脅威の可視化
- PROTECT (保護) - 予防的コントロールの実装
- DETECT (検知) - 異常兆候の早期検知
- RESPOND (対応) - 影響最小化と封じ込め
- RECOVER (復旧) - 事業継続と復旧計画
- 脆弱性管理（CVSS/影響資産/ステータス）
- セキュリティダッシュボード（アラート、監査ログ、アクティビティ）

### 3. コンプライアンス / GRC
- 監査ダッシュボード（カバレッジ/スケジュール/指摘事項/証跡収集）
- 監査ログ（操作証跡の検索・追跡）
- ポリシー・プロシージャー管理（ルールと手順の維持・レビュー）
- コンプライアンス管理（エビデンス/監査/指摘/レポート）

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
- [x] 監査ダッシュボード / コンプライアンス管理 UI整備
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

---

## 本番環境デプロイメント

### ネイティブNode.js環境でのデプロイ

#### 前提条件
- Node.js v20.x LTS
- npm v10.x以上
- 4GB以上のメモリ
- 50GB以上のディスク空き容量

#### クイックスタート

```bash
# 1. 環境変数の設定
./scripts/setup-env.sh

# 2. 依存関係のインストール
npm install

# 3. データベースマイグレーション
npm run migrate:latest

# 4. systemdサービスとしてインストール
sudo ./scripts/install-systemd.sh

# 5. サービス起動
sudo systemctl start itsm-system

# 6. デプロイ確認
curl http://localhost:5000/api/v1/health/ready
```

#### 利用可能なコマンド

```bash
# サービス管理
sudo systemctl start itsm-system     # サービス起動
sudo systemctl stop itsm-system      # サービス停止
sudo systemctl restart itsm-system   # サービス再起動
sudo systemctl status itsm-system    # ステータス確認

# データベースマイグレーション
npm run migrate:latest    # マイグレーション実行
npm run migrate:rollback  # ロールバック
npm run migrate:status    # 状態確認

# バックアップ・リストア
npm run backup            # 手動バックアップ
npm run restore <file>    # バックアップから復元
```

### 詳細なデプロイ手順

完全なデプロイメント手順、アップデート方法、ロールバック手順、トラブルシューティングについては、以下のドキュメントを参照してください：

📖 **[デプロイメントガイド](Docs/デプロイメントガイド.md)**

---

## 監視・メトリクス

### Prometheusメトリクス

メトリクスエンドポイント: `http://localhost:5000/metrics`

収集されるメトリクス：
- HTTPリクエスト数（method, route, status_code別）
- レスポンスタイム（ヒストグラム）
- アクティブユーザー数
- データベースクエリ数
- 認証エラー数
- システムリソース（CPU、メモリ、GC統計）

### ヘルスチェック

```bash
# 基本ヘルスチェック
curl http://localhost:5000/api/v1/health

# Liveness Probe（プロセス生存確認）
curl http://localhost:5000/api/v1/health/live

# Readiness Probe（トラフィック受入可能確認）
curl http://localhost:5000/api/v1/health/ready
```

---

## バックアップ・リストア

### 自動バックアップ

```bash
# 日次バックアップ（02:00）
# 週次バックアップ（日曜 03:00）
# 月次バックアップ（1日 04:00）

# cron設定
sudo cp cron.d/itsm-backup /etc/cron.d/
```

### 手動バックアップ

```bash
# バックアップ実行
./scripts/backup.sh

# バックアップから復元
./scripts/restore.sh /path/to/backup/itsm_nexus_YYYYMMDD_HHMMSS.db
```

バックアップは以下に保存されます：
- 日次: `backend/backups/daily/` (7日保持)
- 週次: `backend/backups/weekly/` (4週保持)
- 月次: `backend/backups/monthly/` (12ヶ月保持)

---

## セキュリティベストプラクティス

### 本番環境チェックリスト

- [ ] デフォルトパスワードを変更（admin/admin123など）
- [ ] `.env.production`にランダムなJWT_SECRETを設定
- [ ] Let's Encrypt証明書を使用（自己署名ではない）
- [ ] ファイアウォールで不要なポートを閉鎖
- [ ] 定期的なセキュリティアップデート
- [ ] バックアップの定期実行と検証
- [ ] 監視アラートの設定

### SSL/TLS設定

- TLS 1.2/1.3のみ許可
- モダンな暗号スイート使用
- HSTS有効（max-age=1年）
- OCSP Stapling有効

### Rate Limiting

- 一般API: 100リクエスト/15分/IP
- 認証API: 5リクエスト/15分/IP（ブルートフォース対策）

---

## ライセンス

ISC

## 貢献

Issue・Pull Requestを歓迎します！

## サポート

- 📖 [デプロイメントガイド](Docs/デプロイメントガイド.md)
- 📖 [開発者ガイド](Docs/開発者ガイド.md)
- 📖 [運用マニュアル](Docs/運用マニュアル.md)
- 📖 [テスト計画書](Docs/テスト計画書.md)
