# CI/CD ロールバック手順書

## 概要

本ドキュメントは、ITSM-Sec Nexus のリリースに問題が発生した場合のロールバック手順を定義します。
GitHub Actions の CD パイプライン（`cd.yml`）によるセマンティックバージョニングとタグ管理を前提としています。

---

## 1. ロールバックが必要なシナリオ

| シナリオ | 重大度 | 目標復旧時間 |
|----------|--------|-------------|
| 本番環境でサービス障害が発生 | 高 | 5分以内 |
| デプロイ後にテスト失敗が発覚 | 中 | 15分以内 |
| セキュリティ脆弱性の発見 | 高 | 10分以内 |
| パフォーマンス劣化が検知された | 中 | 30分以内 |
| CDパイプライン自体の失敗 | 低 | 対応不要（自動停止） |

---

## 2. 事前確認事項

ロールバックを実行する前に、以下を確認してください。

### 2.1 現在のバージョン確認

```bash
# 現在デプロイされているバージョン
node -p "require('./package.json').version"

# Gitタグ一覧（最新5件）
git tag --sort=-v:refname | head -5

# 現在のコミット
git log --oneline -3
```

### 2.2 ロールバック先バージョンの特定

```bash
# リリース一覧を確認
gh release list --limit 10

# 特定リリースの詳細
gh release view v<VERSION>
```

### 2.3 データベースマイグレーション状況

```bash
# マイグレーション状態を確認
npx knex migrate:status

# 直近のマイグレーション一覧
ls -la backend/migrations/ | tail -10
```

**注意**: ロールバック先バージョンと現在のバージョンの間にDBマイグレーションがある場合、
データベースのロールバックも必要です（セクション4参照）。

---

## 3. ロールバック手順

### 3.1 Git タグを使った即時ロールバック（推奨）

最も安全かつ高速な方法です。

```bash
# 1. ロールバック先バージョンを確認
TARGET_VERSION="1.0.0"  # 戻したいバージョンに置き換え

# 2. 現在の状態をバックアップ（念のため）
git stash  # 未コミットの変更がある場合

# 3. ロールバック先タグにチェックアウト
git fetch origin --tags
git checkout "v${TARGET_VERSION}"

# 4. 依存関係を再インストール
npm ci --omit=dev

# 5. サーバーを再起動
# systemdを使用している場合:
sudo systemctl restart itsm-system

# プロセス直接管理の場合:
# 既存プロセスを停止
kill $(lsof -t -i:6443) 2>/dev/null || true
# 新しいバージョンで起動
NODE_ENV=production nohup node backend/server.js > /var/log/itsm/server.log 2>&1 &
```

### 3.2 Git revert を使ったロールバック

問題のコミットのみを取り消す場合に使用します。

```bash
# 1. 問題のコミットハッシュを特定
git log --oneline -10

# 2. revert コミットを作成
git revert <COMMIT_HASH> --no-edit

# 3. CI/CDパイプラインを通してデプロイ
git push origin main
```

### 3.3 GitHub Actions でのロールバック（workflow_dispatch）

CDパイプラインの手動トリガーを使用して、新しいパッチバージョンとしてリリースします。

```bash
# GitHub CLI でワークフローを手動トリガー
gh workflow run cd.yml -f version_bump=patch

# 実行状況の確認
gh run list --workflow=cd.yml --limit 3
```

---

## 4. データベースマイグレーションのロールバック

### 4.1 直近1件のマイグレーションをロールバック

```bash
# マイグレーション状態確認
npx knex migrate:status

# 直近のマイグレーションをロールバック
npx knex migrate:rollback
```

### 4.2 複数マイグレーションのロールバック

```bash
# 全てのマイグレーションをロールバック（注意: 全データが失われる可能性）
npx knex migrate:rollback --all

# 特定バージョンまでロールバック（1つずつ実行）
npx knex migrate:rollback  # 1回目
npx knex migrate:rollback  # 2回目（必要に応じて繰り返し）
```

### 4.3 SQLiteデータベースのバックアップからの復旧

マイグレーションロールバックが困難な場合、バックアップから復旧します。

```bash
# バックアップ一覧を確認
ls -la backups/

# データベースファイルを入れ替え
cp backend/itsm.db backend/itsm.db.broken  # 現在のDBを退避
cp backups/itsm_<TIMESTAMP>.db backend/itsm.db  # バックアップから復旧

# サーバーを再起動
sudo systemctl restart itsm-system
```

---

## 5. ロールバック後の動作確認

### 5.1 基本動作確認

```bash
# 1. サーバーが起動しているか
curl -k https://localhost:6443/api/v1/health

# 2. 認証APIが動作するか
curl -k -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'

# 3. バージョン確認
node -p "require('./package.json').version"

# 4. データベース接続確認
node -e "const db = require('./backend/db'); console.log('DB OK');"
```

### 5.2 ログ確認

```bash
# アプリケーションログ
tail -50 /var/log/itsm/server.log

# systemdジャーナル（systemd使用時）
journalctl -u itsm-system --since "5 minutes ago" --no-pager
```

### 5.3 CI パイプラインでの検証

```bash
# テストを実行して問題がないか確認
npm run test:ci

# E2Eテスト実行（オプション）
npm run test:e2e
```

---

## 6. エスカレーション手順

### 6.1 エスカレーション基準

| 状況 | エスカレーション先 | 対応時間 |
|------|-------------------|---------|
| ロールバック手順で復旧可能 | 運用チーム内で完結 | - |
| ロールバック後もサービス復旧せず | プロジェクトリーダー | 即時 |
| データ損失の可能性あり | プロジェクトリーダー + DBA | 即時 |
| セキュリティインシデントを伴う | セキュリティ担当者 | 即時 |

### 6.2 エスカレーション時の報告内容

以下を必ず含めてください:

1. **発生日時**: いつ問題が検知されたか
2. **影響範囲**: 影響を受けるユーザー・機能
3. **現在の状態**: ロールバック済み / 復旧中 / 未復旧
4. **原因の推定**: 分かっている範囲で
5. **対応履歴**: 実施した手順のタイムライン

### 6.3 連絡先

| 担当 | 連絡先 | 備考 |
|------|--------|------|
| 運用チーム | GitHub Issue 作成 | 通常の問題報告 |
| プロジェクトリーダー | GitHub Issue + メンション | 緊急時 |
| セキュリティ担当 | GitHub Issue (Security Label) | セキュリティ関連 |

---

## 7. ロールバック判断フローチャート

```
問題検知
  |
  v
サービス停止中? ──Yes──> 即時ロールバック（3.1手順）
  |No                         |
  v                           v
パフォーマンス問題? ──Yes──> 原因調査（30分以内）
  |No                         |
  v                           |
セキュリティ問題? ──Yes──> 緊急ロールバック + インシデント対応
  |No                         |
  v                           |
テスト失敗? ──Yes──────> git revert で修正（3.2手順）
  |No                         |
  v                           v
経過観察              ロールバック後の動作確認（セクション5）
```

---

## 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-03-02 | 初版作成 | 運用チーム |
