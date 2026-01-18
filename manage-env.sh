#!/bin/bash

# ITSM-Sec Nexus 環境別サービス管理スクリプト

DEV_SERVICE="itsm-sec-nexus-dev"
PROD_SERVICE="itsm-sec-nexus-prod"

show_usage() {
    cat << EOF
ITSM-Sec Nexus 環境別サービス管理

使用方法:
    $0 <環境> <コマンド>

環境:
    dev     - 開発環境 (HTTP: ポート8080)
    prod    - 本番環境 (HTTPS: ポート6443)
    both    - 両方の環境

コマンド:
    start       - サービスを起動
    stop        - サービスを停止
    restart     - サービスを再起動
    status      - サービスの状態を表示
    logs        - ログをリアルタイム表示
    enable      - 自動起動を有効化
    disable     - 自動起動を無効化

例:
    $0 dev start        # 開発環境を起動
    $0 prod start       # 本番環境を起動
    $0 both start       # 両方を起動
    $0 dev logs         # 開発環境のログを表示
    $0 prod status      # 本番環境の状態を確認

クイックスタート:
    sudo $0 both start  # 両方の環境を起動

アクセスURL:
    開発環境: http://192.168.0.187:8080  (タイトル: [開発])
    本番環境: https://192.168.0.187:6443 (タイトル: [本番])

EOF
}

check_sudo() {
    if [ "$EUID" -ne 0 ]; then
        echo "❌ このコマンドはroot権限が必要です"
        echo "   sudo $0 $1 $2"
        exit 1
    fi
}

run_command() {
    local env=$1
    local cmd=$2
    local service=""

    case "$env" in
        dev)
            service=$DEV_SERVICE
            ;;
        prod)
            service=$PROD_SERVICE
            ;;
        both)
            if [ "$cmd" == "status" ] || [ "$cmd" == "logs" ]; then
                echo "⚠️  'both'は${cmd}コマンドには使用できません"
                echo "   'dev'または'prod'を指定してください"
                exit 1
            fi
            ;;
        *)
            echo "❌ 不明な環境: $env"
            show_usage
            exit 1
            ;;
    esac

    case "$cmd" in
        start)
            check_sudo "$env" "start"
            if [ "$env" == "both" ]; then
                echo "🚀 両方の環境を起動中..."
                systemctl start $DEV_SERVICE
                systemctl start $PROD_SERVICE
                sleep 2
                echo ""
                echo "【開発環境】"
                systemctl status $DEV_SERVICE --no-pager -l | head -15
                echo ""
                echo "【本番環境】"
                systemctl status $PROD_SERVICE --no-pager -l | head -15
            else
                echo "🚀 ${env}環境を起動中..."
                systemctl start $service
                sleep 2
                systemctl status $service --no-pager -l
            fi
            ;;

        stop)
            check_sudo "$env" "stop"
            if [ "$env" == "both" ]; then
                echo "🛑 両方の環境を停止中..."
                systemctl stop $DEV_SERVICE
                systemctl stop $PROD_SERVICE
                echo "✅ 両方の環境を停止しました"
            else
                echo "🛑 ${env}環境を停止中..."
                systemctl stop $service
                echo "✅ ${env}環境を停止しました"
            fi
            ;;

        restart)
            check_sudo "$env" "restart"
            if [ "$env" == "both" ]; then
                echo "🔄 両方の環境を再起動中..."
                systemctl restart $DEV_SERVICE
                systemctl restart $PROD_SERVICE
                sleep 2
                echo ""
                echo "【開発環境】"
                systemctl status $DEV_SERVICE --no-pager -l | head -15
                echo ""
                echo "【本番環境】"
                systemctl status $PROD_SERVICE --no-pager -l | head -15
            else
                echo "🔄 ${env}環境を再起動中..."
                systemctl restart $service
                sleep 2
                systemctl status $service --no-pager -l
            fi
            ;;

        status)
            systemctl status $service --no-pager -l
            ;;

        logs)
            echo "📋 ${env}環境のログを表示中 (Ctrl+Cで終了)..."
            journalctl -u $service -f
            ;;

        enable)
            check_sudo "$env" "enable"
            if [ "$env" == "both" ]; then
                echo "⚙️  両方の環境の自動起動を有効化中..."
                systemctl enable $DEV_SERVICE
                systemctl enable $PROD_SERVICE
                echo "✅ 両方の環境の自動起動を有効化しました"
            else
                echo "⚙️  ${env}環境の自動起動を有効化中..."
                systemctl enable $service
                echo "✅ ${env}環境の自動起動を有効化しました"
            fi
            ;;

        disable)
            check_sudo "$env" "disable"
            if [ "$env" == "both" ]; then
                echo "🔓 両方の環境の自動起動を無効化中..."
                systemctl disable $DEV_SERVICE
                systemctl disable $PROD_SERVICE
                echo "✅ 両方の環境の自動起動を無効化しました"
            else
                echo "🔓 ${env}環境の自動起動を無効化中..."
                systemctl disable $service
                echo "✅ ${env}環境の自動起動を無効化しました"
            fi
            ;;

        *)
            echo "❌ 不明なコマンド: $cmd"
            show_usage
            exit 1
            ;;
    esac
}

# Main
if [ $# -lt 1 ]; then
    show_usage
    exit 1
fi

if [ "$1" == "help" ] || [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    show_usage
    exit 0
fi

if [ $# -lt 2 ]; then
    echo "❌ コマンドが指定されていません"
    show_usage
    exit 1
fi

run_command "$1" "$2"
