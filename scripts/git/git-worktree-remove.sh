#!/bin/bash
################################################################################
# Git Worktree Remove Script
# ITSM-Sec Nexus プロジェクト用
#
# 使用方法:
#   ./git-worktree-remove.sh <worktree-name-or-path> [options]
#
# 例:
#   ./git-worktree-remove.sh ITSM-System-dev
#   ./git-worktree-remove.sh /path/to/worktree -f
################################################################################

set -euo pipefail

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
Git Worktree Remove Script - ITSM-Sec Nexus

使用方法:
    $0 <worktree-name-or-path> [options]

引数:
    worktree-name-or-path : 削除するWorktreeの名前またはパス（必須）

オプション:
    -f, --force     : 強制削除（変更があっても削除）
    -b, --branch    : ブランチも削除
    -y, --yes       : 確認をスキップ
    -h, --help      : このヘルプを表示

例:
    # Worktreeを削除
    $0 ITSM-System-dev

    # 強制削除
    $0 ITSM-System-dev -f

    # Worktreeとブランチを削除
    $0 ITSM-System-dev -b

    # 確認なしで削除
    $0 ITSM-System-dev -y

EOF
}

# 引数チェック
if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# デフォルト値
WORKTREE_INPUT=""
FORCE=false
DELETE_BRANCH=false
SKIP_CONFIRM=false

# 引数パース
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        -b|--branch)
            DELETE_BRANCH=true
            shift
            ;;
        -y|--yes)
            SKIP_CONFIRM=true
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
            if [[ -z "$WORKTREE_INPUT" ]]; then
                WORKTREE_INPUT="$1"
            else
                log_error "引数が多すぎます: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# Worktree名が指定されているか確認
if [[ -z "$WORKTREE_INPUT" ]]; then
    log_error "Worktree名またはパスを指定してください"
    show_help
    exit 1
fi

# Gitリポジトリのルートディレクトリを取得
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$GIT_ROOT" ]]; then
    log_error "Gitリポジトリ内で実行してください"
    exit 1
fi

# Worktreeパスを決定
WORKTREE_PATH=""
if [[ -d "$WORKTREE_INPUT" ]]; then
    # フルパスが指定された場合
    WORKTREE_PATH="$WORKTREE_INPUT"
else
    # 名前が指定された場合、親ディレクトリから検索
    PARENT_DIR=$(dirname "$GIT_ROOT")
    POTENTIAL_PATH="${PARENT_DIR}/${WORKTREE_INPUT}"
    if [[ -d "$POTENTIAL_PATH" ]]; then
        WORKTREE_PATH="$POTENTIAL_PATH"
    else
        log_error "Worktree '$WORKTREE_INPUT' が見つかりません"
        log_info "既存のWorktree一覧:"
        git worktree list
        exit 1
    fi
fi

# Worktreeが存在するか確認
if ! git worktree list | grep -q "$WORKTREE_PATH"; then
    log_error "Worktree '$WORKTREE_PATH' はGitによって管理されていません"
    log_info "既存のWorktree一覧:"
    git worktree list
    exit 1
fi

# メインWorktreeは削除できない
if [[ "$WORKTREE_PATH" == "$GIT_ROOT" ]]; then
    log_error "メインWorktreeは削除できません"
    exit 1
fi

# ブランチ名を取得
BRANCH_NAME=""
if cd "$WORKTREE_PATH" 2>/dev/null; then
    BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    cd - > /dev/null
fi

log_info "=== Worktree削除情報 ==="
log_info "Worktreeパス: $WORKTREE_PATH"
log_info "ブランチ名: ${BRANCH_NAME:-N/A}"

# 変更があるか確認
if [[ -d "$WORKTREE_PATH" ]]; then
    CHANGES=$(cd "$WORKTREE_PATH" && git status --porcelain 2>/dev/null | wc -l)
    if [[ $CHANGES -gt 0 ]]; then
        log_warning "Worktreeに${CHANGES}件の未コミット変更があります"
        if [[ "$FORCE" != true ]]; then
            log_error "変更をコミットまたは破棄してから削除してください"
            log_info "強制削除する場合は -f オプションを使用してください"
            exit 1
        fi
    fi
fi

# 確認
if [[ "$SKIP_CONFIRM" != true ]]; then
    echo ""
    log_warning "次のWorktreeを削除しようとしています:"
    echo "  パス: $WORKTREE_PATH"
    echo "  ブランチ: ${BRANCH_NAME:-N/A}"
    if [[ "$DELETE_BRANCH" == true ]]; then
        log_warning "ブランチも削除されます"
    fi
    echo ""
    read -p "本当に削除しますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "削除をキャンセルしました"
        exit 0
    fi
fi

# Worktreeを削除
log_info "Worktreeを削除中..."
if [[ "$FORCE" == true ]]; then
    git worktree remove --force "$WORKTREE_PATH"
else
    git worktree remove "$WORKTREE_PATH"
fi

log_success "Worktree '$WORKTREE_PATH' を削除しました"

# ブランチを削除
if [[ "$DELETE_BRANCH" == true ]] && [[ -n "$BRANCH_NAME" ]]; then
    log_info "ブランチ '$BRANCH_NAME' を削除中..."

    # ブランチが存在するか確認
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
        git branch -D "$BRANCH_NAME"
        log_success "ブランチ '$BRANCH_NAME' を削除しました"
    else
        log_warning "ブランチ '$BRANCH_NAME' が見つかりません（既に削除済みの可能性があります）"
    fi
fi

# クリーンアップ
log_info "Worktreeのクリーンアップ中..."
git worktree prune

echo ""
log_success "=== 削除完了 ==="
log_info "現在のWorktree一覧:"
git worktree list

exit 0
