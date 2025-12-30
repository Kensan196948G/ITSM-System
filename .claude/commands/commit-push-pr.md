---
allowed-tools: Bash(git:*), Bash(gh:*)
argument-hint: [commit-message]
description: 変更をコミット、プッシュし、プルリクエストを作成
---

# Commit, Push, and Create PR

このコマンドは以下の手順を実行します：
1. 現在のgit状態を確認
2. 変更をコミット（提供されたメッセージで）
3. リモートブランチにプッシュ
4. GitHubプルリクエストを作成

## 実行コンテキスト

現在のブランチ: !`git branch --show-current`

現在の状態: !`git status --short`

最近のコミット: !`git log --oneline -5`

---

## 実行手順

以下の手順を実行してください：

1. **変更を確認**
   - 未コミットの変更があるか確認
   - 必要に応じて`git add`を実行

2. **コミットを作成**
   - コミットメッセージ: $ARGUMENTS
   - CLAUDE.mdのコミットメッセージルールに従う
   - コミットに以下のフッターを含める:
     ```
     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>
     ```

3. **リモートにプッシュ**
   - `git push -u origin [current-branch]`を実行
   - ブランチが追跡されていない場合は`-u`フラグを使用

4. **プルリクエストを作成**
   - `gh pr create`を使用
   - タイトルはコミットメッセージから生成
   - 本文には変更の概要を含める
   - 以下のフォーマットを使用:
     ```
     ## Summary
     [変更の要約]

     ## Test plan
     - [ ] テストが成功することを確認
     - [ ] ESLintエラーがないことを確認
     - [ ] Prettierフォーマットが正しいことを確認

     🤖 Generated with [Claude Code](https://claude.com/claude-code)
     ```

5. **PR URLを返す**
   - 作成されたプルリクエストのURLを表示

## 注意事項

- README.mdは変更しない（CLAUDE.md参照）
- 既存の動作を壊さない
- テストが成功することを確認
