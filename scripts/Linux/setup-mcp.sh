#!/usr/bin/env bash
# MCP統合設定セットアップスクリプト（Linux用）
# ITSM-Sec Nexus プロジェクト

set -e

echo "=== MCP統合設定セットアップ（Linux） ==="

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# プロジェクトルート
PROJECT_ROOT="/mnt/LinuxHDD/ITSM-System"
MCP_CONFIG="${PROJECT_ROOT}/config/mcp/.mcp.json.linux"
CLAUDE_CONFIG="${HOME}/.config/claude/config.json"

echo -e "${YELLOW}📋 前提条件チェック${NC}"

# 1. Node.js確認
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.jsがインストールされていません${NC}"
    echo "Node.js 18以降をインストールしてください"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"

# 2. npx確認
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npxがインストールされていません${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npx: 利用可能${NC}"

# 3. uvx確認（sqlite用）
if ! command -v uvx &> /dev/null; then
    echo -e "${YELLOW}⚠️  uvxがインストールされていません（sqlite用）${NC}"
    echo "以下のコマンドでインストールできます:"
    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
else
    echo -e "${GREEN}✅ uvx: 利用可能${NC}"
fi

echo ""
echo -e "${YELLOW}📁 ディレクトリ作成${NC}"

# 4. 必要なディレクトリ作成
mkdir -p "${HOME}/.config/claude"
mkdir -p "${HOME}/.claude-memory"
mkdir -p "${HOME}/.databases"
echo -e "${GREEN}✅ ディレクトリ作成完了${NC}"

echo ""
echo -e "${YELLOW}🔧 MCP設定ファイルコピー${NC}"

# 5. Claude設定ディレクトリにMCP設定をコピー
if [ -f "${CLAUDE_CONFIG}" ]; then
    echo -e "${YELLOW}⚠️  既存のClaude設定が存在します${NC}"
    echo "バックアップを作成します..."
    cp "${CLAUDE_CONFIG}" "${CLAUDE_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✅ バックアップ作成完了${NC}"
fi

# MCP設定をマージ
if [ ! -f "${CLAUDE_CONFIG}" ]; then
    # 新規作成
    cp "${MCP_CONFIG}" "${CLAUDE_CONFIG}"
    echo -e "${GREEN}✅ MCP設定ファイルをコピーしました${NC}"
else
    # 既存設定にMCPサーバーセクションをマージ
    echo -e "${YELLOW}既存設定にMCPサーバーをマージします${NC}"
    # jqを使用してマージ（jqがインストールされている場合）
    if command -v jq &> /dev/null; then
        jq -s '.[0] * .[1]' "${CLAUDE_CONFIG}" "${MCP_CONFIG}" > "${CLAUDE_CONFIG}.tmp"
        mv "${CLAUDE_CONFIG}.tmp" "${CLAUDE_CONFIG}"
        echo -e "${GREEN}✅ MCP設定をマージしました${NC}"
    else
        echo -e "${YELLOW}⚠️  jqがインストールされていないため、手動でマージしてください${NC}"
        echo "MCP設定ファイル: ${MCP_CONFIG}"
        echo "Claude設定ファイル: ${CLAUDE_CONFIG}"
    fi
fi

echo ""
echo -e "${YELLOW}🔑 API キー設定確認${NC}"

# 6. API キーの確認と設定ガイダンス
echo "以下のAPIキーを設定してください:"
echo ""
echo "1. Brave Search API Key"
echo "   現在の設定ファイルにキーが含まれています"
echo "   必要に応じて ${CLAUDE_CONFIG} を編集してください"
echo ""
echo "2. Context7 API Key"
echo "   現在の設定ファイルにキーが含まれています"
echo "   必要に応じて ${CLAUDE_CONFIG} を編集してください"
echo ""
echo "3. GitHub Personal Access Token"
echo "   ${CLAUDE_CONFIG} 内の \"GITHUB_PERSONAL_ACCESS_TOKEN\" を設定してください"
echo "   取得方法: https://github.com/settings/tokens"
echo ""

echo ""
echo -e "${YELLOW}📦 MCPサーバーパッケージのプリインストール（オプション）${NC}"
read -p "MCPサーバーパッケージを事前インストールしますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "MCPサーバーパッケージをインストール中..."

    npx -y @modelcontextprotocol/server-brave-search --version 2>/dev/null || true
    npx -y @upstash/context7-mcp@latest --version 2>/dev/null || true
    npx -y @modelcontextprotocol/server-memory --version 2>/dev/null || true
    npx -y @modelcontextprotocol/server-github --version 2>/dev/null || true
    npx -y @modelcontextprotocol/server-sequential-thinking --version 2>/dev/null || true
    npx -y @modelcontextprotocol/server-chrome-devtools --version 2>/dev/null || true
    npx -y @upstash/memory-keeper-mcp@latest --version 2>/dev/null || true
    npx -y @executeautomation/playwright-mcp-server --version 2>/dev/null || true

    if command -v uvx &> /dev/null; then
        uvx mcp-server-sqlite --version 2>/dev/null || true
    fi

    echo -e "${GREEN}✅ パッケージインストール完了${NC}"
fi

echo ""
echo -e "${YELLOW}🧪 MCP設定テスト${NC}"

# 7. Claude Codeを再起動してMCP設定を読み込む
echo "Claude Codeを再起動してMCP設定を反映してください"
echo ""
echo -e "${GREEN}✅ MCP統合設定セットアップ完了${NC}"
echo ""
echo "次のステップ:"
echo "1. Claude Codeを再起動"
echo "2. 以下のコマンドでMCP接続を確認:"
echo "   - ToolSearch(\"memory\")"
echo "   - ToolSearch(\"brave-search\")"
echo "   - ToolSearch(\"github\")"
echo ""
echo "3. APIキーが未設定の場合は設定:"
echo "   ${CLAUDE_CONFIG}"
echo ""
echo -e "${GREEN}🎉 セットアップ完了！${NC}"
