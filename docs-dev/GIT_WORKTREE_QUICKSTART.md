# Git Worktree クイックスタートガイド

## 5分で始めるGit Worktree

### 基本コマンド

#### 1. 新しいfeatureブランチで作業を開始

```bash
# スクリプトを使用（推奨）
./scripts/git/git-worktree-setup.sh feature/new-dashboard

# または、Gitコマンド直接使用
git worktree add -b feature/new-dashboard ../ITSM-System-new-dashboard main
```

#### 2. 作業ディレクトリに移動

```bash
cd ../ITSM-System-new-dashboard
```

#### 3. 通常通り開発

```bash
npm install  # 必要に応じて
npm run dev
git add .
git commit -m "feat: ダッシュボード追加"
git push -u origin feature/new-dashboard
```

#### 4. 作業完了後、Worktreeを削除

```bash
cd ../ITSM-System
./scripts/git/git-worktree-remove.sh ITSM-System-new-dashboard -b
```

### よくあるシナリオ

#### 緊急バグ修正（現在の作業を中断せずに）

```bash
# 1. hotfixブランチを作成
./scripts/git/git-worktree-setup.sh hotfix/critical-fix

# 2. hotfix作業
cd ../ITSM-System-critical-fix
vim backend/some-file.js
npm test
git add .
git commit -m "fix: 重大なバグを修正"
git push -u origin hotfix/critical-fix

# 3. PR作成
gh pr create --title "Hotfix: 重大なバグ修正" --base main

# 4. マージ後、Worktreeを削除
cd ../ITSM-System
./scripts/git/git-worktree-remove.sh ITSM-System-critical-fix -b

# 5. 元の作業に戻る（中断していない！）
cd ../ITSM-System-feature-dashboard
```

#### PRレビュー用にリモートブランチをチェックアウト

```bash
# 1. リモートブランチをチェックアウト
./scripts/git/git-worktree-setup.sh feature/pr-123 -r

# 2. 動作確認
cd ../ITSM-System-pr-123
npm install
npm run dev
# ブラウザでテスト...

# 3. レビュー完了後、削除
cd ../ITSM-System
./scripts/git/git-worktree-remove.sh ITSM-System-pr-123
```

#### 複数環境で同時テスト

```bash
# 1. developブランチのWorktreeを作成
./scripts/git/git-worktree-setup.sh develop -r

# 2. 異なるターミナルでそれぞれ起動
# Terminal 1 (main)
cd /mnt/LinuxHDD/ITSM-System
PORT=5443 npm run dev

# Terminal 2 (develop)
cd /mnt/LinuxHDD/ITSM-System-dev
PORT=5444 npm run dev

# 3. 同時に動作確認
# http://localhost:5443 (main)
# http://localhost:5444 (develop)
```

### Worktree一覧確認

```bash
# シンプル表示
./scripts/git/git-worktree-list.sh

# 詳細表示（コミット情報、変更状態、ディスク使用量）
./scripts/git/git-worktree-list.sh -v

# JSON形式で出力
./scripts/git/git-worktree-list.sh -j
```

### トラブルシューティング

#### 変更があって削除できない

```bash
# 変更を確認
cd ITSM-System-feature
git status

# オプション1: コミットする
git add .
git commit -m "WIP: 作業中の変更を保存"

# オプション2: 強制削除
./scripts/git/git-worktree-remove.sh ITSM-System-feature -f
```

#### ポートが競合する

各Worktreeで異なるポートを使用：

```bash
# .env.development を編集
PORT=5443  # メインWorktree
PORT=5444  # 2つ目のWorktree
PORT=5445  # 3つ目のWorktree
```

#### node_modulesが見つからない

```bash
# オプション1: シンボリックリンクを作成
ln -s /mnt/LinuxHDD/ITSM-System/node_modules worktree/node_modules

# オプション2: 個別にインストール
cd worktree
npm install
```

### ベストプラクティス

1. **命名規則を守る**: `ITSM-System-<feature-name>`
2. **定期的にクリーンアップ**: 不要なWorktreeは削除
3. **node_modulesは共有**: ディスク容量を節約
4. **環境変数を分離**: ポート競合を避ける
5. **変更をコミット**: 削除前に必ず変更をコミット

### チートシート

```bash
# Worktree作成
./scripts/git/git-worktree-setup.sh <branch-name>

# Worktree一覧
./scripts/git/git-worktree-list.sh

# Worktree削除
./scripts/git/git-worktree-remove.sh <worktree-name>

# Worktree同期
./scripts/git/git-worktree-sync.sh

# リモートブランチをチェックアウト
./scripts/git/git-worktree-setup.sh <branch-name> -r

# Worktreeとブランチを同時削除
./scripts/git/git-worktree-remove.sh <worktree-name> -b

# 強制削除
./scripts/git/git-worktree-remove.sh <worktree-name> -f

# 確認なしで削除
./scripts/git/git-worktree-remove.sh <worktree-name> -y
```

## 詳細情報

完全なガイドは **[GIT_WORKTREE_GUIDE.md](GIT_WORKTREE_GUIDE.md)** を参照してください。

---

**作成者:** ITSM-Sec Nexus開発チーム
**最終更新:** 2026-01-31
