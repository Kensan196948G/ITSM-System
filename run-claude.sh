#!/usr/bin/env bash
set -euo pipefail

PORT=9223
RESTART_DELAY=3

# 初期プロンプト
INIT_PROMPT="以降、日本語で対応願います。全SubAgent機能＋全Hooks機能（並列実行機能）＋全MCP機能+標準機能を利用してください。Memory MCPに記録された内容から続きの開発フェーズを続けてください。"

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