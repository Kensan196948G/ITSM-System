#!/bin/bash

# ITSM-Sec Nexus Systemd Service Installer
# このスクリプトはsystemdサービスをインストールします

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="itsm-sec-nexus.service"
SERVICE_FILE="${SCRIPT_DIR}/${SERVICE_NAME}"
SYSTEMD_DIR="/etc/systemd/system"

echo "========================================"
echo "ITSM-Sec Nexus Service Installer"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ このスクリプトはroot権限で実行する必要があります"
    echo "   以下のコマンドで再実行してください:"
    echo "   sudo $0"
    exit 1
fi

# Check if service file exists
if [ ! -f "${SERVICE_FILE}" ]; then
    echo "❌ サービスファイルが見つかりません: ${SERVICE_FILE}"
    exit 1
fi

echo "📋 現在実行中のITSM-Sec Nexusプロセスを確認..."
RUNNING_PROCESSES=$(ps aux | grep -E "node.*server.js" | grep -v grep || true)

if [ -n "$RUNNING_PROCESSES" ]; then
    echo "⚠️  以下のプロセスが実行中です:"
    echo "$RUNNING_PROCESSES"
    echo ""
    read -p "これらのプロセスを停止しますか? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 プロセスを停止中..."
        pkill -f "node.*server.js" || true
        sleep 2
        echo "✅ プロセスを停止しました"
    fi
fi

echo ""
echo "📦 サービスファイルをインストール中..."
cp "${SERVICE_FILE}" "${SYSTEMD_DIR}/${SERVICE_NAME}"
chmod 644 "${SYSTEMD_DIR}/${SERVICE_NAME}"
echo "✅ サービスファイルをコピーしました: ${SYSTEMD_DIR}/${SERVICE_NAME}"

echo ""
echo "🔄 systemdデーモンをリロード中..."
systemctl daemon-reload
echo "✅ systemdデーモンをリロードしました"

echo ""
echo "========================================"
echo "✅ インストール完了！"
echo "========================================"
echo ""
echo "📝 次のコマンドでサービスを管理できます:"
echo ""
echo "  サービスを起動:"
echo "    sudo systemctl start ${SERVICE_NAME%.service}"
echo ""
echo "  サービスを停止:"
echo "    sudo systemctl stop ${SERVICE_NAME%.service}"
echo ""
echo "  サービスを再起動:"
echo "    sudo systemctl restart ${SERVICE_NAME%.service}"
echo ""
echo "  サービスの状態を確認:"
echo "    sudo systemctl status ${SERVICE_NAME%.service}"
echo ""
echo "  システム起動時に自動起動を有効化:"
echo "    sudo systemctl enable ${SERVICE_NAME%.service}"
echo ""
echo "  ログを表示:"
echo "    sudo journalctl -u ${SERVICE_NAME%.service} -f"
echo ""
echo "========================================"
