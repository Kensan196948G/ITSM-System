#!/bin/bash

# ITSM-Sec Nexus - 環境切り替えスクリプト

case "$1" in
    dev)
        sudo ./manage-env.sh prod stop
        sudo ./manage-env.sh dev start
        echo ""
        echo "✅ 開発環境に切り替えました"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🌐 URL: https://192.168.0.187:5443"
        echo "🔧 環境: 開発"
        echo "📊 ポート: 5443"
        echo "📋 ログ: tail -f backend-dev.log"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        ;;
    prod)
        sudo ./manage-env.sh dev stop
        sudo ./manage-env.sh prod start
        echo ""
        echo "✅ 本番環境に切り替えました"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🌐 URL: https://192.168.0.187:6443"
        echo "🔒 環境: 本番"
        echo "📊 ポート: 6443"
        echo "📋 ログ: tail -f backend-prod.log"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        ;;
    both)
        sudo ./manage-env.sh both start
        echo ""
        echo "✅ 両方の環境を起動しました"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🔧 開発: https://192.168.0.187:5443"
        echo "🔒 本番: https://192.168.0.187:6443"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        ;;
    status)
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "【開発環境】"
        ./manage-env.sh dev status | grep -E "Active:|Main PID:|Memory:|Tasks:" | head -4
        echo ""
        echo "【本番環境】"
        ./manage-env.sh prod status | grep -E "Active:|Main PID:|Memory:|Tasks:" | head -4
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        ;;
    *)
        echo "ITSM-Sec Nexus - 環境切り替え"
        echo ""
        echo "使用方法:"
        echo "  $0 dev     - 開発環境のみ起動"
        echo "  $0 prod    - 本番環境のみ起動"
        echo "  $0 both    - 両方起動"
        echo "  $0 status  - 両方の状態を確認"
        echo ""
        echo "例:"
        echo "  $0 dev     # 開発作業時"
        echo "  $0 prod    # 本番運用時"
        echo "  $0 both    # 並行稼働時"
        exit 1
        ;;
esac
