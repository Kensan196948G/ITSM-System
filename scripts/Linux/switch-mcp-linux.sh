#!/bin/bash
# MCP設定をLinux用に切り替えるスクリプト
# Usage: ./switch-mcp-linux.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "=== MCP設定をLinux用に切り替え ==="
echo "プロジェクトルート: $PROJECT_ROOT"

# Linux用設定をコピー
if [ -f "$PROJECT_ROOT/.mcp.json.linux" ]; then
    cp "$PROJECT_ROOT/.mcp.json.linux" "$PROJECT_ROOT/.mcp.json"
    echo "✅ .mcp.json を Linux用設定に更新しました"
else
    echo "❌ .mcp.json.linux が見つかりません"
    exit 1
fi

# 必要なディレクトリを作成
mkdir -p "${HOME}/.claude-memory"
mkdir -p "${HOME}/.databases"

echo "✅ 必要なディレクトリを作成しました:"
echo "   - ${HOME}/.claude-memory"
echo "   - ${HOME}/.databases"

echo ""
echo "🎉 完了！Claude Codeを再起動してください。"
