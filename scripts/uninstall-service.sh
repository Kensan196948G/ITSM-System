#!/bin/bash

# ITSM-Sec Nexus Systemd Service Uninstaller
# このスクリプトはsystemdサービスをアンインストールします

set -e

SERVICE_NAME="itsm-sec-nexus.service"
SYSTEMD_DIR="/etc/systemd/system"
SERVICE_PATH="${SYSTEMD_DIR}/${SERVICE_NAME}"

echo "========================================"
echo "ITSM-Sec Nexus Service Uninstaller"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ このスクリプトはroot権限で実行する必要があります"
    echo "   以下のコマンドで再実行してください:"
    echo "   sudo $0"
    exit 1
fi

# Check if service is installed
if [ ! -f "${SERVICE_PATH}" ]; then
    echo "⚠️  サービスがインストールされていません: ${SERVICE_PATH}"
    exit 0
fi

echo "🔍 サービスの状態を確認中..."
if systemctl is-active --quiet ${SERVICE_NAME%.service}; then
    echo "🛑 サービスを停止中..."
    systemctl stop ${SERVICE_NAME%.service}
    echo "✅ サービスを停止しました"
fi

if systemctl is-enabled --quiet ${SERVICE_NAME%.service} 2>/dev/null; then
    echo "🔓 自動起動を無効化中..."
    systemctl disable ${SERVICE_NAME%.service}
    echo "✅ 自動起動を無効化しました"
fi

echo ""
echo "🗑️  サービスファイルを削除中..."
rm -f "${SERVICE_PATH}"
echo "✅ サービスファイルを削除しました"

echo ""
echo "🔄 systemdデーモンをリロード中..."
systemctl daemon-reload
systemctl reset-failed 2>/dev/null || true
echo "✅ systemdデーモンをリロードしました"

echo ""
echo "========================================"
echo "✅ アンインストール完了！"
echo "========================================"
