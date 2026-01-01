#!/bin/bash

################################################################################
# Sudoers Setup Script for ITSM-System
# 用途: systemctlコマンドをパスワードなしで実行できるように設定
################################################################################

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}ITSM-System Sudoers Configuration${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

# 現在のユーザー名を取得
CURRENT_USER=$(whoami)

echo -e "${YELLOW}Current user: $CURRENT_USER${NC}"
echo ""
echo "This script will configure sudoers to allow password-free"
echo "execution of systemctl commands for ITSM services."
echo ""
echo -e "${YELLOW}Commands that will be allowed without password:${NC}"
echo "  - sudo systemctl start/stop/restart/status itsm-system-https"
echo "  - sudo systemctl start/stop/restart/status itsm-frontend-https"
echo "  - sudo systemctl daemon-reload"
echo "  - sudo systemctl enable itsm-system-https/itsm-frontend-https"
echo ""
read -p "Do you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Sudoers configuration cancelled"
    exit 0
fi
echo ""

# sudoers設定ファイルを作成
echo -e "${YELLOW}Creating sudoers configuration...${NC}"
echo "This will require your sudo password (one time only)."
echo ""

sudo tee /etc/sudoers.d/itsm-system > /dev/null <<EOF
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

# System management
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl daemon-reload

# Legacy HTTP services (for compatibility)
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start itsm-system
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop itsm-system
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl start itsm-frontend
$CURRENT_USER ALL=(ALL) NOPASSWD: /bin/systemctl stop itsm-frontend
EOF

# 権限設定（セキュリティのため）
sudo chmod 440 /etc/sudoers.d/itsm-system

# 設定の検証
echo ""
echo -e "${YELLOW}Validating sudoers configuration...${NC}"
if sudo visudo -c -f /etc/sudoers.d/itsm-system; then
    echo -e "${GREEN}✓ Sudoers configuration is valid${NC}"
else
    echo -e "${RED}✗ Sudoers configuration has errors${NC}"
    echo "Removing invalid configuration..."
    sudo rm /etc/sudoers.d/itsm-system
    exit 1
fi

echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}Sudoers Configuration Complete!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo "You can now run the following commands WITHOUT password:"
echo ""
echo "  sudo systemctl start itsm-system-https"
echo "  sudo systemctl stop itsm-system-https"
echo "  sudo systemctl restart itsm-system-https"
echo "  sudo systemctl status itsm-system-https"
echo "  sudo systemctl enable itsm-system-https"
echo ""
echo "  sudo systemctl start itsm-frontend-https"
echo "  sudo systemctl stop itsm-frontend-https"
echo "  sudo systemctl restart itsm-frontend-https"
echo "  sudo systemctl daemon-reload"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Install systemd services:"
echo "   sudo cp systemd/itsm-system-https.service /etc/systemd/system/"
echo "   sudo cp systemd/itsm-frontend-https.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo ""
echo "2. Enable and start services:"
echo "   sudo systemctl enable itsm-system-https itsm-frontend-https"
echo "   sudo systemctl start itsm-system-https itsm-frontend-https"
echo ""
echo "3. Check status:"
echo "   sudo systemctl status itsm-system-https"
echo ""
echo -e "${GREEN}All commands above will NOT require password!${NC}"
echo ""
