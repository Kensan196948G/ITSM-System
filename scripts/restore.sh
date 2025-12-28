#!/bin/bash
# ITSM-Sec Nexus - Database Restore Script
# Restores database from backup file

set -e

# ============================================================
# Configuration
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_DIR}/backend/itsm_nexus.db"

# Colors for output
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

# ============================================================
# Functions
# ============================================================

log_info() {
    echo -e "${COLOR_GREEN}[INFO]${COLOR_RESET} $1"
}

log_warn() {
    echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $1"
}

log_error() {
    echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $1"
}

log_debug() {
    echo -e "${COLOR_BLUE}[DEBUG]${COLOR_RESET} $1"
}

# Display usage
usage() {
    echo "Usage: $0 <backup_file_path>"
    echo ""
    echo "Examples:"
    echo "  $0 backend/backups/daily/itsm_nexus_daily_20251228_020000.db"
    echo "  $0 backend/backups/weekly/itsm_nexus_weekly_20251222_030000.db"
    echo ""
    echo "Available backups:"
    find "${PROJECT_DIR}/backend/backups" -name "*.db" 2>/dev/null | sort -r | head -10
    exit 1
}

# Verify checksum
verify_checksum() {
    local backup_file=$1
    local checksum_file="${backup_file%.*}.sha256"

    if [ -f "$checksum_file" ]; then
        log_info "Verifying backup integrity..."
        (cd "$(dirname "$backup_file")" && sha256sum -c "$(basename "$checksum_file")" --quiet) 2>&1 | grep -v "No such file" || true
        log_info "✓ Checksum verification passed"
    else
        log_warn "Checksum file not found, skipping verification"
    fi
}

# Stop services
stop_services() {
    log_info "Stopping ITSM services..."

    # Check if running in Docker
    if docker-compose ps 2>/dev/null | grep -q "backend"; then
        docker-compose stop backend
        log_info "✓ Docker services stopped"
    # Check if running as systemd service
    elif systemctl is-active --quiet itsm-system 2>/dev/null; then
        sudo systemctl stop itsm-system
        log_info "✓ Systemd service stopped"
    # Check if running as standalone process
    elif pgrep -f "node backend/server.js" > /dev/null; then
        pkill -f "node backend/server.js"
        sleep 2
        log_info "✓ Node.js process stopped"
    else
        log_debug "No running services detected"
    fi
}

# Start services
start_services() {
    log_info "Starting ITSM services..."

    if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
        docker-compose start backend
        log_info "✓ Docker services started"
    elif systemctl is-enabled --quiet itsm-system 2>/dev/null; then
        sudo systemctl start itsm-system
        log_info "✓ Systemd service started"
    else
        (cd "$PROJECT_DIR" && node backend/server.js &)
        log_info "✓ Node.js process started"
    fi
}

# Backup current database
backup_current() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local safety_backup="${PROJECT_DIR}/backend/backups/restore_safety_${timestamp}.db"

    mkdir -p "$(dirname "$safety_backup")"
    cp "$DB_PATH" "$safety_backup"

    log_info "✓ Current database backed up to: $safety_backup"
    echo "$safety_backup"
}

# Restore database
restore_database() {
    local backup_file=$1

    log_info "Restoring database from: $backup_file"

    # Remove existing database files
    rm -f "${DB_PATH}" "${DB_PATH}-wal" "${DB_PATH}-shm" "${DB_PATH}-journal"

    # Restore from backup
    if [[ "$backup_file" == *.sql.gz ]]; then
        # SQL dump restore
        log_debug "Restoring from SQL dump..."
        gunzip -c "$backup_file" | sqlite3 "$DB_PATH"
    elif [[ "$backup_file" == *.db ]]; then
        # Binary restore
        log_debug "Restoring from binary backup..."
        cp "$backup_file" "$DB_PATH"

        # Restore WAL file if exists
        if [ -f "${backup_file}-wal" ]; then
            cp "${backup_file}-wal" "${DB_PATH}-wal"
        fi
    else
        log_error "Unsupported backup file format: $backup_file"
        exit 1
    fi

    log_info "✓ Database restored successfully"
}

# Verify database integrity
verify_database() {
    log_info "Verifying database integrity..."

    # SQLite integrity check
    if sqlite3 "$DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_info "✓ Database integrity check passed"
    else
        log_error "Database integrity check failed!"
        return 1
    fi

    # Quick table count check
    local table_count=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "0")
    log_debug "Database contains $table_count tables"

    if [ "$table_count" -lt 10 ]; then
        log_warn "Expected at least 10 tables, found $table_count"
    fi
}

# ============================================================
# Main Execution
# ============================================================

main() {
    echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
    echo -e "${COLOR_GREEN}ITSM-Sec Nexus Database Restore${COLOR_RESET}"
    echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
    echo ""

    # Check arguments
    if [ $# -eq 0 ]; then
        log_error "No backup file specified"
        usage
    fi

    local backup_file="$1"

    # Check if backup file exists
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        usage
    fi

    log_info "Backup file: $backup_file"
    log_info "Database: $DB_PATH"
    echo ""

    # Confirmation
    log_warn "This will replace the current database!"
    read -p "Continue? (yes/NO): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    echo ""

    # Verify backup checksum
    verify_checksum "$backup_file"

    # Backup current database (safety measure)
    local safety_backup=$(backup_current)

    # Stop services
    stop_services

    # Restore database
    restore_database "$backup_file"

    # Verify restored database
    if verify_database; then
        log_info "✓ Database verification passed"
    else
        log_error "Database verification failed! Rolling back..."
        cp "$safety_backup" "$DB_PATH"
        log_info "Rollback completed"
        start_services
        exit 1
    fi

    # Start services
    start_services

    # Wait for service to be ready
    sleep 3

    # Health check
    if curl -f -s http://localhost:5000/api/v1/health > /dev/null 2>&1; then
        log_info "✓ Service health check passed"
    else
        log_warn "Service health check failed (service may still be starting)"
    fi

    echo ""
    log_info "Restore completed successfully!"
    log_info "Safety backup saved at: $safety_backup"
    echo ""
}

# Run main function
main "$@"
