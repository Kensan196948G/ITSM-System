#!/bin/bash
# Linux - 全サービス停止スクリプト
# ITSM-Sec Nexus Stop All Services

echo "=========================================="
echo "🛑 ITSM-Sec Nexus - 全サービス停止"
echo "=========================================="
echo ""

# プロジェクトルートに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Node.jsプロセスを停止
echo "1. Node.jsプロセスを停止中..."
NODE_PIDS=$(pgrep -f "node backend/server.js")
if [ -n "$NODE_PIDS" ]; then
    kill $NODE_PIDS 2>/dev/null || kill -9 $NODE_PIDS 2>/dev/null
    echo "   ✅ Node.jsプロセスを停止しました (PID: $NODE_PIDS)"
else
    echo "   ℹ️  実行中のNode.jsプロセスはありません"
fi

# Pythonプロセスを停止（http.server）
echo ""
echo "2. Pythonプロセスを停止中..."
PYTHON_PIDS=$(pgrep -f "python.*http.server")
if [ -n "$PYTHON_PIDS" ]; then
    kill $PYTHON_PIDS 2>/dev/null || kill -9 $PYTHON_PIDS 2>/dev/null
    echo "   ✅ Pythonプロセスを停止しました (PID: $PYTHON_PIDS)"
else
    echo "   ℹ️  実行中のPythonプロセスはありません"
fi

# ログファイルの確認
echo ""
echo "3. ログファイル確認..."
if [ -f "backend-dev.log" ] || [ -f "frontend-dev.log" ]; then
    echo "   📋 ログファイル:"
    [ -f "backend-dev.log" ] && echo "      - backend-dev.log ($(wc -l < backend-dev.log) 行)"
    [ -f "frontend-dev.log" ] && echo "      - frontend-dev.log ($(wc -l < frontend-dev.log) 行)"
fi

echo ""
echo "=========================================="
echo "✅ 全サービス停止完了"
echo "=========================================="
echo ""
