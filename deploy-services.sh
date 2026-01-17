#!/bin/bash

# ITSM-Sec Nexus - 環境別サービス デプロイスクリプト
# 開発環境と本番環境を分離してデプロイ

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# シンボリックリンク対応: 実際のスクリプトの場所を取得
REAL_SCRIPT="$(readlink -f "${BASH_SOURCE[0]}")"
REAL_SCRIPT_DIR="$(dirname "$REAL_SCRIPT")"
PROJECT_ROOT="$(cd "${REAL_SCRIPT_DIR}/.." && pwd)"
SERVICES_DIR="${PROJECT_ROOT}/services"
DEV_SERVICE="itsm-sec-nexus-dev.service"
PROD_SERVICE="itsm-sec-nexus-prod.service"
OLD_SERVICE="itsm-sec-nexus.service"
SYSTEMD_DIR="/etc/systemd/system"

echo "========================================"
echo "ITSM-Sec Nexus 環境別サービス デプロイ"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ このスクリプトはroot権限で実行する必要があります"
    echo "   sudo $0"
    exit 1
fi

echo "🔍 既存サービスの確認..."

# 古いサービスが存在する場合は停止
if systemctl is-active --quiet itsm-sec-nexus 2>/dev/null; then
    echo "🛑 既存の統合サービスを停止中..."
    systemctl stop itsm-sec-nexus
    echo "✅ 既存サービスを停止しました"
fi

if systemctl is-enabled --quiet itsm-sec-nexus 2>/dev/null; then
    echo "🔓 既存サービスの自動起動を無効化中..."
    systemctl disable itsm-sec-nexus
    echo "✅ 既存サービスの自動起動を無効化しました"
fi

# 古いサービスファイルを削除
if [ -f "${SYSTEMD_DIR}/${OLD_SERVICE}" ]; then
    echo "🗑️  古いサービスファイルを削除中..."
    rm -f "${SYSTEMD_DIR}/${OLD_SERVICE}"
    echo "✅ 古いサービスファイルを削除しました"
fi

echo ""
echo "📦 新しいサービスファイルをインストール中..."

# 開発環境サービス
cp "${SERVICES_DIR}/${DEV_SERVICE}" "${SYSTEMD_DIR}/${DEV_SERVICE}"
chmod 644 "${SYSTEMD_DIR}/${DEV_SERVICE}"
echo "✅ 開発環境サービスをインストール: ${DEV_SERVICE}"

# 本番環境サービス
cp "${SERVICES_DIR}/${PROD_SERVICE}" "${SYSTEMD_DIR}/${PROD_SERVICE}"
chmod 644 "${SYSTEMD_DIR}/${PROD_SERVICE}"
echo "✅ 本番環境サービスをインストール: ${PROD_SERVICE}"

echo ""
echo "🔄 systemdデーモンをリロード中..."
systemctl daemon-reload
echo "✅ systemdデーモンをリロードしました"

echo ""
echo "========================================"
echo "✅ デプロイ完了！"
echo "========================================"
echo ""
echo "📝 サービス管理コマンド:"
echo ""
echo "【開発環境】(HTTP: ポート8080)"
echo "  起動:   sudo systemctl start itsm-sec-nexus-dev"
echo "  停止:   sudo systemctl stop itsm-sec-nexus-dev"
echo "  再起動: sudo systemctl restart itsm-sec-nexus-dev"
echo "  状態:   sudo systemctl status itsm-sec-nexus-dev"
echo "  ログ:   sudo journalctl -u itsm-sec-nexus-dev -f"
echo "  自動起動: sudo systemctl enable itsm-sec-nexus-dev"
echo ""
echo "【本番環境】(HTTPS: ポート6443)"
echo "  起動:   sudo systemctl start itsm-sec-nexus-prod"
echo "  停止:   sudo systemctl stop itsm-sec-nexus-prod"
echo "  再起動: sudo systemctl restart itsm-sec-nexus-prod"
echo "  状態:   sudo systemctl status itsm-sec-nexus-prod"
echo "  ログ:   sudo journalctl -u itsm-sec-nexus-prod -f"
echo "  自動起動: sudo systemctl enable itsm-sec-nexus-prod"
echo ""
echo "📝 便利な管理スクリプト:"
echo "  ./manage-env.sh を使用してください"
echo ""
echo "========================================"
