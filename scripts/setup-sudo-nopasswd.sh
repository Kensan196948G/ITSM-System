#!/bin/bash
#
# ITSM-System sudo NOPASSWD セットアップスクリプト
#
# 使用方法:
#   chmod +x scripts/setup-sudo-nopasswd.sh
#   ./scripts/setup-sudo-nopasswd.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SUDOERS_SOURCE="$SCRIPT_DIR/itsm-sudoers-config"
SUDOERS_TARGET="/etc/sudoers.d/itsm-system"

echo "======================================"
echo "ITSM-System sudo NOPASSWD セットアップ"
echo "======================================"
echo ""

# 権限チェック
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  このスクリプトはroot権限で実行する必要があります"
    echo ""
    echo "以下のコマンドで実行してください:"
    echo "  sudo $0"
    exit 1
fi

# sudoers設定ファイルの存在確認
if [ ! -f "$SUDOERS_SOURCE" ]; then
    echo "❌ sudoers設定ファイルが見つかりません: $SUDOERS_SOURCE"
    exit 1
fi

echo "📝 sudoers設定ファイル: $SUDOERS_SOURCE"
echo ""

# 構文チェック
echo "🔍 sudoers設定ファイルの構文チェック中..."
if visudo -c -f "$SUDOERS_SOURCE"; then
    echo "✅ 構文チェック成功"
else
    echo "❌ 構文エラーが検出されました"
    exit 1
fi
echo ""

# バックアップ
if [ -f "$SUDOERS_TARGET" ]; then
    BACKUP_FILE="${SUDOERS_TARGET}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📦 既存の設定をバックアップ: $BACKUP_FILE"
    cp "$SUDOERS_TARGET" "$BACKUP_FILE"
    echo ""
fi

# インストール
echo "📥 sudoers設定をインストール中..."
cp "$SUDOERS_SOURCE" "$SUDOERS_TARGET"
chmod 440 "$SUDOERS_TARGET"
chown root:root "$SUDOERS_TARGET"
echo "✅ インストール完了: $SUDOERS_TARGET"
echo ""

# 最終検証
echo "🔍 最終検証中..."
if visudo -c; then
    echo "✅ sudoers設定が正常に適用されました"
else
    echo "❌ sudoers設定に問題があります。バックアップから復元してください"
    exit 1
fi
echo ""

echo "======================================"
echo "✅ セットアップ完了"
echo "======================================"
echo ""
echo "以下のコマンドがパスワード不要で実行できます:"
echo ""
echo "  sudo systemctl restart itsm-system-https.service"
echo "  sudo systemctl restart itsm-frontend-https.service"
echo "  sudo journalctl -u itsm-system-https.service"
echo "  sudo netstat -tulpn"
echo ""
echo "テスト実行:"
echo "  sudo systemctl status itsm-system-https.service"
echo ""
