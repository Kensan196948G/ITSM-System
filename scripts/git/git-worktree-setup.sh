#!/bin/bash
################################################################################
# Git Worktree Setup Script
# ITSM-Sec Nexus プロジェクト用
#
# 使用方法:
#   ./git-worktree-setup.sh <branch-name> [worktree-name]
#
# 例:
#   ./git-worktree-setup.sh feature/new-feature
#   ./git-worktree-setup.sh hotfix/bug-123 hotfix-bug-123
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
Git Worktree Setup Script - ITSM-Sec Nexus

使用方法:
    $0 <branch-name> [worktree-name] [options]

引数:
    branch-name     : 作成するブランチ名（必須）
    worktree-name   : Worktreeディレクトリ名（省略時はブランチ名から自動生成）

オプション:
    -b, --base      : ベースブランチを指定（デフォルト: main）
    -p, --path      : Worktreeの親ディレクトリを指定（デフォルト: 親ディレクトリ）
    -r, --remote    : リモートブランチをチェックアウト
    -h, --help      : このヘルプを表示

例:
    # 新しいfeatureブランチでWorktreeを作成
    $0 feature/new-dashboard

    # 既存のリモートブランチをチェックアウト
    $0 feature/security-dashboard -r

    # カスタム名でWorktreeを作成
    $0 hotfix/critical-bug hotfix-urgent

    # developブランチをベースに作成
    $0 feature/new-feature -b develop

EOF
}

# 引数チェック
if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# デフォルト値
BRANCH_NAME=""
WORKTREE_NAME=""
BASE_BRANCH="main"
WORKTREE_PARENT=""
USE_REMOTE=false

# 引数パース
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--base)
            BASE_BRANCH="$2"
            shift 2
            ;;
        -p|--path)
            WORKTREE_PARENT="$2"
            shift 2
            ;;
        -r|--remote)
            USE_REMOTE=true
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
            if [[ -z "$BRANCH_NAME" ]]; then
                BRANCH_NAME="$1"
            elif [[ -z "$WORKTREE_NAME" ]]; then
                WORKTREE_NAME="$1"
            else
                log_error "引数が多すぎます: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# ブランチ名が指定されているか確認
if [[ -z "$BRANCH_NAME" ]]; then
    log_error "ブランチ名を指定してください"
    show_help
    exit 1
fi

# Gitリポジトリのルートディレクトリを取得
GIT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [[ -z "$GIT_ROOT" ]]; then
    log_error "Gitリポジトリ内で実行してください"
    exit 1
fi

log_info "Gitリポジトリルート: $GIT_ROOT"

# プロジェクト名を取得
PROJECT_NAME=$(basename "$GIT_ROOT")

# Worktree名が指定されていない場合は自動生成
if [[ -z "$WORKTREE_NAME" ]]; then
    # feature/new-feature -> new-feature
    # hotfix/bug-123 -> bug-123
    WORKTREE_NAME=$(echo "$BRANCH_NAME" | sed 's/^.*\///')
    # プロジェクト名を接頭辞として追加
    WORKTREE_NAME="${PROJECT_NAME}-${WORKTREE_NAME}"
fi

# Worktreeの親ディレクトリを決定
if [[ -z "$WORKTREE_PARENT" ]]; then
    WORKTREE_PARENT=$(dirname "$GIT_ROOT")
fi

WORKTREE_PATH="${WORKTREE_PARENT}/${WORKTREE_NAME}"

log_info "=== Git Worktree 設定 ==="
log_info "ブランチ名: $BRANCH_NAME"
log_info "Worktree名: $WORKTREE_NAME"
log_info "Worktreeパス: $WORKTREE_PATH"
log_info "ベースブランチ: $BASE_BRANCH"

# 既存のWorktreeチェック
if git worktree list | grep -q "$WORKTREE_PATH"; then
    log_error "Worktree '$WORKTREE_PATH' は既に存在します"
    log_info "既存のWorktree一覧:"
    git worktree list
    exit 1
fi

# ディレクトリの存在チェック
if [[ -d "$WORKTREE_PATH" ]]; then
    log_error "ディレクトリ '$WORKTREE_PATH' は既に存在します"
    exit 1
fi

# リモートブランチを使用する場合
if [[ "$USE_REMOTE" == true ]]; then
    log_info "リモートブランチをフェッチ中..."
    git fetch origin

    # リモートブランチが存在するか確認
    if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH_NAME"; then
        log_info "リモートブランチ 'origin/$BRANCH_NAME' をチェックアウトします"
        git worktree add "$WORKTREE_PATH" "origin/$BRANCH_NAME"
        cd "$WORKTREE_PATH"
        git checkout -b "$BRANCH_NAME" --track "origin/$BRANCH_NAME"
    else
        log_error "リモートブランチ 'origin/$BRANCH_NAME' が見つかりません"
        log_info "利用可能なリモートブランチ:"
        git branch -r | grep "$BRANCH_NAME" || log_warning "一致するブランチが見つかりません"
        exit 1
    fi
else
    # ローカルブランチが既に存在するか確認
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
        log_info "既存のブランチ '$BRANCH_NAME' を使用します"
        git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
    else
        log_info "新しいブランチ '$BRANCH_NAME' を '$BASE_BRANCH' から作成します"
        git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" "$BASE_BRANCH"
    fi
fi

log_success "Worktree '$WORKTREE_NAME' を作成しました"

# Worktree情報を表示
echo ""
log_info "=== Worktree情報 ==="
git worktree list | grep "$WORKTREE_PATH" || true

# .envファイルのコピー（存在する場合）
if [[ -f "$GIT_ROOT/config/env/.env.development" ]]; then
    log_info ".env.developmentをコピー中..."
    mkdir -p "$WORKTREE_PATH/config/env"
    cp "$GIT_ROOT/config/env/.env.development" "$WORKTREE_PATH/config/env/"
    log_success ".env.developmentをコピーしました"
fi

# node_modulesのシンボリックリンク作成（オプション）
if [[ -d "$GIT_ROOT/node_modules" ]]; then
    read -p "node_modulesのシンボリックリンクを作成しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ln -s "$GIT_ROOT/node_modules" "$WORKTREE_PATH/node_modules"
        log_success "node_modulesのシンボリックリンクを作成しました"
    fi
fi

# backend/node_modulesのシンボリックリンク作成（オプション）
if [[ -d "$GIT_ROOT/backend/node_modules" ]]; then
    read -p "backend/node_modulesのシンボリックリンクを作成しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p "$WORKTREE_PATH/backend"
        ln -s "$GIT_ROOT/backend/node_modules" "$WORKTREE_PATH/backend/node_modules"
        log_success "backend/node_modulesのシンボリックリンクを作成しました"
    fi
fi

echo ""
log_success "=== セットアップ完了 ==="
log_info "次のコマンドで移動できます:"
echo "  cd $WORKTREE_PATH"
echo ""
log_info "Worktree一覧を確認:"
echo "  git worktree list"
echo ""
log_info "Worktreeを削除する場合:"
echo "  git worktree remove $WORKTREE_PATH"

exit 0
