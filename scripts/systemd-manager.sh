#!/bin/bash

# ========================================
# ITSM-Sec Nexus Systemd Manager
# ========================================
# systemdサービスの管理を簡素化するヘルパースクリプト
# ========================================

set -e

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# サービス名
SERVICE_DEV="itsm-nexus-dev"
SERVICE_PROD="itsm-nexus-prod"

# 使用方法の表示
show_usage() {
    echo -e "${BLUE}"
    echo "========================================"
    echo " ITSM-Sec Nexus Systemd Manager"
    echo "========================================"
    echo -e "${NC}"
    echo ""
    echo "使用方法: $0 [環境] [コマンド]"
    echo ""
    echo -e "${CYAN}環境:${NC}"
    echo "  dev   - 開発環境"
    echo "  prod  - 本番環境"
    echo ""
    echo -e "${CYAN}コマンド:${NC}"
    echo "  start     - サービスを起動"
    echo "  stop      - サービスを停止"
    echo "  restart   - サービスを再起動"
    echo "  status    - サービスの状態を表示"
    echo "  enable    - 自動起動を有効化"
    echo "  disable   - 自動起動を無効化"
    echo "  logs      - ログをリアルタイム表示"
    echo "  logs-100  - 最新100行のログを表示"
    echo "  logs-1000 - 最新1000行のログを表示"
    echo "  logs-err  - エラーログのみ表示"
    echo ""
    echo -e "${CYAN}例:${NC}"
    echo "  $0 dev start       # 開発環境を起動"
    echo "  $0 prod status     # 本番環境の状態確認"
    echo "  $0 prod logs       # 本番環境のログをリアルタイム表示"
    echo ""
}

# Root権限チェック
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}⚠️  このコマンドはroot権限が必要です${NC}"
        echo -e "${YELLOW}   以下のコマンドで再実行してください:${NC}"
        echo -e "   ${GREEN}sudo $0 $@${NC}"
        exit 1
    fi
}

# サービス選択
select_service() {
    case $1 in
        dev)
            SERVICE=$SERVICE_DEV
            ENV_NAME="開発環境"
            ;;
        prod)
            SERVICE=$SERVICE_PROD
            ENV_NAME="本番環境"
            ;;
        *)
            echo -e "${RED}❌ 無効な環境です: $1${NC}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# サービスの起動
start_service() {
    check_root "$@"
    echo -e "${BLUE}🚀 ${ENV_NAME}のサービスを起動中...${NC}"
    systemctl start $SERVICE
    sleep 2
    if systemctl is-active --quiet $SERVICE; then
        echo -e "${GREEN}✅ ${ENV_NAME}のサービスを起動しました${NC}"
        systemctl status $SERVICE --no-pager -l
    else
        echo -e "${RED}❌ ${ENV_NAME}のサービスの起動に失敗しました${NC}"
        echo ""
        echo -e "${YELLOW}ログを確認してください:${NC}"
        echo "  sudo journalctl -u $SERVICE -n 50"
        exit 1
    fi
}

# サービスの停止
stop_service() {
    check_root "$@"
    echo -e "${BLUE}🛑 ${ENV_NAME}のサービスを停止中...${NC}"
    systemctl stop $SERVICE
    sleep 2
    if ! systemctl is-active --quiet $SERVICE; then
        echo -e "${GREEN}✅ ${ENV_NAME}のサービスを停止しました${NC}"
    else
        echo -e "${YELLOW}⚠️  ${ENV_NAME}のサービスがまだ実行中です${NC}"
        systemctl status $SERVICE --no-pager -l
    fi
}

# サービスの再起動
restart_service() {
    check_root "$@"
    echo -e "${BLUE}🔄 ${ENV_NAME}のサービスを再起動中...${NC}"
    systemctl restart $SERVICE
    sleep 2
    if systemctl is-active --quiet $SERVICE; then
        echo -e "${GREEN}✅ ${ENV_NAME}のサービスを再起動しました${NC}"
        systemctl status $SERVICE --no-pager -l
    else
        echo -e "${RED}❌ ${ENV_NAME}のサービスの再起動に失敗しました${NC}"
        echo ""
        echo -e "${YELLOW}ログを確認してください:${NC}"
        echo "  sudo journalctl -u $SERVICE -n 50"
        exit 1
    fi
}

# サービスの状態表示
status_service() {
    check_root "$@"
    echo -e "${BLUE}📊 ${ENV_NAME}のサービス状態:${NC}"
    echo ""
    systemctl status $SERVICE --no-pager -l
    echo ""

    # 追加情報
    echo -e "${CYAN}追加情報:${NC}"

    # プロセスID
    MAIN_PID=$(systemctl show $SERVICE --property=MainPID --value)
    echo "  プロセスID: $MAIN_PID"

    # 起動時刻
    ACTIVE_SINCE=$(systemctl show $SERVICE --property=ActiveEnterTimestamp --value)
    echo "  起動時刻: $ACTIVE_SINCE"

    # 再起動回数
    RESTART_COUNT=$(systemctl show $SERVICE --property=NRestarts --value)
    echo "  再起動回数: $RESTART_COUNT"

    # メモリ使用量
    MEMORY=$(systemctl show $SERVICE --property=MemoryCurrent --value)
    if [ "$MEMORY" != "[not set]" ] && [ "$MEMORY" != "0" ]; then
        MEMORY_MB=$((MEMORY / 1024 / 1024))
        echo "  メモリ使用量: ${MEMORY_MB} MB"
    fi
}

# 自動起動を有効化
enable_service() {
    check_root "$@"
    echo -e "${BLUE}⚙️  ${ENV_NAME}の自動起動を有効化中...${NC}"
    systemctl enable $SERVICE
    echo -e "${GREEN}✅ ${ENV_NAME}の自動起動を有効化しました${NC}"
    echo ""
    echo -e "${CYAN}システム起動時に自動的にサービスが起動します${NC}"
}

# 自動起動を無効化
disable_service() {
    check_root "$@"
    echo -e "${BLUE}⚙️  ${ENV_NAME}の自動起動を無効化中...${NC}"
    systemctl disable $SERVICE
    echo -e "${GREEN}✅ ${ENV_NAME}の自動起動を無効化しました${NC}"
    echo ""
    echo -e "${CYAN}システム起動時にサービスは自動起動しません${NC}"
}

# ログをリアルタイム表示
logs_follow() {
    echo -e "${BLUE}📝 ${ENV_NAME}のログをリアルタイム表示中...${NC}"
    echo -e "${YELLOW}   Ctrl+C で終了${NC}"
    echo ""
    journalctl -u $SERVICE -f
}

# 最新100行のログを表示
logs_100() {
    echo -e "${BLUE}📝 ${ENV_NAME}の最新100行のログ:${NC}"
    echo ""
    journalctl -u $SERVICE -n 100 --no-pager
}

# 最新1000行のログを表示
logs_1000() {
    echo -e "${BLUE}📝 ${ENV_NAME}の最新1000行のログ:${NC}"
    echo ""
    journalctl -u $SERVICE -n 1000 --no-pager
}

# エラーログのみ表示
logs_error() {
    echo -e "${BLUE}📝 ${ENV_NAME}のエラーログ:${NC}"
    echo ""
    journalctl -u $SERVICE -p err --no-pager
}

# メイン処理
main() {
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi

    ENV=$1
    COMMAND=$2

    # 環境選択
    select_service $ENV

    # コマンド実行
    case $COMMAND in
        start)
            start_service "$@"
            ;;
        stop)
            stop_service "$@"
            ;;
        restart)
            restart_service "$@"
            ;;
        status)
            status_service "$@"
            ;;
        enable)
            enable_service "$@"
            ;;
        disable)
            disable_service "$@"
            ;;
        logs)
            logs_follow
            ;;
        logs-100)
            logs_100
            ;;
        logs-1000)
            logs_1000
            ;;
        logs-err)
            logs_error
            ;;
        *)
            echo -e "${RED}❌ 無効なコマンドです: $COMMAND${NC}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# スクリプト実行
main "$@"
