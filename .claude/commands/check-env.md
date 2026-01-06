# 環境変数設定確認

以下の環境変数の設定状態を確認して報告してください：

```bash
echo "=== Claude Code 環境変数設定 ==="
echo "ENABLE_TOOL_SEARCH=$ENABLE_TOOL_SEARCH"
echo "ENABLE_EXPERIMENTAL_MCP_CLI=$ENABLE_EXPERIMENTAL_MCP_CLI"
echo ""
echo "=== 設定の意味 ==="
if [ "$ENABLE_TOOL_SEARCH" = "true" ]; then
  echo "✅ ENABLE_TOOL_SEARCH=true: MCPツール検索（TST）モード有効"
  echo "   → MCPツールはオンデマンドでロード（トークン節約）"
else
  echo "❌ ENABLE_TOOL_SEARCH=false: MCPツール検索モード無効"
  echo "   → すべてのMCPツールが最初からロード"
fi
echo ""
if [ "$ENABLE_EXPERIMENTAL_MCP_CLI" = "true" ]; then
  echo "⚠️ ENABLE_EXPERIMENTAL_MCP_CLI=true: 実験的MCP CLIモード有効"
else
  echo "✅ ENABLE_EXPERIMENTAL_MCP_CLI=false: 標準モード"
fi
```

上記のコマンドを実行し、結果を日本語で分かりやすく報告してください。
