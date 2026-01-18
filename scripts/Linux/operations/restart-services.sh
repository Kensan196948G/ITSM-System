#!/bin/bash
#
# ITSM-System 全サービス再起動スクリプト
# sudoers NOPASSWD設定後は自動実行可能
#

set -e

echo "======================================"
echo "ITSM-System サービス再起動"
echo "======================================"
echo ""

# バックエンドHTTPSサービスの再起動
echo "🔄 バックエンドHTTPSサービスを再起動中..."
sudo systemctl restart itsm-system-https.service
sleep 2

# ステータス確認
if sudo systemctl is-active --quiet itsm-system-https.service; then
    echo "✅ itsm-system-https.service - 起動成功"
else
    echo "❌ itsm-system-https.service - 起動失敗"
    sudo systemctl status itsm-system-https.service
    exit 1
fi

# フロントエンドHTTPSサービスの再起動
echo "🔄 フロントエンドHTTPSサービスを再起動中..."
sudo systemctl restart itsm-frontend-https.service
sleep 2

# ステータス確認
if sudo systemctl is-active --quiet itsm-frontend-https.service; then
    echo "✅ itsm-frontend-https.service - 起動成功"
else
    echo "❌ itsm-frontend-https.service - 起動失敗"
    sudo systemctl status itsm-frontend-https.service
    exit 1
fi

echo ""
echo "======================================"
echo "✅ 全サービス再起動完了"
echo "======================================"
echo ""

# サービス状態の表示
echo "📊 サービス状態:"
sudo systemctl status itsm-system-https.service --no-pager -l | head -5
echo ""
sudo systemctl status itsm-frontend-https.service --no-pager -l | head -5
echo ""

# ポート確認
echo "🔌 ポート確認:"
sudo netstat -tulpn | grep -E ':(5443|5050)' || echo "⚠️ ポートが見つかりません"
echo ""
