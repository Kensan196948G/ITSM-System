#!/bin/bash
################################################################################
# Git Worktree Sync Script
# ITSM-Sec Nexus プロジェクト用
#
# 使用方法:
#   ./git-worktree-sync.sh [worktree-path] [options]
#
# 例:
#   ./git-worktree-sync.sh                    # 全Worktreeを同期
#   ./git-worktree-sync.sh /path/to/worktree  # 特定のWorktreeを同期
################################################################################

set -euo pipefail

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
Git Worktree Sync Script - ITSM-Sec Nexus

使用方法:
    $0 [worktree-path] [options]

引数:
    worktree-path   : 同期するWorktreeのパス（省略時は全Worktreeを同期）

オプション:
    -p, --pull      : リモートから変更をプル
    -f, --fetch     : リモートから情報をフェッチのみ
    -r, --repair    : Worktreeを修復
    -h, --help      : このヘルプを表示

例:
    # 全Worktreeをフェッチ
    $0

    # 全Worktreeをプル
    $0 -p

    # 特定のWorktreeをプル
    $0 /path/to/worktree -p

    # Worktreeを修復
    $0 -r

EOF
}

# デフォルト値
WORKTREE_PATH=""
DO_PULL=false
DO_FETCH=true
DO_REPAIR=false

# 引数パース
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--pull)
            DO_PULL=true
            shift
            ;;
        -f|--fetch)
            DO_FETCH=true
            DO_PULL=false
            shift
            ;;
        -r|--repair)
            DO_REPAIR=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            log_error "不明なオプション: $1"
            show_help
            exit 1
            ;;
        *)
            if [[ -z "$WORKTREE_PATH" ]]; then
                WORKTREE_PATH="$1"
            else
                log_error "引数が多すぎます: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# Gitリポジトリのルートディレクトリを取得
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$GIT_ROOT" ]]; then
    log_error "Gitリポジトリ内で実行してください"
    exit 1
fi

# Worktreeを修復
if [[ "$DO_REPAIR" == true ]]; then
    log_info "Worktreeを修復中..."
    git worktree repair
    log_success "Worktreeを修復しました"
    exit 0
fi

# 特定のWorktreeを同期
sync_worktree() {
    local wt_path="$1"
    local wt_name=$(basename "$wt_path")

    echo ""
    log_info "=== $wt_name を同期中 ==="

    if [[ ! -d "$wt_path" ]]; then
        log_error "ディレクトリが見つかりません: $wt_path"
        return 1
    fi

    cd "$wt_path"

    # 現在のブランチを取得
    local current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    log_info "ブランチ: $current_branch"

    # 変更状態を確認
    local changes=$(git status --porcelain 2>/dev/null | wc -l)
    if [[ $changes -gt 0 ]]; then
        log_warning "${changes}件の未コミット変更があります"
        git status --short
    fi

    # フェッチまたはプル
    if [[ "$DO_PULL" == true ]]; then
        if [[ $changes -gt 0 ]]; then
            log_error "未コミット変更があるためプルできません"
            log_info "変更をコミットまたはスタッシュしてください"
            return 1
        fi

        log_info "リモートからプル中..."
        if git pull --rebase 2>&1; then
            log_success "プル完了"
        else
            log_error "プルに失敗しました"
            return 1
        fi
    elif [[ "$DO_FETCH" == true ]]; then
        log_info "リモートからフェッチ中..."
        if git fetch origin 2>&1; then
            log_success "フェッチ完了"

            # リモートとの差分を確認
            if [[ -n "$current_branch" ]] && git show-ref --verify --quiet "refs/remotes/origin/$current_branch"; then
                local behind=$(git rev-list --count HEAD..origin/$current_branch 2>/dev/null || echo "0")
                local ahead=$(git rev-list --count origin/$current_branch..HEAD 2>/dev/null || echo "0")

                if [[ $behind -gt 0 ]]; then
                    log_warning "リモートより${behind}コミット遅れています"
                fi
                if [[ $ahead -gt 0 ]]; then
                    log_info "リモートより${ahead}コミット進んでいます"
                fi
                if [[ $behind -eq 0 ]] && [[ $ahead -eq 0 ]]; then
                    log_success "リモートと同期しています"
                fi
            fi
        else
            log_error "フェッチに失敗しました"
            return 1
        fi
    fi

    cd - > /dev/null
    return 0
}

# Worktree一覧を取得
WORKTREE_LIST=$(git worktree list --porcelain)

if [[ -z "$WORKTREE_LIST" ]]; then
    log_warning "Worktreeが見つかりません"
    exit 0
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Git Worktree 同期                                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════════╝${NC}"

# 特定のWorktreeが指定された場合
if [[ -n "$WORKTREE_PATH" ]]; then
    if [[ ! -d "$WORKTREE_PATH" ]]; then
        log_error "Worktreeが見つかりません: $WORKTREE_PATH"
        exit 1
    fi

    sync_worktree "$WORKTREE_PATH"
    exit $?
fi

# 全Worktreeを同期
SUCCESS_COUNT=0
FAIL_COUNT=0

while IFS= read -r line; do
    if [[ "$line" =~ ^worktree\ (.+)$ ]]; then
        wt_path="${BASH_REMATCH[1]}"

        if sync_worktree "$wt_path"; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    fi
done <<< "$WORKTREE_LIST"

# 結果サマリー
echo ""
log_info "=== 同期完了 ==="
log_success "成功: ${SUCCESS_COUNT}個"
if [[ $FAIL_COUNT -gt 0 ]]; then
    log_error "失敗: ${FAIL_COUNT}個"
else
    log_info "失敗: ${FAIL_COUNT}個"
fi

exit 0
