#!/bin/bash
# ITSM-Sec Nexus - Systemd Service Installation Script

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_RESET='\033[0m'

echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
echo -e "${COLOR_GREEN}ITSM-Sec Nexus - Systemd Setup${COLOR_RESET}"
echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${COLOR_RED}Error: This script must be run as root (use sudo)${COLOR_RESET}"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${COLOR_RED}Error: docker-compose is not installed${COLOR_RESET}"
    echo "Please install docker-compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

# Get the current directory
ITSM_DIR=$(pwd)

echo -e "${COLOR_GREEN}ITSM System directory: $ITSM_DIR${COLOR_RESET}"
echo ""

# Update WorkingDirectory in service file
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$ITSM_DIR|g" systemd/itsm-system.service

# Copy service file to systemd directory
echo -e "${COLOR_GREEN}Installing systemd service file...${COLOR_RESET}"
cp systemd/itsm-system.service /etc/systemd/system/

# Set proper permissions
chmod 644 /etc/systemd/system/itsm-system.service

# Reload systemd daemon
echo -e "${COLOR_GREEN}Reloading systemd daemon...${COLOR_RESET}"
systemctl daemon-reload

# Enable service (auto-start on boot)
echo -e "${COLOR_GREEN}Enabling ITSM System service...${COLOR_RESET}"
systemctl enable itsm-system.service

echo ""
echo -e "${COLOR_GREEN}✓ Systemd service installed successfully!${COLOR_RESET}"
echo ""
echo -e "${COLOR_GREEN}Available commands:${COLOR_RESET}"
echo "  sudo systemctl start itsm-system    # Start the system"
echo "  sudo systemctl stop itsm-system     # Stop the system"
echo "  sudo systemctl restart itsm-system  # Restart the system"
echo "  sudo systemctl status itsm-system   # Check status"
echo "  sudo systemctl enable itsm-system   # Enable auto-start on boot"
echo "  sudo systemctl disable itsm-system  # Disable auto-start"
echo "  sudo journalctl -u itsm-system -f   # View logs"
echo ""
echo -e "${COLOR_YELLOW}Note: The service is enabled but not started.${COLOR_RESET}"
read -p "Do you want to start the service now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl start itsm-system
    echo ""
    echo -e "${COLOR_GREEN}Service started successfully!${COLOR_RESET}"
    echo ""
    systemctl status itsm-system
fi
