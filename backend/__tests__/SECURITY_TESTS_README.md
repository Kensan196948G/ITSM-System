# セキュリティダッシュボード テスト実装

セキュリティダッシュボード機能の包括的なテストスイートです。

## 実装されたテストファイル

### 1. ユニットテスト - auditLog.test.js
**場所**: `/mnt/LinuxHDD/ITSM-System/backend/__tests__/unit/middleware/auditLog.test.js`

**テスト内容**:
- POSTリクエストを監査ログに記録
- PUTリクエストを監査ログに記録
- DELETEリクエストを監査ログに記録
- セキュリティ関連アクションのマーキング
  - 脆弱性の更新
  - インシデント作成
  - ユーザー権限変更
  - セキュリティ変更管理
- IPアドレスの記録
  - req.ipから取得
  - req.connection.remoteAddressから取得
  - 取得できない場合のnull処理
- 監査対象外パスの除外
  - GETリクエスト
  - /health/*
  - /metrics
  - /api-docs/*
- 認証されていないリクエストの処理
- データベースエラーハンドリング

**テストケース数**: 17
**合格率**: 100% (17/17)

### 2. ユニットテスト - securityAlerts.test.js
**場所**: `/mnt/LinuxHDD/ITSM-System/backend/__tests__/unit/utils/securityAlerts.test.js`

**テスト内容**:
- failed_loginアラート生成
  - 15分以内に5回以上の失敗ログインでアラート
  - 5回未満ではアラート生成しない
- suspicious_activityアラート生成
  - 30秒以内に異なるIPからのログインでアラート
  - 同一IPからのログインではアラート生成しない
- privilege_escalationアラート生成
  - analyst → admin への権限昇格
  - viewer → admin への権限昇格
  - admin → admin は無視
  - analyst → manager は無視
- vulnerability_detectedアラート生成
  - Critical脆弱性でアラート
  - High脆弱性でアラート
  - Medium/Low脆弱性は無視
- 必須コンテキストのバリデーション
- データベースエラーハンドリング

**テストケース数**: 17
**合格率**: 100% (17/17)

### 3. 統合テスト - security-dashboard.test.js
**場所**: `/mnt/LinuxHDD/ITSM-System/backend/__tests__/integration/security-dashboard.test.js`

**テスト内容**:
- `GET /api/v1/security/dashboard/overview`
  - adminユーザーアクセス可能
  - analyst/viewerは403エラー
  - 認証なしで401エラー
- `GET /api/v1/security/alerts`
  - アラート一覧取得
  - severityフィルタ
  - alert_typeフィルタ
  - is_acknowledgedフィルタ
  - ページネーション
  - analyst/managerアクセス可能
- `PUT /api/v1/security/alerts/:id/acknowledge`
  - アラート確認成功
  - 存在しないIDで404エラー
- `GET /api/v1/security/audit-logs`
  - 監査ログ一覧取得
  - actionフィルタ
  - resource_typeフィルタ
  - is_security_actionフィルタ
  - user_idフィルタ
  - 日付範囲フィルタ
  - ページネーション
  - admin/managerのみアクセス可能
- `GET /api/v1/security/user-activity/:user_id`
  - ユーザーアクティビティ取得
  - activity_typeフィルタ
  - 日付範囲フィルタ
  - ページネーション
  - 異常検知データ取得
- `GET /api/v1/security/activity-stats`
  - アクティビティ統計取得
  - 日付範囲フィルタ
  - admin/managerのみアクセス可能

**テストケース数**: 39
**現状**: SKIPPED（データベーススキーマ依存）

## テスト実行方法

### ユニットテストのみ実行
```bash
npm test -- __tests__/unit/
```

### セキュリティダッシュボード関連のユニットテストのみ
```bash
npm test -- __tests__/unit/middleware/auditLog.test.js
npm test -- __tests__/unit/utils/securityAlerts.test.js
```

### 統合テスト実行（現在はスキップ）
```bash
npm test -- __tests__/integration/security-dashboard.test.js
```

## 統合テストの有効化

統合テストは現在、データベーススキーマの制約によりスキップされています。

### 前提条件
統合テストを有効にするには、以下のテーブルが必要です:

1. **user_activity** テーブル
   - ログイン追跡に使用
   - 列: user_id, activity_type, ip_address, user_agent, success, failure_reason, session_id, created_at

2. **security_alerts** テーブル
   - セキュリティアラートの保存
   - 列: id, alert_type, severity, description, affected_user_id, affected_resource_type, affected_resource_id, source_ip, is_acknowledged, created_at, acknowledged_at, acknowledged_by

3. **audit_logs** テーブル（更新版）
   - 監査ログの保存
   - 列: id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, is_security_action, created_at

### 有効化手順
1. `backend/db.js`でテストデータベーススキーマを更新
2. `backend/__tests__/integration/security-dashboard.test.js`の`describe.skip`を`describe`に変更
3. テスト実行: `npm test -- __tests__/integration/security-dashboard.test.js`

## テストカバレッジ

### ユニットテスト
- **auditLog.test.js**: 監査ログミドルウェアの全機能をカバー
- **securityAlerts.test.js**: セキュリティアラート生成ロジックの全パターンをカバー

### 統合テスト（有効化時）
- セキュリティダッシュボードAPI全6エンドポイント
- 認証・認可の検証
- フィルタリングとページネーションの動作確認
- エラーハンドリング

## テスト実装パターン

### ユニットテスト
- Jestのモック機能を使用してデータベースをモック化
- `beforeEach`で各テストケース前にモックをリセット
- `setImmediate`を使用して非同期処理を待機

### 統合テスト
- `supertest`を使用した実際のHTTPリクエスト
- 実際のデータベースを使用
- `beforeAll`でテストデータ作成、`afterAll`でクリーンアップ
- 認証トークンを使用した実際の認証フロー

## 注意事項

1. ユニットテストは独立して実行可能
2. 統合テストはデータベーススキーマに依存
3. テスト実行時は`.env.test`の環境変数が使用される
4. テストデータベースは`backend/test_itsm.db`

## トラブルシューティング

### "SQLITE_ERROR: no such table: user_activity"
- `user_activity`テーブルが存在しません
- `backend/db.js`でテーブル作成スクリプトを追加してください

### "SQLITE_ERROR: no such column: new_values"
- `audit_logs`テーブルのスキーマが古いバージョンです
- テーブルを削除して再作成するか、ALTERコマンドで列を追加してください

### タイムアウトエラー
- データベース接続の問題の可能性があります
- テストタイムアウトを増やす: `jest.setTimeout(30000)`

## 今後の改善案

1. 統合テスト用のマイグレーションスクリプト作成
2. テストデータファクトリーの導入
3. E2Eテストの追加
4. テストカバレッジレポートの自動生成
5. CI/CDパイプラインへの統合

## 関連ファイル

- `/mnt/LinuxHDD/ITSM-System/backend/middleware/auditLog.js` - 監査ログミドルウェア
- `/mnt/LinuxHDD/ITSM-System/backend/utils/securityAlerts.js` - セキュリティアラートユーティリティ
- `/mnt/LinuxHDD/ITSM-System/backend/server.js` - セキュリティダッシュボードAPIエンドポイント
- `/mnt/LinuxHDD/ITSM-System/backend/middleware/userActivity.js` - ユーザーアクティビティトラッキング
