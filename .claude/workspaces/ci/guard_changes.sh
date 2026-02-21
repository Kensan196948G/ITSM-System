#!/bin/bash
#####################################################################
# guard_changes.sh - 自動修復CIループ用ガードスクリプト
#
# 目的: Claude Codeによる自動修復の暴走を防止
#
# ガード機能:
#   1. 最大試行回数制限
#   2. 同一エラー検出
#   3. 差分量制限（20行以下）
#   4. 対象ファイル制限（.js, .ts, .ps1のみ）
#
# 使用方法:
#   ./ci/guard_changes.sh
#
# 終了コード:
#   0: すべてのガードをパス
#   1: ガード違反（修復を中止すべき）
#####################################################################

set -e

# 設定
MAX_ATTEMPTS=${MAX_ATTEMPTS:-5}
MAX_DIFF_LINES=${MAX_DIFF_LINES:-20}
ATTEMPT_FILE=".ci_attempt"
ERROR_HASH_FILE=".ci_error_hash"
BUILD_LOG=${BUILD_LOG:-"build.log"}

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️  ガードチェック開始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

#####################################################################
# ガード1: 最大試行回数チェック
#####################################################################
echo ""
echo "📊 [1/4] 最大試行回数チェック..."

ATTEMPT=$(cat $ATTEMPT_FILE 2>/dev/null || echo 0)
ATTEMPT=$((ATTEMPT+1))
echo "$ATTEMPT" > $ATTEMPT_FILE

echo "   現在の試行回数: $ATTEMPT / $MAX_ATTEMPTS"

if [ "$ATTEMPT" -gt "$MAX_ATTEMPTS" ]; then
  echo -e "${RED}❌ 最大試行回数 ($MAX_ATTEMPTS) に到達しました${NC}"
  echo "   自動修復を中止します。人間による対応が必要です。"
  exit 1
fi
echo -e "${GREEN}   ✓ パス${NC}"

#####################################################################
# ガード2: 同一エラー検出
#####################################################################
echo ""
echo "🔍 [2/4] 同一エラー検出..."

if [ -f "$BUILD_LOG" ]; then
  # エラーログのハッシュを計算（行番号等を除去して正規化）
  CURRENT_HASH=$(cat "$BUILD_LOG" | \
    grep -E "(Error|FAIL|●|✕|Expected)" | \
    sed 's/:[0-9]*:[0-9]*/:/g' | \
    sed 's/line [0-9]*/line X/g' | \
    head -20 | \
    sha256sum | awk '{print $1}')

  echo "   現在のエラーハッシュ: ${CURRENT_HASH:0:16}..."

  if [ -f "$ERROR_HASH_FILE" ]; then
    LAST_HASH=$(cat $ERROR_HASH_FILE)
    echo "   前回のエラーハッシュ: ${LAST_HASH:0:16}..."

    if [ "$CURRENT_HASH" = "$LAST_HASH" ]; then
      echo -e "${RED}❌ 同一エラーが連続で検出されました${NC}"
      echo "   同じ修正を繰り返しても解決しません。"
      echo "   自動修復を中止します。人間による対応が必要です。"
      exit 1
    fi
  fi

  echo "$CURRENT_HASH" > $ERROR_HASH_FILE
  echo -e "${GREEN}   ✓ パス（新しいエラーまたは初回）${NC}"
else
  echo -e "${YELLOW}   ⚠ ビルドログが見つかりません（スキップ）${NC}"
fi

#####################################################################
# ガード3: 差分量チェック
#####################################################################
echo ""
echo "📏 [3/4] 差分量チェック..."

DIFF_LINES=$(git diff --stat 2>/dev/null | tail -1 | grep -oE '[0-9]+' | head -1 || echo 0)
DIFF_LINES=${DIFF_LINES:-0}

echo "   変更行数: $DIFF_LINES 行"

if [ "$DIFF_LINES" -gt "$MAX_DIFF_LINES" ]; then
  echo -e "${RED}❌ 差分が大きすぎます ($DIFF_LINES 行 > $MAX_DIFF_LINES 行)${NC}"
  echo "   大規模な変更は自動修復の範囲外です。"
  echo ""
  echo "   変更内容:"
  git diff --stat
  echo ""
  echo "   変更をリバートします..."
  git checkout . 2>/dev/null || true
  exit 1
fi
echo -e "${GREEN}   ✓ パス${NC}"

#####################################################################
# ガード4: 対象ファイルチェック
#####################################################################
echo ""
echo "📁 [4/4] 対象ファイルチェック..."

# 許可されたファイルパターン
ALLOWED_PATTERNS=(
  '\.js$'
  '\.ts$'
  '\.jsx$'
  '\.tsx$'
  '\.ps1$'
  '\.json$'
  '^ci/'
  '^\.github/'
)

CHANGED_FILES=$(git diff --name-only 2>/dev/null || echo "")
FORBIDDEN_FILES=""

for f in $CHANGED_FILES; do
  ALLOWED=false
  for pattern in "${ALLOWED_PATTERNS[@]}"; do
    if echo "$f" | grep -qE "$pattern"; then
      ALLOWED=true
      break
    fi
  done

  if [ "$ALLOWED" = "false" ]; then
    FORBIDDEN_FILES="$FORBIDDEN_FILES $f"
  fi
done

if [ -n "$FORBIDDEN_FILES" ]; then
  echo -e "${RED}❌ 許可されていないファイルが変更されています${NC}"
  echo "   禁止されたファイル:$FORBIDDEN_FILES"
  echo ""
  echo "   これらのファイルの変更をリバートします..."
  for f in $FORBIDDEN_FILES; do
    git checkout "$f" 2>/dev/null || true
    echo "   リバート: $f"
  done
  echo ""
  echo -e "${YELLOW}   ⚠ 禁止ファイルをリバートしました。許可ファイルのみ続行します。${NC}"
else
  echo "   変更されたファイル:"
  for f in $CHANGED_FILES; do
    echo "     ✓ $f"
  done
  echo -e "${GREEN}   ✓ パス${NC}"
fi

#####################################################################
# 最終結果
#####################################################################
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ すべてのガードチェックをパスしました${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 サマリー:"
echo "   - 試行回数: $ATTEMPT / $MAX_ATTEMPTS"
echo "   - 差分行数: $DIFF_LINES / $MAX_DIFF_LINES"
echo "   - 変更ファイル数: $(echo "$CHANGED_FILES" | wc -w | tr -d ' ')"

exit 0
