# Changelog

このプロジェクトのすべての重要な変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

## [2.1.0] - 2026-01-11

### 追加機能 (Added)

#### セキュリティ強化
- HTTPS/TLS 1.2/1.3対応（自己署名証明書生成スクリプト付き）
- HSTS（HTTP Strict Transport Security）ヘッダー実装
- CSP（Content Security Policy）ヘッダー強化
- Rate Limiting強化（認証API: 5リクエスト/15分/IP）

#### 脅威検知サービス
- ブルートフォース攻撃検知（5分間に5回失敗でアラート）
- 異常アクセスパターン検知（異なるIPからの同時ログイン）
- 権限昇格攻撃検知
- 自動対応機能（アカウントロック、追加認証要求）

#### エンタープライズ機能
- マルチテナントサービス（テナント分離、ドメイン別ルーティング）
- エンタープライズRBAC（部門別アクセス制御、リソースオーナーシップ）

### 改善 (Changed)

#### パフォーマンス
- キャッシュキー生成の修正（`req.path` → `req.originalUrl`）
  - ルーターマウント時のキャッシュキー衝突を解消
  - 各エンドポイントが正しくキャッシュされるように改善

#### API
- ダッシュボードKPIレスポンス形式の統一
  - `active_incidents`, `sla_compliance`, `vulnerabilities.critical` 追加
  - `csf_progress`（NIST CSF進捗）データ追加
- セキュリティダッシュボードにチャートデータ追加
  - `login_timeline`: 24時間ログイン推移
  - `failed_logins_by_ip`: IP別ログイン失敗
  - `activity_distribution`: アクティビティ分布
- セキュリティアラートAPIレスポンス形式修正（`{alerts:[]}` → `{data:[]}`）
- キャパシティメトリクスAPIレスポンス形式修正（オブジェクト → 配列）
- 脆弱性一覧SQLカラム名修正（`discovered_date` → `detection_date`）

#### 開発環境
- ESLint設定の最適化
  - `class-methods-use-this`: off（クラスメソッドの柔軟性向上）
  - `no-restricted-syntax`: warn（for-of許可）
  - `no-await-in-loop`: warn（async/await柔軟性向上）
  - `max-classes-per-file`: off（サービスクラスの柔軟性向上）
- Prettierフォーマット自動適用

### 修正 (Fixed)

- キャッシュミドルウェアのキー生成バグ修正
  - ルーターマウント時に全エンドポイントが同一キー（`/`）になる問題を解決
- フロントエンドのデータ読み込みエラー修正
  - ダッシュボード、キャパシティ管理、セキュリティダッシュボード
- ESLintエラー41件を0件に削減
- 未使用変数の削除（threatDetectionService.js）
- 変数シャドウイング問題の修正

### セキュリティ (Security)

- 入力検証強化（`parseInt()`にradixパラメータ追加）
- インポート順序の標準化

## [2.0.0] - 2026-01-07

### 追加機能 (Added)

#### ダッシュボード & レポート
- 統合ダッシュボードのウィジェットシステム実装
- リアルタイムKPI可視化機能
- PDFレポート自動生成機能（インシデント、SLA、セキュリティ）
- Excelエクスポート機能（全リソース対応）
- スケジュールレポート機能（日次/週次/月次）
- カスタムダッシュボードウィジェット作成機能

#### 通知システム
- マルチチャネル通知システム（メール/Slack/Webhook）
- 通知優先度設定（High/Medium/Low）
- 通知テンプレート管理
- 通知設定のユーザーカスタマイズ
- 未読通知カウント機能

#### 統合機能
- Microsoft 365統合（Graph API経由のユーザー同期）
- ServiceNow統合（インシデント双方向同期）
- Webhook統合（カスタムイベント配信）
- Microsoft Graph API認証（Client Credentials Flow）
- Intune デバイス情報取得

#### E2Eテスト
- Playwright E2Eテスト追加（ダッシュボード、レポート、統合、通知）
- API E2Eテスト追加（Jest + Supertest）
- テストカバレッジ向上（47.08%達成）

#### OpenAPI仕様
- Swagger UI統合（/api-docsエンドポイント）
- 全APIエンドポイントのOpenAPI仕様書作成
- リクエスト/レスポンススキーマ定義

#### パフォーマンス最適化
- インメモリキャッシュシステム（node-cache）
- エンドポイント別TTL最適化
- ユーザーロール別キャッシュ戦略
- 自動キャッシュインバリデーション
- Prometheusメトリクス収集

### 改善 (Changed)
- ダッシュボードUIの大幅改善
- レスポンシブデザイン最適化
- エラーハンドリング強化
- ログ出力の改善
- API応答速度の向上（キャッシュ導入により30-50%高速化）

### 修正 (Fixed)
- キャッシュ関連のメモリリーク修正
- 通知送信時のエラーハンドリング改善
- M365統合のトークン更新処理修正

### セキュリティ (Security)
- 監査ログシステム強化
- 2FA認証機能実装
- パスワードリセット機能追加
- Rate Limiting強化
- CSRF対策追加

## [1.5.0] - 2026-01-03

### 追加機能 (Added)

#### SLA管理強化
- SLA違反アラート機能
- SLAレポート自動生成
- アラート履歴管理
- ダッシュボードウィジェット追加
- 定期レポート配信機能

#### 監査・コンプライアンス
- 監査ダッシュボード実装
- 監査ログ検索・エクスポート機能
- ポリシー・プロシージャー管理
- コンプライアンス管理機能
- GRC（ガバナンス・リスク・コンプライアンス）統合

#### セキュリティ強化
- CVSS計算機能（CVSS v3.1対応）
- 脆弱性管理システム強化
- NIST CSF 2.0マッピング機能
- セキュリティイベント監視強化

### 改善 (Changed)
- データベースパフォーマンス最適化（インデックス追加）
- API応答速度改善
- ユーザーアクティビティ追跡精度向上

## [1.0.0] - 2025-12-28

### 追加機能 (Added)

#### 基本機能
- インシデント管理（CRUD操作）
- 変更管理（RFC承認ワークフロー）
- 問題管理（根本原因分析）
- 構成管理（CMDB）
- SLA管理（基本機能）

#### 認証・認可
- JWT認証システム
- RBAC（4ロール: admin/manager/analyst/viewer）
- bcryptパスワードハッシング
- トークン有効期限管理

#### セキュリティ
- XSS対策（DOM API使用、innerHTML禁止）
- SQLインジェクション対策（パラメータ化クエリ）
- セキュリティヘッダー（helmet）
- CORS設定（ホワイトリスト方式）

#### データベース
- SQLite3データベース
- マイグレーションシステム（Knex.js）
- シードデータ自動投入
- バックアップ・リストア機能

#### テスト
- Jest統合テスト（15 suites / 279 tests）
- Supertest API テスト
- テストカバレッジレポート

#### 開発ツール
- ESLint（Airbnb Style Guide）
- Prettier コードフォーマット
- Husky Git フック
- lint-staged プレコミットチェック

### 技術スタック
- **バックエンド**: Node.js v20+, Express.js v5.2.1, SQLite3
- **フロントエンド**: Vanilla JavaScript, Chart.js, CSS3
- **認証**: JWT, bcryptjs
- **テスト**: Jest, Supertest, Playwright
- **開発**: ESLint, Prettier, Husky

## [0.1.0] - 2025-12-15

### 追加機能 (Added)
- プロジェクト初期化
- 基本的なプロジェクト構造設定
- 要件定義ドキュメント作成
- システム設計ドキュメント作成

---

## バージョン番号の意味

- **MAJOR** (X.0.0): 破壊的変更を含むメジャーアップデート
- **MINOR** (x.Y.0): 後方互換性のある新機能追加
- **PATCH** (x.y.Z): 後方互換性のあるバグ修正

## 変更タイプ

- **Added**: 新機能
- **Changed**: 既存機能の変更
- **Deprecated**: 非推奨になった機能
- **Removed**: 削除された機能
- **Fixed**: バグ修正
- **Security**: セキュリティ関連の修正

---

[Unreleased]: https://github.com/Kensan196948G/ITSM-System/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Kensan196948G/ITSM-System/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Kensan196948G/ITSM-System/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/Kensan196948G/ITSM-System/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/Kensan196948G/ITSM-System/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/Kensan196948G/ITSM-System/releases/tag/v0.1.0
