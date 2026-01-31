#!/bin/bash
################################################################################
# Git Worktree List Script
# ITSM-Sec Nexus プロジェクト用
#
# 使用方法:
#   ./git-worktree-list.sh [options]
#
# 例:
#   ./git-worktree-list.sh              # 標準表示
#   ./git-worktree-list.sh -v           # 詳細表示
#   ./git-worktree-list.sh -j           # JSON形式で出力
################################################################################

set -euo pipefail

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ヘルプ表示
show_help() {
    cat << EOF
Git Worktree List Script - ITSM-Sec Nexus

使用方法:
    $0 [options]

オプション:
    -v, --verbose   : 詳細情報を表示
    -j, --json      : JSON形式で出力
    -s, --simple    : シンプルな一覧表示（デフォルト）
    -h, --help      : このヘルプを表示

例:
    # 標準表示
    $0

    # 詳細表示
    $0 -v

    # JSON形式で出力
    $0 -j

EOF
}

# デフォルト値
VERBOSE=false
JSON_OUTPUT=false

# 引数パース
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -j|--json)
            JSON_OUTPUT=true
            shift
            ;;
        -s|--simple)
            VERBOSE=false
            JSON_OUTPUT=false
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "不明なオプション: $1"
            show_help
            exit 1
            ;;
    esac
done

# Gitリポジトリのルートディレクトリを取得
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$GIT_ROOT" ]]; then
    log_error "Gitリポジトリ内で実行してください"
    exit 1
fi

# Worktree情報を取得
WORKTREE_LIST=$(git worktree list --porcelain)

if [[ -z "$WORKTREE_LIST" ]]; then
    log_warning "Worktreeが見つかりません"
    exit 0
fi

# JSON出力
if [[ "$JSON_OUTPUT" == true ]]; then
    echo "{"
    echo "  \"worktrees\": ["

    FIRST=true
    while IFS= read -r line; do
        if [[ "$line" =~ ^worktree\ (.+)$ ]]; then
            WORKTREE_PATH="${BASH_REMATCH[1]}"

            if [[ "$FIRST" == false ]]; then
                echo "    },"
            fi
            FIRST=false

            echo "    {"
            echo "      \"path\": \"$WORKTREE_PATH\","
        elif [[ "$line" =~ ^HEAD\ ([a-f0-9]+)$ ]]; then
            COMMIT="${BASH_REMATCH[1]}"
            echo "      \"commit\": \"$COMMIT\","
        elif [[ "$line" =~ ^branch\ refs/heads/(.+)$ ]]; then
            BRANCH="${BASH_REMATCH[1]}"
            echo "      \"branch\": \"$BRANCH\","
        elif [[ "$line" =~ ^detached$ ]]; then
            echo "      \"detached\": true,"
        elif [[ "$line" =~ ^bare$ ]]; then
            echo "      \"bare\": true,"
        elif [[ "$line" =~ ^prunable\ (.+)$ ]]; then
            PRUNABLE="${BASH_REMATCH[1]}"
            echo "      \"prunable\": \"$PRUNABLE\","
        fi
    done <<< "$WORKTREE_LIST"

    echo "    }"
    echo "  ]"
    echo "}"
    exit 0
fi

# Worktree表示関数
display_worktree_info() {
    local worktree_name=$(basename "$CURRENT_WORKTREE")
    local is_main=false

    # メインWorktreeかチェック
    if [[ "$CURRENT_WORKTREE" == "$GIT_ROOT" ]]; then
        is_main=true
        echo -e "${GREEN}● ${NC}${MAGENTA}[MAIN]${NC} $worktree_name"
    else
        echo -e "${BLUE}● ${NC}$worktree_name"
    fi

    echo -e "  ${CYAN}パス:${NC} $CURRENT_WORKTREE"

    if [[ "$CURRENT_DETACHED" == true ]]; then
        echo -e "  ${YELLOW}ブランチ:${NC} ${RED}[DETACHED]${NC} $CURRENT_COMMIT"
    else
        echo -e "  ${CYAN}ブランチ:${NC} $CURRENT_BRANCH"
    fi

    if [[ "$VERBOSE" == true ]]; then
        echo -e "  ${CYAN}コミット:${NC} $CURRENT_COMMIT"

        # 最新コミット情報を取得
        if [[ -d "$CURRENT_WORKTREE/.git" ]] || [[ -f "$CURRENT_WORKTREE/.git" ]]; then
            COMMIT_MSG=$(cd "$CURRENT_WORKTREE" && git log -1 --pretty=format:"%s" 2>/dev/null || echo "N/A")
            COMMIT_AUTHOR=$(cd "$CURRENT_WORKTREE" && git log -1 --pretty=format:"%an" 2>/dev/null || echo "N/A")
            COMMIT_DATE=$(cd "$CURRENT_WORKTREE" && git log -1 --pretty=format:"%ar" 2>/dev/null || echo "N/A")

            echo -e "  ${CYAN}メッセージ:${NC} $COMMIT_MSG"
            echo -e "  ${CYAN}作成者:${NC} $COMMIT_AUTHOR"
            echo -e "  ${CYAN}日時:${NC} $COMMIT_DATE"

            # 変更状態を確認
            CHANGES=$(cd "$CURRENT_WORKTREE" && git status --porcelain 2>/dev/null | wc -l)
            if [[ $CHANGES -gt 0 ]]; then
                echo -e "  ${YELLOW}変更:${NC} ${CHANGES}件の変更があります"
            else
                echo -e "  ${GREEN}変更:${NC} クリーン"
            fi
        fi
    fi

    echo ""
}

# 標準表示
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Git Worktree 一覧                                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Worktreeカウンター
WORKTREE_COUNT=0

# Worktree情報を解析して表示
CURRENT_WORKTREE=""
CURRENT_BRANCH=""
CURRENT_COMMIT=""
CURRENT_DETACHED=false

while IFS= read -r line; do
    if [[ "$line" =~ ^worktree\ (.+)$ ]]; then
        # 前のWorktree情報を表示
        if [[ -n "$CURRENT_WORKTREE" ]]; then
            display_worktree_info
        fi

        CURRENT_WORKTREE="${BASH_REMATCH[1]}"
        CURRENT_BRANCH=""
        CURRENT_COMMIT=""
        CURRENT_DETACHED=false
        WORKTREE_COUNT=$((WORKTREE_COUNT + 1))

    elif [[ "$line" =~ ^HEAD\ ([a-f0-9]+)$ ]]; then
        CURRENT_COMMIT="${BASH_REMATCH[1]}"

    elif [[ "$line" =~ ^branch\ refs/heads/(.+)$ ]]; then
        CURRENT_BRANCH="${BASH_REMATCH[1]}"

    elif [[ "$line" =~ ^detached$ ]]; then
        CURRENT_DETACHED=true
    fi
done <<< "$WORKTREE_LIST"

# 最後のWorktree情報を表示
if [[ -n "$CURRENT_WORKTREE" ]]; then
    display_worktree_info
fi

echo -e "${CYAN}合計: ${WORKTREE_COUNT} 個のWorktree${NC}"
echo ""

# 詳細表示の場合は追加情報を表示
if [[ "$VERBOSE" == true ]]; then
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    追加情報                                            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # ディスク使用量を表示
    echo -e "${CYAN}ディスク使用量:${NC}"
    while IFS= read -r line; do
        if [[ "$line" =~ ^worktree\ (.+)$ ]]; then
            WORKTREE_PATH="${BASH_REMATCH[1]}"
            if [[ -d "$WORKTREE_PATH" ]]; then
                SIZE=$(du -sh "$WORKTREE_PATH" 2>/dev/null | cut -f1)
                echo "  $(basename "$WORKTREE_PATH"): $SIZE"
            fi
        fi
    done <<< "$WORKTREE_LIST"

    echo ""
fi

# 使用可能なコマンドを表示
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    使用可能なコマンド                                  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Worktreeを追加:"
echo "    git worktree add <path> <branch>"
echo "    または: scripts/git/git-worktree-setup.sh <branch-name>"
echo ""
echo "  Worktreeを削除:"
echo "    git worktree remove <path>"
echo "    または: scripts/git/git-worktree-remove.sh <worktree-name>"
echo ""
echo "  Worktreeを修復:"
echo "    git worktree repair"
echo ""
echo "  不要なWorktreeをクリーンアップ:"
echo "    git worktree prune"
echo ""

exit 0
