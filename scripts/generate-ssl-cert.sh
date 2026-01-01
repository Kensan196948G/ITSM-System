#!/bin/bash

################################################################################
# SSL証明書生成スクリプト
# 用途: 本番環境向けの自己署名SSL証明書を生成
# 対応: IPアドレス（192.168.0.187）をSANに含める
################################################################################

set -e

# 設定
CERT_DIR="./ssl"
COUNTRY="JP"
STATE="Tokyo"
LOCALITY="Tokyo"
ORGANIZATION="ITSM-System"
ORGANIZATIONAL_UNIT="IT Security"
COMMON_NAME="ITSM Nexus"
IP_ADDRESS="${1:-192.168.0.187}"
DAYS_VALID=365

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}ITSM-System SSL Certificate Generator${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""

# OpenSSLがインストールされているか確認
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: OpenSSL is not installed${NC}"
    echo "Please install OpenSSL: sudo apt-get install openssl"
    exit 1
fi

# SSL証明書ディレクトリの作成
echo -e "${YELLOW}[1/5] Creating SSL directory...${NC}"
mkdir -p "$CERT_DIR"

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

# OpenSSL設定ファイルの作成（SAN対応）
echo -e "${YELLOW}[2/5] Creating OpenSSL configuration...${NC}"
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
DNS.2 = itsm-system.local
EOF

echo "OpenSSL configuration created:"
echo "  IP Address: $IP_ADDRESS"
echo "  Certificate will be valid for: $DAYS_VALID days"
echo ""

# 秘密鍵の生成
echo -e "${YELLOW}[3/5] Generating private key...${NC}"
openssl genrsa -out "$CERT_DIR/server.key" 2048
chmod 600 "$CERT_DIR/server.key"
echo -e "${GREEN}✓ Private key generated: $CERT_DIR/server.key${NC}"

# CSR（証明書署名要求）の生成
echo -e "${YELLOW}[4/5] Generating Certificate Signing Request (CSR)...${NC}"
openssl req -new -key "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.csr" \
    -config "$CERT_DIR/openssl.cnf"
echo -e "${GREEN}✓ CSR generated: $CERT_DIR/server.csr${NC}"

# 自己署名証明書の生成
echo -e "${YELLOW}[5/5] Generating self-signed certificate...${NC}"
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
echo -e "${YELLOW}Verifying certificate...${NC}"
if openssl verify -CAfile "$CERT_DIR/server.crt" "$CERT_DIR/server.crt" 2>&1 | grep -q "OK"; then
    echo -e "${GREEN}✓ Certificate verification successful (self-signed)${NC}"
else
    echo -e "${YELLOW}Note: Self-signed certificate cannot be verified by CA${NC}"
fi

# ファイルの権限設定
echo ""
echo -e "${YELLOW}Setting file permissions...${NC}"
chmod 644 "$CERT_DIR/server.crt"
chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/openssl.cnf"

# 完了メッセージ
echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}SSL Certificate Generation Complete!${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo "Generated files:"
echo "  Certificate: $CERT_DIR/server.crt (readable)"
echo "  Private Key: $CERT_DIR/server.key (secure)"
echo "  CSR:         $CERT_DIR/server.csr"
echo "  Config:      $CERT_DIR/openssl.cnf"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update your .env file with SSL configuration"
echo "2. Configure backend server for HTTPS (backend/server.js)"
echo "3. Update systemd service files"
echo "4. Restart services: sudo systemctl restart itsm-system"
echo ""
echo -e "${YELLOW}Security Notes:${NC}"
echo "- This is a self-signed certificate (browser will show warnings)"
echo "- For production, consider using Let's Encrypt or a commercial CA"
echo "- Keep server.key secure and never commit to version control"
echo "- Add ssl/ directory to .gitignore"
echo ""
echo -e "${YELLOW}Browser Trust (Optional):${NC}"
echo "To avoid browser warnings, import $CERT_DIR/server.crt"
echo "into your system's trusted certificate store."
echo ""
