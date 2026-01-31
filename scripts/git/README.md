# Git Worktree管理スクリプト

このディレクトリには、Git Worktreeを効率的に管理するためのスクリプトが含まれています。

## スクリプト一覧

### git-worktree-setup.sh
新しいWorktreeを作成します。

```bash
./git-worktree-setup.sh feature/new-dashboard
./git-worktree-setup.sh feature/security-dashboard -r
./git-worktree-setup.sh hotfix/critical-bug hotfix-urgent
```

### git-worktree-list.sh
Worktree一覧を表示します。

```bash
./git-worktree-list.sh        # 標準表示
./git-worktree-list.sh -v     # 詳細表示
./git-worktree-list.sh -j     # JSON形式
```

### git-worktree-remove.sh
Worktreeを削除します。

```bash
./git-worktree-remove.sh ITSM-System-feature-dashboard
./git-worktree-remove.sh ITSM-System-feature-dashboard -b  # ブランチも削除
./git-worktree-remove.sh ITSM-System-feature-dashboard -f  # 強制削除
```

### git-worktree-sync.sh
Worktreeをリモートと同期します。

```bash
./git-worktree-sync.sh        # 全Worktreeをフェッチ
./git-worktree-sync.sh -p     # 全Worktreeをプル
./git-worktree-sync.sh -r     # Worktreeを修復
```

## ドキュメント

詳細は以下のドキュメントを参照してください:

- **[GIT_WORKTREE_GUIDE.md](../../docs-dev/GIT_WORKTREE_GUIDE.md)** - 包括的な使用ガイド
- **[GIT_WORKTREE_QUICKSTART.md](../../docs-dev/GIT_WORKTREE_QUICKSTART.md)** - クイックスタートガイド
- **[GIT_WORKTREE_SETUP_REPORT.md](../../docs-dev/GIT_WORKTREE_SETUP_REPORT.md)** - 構築レポート

## クイックスタート

```bash
# 1. 新しいfeatureブランチでWorktreeを作成
./git-worktree-setup.sh feature/new-feature

# 2. 作業ディレクトリに移動
cd ../../ITSM-System-new-feature

# 3. 開発作業
npm install
git add .
git commit -m "feat: 新機能追加"

# 4. 作業完了後、Worktreeを削除
cd ../../ITSM-System/scripts/git
./git-worktree-remove.sh ITSM-System-new-feature -b
```

## ヘルプ

各スクリプトは`-h`または`--help`オプションでヘルプを表示できます:

```bash
./git-worktree-setup.sh -h
./git-worktree-list.sh -h
./git-worktree-remove.sh -h
./git-worktree-sync.sh -h
```

---

**作成者:** ITSM-Sec Nexus開発チーム
**最終更新:** 2026-01-31
