#!/bin/bash

# ========================================
# ITSM-Sec Nexus Systemd Uninstaller
# ========================================
# systemd自動起動設定のアンインストールスクリプト
# ========================================

set -e

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# サービス名
SERVICE_DEV="itsm-nexus-dev"
SERVICE_PROD="itsm-nexus-prod"
SYSTEMD_SYSTEM_DIR="/etc/systemd/system"

# ロゴ表示
echo -e "${BLUE}"
echo "========================================"
echo " ITSM-Sec Nexus Systemd Uninstaller"
echo "========================================"
echo -e "${NC}"

# Root権限チェック
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ このスクリプトはroot権限で実行する必要があります${NC}"
    echo -e "${YELLOW}   以下のコマンドで再実行してください:${NC}"
    echo -e "   ${GREEN}sudo $0${NC}"
    exit 1
fi

# 確認
echo -e "${YELLOW}⚠️  警告: このスクリプトは以下の操作を実行します:${NC}"
echo ""
echo "  1. itsm-nexus-dev サービスの停止と削除"
echo "  2. itsm-nexus-prod サービスの停止と削除"
echo "  3. systemd設定ファイルの削除"
echo ""
echo -e "${RED}この操作は元に戻せません。${NC}"
echo ""
read -p "本当にアンインストールしますか? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${BLUE}アンインストールをキャンセルしました${NC}"
    exit 0
fi

echo ""

# 開発環境サービスの処理
if systemctl list-unit-files | grep -q "${SERVICE_DEV}.service"; then
    echo -e "${BLUE}🛑 開発環境サービスを停止中...${NC}"

    # サービスが実行中なら停止
    if systemctl is-active --quiet ${SERVICE_DEV}.service; then
        systemctl stop ${SERVICE_DEV}.service
        echo -e "${GREEN}✅ 開発環境サービスを停止しました${NC}"
    else
        echo -e "${YELLOW}ℹ️  開発環境サービスは既に停止しています${NC}"
    fi

    # 自動起動が有効なら無効化
    if systemctl is-enabled --quiet ${SERVICE_DEV}.service 2>/dev/null; then
        systemctl disable ${SERVICE_DEV}.service
        echo -e "${GREEN}✅ 開発環境の自動起動を無効化しました${NC}"
    fi

    # サービスファイルを削除
    if [ -f "${SYSTEMD_SYSTEM_DIR}/${SERVICE_DEV}.service" ]; then
        rm "${SYSTEMD_SYSTEM_DIR}/${SERVICE_DEV}.service"
        echo -e "${GREEN}✅ 開発環境のサービスファイルを削除しました${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  開発環境サービスはインストールされていません${NC}"
fi

echo ""

# 本番環境サービスの処理
if systemctl list-unit-files | grep -q "${SERVICE_PROD}.service"; then
    echo -e "${BLUE}🛑 本番環境サービスを停止中...${NC}"

    # サービスが実行中なら停止
    if systemctl is-active --quiet ${SERVICE_PROD}.service; then
        systemctl stop ${SERVICE_PROD}.service
        echo -e "${GREEN}✅ 本番環境サービスを停止しました${NC}"
    else
        echo -e "${YELLOW}ℹ️  本番環境サービスは既に停止しています${NC}"
    fi

    # 自動起動が有効なら無効化
    if systemctl is-enabled --quiet ${SERVICE_PROD}.service 2>/dev/null; then
        systemctl disable ${SERVICE_PROD}.service
        echo -e "${GREEN}✅ 本番環境の自動起動を無効化しました${NC}"
    fi

    # サービスファイルを削除
    if [ -f "${SYSTEMD_SYSTEM_DIR}/${SERVICE_PROD}.service" ]; then
        rm "${SYSTEMD_SYSTEM_DIR}/${SERVICE_PROD}.service"
        echo -e "${GREEN}✅ 本番環境のサービスファイルを削除しました${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  本番環境サービスはインストールされていません${NC}"
fi

echo ""

# systemdデーモンのリロード
echo -e "${BLUE}🔄 systemdデーモンをリロード中...${NC}"
systemctl daemon-reload
systemctl reset-failed
echo -e "${GREEN}✅ systemdデーモンをリロードしました${NC}"

echo ""
echo -e "${GREEN}"
echo "========================================"
echo "  ✅ アンインストール完了！"
echo "========================================"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}📝 注意事項:${NC}"
echo ""
echo "  - アプリケーションファイルは削除されていません"
echo "  - 環境変数ファイルは削除されていません"
echo "  - データベースファイルは削除されていません"
echo "  - ログファイルは削除されていません"
echo ""
echo -e "${CYAN}これらのファイルを手動で削除する場合:${NC}"
echo ""
echo "  アプリケーション全体を削除:"
echo "    rm -rf /mnt/LinuxHDD/ITSM-System"
echo ""
echo "  ログのみ削除:"
echo "    rm -rf /mnt/LinuxHDD/ITSM-System/logs/*"
echo ""
echo "  データベースのみ削除:"
echo "    rm /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db*"
echo ""
echo "========================================"
echo ""
echo -e "${BLUE}再インストールする場合:${NC}"
echo "  sudo /mnt/LinuxHDD/ITSM-System/scripts/install-systemd.sh"
echo ""
