#!/bin/bash
# Linux - 開発環境起動スクリプト
# ITSM-Sec Nexus Development Environment Startup

set -e

echo "=========================================="
echo "🚀 ITSM-Sec Nexus - 開発環境起動"
echo "=========================================="
echo ""

# プロジェクトルートに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# 環境設定
echo "1. 環境設定を読み込み中..."
cp config/env/.env.development .env
export NODE_ENV=development
echo "   ✅ 開発環境設定を適用しました"

# データベース確認
echo ""
echo "2. データベース確認中..."
DB_PATH="backend/databases/dev/itsm_dev.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    echo "   ✅ データベース: $DB_PATH ($DB_SIZE)"
else
    echo "   ⚠️  データベースが見つかりません"
    echo "   🔧 初回起動時に自動作成されます"
fi

# Node.jsバージョン確認
echo ""
echo "3. Node.jsバージョン確認..."
NODE_VERSION=$(node --version)
echo "   Node.js: $NODE_VERSION"

# バックエンド起動
echo ""
echo "4. バックエンドサーバー起動中..."
echo "   ポート: 5443 (HTTPS)"
echo "   IP: 192.168.0.187"

nohup node backend/server.js > backend-dev.log 2>&1 &
BACKEND_PID=$!
echo "   ✅ バックエンド起動完了 (PID: $BACKEND_PID)"
sleep 3

# フロントエンド起動
echo ""
echo "5. フロントエンドサーバー起動中..."
echo "   ポート: 5050"

nohup python3 -m http.server 5050 --bind 0.0.0.0 > frontend-dev.log 2>&1 &
FRONTEND_PID=$!
echo "   ✅ フロントエンド起動完了 (PID: $FRONTEND_PID)"

echo ""
echo "=========================================="
echo "✅ 開発環境起動完了"
echo "=========================================="
echo ""
echo "📍 アクセスURL:"
echo "   フロントエンド: http://192.168.0.187:5050"
echo "   バックエンドAPI: https://192.168.0.187:5443"
echo "   Swagger API Docs: https://192.168.0.187:5443/api-docs"
echo ""
echo "📝 次のステップ:"
echo "   - ブラウザでフロントエンドにアクセス"
echo "   - ログ確認: tail -f backend-dev.log"
echo "   - 停止: ./scripts/Linux/stop-all.sh"
echo ""
echo "📊 プロセスID:"
echo "   Backend: $BACKEND_PID"
echo "   Frontend: $FRONTEND_PID"
echo ""
