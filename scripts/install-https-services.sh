#!/bin/bash

################################################################################
# HTTPS Services Installation Script
# 用途: systemd HTTPS servicesを自動インストール（sudoers設定後）
################################################################################

set -e

# カラー出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}ITSM-System HTTPS Services Installation${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

# sudoersが設定されているか確認
if ! sudo -n systemctl daemon-reload 2>/dev/null; then
    echo -e "${RED}Error: Sudoers not configured${NC}"
    echo "Please run ./scripts/setup-sudoers.sh first"
    exit 1
fi

echo -e "${GREEN}✓ Sudoers configuration detected${NC}"
echo ""

# 既存のテストサーバーを停止
echo -e "${BLUE}[1/6] Stopping test servers...${NC}"
pkill -f "node backend/server.js" 2>/dev/null || true
pkill -f "node scripts/frontend-https-server.js" 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Test servers stopped${NC}"
echo ""

# 既存のHTTPサービスを停止
echo -e "${BLUE}[2/6] Stopping existing HTTP services...${NC}"
sudo systemctl stop itsm-system 2>/dev/null || true
sudo systemctl stop itsm-frontend 2>/dev/null || true
echo -e "${GREEN}✓ HTTP services stopped${NC}"
echo ""

# HTTPSサービスファイルをコピー
echo -e "${BLUE}[3/6] Installing HTTPS service files...${NC}"
sudo cp systemd/itsm-system-https.service /etc/systemd/system/
sudo cp systemd/itsm-frontend-https.service /etc/systemd/system/
echo -e "${GREEN}✓ Service files copied to /etc/systemd/system/${NC}"
echo ""

# systemdをリロード
echo -e "${BLUE}[4/6] Reloading systemd daemon...${NC}"
sudo systemctl daemon-reload
echo -e "${GREEN}✓ Systemd daemon reloaded${NC}"
echo ""

# サービスを有効化
echo -e "${BLUE}[5/6] Enabling HTTPS services...${NC}"
sudo systemctl enable itsm-system-https.service
sudo systemctl enable itsm-frontend-https.service
echo -e "${GREEN}✓ Services enabled (will start on boot)${NC}"
echo ""

# サービスを起動
echo -e "${BLUE}[6/6] Starting HTTPS services...${NC}"
sudo systemctl start itsm-system-https.service
sudo systemctl start itsm-frontend-https.service
echo -e "${GREEN}✓ Services started${NC}"
echo ""

# ステータス確認
echo -e "${BLUE}Service Status:${NC}"
echo ""
echo "=== Backend HTTPS Service ==="
sudo systemctl status itsm-system-https.service --no-pager -l | head -15
echo ""
echo "=== Frontend HTTPS Service ==="
sudo systemctl status itsm-frontend-https.service --no-pager -l | head -15
echo ""

# 完了メッセージ
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}HTTPS Services Installation Complete!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  Frontend: https://192.168.0.187:5050/index.html"
echo "  Backend API: https://192.168.0.187:5443/api/v1/health"
echo "  Swagger UI: https://192.168.0.187:5443/api-docs"
echo "  Metrics: https://192.168.0.187:5443/metrics"
echo ""
echo -e "${BLUE}Service Management Commands (NO PASSWORD REQUIRED):${NC}"
echo "  Start:   sudo systemctl start itsm-system-https itsm-frontend-https"
echo "  Stop:    sudo systemctl stop itsm-system-https itsm-frontend-https"
echo "  Restart: sudo systemctl restart itsm-system-https itsm-frontend-https"
echo "  Status:  sudo systemctl status itsm-system-https"
echo "  Logs:    sudo journalctl -u itsm-system-https -f"
echo ""
echo -e "${BLUE}Testing:${NC}"
echo "  curl -k https://192.168.0.187:5443/api/v1/health"
echo "  curl -k https://192.168.0.187:5050/"
echo ""
echo -e "${YELLOW}Browser Access:${NC}"
echo "  Open: https://192.168.0.187:5050/index.html"
echo "  (Accept the self-signed certificate warning)"
echo ""
echo -e "${GREEN}Services are now running and will auto-start on system boot!${NC}"
echo ""
