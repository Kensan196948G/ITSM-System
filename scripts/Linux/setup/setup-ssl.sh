#!/bin/bash
################################################################################
# ITSM-System - SSL Certificate Setup Script (統合版)
# 用途: 自己署名証明書生成 + Let's Encrypt セットアップ
# 統合元: generate-ssl-cert.sh + setup-ssl.sh
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
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CERT_DIR="${PROJECT_ROOT}/ssl"
COUNTRY="JP"
STATE="Tokyo"
LOCALITY="Tokyo"
ORGANIZATION="ITSM-System"
ORGANIZATIONAL_UNIT="IT Security"
COMMON_NAME="ITSM Nexus"
DAYS_VALID=365

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}ITSM-System SSL Certificate Setup${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

# OpenSSLのインストール確認
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: OpenSSL is not installed${NC}"
    echo "Please install OpenSSL: sudo apt-get install openssl"
    exit 1
fi

# SSL証明書ディレクトリの作成
mkdir -p "$CERT_DIR"

echo "Select SSL certificate type:"
echo "1) Self-signed certificate (for development/testing)"
echo "2) Let's Encrypt certificate (for production)"
read -p "Enter choice (1 or 2): " SSL_CHOICE

if [ "$SSL_CHOICE" == "1" ]; then
    #=========================================================================
    # 自己署名証明書の生成（generate-ssl-cert.sh の機能を統合）
    #=========================================================================
    echo ""
    echo -e "${BLUE}Generating self-signed SSL certificate...${NC}"

    # IPアドレスを取得（引数がある場合はそれを使用）
    IP_ADDRESS="${1:-$(hostname -I | awk '{print $1}')}"
    if [ -z "$IP_ADDRESS" ]; then
        IP_ADDRESS="192.168.0.187"
        echo -e "${YELLOW}Could not auto-detect IP, using default: $IP_ADDRESS${NC}"
    else
        echo -e "${GREEN}Using IP address: $IP_ADDRESS${NC}"
    fi

    read -p "Enter domain name (default: localhost): " DOMAIN
    DOMAIN=${DOMAIN:-localhost}

    # 既存の証明書がある場合は警告
    if [ -f "$CERT_DIR/server.crt" ] || [ -f "$CERT_DIR/server.key" ]; then
        echo -e "${YELLOW}Warning: Existing certificates found${NC}"
        read -p "Do you want to overwrite existing certificates? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Certificate generation cancelled"
            exit 0
        fi
        echo "Backing up existing certificates..."
        [ -f "$CERT_DIR/server.crt" ] && mv "$CERT_DIR/server.crt" "$CERT_DIR/server.crt.backup.$(date +%Y%m%d_%H%M%S)"
        [ -f "$CERT_DIR/server.key" ] && mv "$CERT_DIR/server.key" "$CERT_DIR/server.key.backup.$(date +%Y%m%d_%H%M%S)"
    fi

    echo ""
    echo -e "${BLUE}[1/5] Creating OpenSSL configuration...${NC}"

    # OpenSSL設定ファイルの作成（SAN対応）
    cat > "$CERT_DIR/openssl.cnf" <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=$COUNTRY
ST=$STATE
L=$LOCALITY
O=$ORGANIZATION
OU=$ORGANIZATIONAL_UNIT
CN=$COMMON_NAME

[v3_req]
subjectAltName = @alt_names

[alt_names]
IP.1 = $IP_ADDRESS
IP.2 = 127.0.0.1
DNS.1 = localhost
DNS.2 = $DOMAIN
DNS.3 = itsm-system.local
EOF

    echo "OpenSSL configuration created:"
    echo "  IP Address: $IP_ADDRESS"
    echo "  Domain: $DOMAIN"
    echo "  Certificate will be valid for: $DAYS_VALID days"
    echo ""

    # 秘密鍵の生成
    echo -e "${BLUE}[2/5] Generating private key...${NC}"
    openssl genrsa -out "$CERT_DIR/server.key" 2048
    chmod 600 "$CERT_DIR/server.key"
    echo -e "${GREEN}✓ Private key generated: $CERT_DIR/server.key${NC}"

    # CSR（証明書署名要求）の生成
    echo -e "${BLUE}[3/5] Generating Certificate Signing Request (CSR)...${NC}"
    openssl req -new -key "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.csr" \
        -config "$CERT_DIR/openssl.cnf"
    echo -e "${GREEN}✓ CSR generated: $CERT_DIR/server.csr${NC}"

    # 自己署名証明書の生成
    echo -e "${BLUE}[4/5] Generating self-signed certificate...${NC}"
    openssl x509 -req -days $DAYS_VALID \
        -in "$CERT_DIR/server.csr" \
        -signkey "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" \
        -extensions v3_req \
        -extfile "$CERT_DIR/openssl.cnf"
    echo -e "${GREEN}✓ Certificate generated: $CERT_DIR/server.crt${NC}"

    # 証明書の詳細表示
    echo ""
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${GREEN}Certificate Details${NC}"
    echo -e "${GREEN}=================================================${NC}"
    openssl x509 -in "$CERT_DIR/server.crt" -text -noout | grep -A2 "Subject:"
    openssl x509 -in "$CERT_DIR/server.crt" -text -noout | grep -A3 "Subject Alternative Name"
    echo ""

    # 証明書の検証
    echo -e "${BLUE}[5/5] Verifying certificate...${NC}"
    if openssl verify -CAfile "$CERT_DIR/server.crt" "$CERT_DIR/server.crt" 2>&1 | grep -q "OK"; then
        echo -e "${GREEN}✓ Certificate verification successful (self-signed)${NC}"
    else
        echo -e "${YELLOW}Note: Self-signed certificate cannot be verified by CA${NC}"
    fi

    # ファイルの権限設定
    echo ""
    echo -e "${BLUE}Setting file permissions...${NC}"
    chmod 644 "$CERT_DIR/server.crt"
    chmod 600 "$CERT_DIR/server.key"
    chmod 644 "$CERT_DIR/openssl.cnf"

    # 完了メッセージ
    echo ""
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${GREEN}Self-Signed SSL Certificate Generation Complete!${NC}"
    echo -e "${GREEN}=================================================${NC}"
    echo ""
    echo "Generated files:"
    echo "  Certificate: $CERT_DIR/server.crt (readable)"
    echo "  Private Key: $CERT_DIR/server.key (secure)"
    echo "  CSR:         $CERT_DIR/server.csr"
    echo "  Config:      $CERT_DIR/openssl.cnf"
    echo ""
    echo -e "${YELLOW}Warning: This certificate is not trusted by browsers.${NC}"
    echo -e "${YELLOW}Use Let's Encrypt for production environments.${NC}"

elif [ "$SSL_CHOICE" == "2" ]; then
    #=========================================================================
    # Let's Encrypt 証明書の取得
    #=========================================================================
    echo ""
    echo -e "${BLUE}Setting up Let's Encrypt certificate...${NC}"

    read -p "Enter your domain name: " DOMAIN
    read -p "Enter your email address: " EMAIL

    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        echo -e "${RED}Error: Domain and email are required!${NC}"
        exit 1
    fi

    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${YELLOW}Certbot not found. Installing...${NC}"

        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot
        else
            echo -e "${RED}Error: Could not install certbot automatically.${NC}"
            echo "Please install certbot manually: https://certbot.eff.org/"
            exit 1
        fi
    fi

    echo ""
    echo -e "${YELLOW}Important: Ensure that:${NC}"
    echo "1. Port 80 is open and accessible from the internet"
    echo "2. DNS records for $DOMAIN point to this server"
    echo "3. No other service is using port 80"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi

    # Obtain certificate
    sudo certbot certonly --standalone \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive

    # Copy certificates to ssl directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/server.crt"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$CERT_DIR/server.key"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/chain.pem" "$CERT_DIR/chain.pem"
    sudo chown $(whoami):$(whoami) "$CERT_DIR"/*.pem "$CERT_DIR"/*.crt "$CERT_DIR"/*.key

    # Generate DH parameters
    echo -e "${BLUE}Generating Diffie-Hellman parameters (this may take a while)...${NC}"
    openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048

    # Setup auto-renewal cron job
    echo -e "${BLUE}Setting up automatic certificate renewal...${NC}"

    CRON_COMMAND="0 3 * * * certbot renew --quiet --post-hook 'systemctl restart itsm-system-https itsm-frontend-https'"

    (crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_COMMAND") | crontab -

    echo ""
    echo -e "${GREEN}✓ Let's Encrypt certificate installed successfully!${NC}"
    echo -e "${GREEN}✓ Automatic renewal configured (runs daily at 3 AM)${NC}"

else
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
fi

# Set proper permissions
chmod 600 "$CERT_DIR/server.key" 2>/dev/null || true
chmod 644 "$CERT_DIR/server.crt" 2>/dev/null || true
chmod 644 "$CERT_DIR/chain.pem" 2>/dev/null || true
chmod 644 "$CERT_DIR/dhparam.pem" 2>/dev/null || true

# .gitignoreの更新
echo ""
echo -e "${BLUE}Updating .gitignore...${NC}"
if ! grep -q "^ssl/$" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    echo "ssl/" >> "$PROJECT_ROOT/.gitignore"
    echo -e "${GREEN}✓ Added ssl/ to .gitignore${NC}"
else
    echo "ssl/ already in .gitignore"
fi

echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}SSL setup complete!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "${GREEN}Certificate files created:${NC}"
echo "  - $CERT_DIR/server.crt (certificate)"
echo "  - $CERT_DIR/server.key (private key)"
[ -f "$CERT_DIR/chain.pem" ] && echo "  - $CERT_DIR/chain.pem (certificate chain)"
[ -f "$CERT_DIR/dhparam.pem" ] && echo "  - $CERT_DIR/dhparam.pem (DH parameters)"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update your .env file with SSL configuration"
echo "2. Run ./scripts/Linux/setup/setup-services.sh to install services"
echo "3. Restart services: sudo systemctl restart itsm-system-https itsm-frontend-https"
echo ""
echo -e "${YELLOW}Security Notes:${NC}"
echo "- Keep server.key secure and never commit to version control"
echo "- For production, consider using Let's Encrypt"
echo "- Browser Trust: Import $CERT_DIR/server.crt to your trusted certificate store"
echo ""
