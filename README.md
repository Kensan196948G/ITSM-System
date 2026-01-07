# ITSM-Sec Nexus: 次世代運用・セキュリティ統合管理システム

[![CI Pipeline](https://github.com/USER/ITSM-System/workflows/CI%20Pipeline/badge.svg)](https://github.com/USER/ITSM-System/actions/workflows/ci.yml)
[![CD Pipeline](https://github.com/USER/ITSM-System/workflows/CD%20Pipeline/badge.svg)](https://github.com/USER/ITSM-System/actions/workflows/cd.yml)
[![Security Scan](https://github.com/USER/ITSM-System/workflows/Security%20Scan/badge.svg)](https://github.com/USER/ITSM-System/actions/workflows/security.yml)
[![codecov](https://codecov.io/gh/USER/ITSM-System/branch/main/graph/badge.svg)](https://codecov.io/gh/USER/ITSM-System)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

ISO 20000 (ITSM) と NIST CSF 2.0 (Security) を高度に統合した、プロフェッショナルなITサービスマネジメントシステムです。

## 概要

本システムは、従来のITSM機能に加え、最新のサイバーセキュリティフレームワークであるNIST CSF 2.0の理念を取り込み、攻めと守りの運用を一つのプラットフォームで実現します。

## 主な機能

### 1. ITSM (ISO 20000-1:2018 準拠)
- **サービスレベル管理 (SLM/SLA)**: 違反アラート、レポート生成、定期レポート配信
- **インシデント管理**: チケット管理、優先度設定、SLA追跡
- **問題管理**: 根本原因分析、再発防止策管理
- **構成管理 (CMDB)**: 資産管理、依存関係追跡
- **変更・リリース管理**: RFC承認ワークフロー、リスク評価

### 2. セキュリティ (NIST CSF 2.0 準拠)
- **GOVERN (統治)**: 方針・責任・意思決定の枠組み
- **IDENTIFY (識別)**: 資産/リスク/脅威の可視化
- **PROTECT (保護)**: 予防的コントロールの実装、2FA認証
- **DETECT (検知)**: 異常兆候の早期検知、セキュリティイベント監視
- **RESPOND (対応)**: 影響最小化と封じ込め
- **RECOVER (復旧)**: 事業継続と復旧計画
- **脆弱性管理**: CVSS計算、影響資産管理、NIST CSFマッピング
- **セキュリティダッシュボード**: リアルタイムアラート、監査ログ、ユーザーアクティビティ

### 3. コンプライアンス / GRC
- **監査ダッシュボード**: カバレッジ/スケジュール/指摘事項/証跡収集
- **監査ログ**: 操作証跡の検索・追跡、エクスポート機能
- **ポリシー・プロシージャー管理**: ルールと手順の維持・レビュー
- **コンプライアンス管理**: エビデンス/監査/指摘/レポート

### 4. ダッシュボード & レポート
- **統合ダッシュボード**: KPI可視化、リアルタイムウィジェット
- **PDFレポート生成**: インシデント、SLA、セキュリティレポート
- **Excelエクスポート**: データ分析用エクスポート機能
- **スケジュールレポート**: 日次/週次/月次の自動配信

### 5. 通知 & 統合
- **通知システム**: メール/Slack/Webhook通知
- **Microsoft 365統合**: Graph API経由のユーザー同期
- **ServiceNow統合**: インシデント双方向同期
- **Webhook**: カスタム統合対応

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
- [x] 脆弱性管理の完全統合
- [x] 統合テスト（Jest: 15 suites / 279 tests 合格）
- [x] Lint警告の解消（no-shadow 20件）
- [x] テストカバレッジ30%達成（現在: lines 47.08%）
- [x] **アクセシビリティ改善（WCAG 2.1 Level AA準拠）**

## アクセシビリティ機能

ITSM-Sec Nexusは、すべてのユーザーが利用できるよう、WCAG 2.1 Level AA準拠のアクセシビリティ機能を実装しています。

### セマンティックHTML
- **ランドマークロール**: `<header>`, `<nav>`, `<main>`, `<aside>`による明確な構造
- **見出し階層**: 論理的なh1〜h6の使用
- **ARIA属性**: スクリーンリーダー対応（aria-label, aria-live, aria-expanded等）

### キーボードナビゲーション
- **完全キーボード操作**: マウス不要で全機能にアクセス可能
- **フォーカス管理**: 視覚的なフォーカスインジケーター（青色アウトライン）
- **モーダルフォーカストラップ**: Escキーで閉じる、Tab循環
- **スキップリンク**: 繰り返しナビゲーションのスキップ

### カラーコントラスト
- **WCAG AA準拠**: 4.5:1以上のコントラスト比
- **色覚対応**: 色だけに依存しない情報伝達（アイコン併用）

### スクリーンリーダー対応
- **ライブリージョン**: 動的コンテンツ変更の通知（aria-live）
- **代替テキスト**: すべての画像とアイコンに意味のある説明
- **視覚的に隠す要素**: `.visually-hidden`クラスによる補足情報

### テスト
- **自動テスト**: axe-core 4.8.2による継続的なアクセシビリティチェック
- **テストツール**: `/frontend/accessibility-test.html`でWCAG準拠を検証

詳細は [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) を参照してください。

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

## パフォーマンス最適化

### キャッシュ戦略
- **インメモリキャッシュ**: node-cacheによる高速キャッシング
- **TTL最適化**: エンドポイント別の適切なTTL設定
  - ダッシュボードチャート: 30秒（リアルタイム性重視）
  - ウィジェットデータ: 60秒
  - SLA統計: 120秒
- **ユーザーロール別キャッシュ**: 権限に応じた効率的なキャッシング
- **自動インバリデーション**: データ更新時の関連キャッシュ自動削除
- **メモリ管理**: 上限設定とLRU的自動エビクション（デフォルト100MB）

### 監視・メトリクス
- **Prometheus統合**: キャッシュヒット率、メモリ使用量などのメトリクス
- **レスポンスタイムロギング**: パフォーマンス分析用ログ
- **統計ダッシュボード**: リアルタイムキャッシュ統計表示

詳細は [Docs/cache-optimization.md](Docs/cache-optimization.md) を参照してください。

## モニタリング & 可視化

ITSM NexusはPrometheus形式のメトリクスを `/api/metrics` エンドポイントで公開し、Grafanaによる包括的な可視化をサポートしています。

### 監視対象メトリクス

#### システムメトリクス
- HTTPリクエスト数・レスポンスタイム（P50/P95/P99）
- CPU・メモリ使用率
- アクティブユーザー数
- エラー率（4xx/5xx）

#### ビジネスメトリクス
- インシデント数（優先度別・ステータス別）
- SLA達成率・違反数
- セキュリティインシデント統計

#### パフォーマンスメトリクス
- キャッシュヒット率・メモリ使用量
- データベースクエリ数（操作別・テーブル別）
- 認証エラー数

### Grafanaダッシュボード

事前に設計された包括的なダッシュボードが提供されています：

- **システム概要**: リクエスト数、レスポンスタイム、CPU/メモリ
- **インシデント管理**: 優先度別分布、オープンインシデント推移
- **SLAメトリクス**: 達成率グラフ、サービス別バー表示
- **キャッシュパフォーマンス**: ヒット率、エビクション率、エンドポイント別統計
- **データベース**: クエリ数推移、テーブル別負荷
- **セキュリティ**: 認証エラー、HTTPステータスコード分布

### セットアップ

詳細なインストールガイドは以下を参照してください：

- **[モニタリングセットアップガイド](Docs/monitoring-setup.md)**: Prometheus/Grafana詳細手順
- **[ダッシュボードガイド](monitoring/DASHBOARD-GUIDE.md)**: パネル構成と使用方法
- **[モニタリングREADME](monitoring/README.md)**: クイックスタートガイド

#### クイックスタート

```bash
# Prometheusのインストール
sudo ./monitoring/install-prometheus.sh

# Grafanaのインストール
sudo ./monitoring/install-grafana.sh

# ブラウザでアクセス
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
```

ダッシュボードファイル: `monitoring/grafana/dashboards/itsm-system-dashboard.json`

## CI/CD パイプライン

このプロジェクトは GitHub Actions を使用した自動化された CI/CD パイプラインを実装しています。

### CI (継続的インテグレーション)

- **複数バージョンテスト**: Node.js 18.x, 20.x でのマトリックステスト
- **コード品質チェック**: ESLint, Prettier によるコード品質保証
- **テストスイート**: 単体テスト、統合テスト、E2E テスト (Playwright)
- **カバレッジ測定**: Codecov によるコードカバレッジトラッキング
- **自動実行**: プッシュ・プルリクエスト時に自動実行

### CD (継続的デリバリー)

- **自動バージョニング**: セマンティックバージョニングによる自動バージョン管理
- **リリース自動化**: main ブランチマージ時に自動リリース作成
- **リリースノート生成**: 変更履歴の自動生成とドキュメント化
- **タグ管理**: Git タグの自動作成と管理

### セキュリティスキャン

- **依存関係スキャン**: npm audit による脆弱性検出
- **CodeQL 分析**: GitHub CodeQL によるコードセキュリティ分析
- **Secret スキャン**: 機密情報の誤コミット検出
- **定期実行**: 毎週月曜日の自動セキュリティスキャン

詳細は [CI/CD ガイド](Docs/CI_CD_GUIDE.md) を参照してください。

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

#### 主要な環境変数

| 変数名 | 説明 | デフォルト | 必須 |
|--------|------|-----------|------|
| `NODE_ENV` | 実行環境 (development/production) | development | ✓ |
| `PORT` | バックエンドポート | 5000 | ✓ |
| `HTTPS_PORT` | HTTPSポート | 5443 | - |
| `JWT_SECRET` | JWT署名キー（ランダム文字列） | - | ✓ |
| `JWT_EXPIRES_IN` | トークン有効期限 | 24h | ✓ |
| `DATABASE_PATH` | SQLiteデータベースパス | ./backend/itsm_nexus.db | ✓ |
| `ALLOWED_ORIGINS` | CORS許可オリジン（カンマ区切り） | http://localhost:5050 | ✓ |
| `DISABLE_SEED_DATA` | シードデータ無効化（本番環境推奨） | false | - |
| `M365_TENANT_ID` | Microsoft 365 テナントID | - | - |
| `M365_CLIENT_ID` | Microsoft 365 クライアントID | - | - |
| `M365_CLIENT_SECRET` | Microsoft 365 クライアントシークレット | - | - |
| `SERVICENOW_INSTANCE` | ServiceNowインスタンスURL | - | - |
| `SERVICENOW_USERNAME` | ServiceNowユーザー名 | - | - |
| `SERVICENOW_PASSWORD` | ServiceNowパスワード | - | - |
| `SMTP_HOST` | SMTPサーバーホスト | - | - |
| `SMTP_PORT` | SMTPポート | 587 | - |
| `SMTP_USER` | SMTP認証ユーザー | - | - |
| `SMTP_PASSWORD` | SMTP認証パスワード | - | - |
| `SLACK_WEBHOOK_URL` | Slack Webhook URL | - | - |

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
- `POST /api/v1/auth/register` - ユーザー登録（admin権限必要）
- `GET /api/v1/auth/me` - 現在のユーザー情報
- `POST /api/v1/auth/2fa/setup` - 2FA設定開始
- `POST /api/v1/auth/2fa/verify` - 2FA検証
- `POST /api/v1/auth/password-reset/request` - パスワードリセット要求
- `POST /api/v1/auth/password-reset/verify` - パスワードリセット実行

### ダッシュボード
- `GET /api/v1/dashboard/kpi` - KPI統計
- `GET /api/v1/dashboard/widgets` - ダッシュボードウィジェット一覧
- `GET /api/v1/dashboard/charts/:type` - チャートデータ取得

### インシデント管理
- `GET /api/v1/incidents` - 一覧取得（ページネーション対応）
- `GET /api/v1/incidents/:id` - 詳細取得
- `POST /api/v1/incidents` - 新規作成（analyst以上）
- `PUT /api/v1/incidents/:id` - 更新（analyst以上）
- `DELETE /api/v1/incidents/:id` - 削除（manager以上）

### 変更管理
- `GET /api/v1/changes` - RFC一覧取得
- `POST /api/v1/changes` - RFC作成（analyst以上）
- `PUT /api/v1/changes/:id` - RFC更新（analyst以上）
- `PUT /api/v1/changes/:id/approve` - RFC承認（manager以上）

### 構成管理
- `GET /api/v1/assets` - 資産一覧
- `POST /api/v1/assets` - 資産登録（analyst以上）
- `PUT /api/v1/assets/:id` - 資産更新（analyst以上）

### SLA管理
- `GET /api/v1/sla/targets` - SLAターゲット一覧
- `POST /api/v1/sla/targets` - SLAターゲット作成（manager以上）
- `GET /api/v1/sla/alerts` - SLA違反アラート一覧
- `POST /api/v1/sla/reports/generate` - SLAレポート生成

### セキュリティ
- `GET /api/v1/security/events` - セキュリティイベント一覧
- `GET /api/v1/security/dashboard` - セキュリティダッシュボード
- `GET /api/v1/vulnerabilities` - 脆弱性一覧
- `POST /api/v1/vulnerabilities` - 脆弱性登録（analyst以上）
- `PUT /api/v1/vulnerabilities/:id` - 脆弱性更新（analyst以上）

### 監査ログ
- `GET /api/v1/audit-logs` - 監査ログ検索
- `GET /api/v1/audit-logs/export` - 監査ログエクスポート

### レポート
- `POST /api/v1/reports/generate` - レポート生成（PDF/Excel）
- `GET /api/v1/reports/:id` - レポート取得
- `GET /api/v1/reports/scheduled` - スケジュールレポート一覧
- `POST /api/v1/reports/scheduled` - スケジュールレポート作成（manager以上）

### 通知
- `GET /api/v1/notifications` - 通知一覧
- `POST /api/v1/notifications` - 通知送信
- `PUT /api/v1/notifications/:id/read` - 既読マーク
- `GET /api/v1/notifications/settings` - 通知設定取得
- `PUT /api/v1/notifications/settings` - 通知設定更新

### 統合
- `GET /api/v1/integrations` - 統合設定一覧
- `POST /api/v1/integrations/m365/sync` - Microsoft 365 同期実行
- `POST /api/v1/integrations/servicenow/sync` - ServiceNow 同期実行
- `POST /api/v1/webhooks` - Webhook設定

### エクスポート
- `GET /api/v1/export/:resource` - データエクスポート（CSV/Excel/JSON）

### ヘルスチェック
- `GET /api/v1/health` - サーバー状態確認
- `GET /api/v1/health/live` - Liveness Probe
- `GET /api/v1/health/ready` - Readiness Probe
- `GET /metrics` - Prometheusメトリクス

詳細なAPI仕様は [Swagger UI](http://localhost:5000/api-docs) を参照してください。

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

## 国際化対応 (i18n)

本システムは多言語対応しています：
- **日本語 (ja)** - デフォルト
- **English (en)** - 英語
- **简体中文 (zh-CN)** - 中国語簡体字

インターフェース右上の言語セレクターから言語を切り替えることができます。ブラウザの言語設定が自動検出されます。

English version of README: [README.en.md](README.en.md)

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
- 📖 [CI/CD ガイド](Docs/CI_CD_GUIDE.md)
- 📖 [データ移行計画書](Docs/DATA_MIGRATION_PLAN.md)
- 📖 [移行ツール実装計画書](Docs/MIGRATION_TOOLS_IMPLEMENTATION.md)
