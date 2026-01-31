#!/bin/bash

# ========================================
# ITSM-Sec Nexus Systemd Installer
# ========================================
# systemd自動起動設定のインストールスクリプト
# ========================================

set -e

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# スクリプトのディレクトリとルートディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SYSTEMD_DIR="${ROOT_DIR}/systemd"
SYSTEMD_SYSTEM_DIR="/etc/systemd/system"

# ロゴ表示
echo -e "${BLUE}"
echo "========================================"
echo " ITSM-Sec Nexus Systemd Installer"
echo "========================================"
echo -e "${NC}"

# Root権限チェック
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ このスクリプトはroot権限で実行する必要があります${NC}"
    echo -e "${YELLOW}   以下のコマンドで再実行してください:${NC}"
    echo -e "   ${GREEN}sudo $0${NC}"
    exit 1
fi

# 環境選択
echo -e "${BLUE}📋 インストールする環境を選択してください:${NC}"
echo ""
echo "  1) 開発環境 (Development)"
echo "  2) 本番環境 (Production)"
echo "  3) 両方インストール"
echo ""
read -p "選択 (1/2/3): " ENV_CHOICE

case $ENV_CHOICE in
    1)
        INSTALL_DEV=true
        INSTALL_PROD=false
        ENV_NAME="開発環境"
        ;;
    2)
        INSTALL_DEV=false
        INSTALL_PROD=true
        ENV_NAME="本番環境"
        ;;
    3)
        INSTALL_DEV=true
        INSTALL_PROD=true
        ENV_NAME="開発環境と本番環境"
        ;;
    *)
        echo -e "${RED}❌ 無効な選択です${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ ${ENV_NAME} をインストールします${NC}"
echo ""

# 既存プロセスの確認
echo -e "${BLUE}📋 既存のITSM-Sec Nexusプロセスを確認中...${NC}"
RUNNING_PROCESSES=$(ps aux | grep -E "node.*backend/server.js" | grep -v grep || true)

if [ -n "$RUNNING_PROCESSES" ]; then
    echo -e "${YELLOW}⚠️  以下のプロセスが実行中です:${NC}"
    echo "$RUNNING_PROCESSES"
    echo ""
    read -p "これらのプロセスを停止しますか? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🛑 プロセスを停止中...${NC}"
        pkill -f "node.*backend/server.js" || true
        sleep 2
        echo -e "${GREEN}✅ プロセスを停止しました${NC}"
    fi
fi

# 既存サービスの停止と無効化
if [ "$INSTALL_DEV" = true ]; then
    if systemctl is-active --quiet itsm-nexus-dev.service 2>/dev/null; then
        echo -e "${BLUE}🛑 既存の開発環境サービスを停止中...${NC}"
        systemctl stop itsm-nexus-dev.service
    fi
    if systemctl is-enabled --quiet itsm-nexus-dev.service 2>/dev/null; then
        systemctl disable itsm-nexus-dev.service
    fi
fi

if [ "$INSTALL_PROD" = true ]; then
    if systemctl is-active --quiet itsm-nexus-prod.service 2>/dev/null; then
        echo -e "${BLUE}🛑 既存の本番環境サービスを停止中...${NC}"
        systemctl stop itsm-nexus-prod.service
    fi
    if systemctl is-enabled --quiet itsm-nexus-prod.service 2>/dev/null; then
        systemctl disable itsm-nexus-prod.service
    fi
fi

# サービスファイルのインストール
echo ""
echo -e "${BLUE}📦 サービスファイルをインストール中...${NC}"

if [ "$INSTALL_DEV" = true ]; then
    if [ ! -f "${SYSTEMD_DIR}/itsm-nexus-dev.service" ]; then
        echo -e "${RED}❌ サービスファイルが見つかりません: ${SYSTEMD_DIR}/itsm-nexus-dev.service${NC}"
        exit 1
    fi
    cp "${SYSTEMD_DIR}/itsm-nexus-dev.service" "${SYSTEMD_SYSTEM_DIR}/"
    chmod 644 "${SYSTEMD_SYSTEM_DIR}/itsm-nexus-dev.service"
    echo -e "${GREEN}✅ 開発環境サービスファイルをインストールしました${NC}"
fi

if [ "$INSTALL_PROD" = true ]; then
    if [ ! -f "${SYSTEMD_DIR}/itsm-nexus-prod.service" ]; then
        echo -e "${RED}❌ サービスファイルが見つかりません: ${SYSTEMD_DIR}/itsm-nexus-prod.service${NC}"
        exit 1
    fi
    cp "${SYSTEMD_DIR}/itsm-nexus-prod.service" "${SYSTEMD_SYSTEM_DIR}/"
    chmod 644 "${SYSTEMD_SYSTEM_DIR}/itsm-nexus-prod.service"
    echo -e "${GREEN}✅ 本番環境サービスファイルをインストールしました${NC}"
fi

# 環境変数ファイルの確認
echo ""
echo -e "${BLUE}📋 環境変数ファイルを確認中...${NC}"

if [ "$INSTALL_DEV" = true ]; then
    if [ ! -f "${ROOT_DIR}/config/env/.env.development" ]; then
        echo -e "${YELLOW}⚠️  開発環境の設定ファイルが見つかりません${NC}"
        echo -e "${YELLOW}   ${ROOT_DIR}/config/env/.env.development を作成してください${NC}"
    else
        echo -e "${GREEN}✅ 開発環境の設定ファイルを確認しました${NC}"
    fi
fi

if [ "$INSTALL_PROD" = true ]; then
    if [ ! -f "${ROOT_DIR}/config/env/.env.production" ]; then
        echo -e "${YELLOW}⚠️  本番環境の設定ファイルが見つかりません${NC}"
        if [ -f "${ROOT_DIR}/config/env/.env.production.example" ]; then
            echo -e "${YELLOW}   .env.production.example をコピーして作成しますか? (y/N)${NC}"
            read -p "> " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cp "${ROOT_DIR}/config/env/.env.production.example" "${ROOT_DIR}/config/env/.env.production"
                echo -e "${GREEN}✅ .env.production を作成しました（要編集）${NC}"
                echo -e "${YELLOW}   ⚠️  JWT_SECRET などの機密情報を設定してください${NC}"
            fi
        else
            echo -e "${YELLOW}   ${ROOT_DIR}/config/env/.env.production を作成してください${NC}"
        fi
    else
        echo -e "${GREEN}✅ 本番環境の設定ファイルを確認しました${NC}"
    fi
fi

# ログディレクトリの作成
echo ""
echo -e "${BLUE}📂 ログディレクトリを作成中...${NC}"
mkdir -p "${ROOT_DIR}/logs"
chown kensan:kensan "${ROOT_DIR}/logs"
chmod 755 "${ROOT_DIR}/logs"
echo -e "${GREEN}✅ ログディレクトリを作成しました${NC}"

# systemdデーモンのリロード
echo ""
echo -e "${BLUE}🔄 systemdデーモンをリロード中...${NC}"
systemctl daemon-reload
echo -e "${GREEN}✅ systemdデーモンをリロードしました${NC}"

# インストール完了
echo ""
echo -e "${GREEN}"
echo "========================================"
echo "  ✅ インストール完了！"
echo "========================================"
echo -e "${NC}"
echo ""

# 使用方法の表示
if [ "$INSTALL_DEV" = true ]; then
    echo -e "${BLUE}【開発環境】サービス管理コマンド:${NC}"
    echo ""
    echo -e "  ${GREEN}サービスを起動:${NC}"
    echo "    sudo systemctl start itsm-nexus-dev"
    echo ""
    echo -e "  ${GREEN}サービスを停止:${NC}"
    echo "    sudo systemctl stop itsm-nexus-dev"
    echo ""
    echo -e "  ${GREEN}サービスを再起動:${NC}"
    echo "    sudo systemctl restart itsm-nexus-dev"
    echo ""
    echo -e "  ${GREEN}サービスの状態を確認:${NC}"
    echo "    sudo systemctl status itsm-nexus-dev"
    echo ""
    echo -e "  ${GREEN}自動起動を有効化:${NC}"
    echo "    sudo systemctl enable itsm-nexus-dev"
    echo ""
    echo -e "  ${GREEN}自動起動を無効化:${NC}"
    echo "    sudo systemctl disable itsm-nexus-dev"
    echo ""
    echo -e "  ${GREEN}ログをリアルタイム表示:${NC}"
    echo "    sudo journalctl -u itsm-nexus-dev -f"
    echo ""
    echo -e "  ${GREEN}ログを表示（最新100行）:${NC}"
    echo "    sudo journalctl -u itsm-nexus-dev -n 100"
    echo ""
fi

if [ "$INSTALL_PROD" = true ]; then
    echo -e "${BLUE}【本番環境】サービス管理コマンド:${NC}"
    echo ""
    echo -e "  ${GREEN}サービスを起動:${NC}"
    echo "    sudo systemctl start itsm-nexus-prod"
    echo ""
    echo -e "  ${GREEN}サービスを停止:${NC}"
    echo "    sudo systemctl stop itsm-nexus-prod"
    echo ""
    echo -e "  ${GREEN}サービスを再起動:${NC}"
    echo "    sudo systemctl restart itsm-nexus-prod"
    echo ""
    echo -e "  ${GREEN}サービスの状態を確認:${NC}"
    echo "    sudo systemctl status itsm-nexus-prod"
    echo ""
    echo -e "  ${GREEN}自動起動を有効化:${NC}"
    echo "    sudo systemctl enable itsm-nexus-prod"
    echo ""
    echo -e "  ${GREEN}自動起動を無効化:${NC}"
    echo "    sudo systemctl disable itsm-nexus-prod"
    echo ""
    echo -e "  ${GREEN}ログをリアルタイム表示:${NC}"
    echo "    sudo journalctl -u itsm-nexus-prod -f"
    echo ""
    echo -e "  ${GREEN}ログを表示（最新100行）:${NC}"
    echo "    sudo journalctl -u itsm-nexus-prod -n 100"
    echo ""
fi

echo -e "${YELLOW}📝 次のステップ:${NC}"
echo ""
if [ "$INSTALL_DEV" = true ]; then
    echo "  1. 開発環境を起動: sudo systemctl start itsm-nexus-dev"
fi
if [ "$INSTALL_PROD" = true ]; then
    echo "  1. 本番環境の設定ファイルを編集: ${ROOT_DIR}/config/env/.env.production"
    echo "  2. 本番環境を起動: sudo systemctl start itsm-nexus-prod"
    echo "  3. 自動起動を有効化: sudo systemctl enable itsm-nexus-prod"
fi
echo ""
echo "========================================"
