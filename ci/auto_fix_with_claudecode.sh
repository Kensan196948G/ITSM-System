#!/bin/bash
#####################################################################
# auto_fix_with_claudecode.sh - Claude Code CI修理工スクリプト
#
# 目的: ビルド失敗時にClaude Codeを呼び出してエラーを自動修復
#
# 必要な環境変数:
#   - ANTHROPIC_API_KEY: Claude API キー（GitHub Secretsから）
#   - BUILD_LOG: ビルドログファイルパス（デフォルト: build.log）
#
# 使用方法:
#   ./ci/auto_fix_with_claudecode.sh
#
# 動作:
#   1. ビルドログを読み込む
#   2. Claude Codeに修復を依頼
#   3. 修復結果を適用
#####################################################################

set -e

# 設定
BUILD_LOG=${BUILD_LOG:-"build.log"}
REPAIR_GUIDE=".github/auto-repair/repair.md"
CLAUDE_MD="CLAUDE.md"
MAX_LOG_LINES=200

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${CYAN}🤖 Claude Code CI Repairer${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

#####################################################################
# 前提条件チェック
#####################################################################
echo "📋 前提条件チェック..."

# APIキーの確認
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo -e "${RED}❌ ANTHROPIC_API_KEY が設定されていません${NC}"
  echo "   GitHub Secrets に ANTHROPIC_API_KEY を追加してください"
  exit 1
fi
echo "   ✓ ANTHROPIC_API_KEY: 設定済み"

# Claude CLIの確認
if ! command -v claude &> /dev/null; then
  echo -e "${YELLOW}⚠ Claude CLI がインストールされていません${NC}"
  echo "   インストール中..."
  npm install -g @anthropic-ai/claude-code
fi
echo "   ✓ Claude CLI: $(claude --version 2>/dev/null || echo 'installed')"

# ビルドログの確認
if [ ! -f "$BUILD_LOG" ]; then
  echo -e "${RED}❌ ビルドログが見つかりません: $BUILD_LOG${NC}"
  exit 1
fi
echo "   ✓ ビルドログ: $BUILD_LOG ($(wc -l < $BUILD_LOG) 行)"

# 必須ファイルの確認
if [ ! -f "$REPAIR_GUIDE" ]; then
  echo -e "${RED}❌ repair.md が見つかりません${NC}"
  exit 1
fi
echo "   ✓ repair.md: 確認済み"

if [ ! -f "$CLAUDE_MD" ]; then
  echo -e "${RED}❌ CLAUDE.md が見つかりません${NC}"
  exit 1
fi
echo "   ✓ CLAUDE.md: 確認済み"

echo ""

#####################################################################
# ビルドログの抽出（最後のN行）
#####################################################################
echo "📖 ビルドログを抽出中..."

ERROR_LOG=$(tail -$MAX_LOG_LINES "$BUILD_LOG")

# エラー行を強調表示
ERROR_SUMMARY=$(echo "$ERROR_LOG" | grep -E "(Error|FAIL|●|✕|Expected|AssertionError)" | head -20)

echo "   エラーサマリー:"
echo "$ERROR_SUMMARY" | head -5 | sed 's/^/     /'
echo ""

#####################################################################
# Claude Code 呼び出し
#####################################################################
echo "🤖 Claude Code を呼び出し中..."
echo ""

# Claude Codeに渡すプロンプトを構築
PROMPT=$(cat << 'PROMPT_END'
You are a CI repair agent for the ITSM-Sec Nexus project.

## Your Role
- You are a **test failure fixer**, not a designer or architect
- Your ONLY job is to make failing tests pass
- You must follow CLAUDE.md and repair.md strictly

## Rules (CRITICAL)
1. **Minimal changes only** - Fix ONLY what's broken
2. **No new features** - Never add functionality
3. **No refactoring** - Don't "improve" unrelated code
4. **No test skipping** - Never disable or skip tests
5. **Keep diff small** - Prefer 1-5 line changes

## Build Log (Error)
PROMPT_END
)

# ビルドログを追加
FULL_PROMPT="$PROMPT

\`\`\`
$ERROR_SUMMARY
\`\`\`

## Task
1. Analyze the error above
2. Find the root cause in the source code
3. Apply the MINIMAL fix to make tests pass
4. Do NOT explain - just fix the code

If you cannot fix it safely, do nothing."

# Claude Code 呼び出し（非対話モード）
echo "$FULL_PROMPT" | claude \
  --print \
  --dangerously-skip-permissions \
  --allowedTools "Read,Edit,Glob,Grep" \
  2>&1 | tee claude_output.log

CLAUDE_EXIT_CODE=$?

echo ""

#####################################################################
# 結果の確認
#####################################################################
if [ $CLAUDE_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Claude Code が完了しました${NC}"

  # 変更があるか確認
  if ! git diff --quiet; then
    echo ""
    echo "📝 変更されたファイル:"
    git diff --name-only | sed 's/^/   /'
    echo ""
    echo "📊 変更の統計:"
    git diff --stat | tail -1 | sed 's/^/   /'
  else
    echo -e "${YELLOW}⚠ 変更はありませんでした${NC}"
  fi
else
  echo -e "${RED}❌ Claude Code がエラーで終了しました (exit code: $CLAUDE_EXIT_CODE)${NC}"
  exit $CLAUDE_EXIT_CODE
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🤖 Claude Code CI Repairer 完了${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
