#!/bin/bash
################################################################################
# ITSM-System - Systemd Services Setup Script (統合版)
# 用途: sudoers設定 + systemdサービスインストール（HTTP/HTTPS）
# 統合元: install-systemd.sh + install-https-services.sh +
#         setup-sudoers.sh + setup-sudo-nopasswd.sh
################################################################################

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CURRENT_USER=$(whoami)

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}ITSM-System Services Setup${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${BLUE}Current user: $CURRENT_USER${NC}"
echo -e "${BLUE}Project root: $PROJECT_ROOT${NC}"
echo ""

#==============================================================================
# Step 1: Sudoers Configuration
#==============================================================================
echo -e "${GREEN}[Step 1/3] Sudoers Configuration${NC}"
echo ""
echo "This step configures sudoers to allow password-free execution"
echo "of systemctl commands for ITSM services."
echo ""
read -p "Do you want to configure sudoers? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Configuring sudoers...${NC}"
    echo "This will require your sudo password (one time only)."
    echo ""

    # sudoers設定ファイルを作成
    SUDOERS_CONTENT=$(cat <<EOF
# ITSM-System systemd management (no password required)
# Created: $(date)
# User: $CURRENT_USER

# Backend HTTPS Service
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start itsm-system-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop itsm-system-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart itsm-system-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl status itsm-system-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl enable itsm-system-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl disable itsm-system-https

# Frontend HTTPS Service
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start itsm-frontend-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop itsm-frontend-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart itsm-frontend-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl status itsm-frontend-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl enable itsm-frontend-https
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl disable itsm-frontend-https

# Backend HTTP Service (Legacy)
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start itsm-system
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop itsm-system
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart itsm-system
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl status itsm-system
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl enable itsm-system
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl disable itsm-system

# Frontend HTTP Service (Legacy)
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start itsm-frontend
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop itsm-frontend
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart itsm-frontend
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl status itsm-frontend
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl enable itsm-frontend
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl disable itsm-frontend

# System management
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl daemon-reload
$CURRENT_USER ALL=(ALL) NOPASSWD: /usr/bin/journalctl
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/netstat
EOF
)

    # 一時ファイルに書き込み
    TEMP_SUDOERS="/tmp/itsm-system-sudoers-$$"
    echo "$SUDOERS_CONTENT" > "$TEMP_SUDOERS"

    # 構文チェック
    echo -e "${YELLOW}Validating sudoers configuration...${NC}"
    if sudo visudo -c -f "$TEMP_SUDOERS"; then
        echo -e "${GREEN}✓ Sudoers configuration is valid${NC}"
    else
        echo -e "${RED}✗ Sudoers configuration has errors${NC}"
        rm -f "$TEMP_SUDOERS"
        exit 1
    fi

    # バックアップ
    if [ -f "/etc/sudoers.d/itsm-system" ]; then
        BACKUP_FILE="/etc/sudoers.d/itsm-system.backup.$(date +%Y%m%d_%H%M%S)"
        echo "Backing up existing configuration: $BACKUP_FILE"
        sudo cp /etc/sudoers.d/itsm-system "$BACKUP_FILE"
    fi

    # インストール
    sudo cp "$TEMP_SUDOERS" /etc/sudoers.d/itsm-system
    sudo chmod 440 /etc/sudoers.d/itsm-system
    sudo chown root:root /etc/sudoers.d/itsm-system
    rm -f "$TEMP_SUDOERS"

    echo -e "${GREEN}✓ Sudoers configuration installed${NC}"
    echo ""
else
    echo "Skipping sudoers configuration"
    echo -e "${YELLOW}Note: You will need to enter password for systemctl commands${NC}"
    echo ""
fi

#==============================================================================
# Step 2: Service Type Selection
#==============================================================================
echo -e "${GREEN}[Step 2/3] Service Type Selection${NC}"
echo ""
echo "Select the service type to install:"
echo "1) HTTPS services (recommended for production)"
echo "2) HTTP services (legacy, not recommended)"
echo "3) Both HTTP and HTTPS services"
read -p "Enter choice (1-3): " SERVICE_CHOICE

case "$SERVICE_CHOICE" in
    1)
        INSTALL_HTTPS=true
        INSTALL_HTTP=false
        echo "Installing HTTPS services only"
        ;;
    2)
        INSTALL_HTTPS=false
        INSTALL_HTTP=true
        echo "Installing HTTP services only"
        ;;
    3)
        INSTALL_HTTPS=true
        INSTALL_HTTP=true
        echo "Installing both HTTP and HTTPS services"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac
echo ""

#==============================================================================
# Step 3: Systemd Service Installation
#==============================================================================
echo -e "${GREEN}[Step 3/3] Installing Systemd Services${NC}"
echo ""

# ログディレクトリの作成
mkdir -p "$PROJECT_ROOT/logs"

#------------------------------------------------------------------------------
# HTTPS Services Installation
#------------------------------------------------------------------------------
if [ "$INSTALL_HTTPS" = true ]; then
    echo -e "${BLUE}Installing HTTPS services...${NC}"

    # 既存のテストサーバーを停止
    echo "Stopping test servers (if running)..."
    pkill -f "node backend/server.js" 2>/dev/null || true
    pkill -f "node scripts/frontend-https-server.js" 2>/dev/null || true
    sleep 2

    # 既存のHTTPサービスを停止
    if systemctl is-active --quiet itsm-system 2>/dev/null; then
        echo "Stopping existing HTTP backend service..."
        sudo systemctl stop itsm-system || true
    fi
    if systemctl is-active --quiet itsm-frontend 2>/dev/null; then
        echo "Stopping existing HTTP frontend service..."
        sudo systemctl stop itsm-frontend || true
    fi

    # サービスファイルの存在確認
    if [ ! -f "$PROJECT_ROOT/systemd/itsm-system-https.service" ]; then
        echo -e "${RED}Error: Service file not found: $PROJECT_ROOT/systemd/itsm-system-https.service${NC}"
        exit 1
    fi
    if [ ! -f "$PROJECT_ROOT/systemd/itsm-frontend-https.service" ]; then
        echo -e "${RED}Error: Service file not found: $PROJECT_ROOT/systemd/itsm-frontend-https.service${NC}"
        exit 1
    fi

    # サービスファイルをコピー
    echo "Copying HTTPS service files..."
    sudo cp "$PROJECT_ROOT/systemd/itsm-system-https.service" /etc/systemd/system/
    sudo cp "$PROJECT_ROOT/systemd/itsm-frontend-https.service" /etc/systemd/system/

    # systemdをリロード
    echo "Reloading systemd daemon..."
    sudo systemctl daemon-reload

    # サービスを有効化
    echo "Enabling HTTPS services..."
    sudo systemctl enable itsm-system-https.service
    sudo systemctl enable itsm-frontend-https.service

    echo -e "${GREEN}✓ HTTPS services installed${NC}"
    echo ""

    # サービスを起動
    read -p "Do you want to start HTTPS services now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting HTTPS services..."
        sudo systemctl start itsm-system-https.service
        sudo systemctl start itsm-frontend-https.service
        sleep 2

        echo ""
        echo -e "${BLUE}=== Backend HTTPS Service Status ===${NC}"
        sudo systemctl status itsm-system-https.service --no-pager -l | head -15
        echo ""
        echo -e "${BLUE}=== Frontend HTTPS Service Status ===${NC}"
        sudo systemctl status itsm-frontend-https.service --no-pager -l | head -15
    fi
    echo ""
fi

#------------------------------------------------------------------------------
# HTTP Services Installation (Legacy)
#------------------------------------------------------------------------------
if [ "$INSTALL_HTTP" = true ]; then
    echo -e "${BLUE}Installing HTTP services (legacy)...${NC}"

    # サービスファイルの存在確認
    if [ ! -f "$PROJECT_ROOT/systemd/itsm-system.service" ]; then
        echo -e "${RED}Error: Service file not found: $PROJECT_ROOT/systemd/itsm-system.service${NC}"
        exit 1
    fi
    if [ ! -f "$PROJECT_ROOT/systemd/itsm-frontend.service" ]; then
        echo -e "${RED}Error: Service file not found: $PROJECT_ROOT/systemd/itsm-frontend.service${NC}"
        exit 1
    fi

    # サービスファイルをコピー
    echo "Copying HTTP service files..."
    sudo cp "$PROJECT_ROOT/systemd/itsm-system.service" /etc/systemd/system/
    sudo cp "$PROJECT_ROOT/systemd/itsm-frontend.service" /etc/systemd/system/

    # systemdをリロード
    echo "Reloading systemd daemon..."
    sudo systemctl daemon-reload

    # サービスを有効化
    echo "Enabling HTTP services..."
    sudo systemctl enable itsm-system.service
    sudo systemctl enable itsm-frontend.service

    echo -e "${GREEN}✓ HTTP services installed${NC}"
    echo ""

    # サービスを起動
    read -p "Do you want to start HTTP services now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting HTTP services..."
        sudo systemctl start itsm-system.service
        sudo systemctl start itsm-frontend.service
        sleep 2

        echo ""
        echo -e "${BLUE}=== Backend HTTP Service Status ===${NC}"
        sudo systemctl status itsm-system.service --no-pager -l | head -15
        echo ""
        echo -e "${BLUE}=== Frontend HTTP Service Status ===${NC}"
        sudo systemctl status itsm-frontend.service --no-pager -l | head -15
    fi
    echo ""
fi

#==============================================================================
# Completion
#==============================================================================
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}Services Setup Complete!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

if [ "$INSTALL_HTTPS" = true ]; then
    echo -e "${BLUE}HTTPS Access URLs:${NC}"
    SYSTEM_IP=$(hostname -I | awk '{print $1}' || echo "192.168.0.187")
    echo "  Frontend: https://${SYSTEM_IP}:5050/index.html"
    echo "  Backend API: https://${SYSTEM_IP}:5443/api/v1/health"
    echo "  Swagger UI: https://${SYSTEM_IP}:5443/api-docs"
    echo "  Metrics: https://${SYSTEM_IP}:5443/metrics"
    echo ""
    echo -e "${BLUE}HTTPS Service Management Commands:${NC}"
    echo "  Start:   sudo systemctl start itsm-system-https itsm-frontend-https"
    echo "  Stop:    sudo systemctl stop itsm-system-https itsm-frontend-https"
    echo "  Restart: sudo systemctl restart itsm-system-https itsm-frontend-https"
    echo "  Status:  sudo systemctl status itsm-system-https"
    echo "  Logs:    sudo journalctl -u itsm-system-https -f"
    echo ""
fi

if [ "$INSTALL_HTTP" = true ]; then
    echo -e "${BLUE}HTTP Access URLs:${NC}"
    SYSTEM_IP=$(hostname -I | awk '{print $1}' || echo "192.168.0.187")
    echo "  Frontend: http://${SYSTEM_IP}:8080/index.html"
    echo "  Backend API: http://${SYSTEM_IP}:5000/api/v1/health"
    echo ""
    echo -e "${BLUE}HTTP Service Management Commands:${NC}"
    echo "  Start:   sudo systemctl start itsm-system itsm-frontend"
    echo "  Stop:    sudo systemctl stop itsm-system itsm-frontend"
    echo "  Restart: sudo systemctl restart itsm-system itsm-frontend"
    echo "  Status:  sudo systemctl status itsm-system"
    echo "  Logs:    sudo journalctl -u itsm-system -f"
    echo ""
fi

echo -e "${YELLOW}Testing:${NC}"
if [ "$INSTALL_HTTPS" = true ]; then
    echo "  curl -k https://localhost:5443/api/v1/health"
    echo "  curl -k https://localhost:5050/"
fi
if [ "$INSTALL_HTTP" = true ]; then
    echo "  curl http://localhost:5000/api/v1/health"
    echo "  curl http://localhost:8080/"
fi
echo ""

echo -e "${GREEN}Services are now configured and will auto-start on system boot!${NC}"
echo ""
