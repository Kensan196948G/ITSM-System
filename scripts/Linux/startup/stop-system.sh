#!/bin/bash
################################################################################
# ITSM-System - System Stop Script
# 用途: ITSM-Systemの全サービスを停止
# 対応: start-system.sh の停止版
################################################################################

echo "======================================"
echo "  ITSM-Sec Nexus System Shutdown"
echo "======================================"
echo ""

# プロセス停止関数
stop_process() {
    local process_name=$1
    local display_name=$2

    if pgrep -f "$process_name" > /dev/null; then
        echo "🛑 Stopping $display_name..."
        pkill -f "$process_name"
        sleep 2

        # 強制終了が必要か確認
        if pgrep -f "$process_name" > /dev/null; then
            echo "   Force killing $display_name..."
            pkill -9 -f "$process_name"
            sleep 1
        fi

        if ! pgrep -f "$process_name" > /dev/null; then
            echo "✅ $display_name stopped"
        else
            echo "❌ Failed to stop $display_name"
            return 1
        fi
    else
        echo "ℹ️  $display_name is not running"
    fi
}

# バックエンドサーバーを停止
stop_process "node backend/server.js" "Backend API Server"

# フロントエンドHTTPサーバーを停止
stop_process "python3 -m http.server" "Frontend HTTP Server"

# Node.js フロントエンドHTTPSサーバーを停止
stop_process "node scripts/frontend-https-server.js" "Frontend HTTPS Server"

# ポート確認
echo ""
echo "🔌 Checking ports..."
if command -v netstat &> /dev/null; then
    PORTS_IN_USE=$(netstat -tulpn 2>/dev/null | grep -E ':(5000|5050|5443|8080)' || true)
    if [ -z "$PORTS_IN_USE" ]; then
        echo "✅ All ITSM ports are now free"
    else
        echo "⚠️  Some ports are still in use:"
        echo "$PORTS_IN_USE"
    fi
else
    echo "   (netstat not available, skipping port check)"
fi

echo ""
echo "======================================"
echo "  System Shutdown Complete"
echo "======================================"
echo ""
echo "To start the system again, run:"
echo "  ./scripts/Linux/startup/start-system.sh"
echo ""
