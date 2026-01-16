#!/bin/bash

# ITSM-Sec Nexus Service Manager
# サービスの管理を簡単に行うためのスクリプト

SERVICE_NAME="itsm-sec-nexus"

show_usage() {
    cat << EOF
ITSM-Sec Nexus サービス管理スクリプト

使用方法:
    $0 <コマンド>

コマンド:
    start       - サービスを起動
    stop        - サービスを停止
    restart     - サービスを再起動
    status      - サービスの状態を表示
    logs        - ログをリアルタイム表示
    enable      - システム起動時の自動起動を有効化
    disable     - システム起動時の自動起動を無効化
    is-running  - サービスが実行中かチェック
    help        - このヘルプを表示

例:
    $0 start
    $0 status
    $0 logs

EOF
}

check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        echo "❌ このコマンドはroot権限が必要です"
        echo "   sudo $0 $1"
        exit 1
    fi
}

case "$1" in
    start)
        check_sudo "start"
        echo "🚀 サービスを起動中..."
        systemctl start ${SERVICE_NAME}
        sleep 2
        if systemctl is-active --quiet ${SERVICE_NAME}; then
            echo "✅ サービスが正常に起動しました"
            systemctl status ${SERVICE_NAME} --no-pager -l
        else
            echo "❌ サービスの起動に失敗しました"
            systemctl status ${SERVICE_NAME} --no-pager -l
            exit 1
        fi
        ;;

    stop)
        check_sudo "stop"
        echo "🛑 サービスを停止中..."
        systemctl stop ${SERVICE_NAME}
        echo "✅ サービスを停止しました"
        ;;

    restart)
        check_sudo "restart"
        echo "🔄 サービスを再起動中..."
        systemctl restart ${SERVICE_NAME}
        sleep 2
        if systemctl is-active --quiet ${SERVICE_NAME}; then
            echo "✅ サービスが正常に再起動しました"
            systemctl status ${SERVICE_NAME} --no-pager -l
        else
            echo "❌ サービスの再起動に失敗しました"
            systemctl status ${SERVICE_NAME} --no-pager -l
            exit 1
        fi
        ;;

    status)
        systemctl status ${SERVICE_NAME} --no-pager -l
        ;;

    logs)
        echo "📋 ログを表示中 (Ctrl+Cで終了)..."
        journalctl -u ${SERVICE_NAME} -f
        ;;

    enable)
        check_sudo "enable"
        echo "⚙️  自動起動を有効化中..."
        systemctl enable ${SERVICE_NAME}
        echo "✅ システム起動時にサービスが自動起動します"
        ;;

    disable)
        check_sudo "disable"
        echo "⚙️  自動起動を無効化中..."
        systemctl disable ${SERVICE_NAME}
        echo "✅ 自動起動を無効化しました"
        ;;

    is-running)
        if systemctl is-active --quiet ${SERVICE_NAME}; then
            echo "✅ サービスは実行中です"
            exit 0
        else
            echo "❌ サービスは停止しています"
            exit 1
        fi
        ;;

    help|--help|-h)
        show_usage
        ;;

    *)
        echo "❌ 不明なコマンド: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac
