#!/bin/bash

################################################################################
# HTTPS Setup Script
# 用途: ITSM-SystemのHTTPS環境を一括セットアップ
################################################################################

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IP_ADDRESS="${1:-192.168.0.187}"

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}ITSM-System HTTPS Setup${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

# ルート権限チェック（systemdインストール用）
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}Warning: Running as root. This script should be run as a normal user.${NC}"
    echo -e "${YELLOW}Systemd services will be installed with sudo when needed.${NC}"
    echo ""
fi

# Node.jsインストール確認
echo -e "${BLUE}[1/7] Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js v20.x or later"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version) found${NC}"

if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: OpenSSL is not installed${NC}"
    echo "Please install: sudo apt-get install openssl"
    exit 1
fi
echo -e "${GREEN}✓ OpenSSL found${NC}"
echo ""

# SSL証明書の生成
echo -e "${BLUE}[2/7] Generating SSL certificates...${NC}"
if [ -f "$PROJECT_ROOT/ssl/server.crt" ] && [ -f "$PROJECT_ROOT/ssl/server.key" ]; then
    echo -e "${YELLOW}Existing SSL certificates found.${NC}"
    read -p "Do you want to regenerate certificates? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        "$SCRIPT_DIR/generate-ssl-cert.sh" "$IP_ADDRESS"
    else
        echo "Using existing certificates"
    fi
else
    "$SCRIPT_DIR/generate-ssl-cert.sh" "$IP_ADDRESS"
fi
echo ""

# 環境変数ファイルの設定
echo -e "${BLUE}[3/7] Configuring environment variables...${NC}"
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${YELLOW}Existing .env file found.${NC}"
    read -p "Do you want to update .env with HTTPS settings? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # .envをバックアップ
        cp "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.backup.$(date +%Y%m%d_%H%M%S)"
        echo "Backup created: .env.backup.$(date +%Y%m%d_%H%M%S)"

        # HTTPS設定を追加/更新
        if grep -q "ENABLE_HTTPS" "$PROJECT_ROOT/.env"; then
            sed -i 's/^ENABLE_HTTPS=.*/ENABLE_HTTPS=true/' "$PROJECT_ROOT/.env"
        else
            echo "ENABLE_HTTPS=true" >> "$PROJECT_ROOT/.env"
        fi

        if grep -q "HTTPS_PORT" "$PROJECT_ROOT/.env"; then
            sed -i 's/^HTTPS_PORT=.*/HTTPS_PORT=5443/' "$PROJECT_ROOT/.env"
        else
            echo "HTTPS_PORT=5443" >> "$PROJECT_ROOT/.env"
        fi

        if grep -q "HTTP_REDIRECT_TO_HTTPS" "$PROJECT_ROOT/.env"; then
            sed -i 's/^HTTP_REDIRECT_TO_HTTPS=.*/HTTP_REDIRECT_TO_HTTPS=true/' "$PROJECT_ROOT/.env"
        else
            echo "HTTP_REDIRECT_TO_HTTPS=true" >> "$PROJECT_ROOT/.env"
        fi

        if grep -q "SYSTEM_IP" "$PROJECT_ROOT/.env"; then
            sed -i "s/^SYSTEM_IP=.*/SYSTEM_IP=$IP_ADDRESS/" "$PROJECT_ROOT/.env"
        else
            echo "SYSTEM_IP=$IP_ADDRESS" >> "$PROJECT_ROOT/.env"
        fi

        echo -e "${GREEN}✓ .env updated with HTTPS settings${NC}"
    else
        echo "Skipping .env update"
    fi
else
    echo "Creating new .env from .env.https.example"
    cp "$PROJECT_ROOT/.env.https.example" "$PROJECT_ROOT/.env"
    sed -i "s/^SYSTEM_IP=.*/SYSTEM_IP=$IP_ADDRESS/" "$PROJECT_ROOT/.env"
    echo -e "${GREEN}✓ .env created${NC}"
    echo -e "${YELLOW}WARNING: Please update JWT_SECRET in .env before production use!${NC}"
fi
echo ""

# .gitignoreの更新
echo -e "${BLUE}[4/7] Updating .gitignore...${NC}"
if ! grep -q "^ssl/$" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    echo "ssl/" >> "$PROJECT_ROOT/.gitignore"
    echo -e "${GREEN}✓ Added ssl/ to .gitignore${NC}"
else
    echo "ssl/ already in .gitignore"
fi

if ! grep -q "^.env$" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    echo ".env" >> "$PROJECT_ROOT/.gitignore"
    echo -e "${GREEN}✓ Added .env to .gitignore${NC}"
else
    echo ".env already in .gitignore"
fi
echo ""

# 依存関係のインストール
echo -e "${BLUE}[5/7] Installing dependencies...${NC}"
cd "$PROJECT_ROOT"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo "Dependencies already installed (run 'npm install' to update)"
fi
echo ""

# systemdサービスのインストール
echo -e "${BLUE}[6/7] Installing systemd services...${NC}"
echo "This step requires sudo privileges."
read -p "Do you want to install systemd services? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # サービスファイルをコピー
    sudo cp "$PROJECT_ROOT/systemd/itsm-system-https.service" /etc/systemd/system/
    sudo cp "$PROJECT_ROOT/systemd/itsm-frontend-https.service" /etc/systemd/system/

    # systemdをリロード
    sudo systemctl daemon-reload

    # サービスを有効化
    sudo systemctl enable itsm-system-https.service
    sudo systemctl enable itsm-frontend-https.service

    echo -e "${GREEN}✓ Systemd services installed and enabled${NC}"
    echo ""

    # サービスを起動
    read -p "Do you want to start services now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl start itsm-system-https.service
        sudo systemctl start itsm-frontend-https.service
        echo -e "${GREEN}✓ Services started${NC}"

        # ステータス確認
        sleep 2
        echo ""
        echo -e "${BLUE}Service Status:${NC}"
        sudo systemctl status itsm-system-https.service --no-pager -l
        echo ""
        sudo systemctl status itsm-frontend-https.service --no-pager -l
    fi
else
    echo "Skipping systemd installation"
    echo "To install manually:"
    echo "  sudo cp systemd/itsm-system-https.service /etc/systemd/system/"
    echo "  sudo cp systemd/itsm-frontend-https.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable --now itsm-system-https itsm-frontend-https"
fi
echo ""

# ファイアウォール設定
echo -e "${BLUE}[7/7] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    read -p "Do you want to configure UFW firewall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo ufw allow 5443/tcp comment 'ITSM Backend HTTPS'
        sudo ufw allow 5050/tcp comment 'ITSM Frontend HTTPS'
        echo -e "${GREEN}✓ Firewall rules added${NC}"
        sudo ufw status numbered
    else
        echo "Skipping firewall configuration"
    fi
else
    echo "UFW not found. Please configure your firewall manually:"
    echo "  - Allow TCP port 5443 (Backend HTTPS)"
    echo "  - Allow TCP port 5050 (Frontend HTTPS)"
fi
echo ""

# 完了メッセージ
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}HTTPS Setup Complete!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  Frontend: https://$IP_ADDRESS:5050/index.html"
echo "  Backend API: https://$IP_ADDRESS:5443/api/v1/health"
echo "  Swagger UI: https://$IP_ADDRESS:5443/api-docs"
echo "  Metrics: https://$IP_ADDRESS:5443/metrics"
echo ""
echo -e "${BLUE}Service Management:${NC}"
echo "  Start:   sudo systemctl start itsm-system-https itsm-frontend-https"
echo "  Stop:    sudo systemctl stop itsm-system-https itsm-frontend-https"
echo "  Restart: sudo systemctl restart itsm-system-https itsm-frontend-https"
echo "  Status:  sudo systemctl status itsm-system-https"
echo "  Logs:    sudo journalctl -u itsm-system-https -f"
echo ""
echo -e "${BLUE}Testing:${NC}"
echo "  curl -k https://$IP_ADDRESS:5443/api/v1/health"
echo "  curl -k https://$IP_ADDRESS:5050/"
echo ""
echo -e "${YELLOW}Security Notes:${NC}"
echo "  - Self-signed certificate will show browser warnings"
echo "  - Import ssl/server.crt to trusted store to avoid warnings"
echo "  - Update JWT_SECRET in .env before production use"
echo "  - Change default admin password"
echo "  - For public deployment, consider Let's Encrypt"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  docs/HTTPS_SETUP.md - Complete HTTPS setup guide"
echo ""
