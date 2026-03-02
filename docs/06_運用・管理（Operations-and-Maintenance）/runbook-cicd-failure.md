# Runbook: CI/CD失敗時対応

## 概要

ITSM-Sec Nexus の GitHub Actions パイプライン（CI/CD）が失敗した場合の
診断・対処手順書です。

### パイプライン構成

| ワークフロー | ファイル | トリガー |
|-------------|---------|---------|
| CI Pipeline | `ci.yml` | push, PR |
| CD Pipeline | `cd.yml` | main push, 手動 |
| Auto Error Fix | `auto-error-fix-continuous.yml` | CI失敗時（自動） |
| Security Scan | `security.yml` | 毎週月曜、手動 |
| Post Merge Notify | `post-merge-notify.yml` | main マージ後 |

---

## 1. 検知方法

### 1.1 GitHub Actions での確認

```bash
# 最新のワークフロー実行結果を確認
gh run list --limit 10

# 失敗したワークフローの詳細
gh run view <RUN_ID>

# 特定ジョブのログ確認
gh run view <RUN_ID> --log-failed
```

### 1.2 アラート条件

| 条件 | 対応 |
|------|------|
| CI Pipeline 失敗（PR） | PR作成者に通知、マージブロック |
| CI Pipeline 失敗（main push） | 即時調査、auto-error-fix が起動 |
| CD Pipeline 失敗 | リリース中断、即時調査 |
| Security Scan 失敗 | セキュリティ担当に通知 |

---

## 2. 失敗種別の判定と対処

### 2.1 Lint エラー

```bash
# ローカルで再現
npm run lint

# 自動修正
npm run lint:fix

# フォーマットチェック
npm run format:check

# 自動フォーマット
npm run format
```

**自動修復**: `auto-error-fix-continuous.yml` が自動修正を試みます。

### 2.2 テスト失敗

```bash
# 全テスト実行
npm test

# 失敗テストのみ再実行
npx jest --onlyFailures --forceExit

# 特定テストファイルを実行
npx jest backend/__tests__/unit/<ファイル名> --forceExit

# カバレッジ付き実行
npm run test:coverage
```

#### よくあるテスト失敗の原因

| 原因 | 確認方法 | 対処 |
|------|---------|------|
| DBマイグレーション未実行 | `npx knex migrate:status` | `npx knex migrate:latest` |
| 環境変数不足 | テストログ確認 | `JWT_SECRET`, `TOTP_ENCRYPTION_KEY` 等を設定 |
| ポート競合 | `lsof -i :5000` | テスト用ポートを開放 |
| タイムアウト | テストログ確認 | Jest timeout を調整 |
| スナップショット不一致 | テストログ確認 | `npx jest -u` で更新 |

### 2.3 E2E テスト失敗

```bash
# Playwright E2E テスト
npm run test:e2e

# API E2E テスト
npm run test:api:e2e

# 特定テストのみ実行
npx playwright test --config=e2e/playwright.config.ts <テスト名>

# デバッグモード
npm run test:e2e:debug
```

### 2.4 ビルド失敗

```bash
# 依存関係の再インストール
rm -rf node_modules package-lock.json
npm install

# 本番ビルド検証
npm ci --omit=dev

# Node.jsバージョン確認
node --version  # 18.x または 20.x
```

### 2.5 CD Pipeline 失敗

```bash
# バージョンタグの確認
git tag --sort=-v:refname | head -5

# package.json のバージョン確認
node -p "require('./package.json').version"

# 手動でCDを再実行
gh workflow run cd.yml -f version_bump=patch

# 実行状況確認
gh run list --workflow=cd.yml --limit 3
```

---

## 3. 手動デプロイ手順

CDパイプラインが復旧不能な場合の手動デプロイ手順です。

### 3.1 手動バージョンタグ作成

```bash
# 1. mainブランチに切り替え
git checkout main
git pull origin main

# 2. テスト実行で問題がないことを確認
npm run test:ci

# 3. バージョンを手動更新
npm version patch  # または minor/major

# 4. タグをプッシュ
git push origin main --tags
```

### 3.2 手動 GitHub Release 作成

```bash
# 新バージョンを取得
VERSION=$(node -p "require('./package.json').version")

# GitHub Release を手動作成
gh release create "v${VERSION}" \
  --title "Release v${VERSION}" \
  --notes "手動リリース - CI/CD復旧作業中" \
  --target main
```

### 3.3 手動デプロイ

```bash
# 本番サーバーで実行
cd /mnt/LinuxHDD/ITSM-System

# 最新コードを取得
git fetch origin main
git checkout main
git pull origin main

# 依存関係更新
npm ci --omit=dev

# マイグレーション実行
NODE_ENV=production npx knex migrate:latest

# サービス再起動
sudo systemctl restart itsm-system

# 動作確認
curl -sk https://localhost:6443/api/v1/health
```

---

## 4. ロールバック

CI/CD経由でデプロイされたバージョンに問題がある場合、[CI-CD-rollback-procedures.md](CI-CD-rollback-procedures.md) を参照してください。

### 4.1 簡易ロールバック

```bash
# 前のバージョンタグに戻る
PREV_TAG=$(git tag --sort=-v:refname | sed -n '2p')
echo "ロールバック先: ${PREV_TAG}"

git checkout "${PREV_TAG}"
npm ci --omit=dev
sudo systemctl restart itsm-system
```

---

## 5. Auto Error Fix の管理

### 5.1 自動修復の状況確認

```bash
# 自動修復ワークフローの最近の実行
gh run list --workflow=auto-error-fix-continuous.yml --limit 5

# 自動修復で作成されたPR
gh pr list --label "auto-fix" --state all --limit 10
```

### 5.2 自動修復が暴走した場合

```bash
# 実行中のワークフローをキャンセル
gh run cancel <RUN_ID>

# 自動修復ワークフローを無効化
gh workflow disable auto-error-fix-continuous.yml

# 状態リセット後に再有効化
gh workflow enable auto-error-fix-continuous.yml
```

---

## 6. 確認方法

### 6.1 CI パイプライン正常性確認

```bash
# 全ジョブの状態を確認
gh run list --workflow=ci.yml --limit 5

# 最新の成功ランを確認
gh run list --workflow=ci.yml --status success --limit 1

# バッジ状態（README.md参照）
gh api repos/:owner/:repo/actions/workflows/ci.yml/runs?per_page=1 --jq '.workflow_runs[0].conclusion'
```

### 6.2 ローカルでCI相当のチェック

```bash
# CIと同等のチェックをローカルで実行
npm run lint && npm run format:check && npm run migrate:latest && npm test
```

---

## 7. エスカレーション

| 状況 | エスカレーション先 | 備考 |
|------|-------------------|------|
| Lint/テスト失敗 | 担当開発者 | auto-fixで自動修復を試行 |
| CDパイプライン失敗 | プロジェクトリーダー | 手動デプロイ検討 |
| GitHub Actions自体の障害 | - | [GitHub Status](https://www.githubstatus.com/) 確認 |
| 自動修復の暴走 | プロジェクトリーダー | ワークフロー無効化 |
| シークレット漏洩の疑い | セキュリティ担当 | シークレットローテーション |

---

## 8. 事後対応

### 8.1 記録

CI/CD失敗が繰り返し発生する場合、GitHub Issue で追跡:

1. 失敗パターン（どのジョブで、どの頻度で）
2. 根本原因
3. 対処方法
4. 再発防止策

### 8.2 改善項目

- [ ] テストの安定性向上（Flaky testの解消）
- [ ] CI実行時間の最適化
- [ ] 環境変数・シークレットの管理改善
- [ ] 通知設定の最適化（Slack連携等）

---

## 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-03-02 | 初版作成 | 運用チーム |
