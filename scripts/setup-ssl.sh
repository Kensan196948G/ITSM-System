#!/bin/bash
# ITSM-Sec Nexus - SSL Certificate Setup Script
# Supports both self-signed (development) and Let's Encrypt (production)

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}ITSM-Sec Nexus - SSL Setup${COLOR_RESET}"
echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
echo ""

# Create SSL directory if it doesn't exist
mkdir -p nginx/ssl

echo "Select SSL certificate type:"
echo "1) Self-signed certificate (for development/testing)"
echo "2) Let's Encrypt certificate (for production)"
read -p "Enter choice (1 or 2): " SSL_CHOICE

if [ "$SSL_CHOICE" == "1" ]; then
    # Self-signed certificate
    echo ""
    echo -e "${COLOR_BLUE}Generating self-signed SSL certificate...${COLOR_RESET}"

    read -p "Enter domain name (default: localhost): " DOMAIN
    DOMAIN=${DOMAIN:-localhost}

    # Generate private key
    openssl genrsa -out nginx/ssl/key.pem 2048

    # Generate certificate
    openssl req -new -x509 -key nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 \
        -subj "/C=JP/ST=Tokyo/L=Tokyo/O=ITSM-Sec Nexus/CN=$DOMAIN"

    # Create dummy chain file
    cp nginx/ssl/cert.pem nginx/ssl/chain.pem

    # Generate DH parameters
    echo -e "${COLOR_BLUE}Generating Diffie-Hellman parameters (this may take a while)...${COLOR_RESET}"
    openssl dhparam -out nginx/ssl/dhparam.pem 2048

    echo ""
    echo -e "${COLOR_GREEN}✓ Self-signed certificate created successfully!${COLOR_RESET}"
    echo -e "${COLOR_YELLOW}Warning: This certificate is not trusted by browsers.${COLOR_RESET}"
    echo -e "${COLOR_YELLOW}Use Let's Encrypt for production environments.${COLOR_RESET}"

elif [ "$SSL_CHOICE" == "2" ]; then
    # Let's Encrypt certificate
    echo ""
    echo -e "${COLOR_BLUE}Setting up Let's Encrypt certificate...${COLOR_RESET}"

    read -p "Enter your domain name: " DOMAIN
    read -p "Enter your email address: " EMAIL

    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        echo -e "${COLOR_RED}Error: Domain and email are required!${COLOR_RESET}"
        exit 1
    fi

    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo -e "${COLOR_YELLOW}Certbot not found. Installing...${COLOR_RESET}"

        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot
        else
            echo -e "${COLOR_RED}Error: Could not install certbot automatically.${COLOR_RESET}"
            echo "Please install certbot manually: https://certbot.eff.org/"
            exit 1
        fi
    fi

    echo ""
    echo -e "${COLOR_YELLOW}Important: Ensure that:${COLOR_RESET}"
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

    # Copy certificates to nginx/ssl
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" nginx/ssl/cert.pem
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" nginx/ssl/key.pem
    sudo cp "/etc/letsencrypt/live/$DOMAIN/chain.pem" nginx/ssl/chain.pem
    sudo chown $(whoami):$(whoami) nginx/ssl/*.pem

    # Generate DH parameters
    echo -e "${COLOR_BLUE}Generating Diffie-Hellman parameters (this may take a while)...${COLOR_RESET}"
    openssl dhparam -out nginx/ssl/dhparam.pem 2048

    # Setup auto-renewal cron job
    echo -e "${COLOR_BLUE}Setting up automatic certificate renewal...${COLOR_RESET}"

    CRON_COMMAND="0 3 * * * certbot renew --quiet --post-hook 'docker-compose -f $(pwd)/docker-compose.yml restart nginx'"

    (crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_COMMAND") | crontab -

    echo ""
    echo -e "${COLOR_GREEN}✓ Let's Encrypt certificate installed successfully!${COLOR_RESET}"
    echo -e "${COLOR_GREEN}✓ Automatic renewal configured (runs daily at 3 AM)${COLOR_RESET}"

else
    echo -e "${COLOR_RED}Invalid choice. Exiting.${COLOR_RESET}"
    exit 1
fi

# Set proper permissions
chmod 600 nginx/ssl/key.pem
chmod 644 nginx/ssl/cert.pem nginx/ssl/chain.pem nginx/ssl/dhparam.pem

echo ""
echo -e "${COLOR_GREEN}SSL setup complete!${COLOR_RESET}"
echo ""
echo -e "${COLOR_GREEN}Certificate files created:${COLOR_RESET}"
echo "  - nginx/ssl/cert.pem (certificate)"
echo "  - nginx/ssl/key.pem (private key)"
echo "  - nginx/ssl/chain.pem (certificate chain)"
echo "  - nginx/ssl/dhparam.pem (DH parameters)"
echo ""
