# Changelog

このプロジェクトのすべての重要な変更はこのファイルに記録されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/lang/ja/) に準拠しています。

## [Unreleased]

### 追加機能 (Added)

#### Phase 9.2: 監視・ヘルスチェック強化（2026-01-31）

##### Backend
- **データベーステーブル追加**: `metric_history`, `alert_rules`, `alert_history`, `notification_channels`, `notification_history`
- **MonitoringService実装**: メトリクス収集、履歴保存、カスタムメトリクス登録
- **AlertService実装**: アラート評価エンジン、発火・解決ロジック
- **REST API実装**: 17エンドポイント（メトリクス、アラートルール、アラート履歴、通知チャネル）
  - メトリクスAPI: システム、ビジネス、パフォーマンスメトリクス取得、履歴取得
  - アラートルールAPI: CRUD操作、トグル、テスト評価
  - アラート履歴API: 一覧、確認（Acknowledge）、解決（Resolve）、統計
  - 通知チャネルAPI: CRUD操作、テスト送信
  - 通知履歴API: 一覧取得
- **スケジューラー統合**: メトリクススナップショット（5分ごと）、アラート評価（1分ごと）、古いデータ削除（30日経過後）
- **通知機能拡張**: Webhook通知、マルチチャネル対応（メール、Slack、カスタムWebhook）

##### Frontend
- **監視ダッシュボード追加**: システムメトリクス、ビジネスメトリクス、パフォーマンスメトリクス表示
- **Chart.js統合**: SLA達成率、インシデント統計、レスポンスタイム、キャッシュヒット率グラフ
- **リアルタイム更新**: 10秒間隔の自動リフレッシュ（システムメトリクス）
- **アクティブアラート表示**: 重大度別のアラート件数表示（Critical/Warning/Info）
- **アラートルール管理UI**: ルール一覧、作成、編集、削除、トグル機能
- **アラート履歴UI**: 履歴一覧、確認（Acknowledge）、解決（Resolve）操作
- **通知チャネル管理UI**: チャネル一覧、作成、編集、削除、テスト送信

##### 運用機能
- **自動メトリクス保存**: 5分ごとのスナップショット（30日間保持）
- **自動アラート評価**: 1分ごとのルール評価
- **詳細ヘルスチェック**: DB、ディスク、メモリ、キャッシュ、スケジューラーの状態確認
- **推奨アラートルール**: 15個の事前定義ルール（システム5個、ビジネス4個、セキュリティ4個、パフォーマンス2個）

##### ドキュメント
- **監視運用ガイド追加**: `docs-prod/MONITORING_OPERATIONS.md`（800行以上）
- **アラート設定ガイド追加**: `docs-prod/ALERT_CONFIGURATION.md`（600行以上）
- **アーキテクチャ設計書**: `docs-dev/MONITORING_ARCHITECTURE.md`
- **要件定義書**: `specs/phase9-2-monitoring-requirements.md`

##### セキュリティ
- **暗号化**: 通知チャネル設定をAES-256-CBC暗号化
- **RBAC統合**: Admin/Manager/Analyst権限による細かいアクセス制御
- **監査ログ**: 全監視操作を記録（ISO 20000準拠）

##### コンプライアンス
- **ISO 20000準拠**: サービス監視および報告機能
- **NIST CSF 2.0準拠**: DETECT（検知）機能の実装

#### Phase 9.1: バックアップ・リストア機能高度化（2026-01-31）

##### Backend
- **データベーステーブル追加**: `backup_logs`, `backup_audit_logs`, `backup_integrity_checks`
- **BackupService実装**: バックアップ作成、リストア、削除、整合性チェック
- **REST API実装**: 6エンドポイント（作成、一覧、詳細、リストア、削除、整合性チェック、統計）
- **スケジューラー統合**: 日次/週次/月次バックアップ、整合性チェック
- **監査ログ統合**: すべてのバックアップ操作を記録（ISO 20000準拠）

##### Frontend
- **バックアップ管理画面追加**: 統計ダッシュボード、一覧表示、フィルター、ページネーション
- **操作UI**: 手動バックアップ実行、リストア、削除、整合性チェック
- **リアルタイム統計表示**: 総数、成功/失敗数、最新バックアップ情報

##### 運用機能
- **自動スケジュール**: 日次（02:00）、週次（日曜03:00）、月次（1日04:00）
- **整合性チェック**: 週次（土曜01:00）自動実行
- **ディザスタリカバリ対応**: RTO ≤ 15分達成

##### ドキュメント
- **運用ガイド追加**: `docs-prod/BACKUP_OPERATIONS.md`
- **ディザスタリカバリRunbook追加**: `docs-prod/DISASTER_RECOVERY.md`
- **アーキテクチャ設計書**: `docs-dev/BACKUP_ARCHITECTURE.md`
- **要件定義書**: `specs/phase9-1-backup-requirements.md`

##### テスト
- **ユニットテスト**: `backend/__tests__/unit/services/backupService.test.js`
- **統合テスト**: `backend/__tests__/integration/backups.test.js`
- **カバレッジ**: 80%達成

### セキュリティ (Security)

#### Phase 9.1: バックアップセキュリティ強化（2026-01-31）
- **Admin権限必須**: すべてのバックアップ操作
- **監査ログ100%記録**: 作成、リストア、削除、一覧取得
- **ファイルアクセス権限**: 700（ディレクトリ）、600（ファイル）

### パフォーマンス (Performance)

#### Phase 9.1: バックアップパフォーマンス最適化（2026-01-31）
- **非同期実行**: バックアップ作成時のレスポンス改善（202 Accepted）
- **インデックス最適化**: backup_logs テーブル
- **ページネーション**: 一覧表示のパフォーマンス向上

### 修正 (Fixed)

#### 監査ログミドルウェア修正（2026-01-26）
- **パス解析バグ修正**: `req.path`を`req.originalUrl`に変更
  - Expressルーター内では`req.path`がマウントポイント相対になるため、`/api/v1/incidents`が`/`として認識される問題を解決
  - リソースタイプが正しく抽出され、監査ログが正常に記録されるように修正
- **レースコンディション修正**: `next()`を`.then()`ブロック内に移動
  - 変更前データ取得の非同期処理とレスポンスフック設定の競合を解消
  - `res.send`フックが確実に設定された後に次のミドルウェアが実行されるよう修正
- **ユニットテスト更新**: 非同期ミドルウェアの動作に対応
  - `waitForAsyncOps()`を使用してPromise解決後にアサーションを実行

### 追加機能 (Added)

#### WebUI再開発（2026-01-19）
- **NIST CSF 2.0ダッシュボード**: 6つのセキュリティ機能（統治/識別/防御/検知/対応/復旧）の統合ビューを追加
- **サイドバーにCSFダッシュボードリンク追加**: NIST CSF 2.0セクションにダッシュボードへのナビゲーションを追加

### 修正 (Fixed)

#### WebUI修正（2026-01-19）
- **タブフィルタリング機能修正**: `filterByTab`関数の`event is not defined`エラーを修正
- **サービスカタログタブ修正**: `switchCatalogTab`関数の同様のエラーを修正
- **申請ボタン動作修正**: JavaScriptエラー解消により、すべての申請ボタンが正常に動作
- **CSP（Content Security Policy）修正**: `script-src-attr 'unsafe-inline'`を追加し、インラインイベントハンドラ（onclick等）が正常に動作するよう修正。helmet 8.xのデフォルト設定`script-src-attr 'none'`が原因でタブ切り替えや申請ボタンがブロックされていた問題を解決

### 変更 (Changed)

#### 環境分離（2026-01-19）
- **開発環境用設定ファイル追加**: `.env.development`を新規作成（HTTPS_PORT=5443）
- **server.js修正**: `NODE_ENV=development`時に`.env.development`を読み込むよう変更
- **ポート分離**: 開発環境（5443）と本番環境（6443）を同時起動可能に

#### セキュリティ強化（P1）
- **JWTブラックリスト機能**: ログアウト時にトークンを無効化
- **リフレッシュトークン**: 7日間有効な長期トークンでセッション維持
- **トークンローテーション**: リフレッシュ時に新トークン発行、旧トークン無効化
- **トークンファミリー追跡**: 再利用攻撃検出時にファミリー全体を無効化
- **セッション管理**: アクティブセッション一覧、全デバイスログアウト機能
- **トークン有効期限短縮**: 24時間 → 1時間に変更

#### API改善（P2）
- **APIバージョニングミドルウェア**: URL/ヘッダー/Accept/クエリパラメータ対応
- **非推奨エンドポイント警告**: Deprecation/Sunset/Linkヘッダー自動付与
- **バージョンレスポンスヘッダー**: X-API-Version, X-API-Supported-Versions
- **レート制限ヘッダー公開**: X-RateLimit-* ヘッダーをCORSで公開

#### ドキュメント（P3）
- **認証・トークン管理ドキュメント**: `docs/security/AUTHENTICATION_AND_TOKENS.md`
- **APIバージョニングガイド**: `docs/api/API_VERSIONING.md`

### 変更 (Changed)
- **ログインAPI**: リフレッシュトークンをHttpOnlyクッキーで返却
- **ログアウトAPI**: JWTをブラックリストに追加、全セッション無効化オプション
- **CORS設定**: PATCHメソッド追加、新ヘッダー許可・公開

### データベース (Database)
- **token_blacklist**: JWTブラックリストテーブル追加
- **refresh_tokens**: リフレッシュトークン管理テーブル追加

### テスト (Tests)
- APIバージョニングミドルウェアのユニットテスト追加（24テスト）

### セキュリティ (Security)
- JWTにJTI（JWT ID）を含めてブラックリスト対応
- リフレッシュトークンはSHA-256ハッシュで保存
- ファミリー追跡によるトークン再利用攻撃の検出・防止
- HttpOnlyクッキーによるXSS対策強化

## [2.2.0] - 2026-01-18

### 追加機能 (Added)

#### WebUI再開発・NIST CSF 2.0完全対応

##### フロントエンド
- **CSFダッシュボード**: 6関数（Govern/Identify/Protect/Detect/Respond/Recover）の統合スコア表示
- **アコーディオンナビゲーション**: 折りたたみ可能なサイドバー、CSF色分けバッジ
- **サービスカタログUI**: 12項目のサービスメニュー、カード型レイアウト
- **CSF詳細ページ**: 各関数のカテゴリ別スコア、成熟度レベル表示
- **CSFテーマモーダル**: 6種のCSF色分けモーダルバリアント
- **モーダルサイズバリアント**: sm/lg/xl/fullscreen対応
- **モーダルタブ機能**: 複数セクションのタブ切り替え

##### バックエンドAPI
- **CSFコントロールAPI** (`/api/v1/csf/*`)
  - `GET /functions` - CSF関数一覧（統計付き）
  - `GET /progress` - ダッシュボード用CSF進捗
  - `GET /statistics` - 詳細統計
  - `GET /controls` - コントロール一覧（フィルタリング対応）
  - `GET /controls/:id` - コントロール詳細
  - `PUT /controls/:id` - コントロール更新
  - `GET /assessments` - 評価履歴

- **サービスカタログAPI** (`/api/v1/service-catalog/*`)
  - `GET /categories` - カテゴリ一覧
  - `POST /categories` - カテゴリ作成
  - `GET /categories/:id` - カテゴリ詳細（サービス含む）
  - `PUT /categories/:id` - カテゴリ更新
  - `DELETE /categories/:id` - カテゴリ削除
  - `GET /services` - サービス一覧（フィルタリング対応）
  - `POST /services` - サービス作成
  - `GET /services/:id` - サービス詳細
  - `PUT /services/:id` - サービス更新
  - `DELETE /services/:id` - サービス削除
  - `GET /statistics` - カタログ統計

##### データベース
- **CSFテーブル追加**
  - `csf_functions`: 6関数マスタ（初期データ含む）
  - `csf_categories`: カテゴリテーブル
  - `csf_controls`: コントロール管理
  - `csf_assessments`: 評価履歴

- **サービスカタログテーブル追加**
  - `service_categories`: 8カテゴリ初期データ
  - `service_catalog`: 12サービス初期データ
  - `service_request_templates`: リクエストテンプレート

### 改善 (Changed)

#### UI/UX
- CSS変数システムの導入（カラーテーマ管理の統一）
- NIST CSF 2.0色分けシステム（6色のカテゴリカラー）
- レスポンシブデザイン強化（4ブレークポイント対応）
- カードコンポーネントの新デザイン（ホバーエフェクト、シャドウ）
- テーブル・バッジスタイルの更新

#### API
- ダッシュボードKPIのCSF進捗が動的に取得されるように改善
- `getCSFProgressSafe()`: DBから動的取得（フォールバック付き）

### テスト (Tests)
- CSFコントロールAPI統合テスト追加（11テスト）
- サービスカタログAPI統合テスト追加（20テスト）

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
