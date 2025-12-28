#!/bin/bash
# ITSM-Sec Nexus - Environment Setup Script
# Generates secure secrets and creates .env.production file

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}ITSM-Sec Nexus - Environment Setup${COLOR_RESET}"
echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
echo ""

# Check if .env.production already exists
if [ -f .env.production ]; then
    echo -e "${COLOR_YELLOW}Warning: .env.production already exists!${COLOR_RESET}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Detect system IP address
SYSTEM_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SYSTEM_IP" ]; then
    SYSTEM_IP="192.168.0.187"
    echo -e "${COLOR_YELLOW}Could not auto-detect IP, using default: $SYSTEM_IP${COLOR_RESET}"
else
    echo -e "${COLOR_GREEN}Detected system IP: $SYSTEM_IP${COLOR_RESET}"
fi

# Ask for domain name
read -p "Enter your domain name (or press Enter for localhost): " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN="localhost"
fi

# Generate secure secrets
echo ""
echo -e "${COLOR_GREEN}Generating secure secrets...${COLOR_RESET}"

JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')
GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d '\n')

echo "✓ JWT_SECRET generated (64 bytes)"
echo "✓ REDIS_PASSWORD generated (32 bytes)"
echo "✓ GRAFANA_ADMIN_PASSWORD generated (16 bytes)"

# Create .env.production file
cat > .env.production <<EOF
# ITSM-Sec Nexus - Production Environment Configuration
# Auto-generated on $(date)
# DO NOT COMMIT THIS FILE TO VERSION CONTROL!

# Node Environment
NODE_ENV=production

# Server Configuration
PORT=5000
HOST=0.0.0.0
DOMAIN=$DOMAIN

# CORS Configuration
CORS_ORIGIN=https://$DOMAIN

# JWT Authentication
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h

# Database
DATABASE_PATH=/app/backend/itsm_nexus.db

# Logging
LOG_LEVEL=warn

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=$GRAFANA_PASSWORD

# System Information
SYSTEM_IP=$SYSTEM_IP
EOF

# Set restrictive permissions
chmod 600 .env.production

echo ""
echo -e "${COLOR_GREEN}✓ .env.production created successfully!${COLOR_RESET}"
echo ""
echo -e "${COLOR_YELLOW}IMPORTANT: Keep these credentials safe!${COLOR_RESET}"
echo ""
echo "Grafana Admin Credentials:"
echo "  Username: admin"
echo "  Password: $GRAFANA_PASSWORD"
echo ""
echo -e "${COLOR_GREEN}Next steps:${COLOR_RESET}"
echo "1. Review .env.production and customize if needed"
echo "2. Run ./scripts/setup-ssl.sh to generate SSL certificates"
echo "3. Run docker-compose up -d to start the system"
echo ""
