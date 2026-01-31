# Git Worktree 使用ガイド

## 目次

1. [概要](#概要)
2. [Git Worktreeとは](#git-worktreeとは)
3. [メリット](#メリット)
4. [環境構成](#環境構成)
5. [基本的な使い方](#基本的な使い方)
6. [提供スクリプト](#提供スクリプト)
7. [ワークフロー例](#ワークフロー例)
8. [ベストプラクティス](#ベストプラクティス)
9. [トラブルシューティング](#トラブルシューティング)
10. [よくある質問](#よくある質問)

---

## 概要

Git Worktreeは、単一のGitリポジトリで複数の作業ディレクトリを同時に管理できる強力な機能です。
ITSM-Sec Nexusプロジェクトでは、この機能を活用して効率的な並行開発環境を提供します。

## Git Worktreeとは

Git Worktreeは、同じリポジトリの異なるブランチを別々のディレクトリで同時にチェックアウトできる機能です。

### 従来の方法との違い

**従来の方法（ブランチ切り替え）:**
```bash
git checkout feature-a    # 作業中...
git checkout main         # feature-aの作業を中断
git checkout feature-b    # 別の作業...
```

**Worktreeを使う方法:**
```bash
# 各ブランチが独立したディレクトリに
/path/to/ITSM-System/          # mainブランチ
/path/to/ITSM-System-feature-a/ # feature-aブランチ
/path/to/ITSM-System-feature-b/ # feature-bブランチ
```

## メリット

### 1. 並行作業が可能
- 複数のブランチで同時に作業できる
- ブランチ切り替えによる作業の中断がない
- それぞれのディレクトリで独立してテストやビルドが可能

### 2. ディスク容量の節約
- 同じリポジトリを複数クローンする必要がない
- `.git`ディレクトリは共有される（ただし作業ツリーは独立）

### 3. 緊急対応に強い
- 急な本番障害対応でもfeatureブランチの作業を中断しない
- hotfixブランチを別Worktreeで作成し、即座に対応可能

### 4. レビューが容易
- PRレビュー用のWorktreeを作成して実際に動作確認
- メインの作業環境に影響を与えない

### 5. テスト環境の分離
- 統合テスト用のWorktreeを作成
- 開発環境とテスト環境を完全に分離

## 環境構成

### ディレクトリ構造例

```
/mnt/LinuxHDD/
├── ITSM-System/                    # メインWorktree (mainブランチ)
│   ├── .git/                       # Gitリポジトリ本体
│   ├── backend/
│   ├── frontend/
│   └── scripts/
│       └── git/                    # Worktree管理スクリプト
│           ├── git-worktree-setup.sh
│           ├── git-worktree-list.sh
│           ├── git-worktree-remove.sh
│           └── git-worktree-sync.sh
│
├── ITSM-System-dev/                # developブランチ
│   ├── .git -> /mnt/.../ITSM-System/.git/worktrees/ITSM-System-dev
│   ├── backend/
│   └── frontend/
│
├── ITSM-System-feature-dashboard/  # feature/dashboardブランチ
│   ├── .git -> /mnt/.../ITSM-System/.git/worktrees/ITSM-System-feature-dashboard
│   ├── backend/
│   └── frontend/
│
└── ITSM-System-hotfix-critical/    # hotfix/criticalブランチ
    ├── .git -> /mnt/.../ITSM-System/.git/worktrees/ITSM-System-hotfix-critical
    ├── backend/
    └── frontend/
```

### Worktree命名規則

```
<プロジェクト名>-<ブランチ名>

例:
- ITSM-System-dev              (developブランチ)
- ITSM-System-feature-dashboard (feature/dashboardブランチ)
- ITSM-System-hotfix-auth      (hotfix/authブランチ)
```

## 基本的な使い方

### Gitコマンドでの操作

#### Worktreeを作成
```bash
# 新しいブランチを作成してWorktreeに追加
git worktree add -b feature/new-feature ../ITSM-System-new-feature main

# 既存のブランチをWorktreeに追加
git worktree add ../ITSM-System-develop develop

# リモートブランチをチェックアウト
git worktree add ../ITSM-System-feature ../origin/feature/some-feature
```

#### Worktree一覧を表示
```bash
git worktree list
```

#### Worktreeを削除
```bash
# Worktreeを削除（ブランチは残る）
git worktree remove ../ITSM-System-feature

# 強制削除（変更があっても削除）
git worktree remove --force ../ITSM-System-feature
```

#### Worktreeを修復
```bash
# Worktreeのメタデータを修復
git worktree repair
```

#### 不要なWorktreeをクリーンアップ
```bash
git worktree prune
```

## 提供スクリプト

ITSM-Sec Nexusプロジェクトでは、Worktree管理を簡単にするスクリプトを提供しています。

### 1. git-worktree-setup.sh

新しいWorktreeを作成するスクリプト。

#### 基本的な使い方
```bash
# 新しいfeatureブランチでWorktreeを作成
./scripts/git/git-worktree-setup.sh feature/new-dashboard

# 既存のリモートブランチをチェックアウト
./scripts/git/git-worktree-setup.sh feature/security-dashboard -r

# カスタム名でWorktreeを作成
./scripts/git/git-worktree-setup.sh hotfix/critical-bug hotfix-urgent

# developブランチをベースに作成
./scripts/git/git-worktree-setup.sh feature/new-feature -b develop
```

#### オプション
- `-b, --base <branch>`: ベースブランチを指定（デフォルト: main）
- `-p, --path <path>`: Worktreeの親ディレクトリを指定
- `-r, --remote`: リモートブランチをチェックアウト
- `-h, --help`: ヘルプを表示

#### 自動実行される処理
1. Worktreeの作成
2. `.env.development`のコピー
3. `node_modules`のシンボリックリンク作成（オプション）

### 2. git-worktree-list.sh

Worktree一覧を表示するスクリプト。

#### 基本的な使い方
```bash
# 標準表示
./scripts/git/git-worktree-list.sh

# 詳細表示
./scripts/git/git-worktree-list.sh -v

# JSON形式で出力
./scripts/git/git-worktree-list.sh -j
```

#### オプション
- `-v, --verbose`: 詳細情報を表示（コミット情報、変更状態など）
- `-j, --json`: JSON形式で出力
- `-s, --simple`: シンプルな一覧表示（デフォルト）
- `-h, --help`: ヘルプを表示

### 3. git-worktree-remove.sh

Worktreeを削除するスクリプト。

#### 基本的な使い方
```bash
# Worktreeを削除
./scripts/git/git-worktree-remove.sh ITSM-System-dev

# 強制削除（変更があっても削除）
./scripts/git/git-worktree-remove.sh ITSM-System-dev -f

# Worktreeとブランチを削除
./scripts/git/git-worktree-remove.sh ITSM-System-dev -b

# 確認なしで削除
./scripts/git/git-worktree-remove.sh ITSM-System-dev -y
```

#### オプション
- `-f, --force`: 強制削除（変更があっても削除）
- `-b, --branch`: ブランチも削除
- `-y, --yes`: 確認をスキップ
- `-h, --help`: ヘルプを表示

### 4. git-worktree-sync.sh

Worktreeをリモートと同期するスクリプト。

#### 基本的な使い方
```bash
# 全Worktreeをフェッチ
./scripts/git/git-worktree-sync.sh

# 全Worktreeをプル
./scripts/git/git-worktree-sync.sh -p

# 特定のWorktreeをプル
./scripts/git/git-worktree-sync.sh /path/to/worktree -p

# Worktreeを修復
./scripts/git/git-worktree-sync.sh -r
```

#### オプション
- `-p, --pull`: リモートから変更をプル
- `-f, --fetch`: リモートから情報をフェッチのみ（デフォルト）
- `-r, --repair`: Worktreeを修復
- `-h, --help`: ヘルプを表示

## ワークフロー例

### 例1: 新機能開発

```bash
# 1. 新しいfeatureブランチでWorktreeを作成
./scripts/git/git-worktree-setup.sh feature/user-dashboard

# 2. Worktreeに移動
cd ../ITSM-System-user-dashboard

# 3. 開発作業
npm install  # 必要に応じて
npm run dev

# 4. コミット
git add .
git commit -m "feat: ユーザーダッシュボードを追加"

# 5. プッシュ
git push -u origin feature/user-dashboard

# 6. 作業完了後、Worktreeを削除
cd ../ITSM-System
./scripts/git/git-worktree-remove.sh ITSM-System-user-dashboard -b
```

### 例2: 緊急バグ修正（hotfix）

```bash
# 1. メインの作業を中断せずhotfixブランチを作成
./scripts/git/git-worktree-setup.sh hotfix/critical-security-fix

# 2. hotfix Worktreeに移動
cd ../ITSM-System-critical-security-fix

# 3. バグ修正
vim backend/middleware/auth.js

# 4. テスト
npm test

# 5. コミット＆プッシュ
git add .
git commit -m "fix: 重大なセキュリティ脆弱性を修正"
git push -u origin hotfix/critical-security-fix

# 6. PR作成
gh pr create --title "Hotfix: 重大なセキュリティ脆弱性修正" --body "..."

# 7. マージ後、Worktreeを削除
cd ../ITSM-System
./scripts/git/git-worktree-remove.sh ITSM-System-critical-security-fix -b
```

### 例3: PRレビュー

```bash
# 1. レビュー対象のPRブランチをチェックアウト
./scripts/git/git-worktree-setup.sh feature/security-dashboard -r

# 2. Worktreeに移動
cd ../ITSM-System-security-dashboard

# 3. 動作確認
npm install
npm run dev

# 4. コードレビュー
# エディタで確認...

# 5. レビュー完了後、Worktreeを削除
cd ../ITSM-System
./scripts/git/git-worktree-remove.sh ITSM-System-security-dashboard
```

### 例4: 複数バージョンのテスト

```bash
# 1. 本番環境（main）とステージング環境（develop）を同時にテスト
./scripts/git/git-worktree-setup.sh develop -r

# 2. それぞれのWorktreeで並行してテスト
# Terminal 1
cd /mnt/LinuxHDD/ITSM-System  # main
npm run test:e2e

# Terminal 2
cd /mnt/LinuxHDD/ITSM-System-dev  # develop
npm run test:e2e

# 3. 比較・検証
diff -r ITSM-System/backend ITSM-System-dev/backend
```

## ベストプラクティス

### 1. Worktree命名規則

- **必ず接頭辞を付ける**: `ITSM-System-` を接頭辞として使用
- **ブランチタイプを含める**: `feature-`, `hotfix-`, `bugfix-` など
- **短く明確に**: 長すぎる名前は避ける

```bash
# Good
ITSM-System-feature-dashboard
ITSM-System-hotfix-auth
ITSM-System-bugfix-api

# Bad
ITSM-System-this-is-a-very-long-feature-name-that-adds-dashboard
dashboard  # 接頭辞がない
```

### 2. node_modulesの管理

大きな`node_modules`は各Worktreeで共有することを推奨します。

```bash
# セットアップ時にシンボリックリンクを作成（自動で確認される）
ln -s /mnt/LinuxHDD/ITSM-System/node_modules /path/to/worktree/node_modules
```

**注意事項:**
- 依存関係が異なるブランチでは個別にインストールが必要
- パッケージのバージョンが大きく異なる場合は共有しない

### 3. 環境変数の管理

各Worktreeで独立した環境変数を使用する場合:

```bash
# .env.developmentをコピー（自動で実行される）
cp ITSM-System/config/env/.env.development worktree/config/env/

# ポート番号を変更（競合を避けるため）
# worktree/.env.development
PORT=5444  # メインは5443
```

### 4. 定期的なクリーンアップ

不要なWorktreeは定期的に削除しましょう。

```bash
# Worktree一覧を確認
./scripts/git/git-worktree-list.sh

# 不要なWorktreeを削除
./scripts/git/git-worktree-remove.sh ITSM-System-old-feature -b

# クリーンアップ
git worktree prune
```

### 5. Worktreeの同期

定期的にリモートと同期しましょう。

```bash
# 全Worktreeをフェッチ
./scripts/git/git-worktree-sync.sh

# 特定のWorktreeをプル
./scripts/git/git-worktree-sync.sh /path/to/worktree -p
```

### 6. バックアップ

重要な作業中のWorktreeはバックアップを取りましょう。

```bash
# Worktree全体をバックアップ
tar -czf ITSM-System-feature-backup.tar.gz ITSM-System-feature-dashboard/

# データベースもバックアップ
cp ITSM-System-feature-dashboard/backend/itsm_nexus.db backup/
```

## トラブルシューティング

### 問題1: Worktreeが削除できない

**症状:**
```bash
$ git worktree remove ITSM-System-dev
fatal: 'ITSM-System-dev' contains modified or untracked files, use --force to delete it
```

**解決方法:**
```bash
# 変更を確認
cd ITSM-System-dev
git status

# 変更をコミットまたは破棄
git add .
git commit -m "WIP: 作業中の変更を保存"

# または強制削除
git worktree remove --force ITSM-System-dev
```

### 問題2: Worktreeのパスが壊れている

**症状:**
```bash
$ git worktree list
/path/to/ITSM-System  abcd123 [main]
/path/to/missing      0000000 [feature/old]  (prunable)
```

**解決方法:**
```bash
# Worktreeを修復
git worktree repair

# 不要なWorktreeをクリーンアップ
git worktree prune
```

### 問題3: ブランチが既に別のWorktreeでチェックアウトされている

**症状:**
```bash
$ git worktree add ../ITSM-System-dev develop
fatal: 'develop' is already checked out at '/path/to/ITSM-System-dev'
```

**解決方法:**
```bash
# 既存のWorktreeを確認
git worktree list

# 既存のWorktreeを削除するか、別のブランチを使用
git worktree remove /path/to/ITSM-System-dev
```

### 問題4: node_modulesのシンボリックリンクが動作しない

**症状:**
モジュールが見つからないエラーが発生する。

**解決方法:**
```bash
# シンボリックリンクを削除
rm -f worktree/node_modules

# 個別にインストール
cd worktree
npm install
```

### 問題5: ポート競合

**症状:**
複数のWorktreeで開発サーバーを起動すると競合する。

**解決方法:**
```bash
# 各Worktreeで異なるポートを使用
# ITSM-System/.env.development
PORT=5443

# ITSM-System-dev/.env.development
PORT=5444

# ITSM-System-feature/.env.development
PORT=5445
```

## よくある質問

### Q1: Worktreeとブランチの違いは？

**A:** ブランチはGitの履歴管理の単位で、Worktreeは作業ディレクトリの単位です。
一つのWorktreeで一つのブランチをチェックアウトできます。

### Q2: Worktreeを作成するとディスク容量は倍になる？

**A:** いいえ。`.git`ディレクトリは共有されるため、作業ツリー分のみ増加します。
通常、元のリポジトリの30-50%程度のディスク容量増加です。

### Q3: Worktreeで作業した変更は他のWorktreeに影響する？

**A:** いいえ。各Worktreeは独立しています。ただし、コミットやプッシュは共有されます。

### Q4: 何個までWorktreeを作成できる？

**A:** 技術的な制限はありませんが、実用的には5-10個程度が管理しやすいです。

### Q5: Worktreeを削除するとブランチも削除される？

**A:** いいえ。`git worktree remove`ではブランチは削除されません。
`-b`オプションを使用するか、`git branch -d`で別途削除する必要があります。

### Q6: リモートブランチをWorktreeでチェックアウトできる？

**A:** はい。`-r`オプションを使用してください。

```bash
./scripts/git/git-worktree-setup.sh feature/remote-branch -r
```

### Q7: Worktreeでgit stashは使える？

**A:** はい。各Worktreeで独立してgit stashが使えます。

### Q8: CIでWorktreeを使える？

**A:** 可能ですが、通常はシャローコピーやクローンの方が効率的です。
Worktreeは主にローカル開発環境での使用を想定しています。

### Q9: Worktreeのバックアップは必要？

**A:** コミットしていない変更は各Worktreeに保存されるため、
重要な作業中の場合はバックアップを推奨します。

### Q10: Worktreeを別のマシンに移動できる？

**A:** リポジトリ全体（メインWorktree含む）を移動すれば可能ですが、
個別のWorktreeのみの移動は推奨されません。

---

## 参考リンク

- [Git公式ドキュメント - git-worktree](https://git-scm.com/docs/git-worktree)
- [ITSM-Sec Nexus 開発ガイド](../CLAUDE.md)
- [GitHub Issues](https://github.com/your-org/ITSM-System/issues)

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-01-31 | 1.0.0 | 初版作成 |

---

**作成者:** ITSM-Sec Nexus開発チーム
**最終更新:** 2026-01-31
