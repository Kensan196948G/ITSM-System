# CI/CD ロールバック手順書

**作成日**: 2026-02-14
**バージョン**: 1.0
**対象システム**: ITSM-Sec Nexus
**対象読者**: システム管理者、CI/CD運用担当者、インシデント対応担当者

---

## 目次

1. [概要](#1-概要)
2. [ロールバック判断基準](#2-ロールバック判断基準)
3. [手順1: Git ロールバック](#3-手順1-git-ロールバック)
4. [手順2: データベースマイグレーション ロールバック](#4-手順2-データベースマイグレーション-ロールバック)
5. [手順3: systemd サービス ロールバック](#5-手順3-systemd-サービス-ロールバック)
6. [手順4: GitHub Release ロールバック](#6-手順4-github-release-ロールバック)
7. [統合ロールバック手順（フルロールバック）](#7-統合ロールバック手順フルロールバック)
8. [検証チェックリスト](#8-検証チェックリスト)

---

## 1. 概要

### 1.1 目的

本ドキュメントは、ITSM-Sec Nexus のデプロイ失敗やリリース不具合が発生した際に、システムを安全に以前の状態に戻すためのロールバック手順を定めます。

### 1.2 対象シナリオ

| シナリオ | 重大度 | 対応手順 |
|---------|--------|---------|
| デプロイ後にアプリケーションが起動しない | Critical | Git ロールバック + systemd 再起動 |
| マイグレーション失敗でDBスキーマ不整合 | Critical | DB マイグレーションロールバック |
| リリース後に重大バグが発見された | High | Git ロールバック（revert） |
| リリースタグやバージョンの誤り | Medium | GitHub Release ロールバック |
| 新バージョンでパフォーマンス劣化 | High | フルロールバック |

### 1.3 前提条件

- サーバーへのSSHアクセス権限があること
- `sudo` 権限を持つこと
- GitHub リポジトリへの push 権限があること
- `gh` CLI がインストールされていること（GitHub Release 操作時）

### 1.4 フローチャート: ロールバック判断

```
デプロイ後に問題発生
│
├─ アプリケーションが起動しない？
│  ├─ YES → [手順1: Git ロールバック] + [手順3: systemd 再起動]
│  └─ NO ─┐
│          │
├─ DBマイグレーションが失敗した？
│  ├─ YES → [手順2: DB マイグレーションロールバック]
│  └─ NO ─┐
│          │
├─ 重大なバグが発見された？
│  ├─ YES → [手順1: Git ロールバック (revert)] + 再デプロイ
│  └─ NO ─┐
│          │
├─ リリースタグ/バージョンが誤り？
│  ├─ YES → [手順4: GitHub Release ロールバック]
│  └─ NO ─┐
│          │
└─ パフォーマンス劣化・総合的問題？
   └─ YES → [手順7: 統合ロールバック（フルロールバック）]
```

---

## 2. ロールバック判断基準

### 2.1 ロールバック実行の判断

| 条件 | 判断 | 根拠 |
|------|------|------|
| ヘルスチェック失敗（`/api/v1/health`） | 即時ロールバック | サービス提供不能 |
| 起動後5分以内にクラッシュ | 即時ロールバック | サービス安定性欠如 |
| Critical バグ発見 | 即時ロールバック | ユーザー影響大 |
| High バグ発見 | 判断待ち（管理者承認） | 影響範囲次第 |
| パフォーマンス30%以上劣化 | 判断待ち（管理者承認） | SLA 影響評価 |

### 2.2 ロールバック前の必須確認事項

- [ ] 現在のDBの状態をバックアップ済みか
- [ ] ロールバック先のバージョン/コミットを特定済みか
- [ ] 関係者に通知済みか
- [ ] ロールバック後の検証手順を把握しているか

---

## 3. 手順1: Git ロールバック

Git ロールバックには2つの方法があります。状況に応じて適切な方法を選択してください。

### 3.1 方法A: `git revert`（推奨 - 安全な方法）

`git revert` はコミット履歴を保持しつつ、変更を打ち消す新しいコミットを作成します。
**共有ブランチ（main）では、この方法を優先してください。**

#### フローチャート

```
git revert を選択
│
├─ 単一コミットの取り消し？
│  └─ git revert <commit-hash>
│
├─ 複数コミットの取り消し？
│  └─ git revert <oldest-hash>..<newest-hash>
│
└─ マージコミットの取り消し？
   └─ git revert -m 1 <merge-commit-hash>
```

#### 手順

```bash
# 1. 現在の状態を確認
cd /mnt/LinuxHDD/ITSM-System
git log --oneline -10

# 2. 取り消したいコミットを特定
# 例: abc1234 が問題のコミット
git show abc1234 --stat

# 3. revert を実行（単一コミット）
git revert abc1234

# 4. 複数コミットを取り消す場合
# abc1234 から def5678 までの範囲を取り消す
git revert --no-commit abc1234..def5678
git commit -m "revert: abc1234..def5678 のコミットを取り消し - [理由を記載]"

# 5. マージコミットを取り消す場合
# -m 1 は parent #1（マージ先=main）を残す指定
git revert -m 1 <merge-commit-hash>
```

#### PRのrevert（GitHub経由）

```bash
# GitHub CLI を使用してPRをrevert
# 1. 問題のPR番号を確認
gh pr list --state merged --limit 10

# 2. PRの内容を確認
gh pr view <PR番号>

# 3. revert用のブランチを作成
git checkout main
git pull origin main
git checkout -b revert/pr-<PR番号>

# 4. マージコミットをrevert
git log --oneline --merges -5
git revert -m 1 <merge-commit-hash>

# 5. revert用のPRを作成
git push origin revert/pr-<PR番号>
gh pr create --title "revert: PR #<PR番号> を取り消し" \
  --body "## 理由\n- [ロールバック理由を記載]\n\n## 元のPR\n- #<PR番号>"
```

#### 注意事項

- `git revert` はコミット履歴を壊さないため、チーム開発で安全に使用できる
- revert したコミットを再度適用する場合、revert の revert が必要になる
- コンフリクトが発生した場合は手動で解決が必要

#### 検証方法

```bash
# revert 後の状態を確認
git log --oneline -5
git diff HEAD~1 --stat

# テスト実行で正常動作を確認
npm test

# Lint チェック
npm run lint
```

---

### 3.2 方法B: `git reset --hard`（緊急時のみ）

`git reset --hard` はコミット履歴自体を巻き戻します。
**強制pushが必要になるため、共有ブランチでは原則使用しないでください。**

#### フローチャート

```
git reset --hard を選択（緊急時のみ）
│
├─ 1. 事前バックアップ（現在のHEADを記録）
│     git log --oneline -1 > /tmp/rollback_head.txt
│
├─ 2. ロールバック先を特定
│     git log --oneline -10
│
├─ 3. reset 実行
│     git reset --hard <target-commit>
│
├─ 4. 強制push（危険操作）
│     git push --force-with-lease origin main
│
└─ 5. チームメンバーに通知
      全員が git pull --rebase を実行する必要がある
```

#### 手順

```bash
# *** 警告: この操作はコミット履歴を書き換えます ***
# *** 共有ブランチでの使用は原則禁止です ***
# *** 緊急時かつ管理者承認を得た場合のみ使用してください ***

# 1. 現在のHEADを記録（復旧用）
cd /mnt/LinuxHDD/ITSM-System
CURRENT_HEAD=$(git rev-parse HEAD)
echo "Current HEAD: $CURRENT_HEAD" | tee /tmp/rollback_head_$(date +%Y%m%d_%H%M%S).txt

# 2. ロールバック先のコミットを確認
git log --oneline -10

# 3. ロールバック先を特定（例: 2つ前のコミット）
git show HEAD~2 --stat

# 4. reset 実行
git reset --hard HEAD~2
# または特定のコミットハッシュを指定
# git reset --hard abc1234

# 5. 強制push（--force-with-lease は他者のpushを上書きしない安全策）
git push --force-with-lease origin main

# 6. 復旧が必要な場合（reset を取り消す）
# git reset --hard $CURRENT_HEAD
# git push --force-with-lease origin main
```

#### 使用判断基準

| 条件 | `git revert` | `git reset --hard` |
|------|:---:|:---:|
| 共有ブランチ（main） | 推奨 | 原則禁止 |
| 個人ブランチ | 可能 | 可能 |
| コミット履歴の保持 | 保持される | 失われる |
| 強制pushの必要性 | 不要 | 必要 |
| チームへの影響 | なし | 全員のローカルに影響 |
| 緊急度が極めて高い | 可能 | 可能（管理者承認必須） |

#### 注意事項

- `--force-with-lease` を必ず使用する（`--force` より安全）
- reset 前に必ず現在の HEAD を記録する
- チームメンバー全員に通知し、`git pull --rebase` を依頼する
- 絶対に `git push --force` を main ブランチに対して無承認で実行しない

#### 検証方法

```bash
# reset 後の状態を確認
git log --oneline -5

# リモートとの同期状態を確認
git status
git log --oneline origin/main -5

# アプリケーションが正常に動作するか確認
npm install
npm test
```

---

## 4. 手順2: データベースマイグレーション ロールバック

### 4.1 概要

ITSM-Sec Nexus は knex を使用したマイグレーション管理を採用しています。
マイグレーションファイルは `backend/migrations/` に配置されています。

#### フローチャート

```
DBマイグレーション失敗 or ロールバック必要
│
├─ マイグレーション実行前にDBバックアップを取得済み？
│  ├─ YES → バックアップからの復元も選択肢
│  └─ NO  → migrate:rollback で対応
│
├─ 1. 現在のマイグレーション状態を確認
│     npm run migrate:status
│
├─ 2. ロールバック実行（1つ戻す）
│     npm run migrate:rollback
│
├─ 3. マイグレーション状態を再確認
│     npm run migrate:status
│
├─ 4. DB整合性チェック
│     sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"
│
└─ 5. アプリケーション動作確認
      curl http://localhost:5000/api/v1/health
```

### 4.2 マイグレーション状態確認

```bash
cd /mnt/LinuxHDD/ITSM-System

# 現在のマイグレーション状態を確認
npm run migrate:status

# 出力例:
# Using environment: production
# Migration                                Status
# ─────────────────────────────────────────────────
# 001_initial_schema.js                    COMPLETED
# 002_add_2fa.js                           COMPLETED
# 002_sla_alert_history.js                 COMPLETED
# ...
# 20260201_add_autofix_tables.js           PENDING
```

### 4.3 ロールバック実行

```bash
# 1. 事前にデータベースをバックアップ
cp backend/itsm_nexus.db "backend/backups/itsm_nexus_pre_rollback_$(date +%Y%m%d_%H%M%S).db"

# 2. 最新のマイグレーションバッチを1つ戻す
npm run migrate:rollback

# 3. 複数バッチを戻す必要がある場合は繰り返す
# npm run migrate:rollback  # 2つ目のバッチ
# npm run migrate:rollback  # 3つ目のバッチ

# 4. すべてのマイグレーションを戻す場合（危険 - 全データ消失の可能性）
# *** 本番環境では原則使用禁止 ***
# npm run migrate:rollback --all
```

### 4.4 マイグレーション失敗時の復旧

```bash
# マイグレーションが途中で失敗した場合

# 1. エラーログを確認
npm run migrate:status

# 2. DBの状態を確認
sqlite3 backend/itsm_nexus.db ".tables"
sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"

# 3. 不完全なテーブルが残っている場合、手動で削除
# *** 注意: テーブル名は実際のエラー内容に応じて変更 ***
# sqlite3 backend/itsm_nexus.db "DROP TABLE IF EXISTS <incomplete_table>;"

# 4. マイグレーションロック解除（ロックが残っている場合）
sqlite3 backend/itsm_nexus.db "DELETE FROM knex_migrations_lock WHERE is_locked = 1;"

# 5. ロールバックを再試行
npm run migrate:rollback
```

### 4.5 バックアップからの直接復元（最終手段）

```bash
# マイグレーションのロールバックが不可能な場合

# 1. サービス停止
sudo systemctl stop itsm-sec-nexus

# 2. 破損したDBを退避
mv backend/itsm_nexus.db backend/itsm_nexus_broken_$(date +%Y%m%d_%H%M%S).db

# 3. バックアップから復元
./scripts/restore.sh backend/backups/daily/itsm_nexus_daily_YYYYMMDD_HHMMSS.db
# または
cp backend/backups/itsm_nexus_pre_rollback_YYYYMMDD_HHMMSS.db backend/itsm_nexus.db

# 4. サービス再起動
sudo systemctl start itsm-sec-nexus
```

#### 注意事項

- ロールバック前に必ずDBバックアップを取得する
- `migrate:rollback --all` は全データ消失の危険があるため本番では使用禁止
- マイグレーションに `down()` 関数が未実装の場合、ロールバックは失敗する
- データ移行を伴うマイグレーションでは、ロールバックしてもデータは元に戻らない場合がある

#### 検証方法

```bash
# 1. マイグレーション状態が期待通りか確認
npm run migrate:status

# 2. DB整合性チェック
sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"

# 3. テーブル一覧が期待通りか確認
sqlite3 backend/itsm_nexus.db ".tables"

# 4. アプリケーション起動・ヘルスチェック
npm start &
sleep 5
curl http://localhost:5000/api/v1/health

# 5. テスト実行
npm test
```

---

## 5. 手順3: systemd サービス ロールバック

### 5.1 概要

ITSM-Sec Nexus は systemd サービス（`itsm-sec-nexus` または `itsm-sec-nexus-prod`）として稼働しています。
デプロイ後にサービスが正常に起動しない場合のロールバック手順です。

#### フローチャート

```
systemd サービスに問題発生
│
├─ サービスが起動しない？
│  ├─ YES ─┐
│  └─ NO ──┤
│           │
├─ 1. サービス状態・ログを確認
│     sudo systemctl status itsm-sec-nexus
│     sudo journalctl -u itsm-sec-nexus -n 100
│
├─ 原因判定
│  ├─ コード起因 → [手順1: Git ロールバック] へ
│  ├─ 設定ファイル起因 → 設定ファイル復元
│  ├─ 環境変数起因 → .env ファイル修正
│  └─ 依存関係起因 → npm install 再実行
│
├─ 2. 以前のバージョンに切り戻し
│     git checkout <previous-tag>
│     npm install
│
├─ 3. サービス再起動
│     sudo systemctl restart itsm-sec-nexus
│
└─ 4. 動作確認
      curl -k https://localhost:6443/api/v1/health
```

### 5.2 サービス状態確認

```bash
# サービスの現在の状態を確認
sudo systemctl status itsm-sec-nexus

# 直近のサービスログを確認
sudo journalctl -u itsm-sec-nexus -n 100 --no-pager

# エラーのみ表示
sudo journalctl -u itsm-sec-nexus -p err --since "1 hour ago"

# サービスが最後に再起動された理由を確認
sudo systemctl show itsm-sec-nexus --property=Result,ExecMainStatus,ActiveState
```

### 5.3 サービスの停止とロールバック

```bash
# 1. サービスを停止
sudo systemctl stop itsm-sec-nexus

# 2. 停止を確認
sudo systemctl status itsm-sec-nexus
# "Active: inactive (dead)" であることを確認

# 3. 以前の安定バージョンに切り替え
cd /mnt/LinuxHDD/ITSM-System
git log --oneline --tags -10  # タグ一覧を確認
git checkout v<前回の安定バージョン>  # 例: git checkout v1.2.3

# 4. 依存関係を再インストール
npm install

# 5. サービスを再起動
sudo systemctl start itsm-sec-nexus

# 6. 起動確認
sudo systemctl status itsm-sec-nexus
# "Active: active (running)" であることを確認
```

### 5.4 設定ファイル関連のロールバック

```bash
# .env ファイルが破損した場合
# 1. バックアップから復元
cp .env.production.bak .env.production

# 2. systemd サービスファイルが変更された場合
# サービスファイルの内容を確認
cat /etc/systemd/system/itsm-sec-nexus.service

# 3. サービスファイルを再インストール
sudo ./install-service.sh

# 4. systemd デーモンをリロード
sudo systemctl daemon-reload

# 5. サービスを再起動
sudo systemctl restart itsm-sec-nexus
```

### 5.5 依存関係のロールバック

```bash
# node_modules が破損した場合

# 1. node_modules を削除して再インストール
rm -rf node_modules
npm ci  # package-lock.json に基づいて厳密にインストール

# 2. サービスを再起動
sudo systemctl restart itsm-sec-nexus
```

#### 注意事項

- サービス停止中はユーザーがシステムにアクセスできないため、事前通知を推奨
- `git checkout` でタグに切り替えると detached HEAD 状態になるので注意
- `.env.production` のバックアップを定期的に取得しておくこと
- `npm ci` は `npm install` より厳密で、本番環境に推奨

#### 検証方法

```bash
# 1. サービス状態確認
sudo systemctl status itsm-sec-nexus

# 2. ヘルスチェック
curl -k https://localhost:6443/api/v1/health

# 3. 詳細ヘルスチェック
curl -k https://localhost:6443/api/v1/health/ready

# 4. ログにエラーがないことを確認
sudo journalctl -u itsm-sec-nexus -n 50 --no-pager | grep -i error

# 5. Webブラウザでフロントエンドにアクセスして動作確認
# https://192.168.0.187:6443/
```

---

## 6. 手順4: GitHub Release ロールバック

### 6.1 概要

CD パイプライン（`.github/workflows/cd.yml`）が自動作成した GitHub Release に問題がある場合のロールバック手順です。

#### フローチャート

```
GitHub Release に問題がある
│
├─ リリースノートの誤り？
│  └─ Release を編集して修正
│
├─ バージョン番号の誤り？
│  ├─ 1. 誤った Release を削除
│  ├─ 2. 誤ったタグを削除
│  ├─ 3. package.json のバージョンを修正
│  ├─ 4. 正しいタグで再作成
│  └─ 5. CD パイプラインを手動実行（必要な場合）
│
└─ リリース自体を取り消し？
   ├─ 1. Release を削除
   ├─ 2. タグを削除
   └─ 3. package.json のバージョンを戻す
```

### 6.2 リリースノートの修正（軽微な誤り）

```bash
# GitHub CLI でリリースを編集
gh release edit v1.2.3 --notes "修正後のリリースノート内容"

# または、タイトルの変更
gh release edit v1.2.3 --title "Release v1.2.3 (修正版)"
```

### 6.3 リリースの削除と再作成

```bash
# 1. 問題のリリースを確認
gh release view v1.2.3

# 2. リリースを削除（タグは残る）
gh release delete v1.2.3 --yes

# 3. リモートタグを削除
git push --delete origin v1.2.3

# 4. ローカルタグを削除
git tag -d v1.2.3

# 5. package.json のバージョンを前のバージョンに戻す
# 例: 1.2.3 → 1.2.2 に戻す
cd /mnt/LinuxHDD/ITSM-System
npm version 1.2.2 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: バージョンを v1.2.2 に戻す（v1.2.3 リリース取り消し）"
git push origin main
```

### 6.4 正しいバージョンで再リリース

```bash
# 1. CD パイプラインを手動実行して正しいバージョンでリリース
# GitHub Actions の workflow_dispatch を使用
gh workflow run cd.yml --field version_bump=patch
# patch / minor / major を適切に選択

# 2. または手動でタグとリリースを作成
NEW_VERSION="1.2.3"
git tag -a "v$NEW_VERSION" -m "Release version $NEW_VERSION"
git push origin "v$NEW_VERSION"

gh release create "v$NEW_VERSION" \
  --title "Release v$NEW_VERSION" \
  --notes "## 変更内容
- [変更内容を記載]

## インストール方法
\`\`\`bash
git clone https://github.com/your-org/ITSM-System.git
cd ITSM-System
git checkout v$NEW_VERSION
npm install
npm run migrate:latest
npm start
\`\`\`"
```

### 6.5 リリースを Draft に変更（一時的な非公開）

```bash
# リリースを draft 状態に変更（公開を一時停止）
gh release edit v1.2.3 --draft

# 問題解決後に公開に戻す
gh release edit v1.2.3 --draft=false
```

#### 注意事項

- リリースを削除しても、そのバージョンをインストール済みのユーザーには影響しない
- タグ削除後に同じタグ名で再作成すると、キャッシュの問題が発生する場合がある
- CD パイプラインが自動でバージョンを判定するため、手動操作後は package.json のバージョンを正確に管理すること
- 既に他のユーザーやシステムが参照しているタグを削除する場合は事前に通知すること

#### 検証方法

```bash
# 1. リリース一覧を確認
gh release list --limit 5

# 2. 最新リリースの内容を確認
gh release view --json tagName,name,isDraft,isPrerelease

# 3. タグ一覧を確認
git tag --list -n1 | tail -5

# 4. package.json のバージョンを確認
node -p "require('./package.json').version"

# 5. リモートのタグとローカルのタグが一致しているか確認
git fetch --tags
git tag --list | sort -V | tail -5
```

---

## 7. 統合ロールバック手順（フルロールバック）

パフォーマンス劣化や複合的な問題で、コード・DB・サービスすべてをロールバックする必要がある場合の統合手順です。

### 7.1 フローチャート

```
フルロールバック開始
│
├─ Step 1: 事前準備
│  ├─ 現在のDBバックアップを取得
│  ├─ 現在のHEADコミットを記録
│  └─ 関係者に通知
│
├─ Step 2: サービス停止
│  └─ sudo systemctl stop itsm-sec-nexus
│
├─ Step 3: DB ロールバック
│  ├─ マイグレーションロールバック
│  └─ または バックアップからの復元
│
├─ Step 4: コード ロールバック
│  ├─ git revert（推奨）
│  └─ または git checkout <previous-tag>
│
├─ Step 5: 依存関係の復元
│  └─ npm ci
│
├─ Step 6: サービス起動
│  └─ sudo systemctl start itsm-sec-nexus
│
├─ Step 7: 検証
│  ├─ ヘルスチェック
│  ├─ 機能確認
│  └─ ログ確認
│
└─ Step 8: 事後対応
   ├─ 関係者に復旧通知
   ├─ GitHub Release を Draft に変更
   └─ インシデント記録
```

### 7.2 手順

```bash
# ============================================================
# Step 1: 事前準備
# ============================================================

cd /mnt/LinuxHDD/ITSM-System

# 現在のコミットを記録
echo "Rollback started at $(date)" > /tmp/rollback_log.txt
echo "Current HEAD: $(git rev-parse HEAD)" >> /tmp/rollback_log.txt
echo "Current version: $(node -p "require('./package.json').version")" >> /tmp/rollback_log.txt

# 現在のDBをバックアップ
cp backend/itsm_nexus.db "backend/backups/itsm_nexus_pre_fullrollback_$(date +%Y%m%d_%H%M%S).db"

# ============================================================
# Step 2: サービス停止
# ============================================================

sudo systemctl stop itsm-sec-nexus
sudo systemctl status itsm-sec-nexus  # inactive (dead) を確認

# ============================================================
# Step 3: DB ロールバック
# ============================================================

# 方法A: マイグレーションロールバック（推奨）
npm run migrate:rollback

# 方法B: バックアップからの復元（マイグレーションロールバック失敗時）
# ./scripts/restore.sh backend/backups/daily/itsm_nexus_daily_YYYYMMDD_HHMMSS.db

# ============================================================
# Step 4: コード ロールバック
# ============================================================

# 前回のリリースタグを確認
git tag --list --sort=-version:refname | head -5

# 前回の安定バージョンに戻す
git revert --no-commit HEAD
git commit -m "revert: フルロールバック - [理由を記載]"

# ============================================================
# Step 5: 依存関係の復元
# ============================================================

npm ci

# ============================================================
# Step 6: サービス起動
# ============================================================

sudo systemctl start itsm-sec-nexus

# ============================================================
# Step 7: 検証（次セクション参照）
# ============================================================

# ヘルスチェック
curl -k https://localhost:6443/api/v1/health

# ============================================================
# Step 8: 事後対応
# ============================================================

# GitHub Release を Draft に変更（問題のバージョン）
# gh release edit v<問題のバージョン> --draft

# ロールバックログを保存
echo "Rollback completed at $(date)" >> /tmp/rollback_log.txt
cat /tmp/rollback_log.txt
```

---

## 8. 検証チェックリスト

ロールバック後に必ず以下の検証を行ってください。

### 8.1 基本検証（全ロールバック共通）

| No. | 検証項目 | コマンド | 期待結果 |
|-----|---------|---------|---------|
| 1 | サービス稼働 | `sudo systemctl status itsm-sec-nexus` | Active: active (running) |
| 2 | ヘルスチェック | `curl -k https://localhost:6443/api/v1/health` | `{"status":"ok"}` |
| 3 | 詳細ヘルスチェック | `curl -k https://localhost:6443/api/v1/health/ready` | DB connected |
| 4 | エラーログなし | `sudo journalctl -u itsm-sec-nexus -p err --since "10 min ago"` | エラーなし |
| 5 | DB整合性 | `sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"` | ok |

### 8.2 機能検証

| No. | 検証項目 | 手順 | 期待結果 |
|-----|---------|------|---------|
| 1 | ログイン | ブラウザでログイン | 正常にログインできる |
| 2 | ダッシュボード | ダッシュボードを開く | KPI/チャートが表示される |
| 3 | インシデント一覧 | インシデント管理を開く | データが正常に表示される |
| 4 | API応答 | `curl -k https://localhost:6443/api/v1/health` | 200 OK |

### 8.3 検証スクリプト

```bash
#!/bin/bash
# ロールバック後の自動検証スクリプト
echo "=== ロールバック後検証 ==="

# 1. サービス状態
echo "[1/5] サービス状態..."
if sudo systemctl is-active itsm-sec-nexus > /dev/null 2>&1; then
  echo "  PASS: サービス稼働中"
else
  echo "  FAIL: サービスが停止しています"
fi

# 2. ヘルスチェック
echo "[2/5] ヘルスチェック..."
HEALTH=$(curl -sk https://localhost:6443/api/v1/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status"'; then
  echo "  PASS: ヘルスチェック正常"
else
  echo "  FAIL: ヘルスチェック失敗"
fi

# 3. DB整合性
echo "[3/5] DB整合性チェック..."
INTEGRITY=$(sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;" 2>/dev/null)
if [ "$INTEGRITY" = "ok" ]; then
  echo "  PASS: DB整合性OK"
else
  echo "  FAIL: DB整合性エラー: $INTEGRITY"
fi

# 4. エラーログ
echo "[4/5] エラーログ確認..."
ERROR_COUNT=$(sudo journalctl -u itsm-sec-nexus -p err --since "10 min ago" --no-pager 2>/dev/null | wc -l)
if [ "$ERROR_COUNT" -le 1 ]; then
  echo "  PASS: エラーログなし"
else
  echo "  WARN: $ERROR_COUNT 件のエラーログ"
fi

# 5. バージョン確認
echo "[5/5] バージョン確認..."
VERSION=$(node -p "require('/mnt/LinuxHDD/ITSM-System/package.json').version" 2>/dev/null)
echo "  INFO: 現在のバージョン: v$VERSION"

echo "=== 検証完了 ==="
```

---

## 付録

### A. 緊急連絡先

| 役割 | 連絡先 | 対応時間 |
|------|--------|---------|
| 運用担当者 | ops@example.com | 24/7 |
| システム管理者 | admin@example.com | 24/7 |
| ITマネージャー | manager@example.com | 平日 9:00-18:00 |

### B. 関連ドキュメント

| ドキュメント | パス |
|-------------|------|
| CI/CDガイド | `Docs/CI_CD_GUIDE.md` |
| デプロイメントガイド | `Docs/デプロイメントガイド.md` |
| ディザスタリカバリ Runbook | `docs-prod/DISASTER_RECOVERY.md` |
| バックアップ運用ガイド | `docs-prod/BACKUP_OPERATIONS.md` |
| systemd サービスガイド | `docs-prod/SYSTEMD_SERVICE.md` |
| CD パイプライン定義 | `.github/workflows/cd.yml` |
| デプロイチェックリスト | `docs-prod/DEPLOYMENT_CHECKLIST.md` |

### C. バージョン履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-02-14 | 1.0 | 初版作成 |

---

**ITSM-Sec Nexus Team**
