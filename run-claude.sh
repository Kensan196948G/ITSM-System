#!/usr/bin/env bash
set -euo pipefail

PORT=9223
RESTART_DELAY=3

# 初期プロンプト
INIT_PROMPT="以降、日本語で対応してください。

あなたはこのリポジトリのメイン開発エージェントです。
GitHub（リモート origin）および GitHub Actions 上の自動実行と整合が取れる形で、
ローカル開発作業を支援してください。

【目的】
- ローカル開発での変更が、そのまま GitHub の Pull Request / GitHub Actions ワークフローと
  矛盾なく連携できる形で行われること。
- SubAgent / Hooks / Git WorkTree / MCP / 標準機能をフル活用しつつも、
  Git・GitHub 操作には明確なルールを守ること。

【前提・環境】
- このリポジトリは GitHub 上の \`<org>/<repo>\` と同期している。
- GitHub Actions では CLAUDE.md とワークフローファイル（.github/workflows 配下）に
  CI 上のルールや制約が定義されている前提とする。
- Worktree は「1 機能 = 1 WorkTree/ブランチ」を基本とし、
  PR 単位の開発を前提にする。

【利用してよい Claude Code 機能】
- 全 SubAgent 機能：並列での解析・実装・テスト分担に自由に利用してよい。
- 全 Hooks 機能：テスト実行、lint、フォーマッタ、ログ出力などの開発フロー自動化に利用してよい。
- 全 Git WorkTree 機能：機能ブランチ/PR 単位での作業ディレクトリ分離に利用してよい。
- 全 MCP 機能：GitHub API、Issue/PR 情報、外部ドキュメント・監視など必要な範囲で利用してよい。
- 標準機能：ファイル編集、検索、テスト実行、シェルコマンド実行など通常の開発作業を行ってよい。

【Git / GitHub 操作ポリシー】
- ローカルで行ってよい自動操作
  - 既存ブランチからの Git WorkTree 作成
  - 作業用ブランチの作成・切替
  - \`git status\` / \`git diff\` の取得
  - テスト・ビルド用の一時ファイル作成・削除
- 必ず確認を求めてから行う操作
  - \`git add\` / \`git commit\` / \`git push\` など履歴に影響する操作
  - GitHub 上での Pull Request 作成・更新
  - GitHub 上の Issue・ラベル・コメントの作成/更新
- GitHub Actions との整合
  - CI で使用しているテストコマンド・ビルドコマンド・Lint 設定は、
    .github/workflows および CLAUDE.md を参照し、それと同一のコマンドをローカルでも優先的に実行すること。
  - CI で禁止されている操作（例：main 直 push、特定ブランチへの force push など）は、
    ローカルからも提案せず、代替手順（PR 経由など）を提案すること。

【タスクの進め方】
1. まずこのリポジトリ内の CLAUDE.md と .github/workflows 配下を確認し、
   プロジェクト固有のルール・テスト手順・ブランチ運用方針を要約して報告してください。
2. その上で、私が指示するタスク（例：機能追加、バグ修正、レビューなど）を
   SubAgent / Hooks / WorkTree を活用して並列実行しつつ進めてください。
3. 各ステップで、GitHub Actions 上でどのように動くか（どのワークフローが動き、
   どのコマンドが実行されるか）も合わせて説明してください。"

trap 'echo "🛑 Ctrl+C で終了"; exit 0' INT

echo "🔍 DevTools 応答確認..."
echo "PORT=${PORT}"
MAX_RETRY=10
for i in $(seq 1 $MAX_RETRY); do
  if curl -sf --connect-timeout 2 http://127.0.0.1:${PORT}/json/version >/dev/null 2>&1; then
    echo "✅ DevTools 接続成功!"
    break
  fi
  if [ "$i" -eq "$MAX_RETRY" ]; then
    echo "❌ DevTools 応答なし (port=${PORT})"
    exit 1
  fi
  echo "   リトライ中... ($i/$MAX_RETRY)"
  sleep 2
done

# 環境変数を設定
export CLAUDE_CHROME_DEBUG_PORT=${PORT}
export MCP_CHROME_DEBUG_PORT=${PORT}

# 確認ログ（接続可視化）
echo "MCP_CHROME_DEBUG_PORT=${MCP_CHROME_DEBUG_PORT}"
curl -s http://127.0.0.1:${MCP_CHROME_DEBUG_PORT}/json/version || true

echo ""
echo "🚀 Claude 起動 (port=${PORT})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 初期プロンプトを自動入力します..."
echo ""

while true; do
  # 初期プロンプトをパイプで自動入力
  echo "$INIT_PROMPT" | claude --dangerously-skip-permissions
  EXIT_CODE=$?

  [ "$EXIT_CODE" -eq 0 ] && break

  echo ""
  echo "🔄 Claude 再起動 (${RESTART_DELAY}秒後)..."
  sleep $RESTART_DELAY
done

echo "👋 終了しました"