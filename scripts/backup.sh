#!/bin/bash
# ITSM-Sec Nexus - Automated Backup Script
# Supports daily, weekly, and monthly backup retention

set -e

# ============================================================
# Configuration
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DB_PATH="${PROJECT_DIR}/backend/itsm_nexus.db"
BACKUP_BASE_DIR="${PROJECT_DIR}/backend/backups"

# Retention policies
DAILY_RETENTION=7    # days
WEEKLY_RETENTION=4   # weeks
MONTHLY_RETENTION=12 # months

# Backup directories
DAILY_DIR="${BACKUP_BASE_DIR}/daily"
WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"
MONTHLY_DIR="${BACKUP_BASE_DIR}/monthly"

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

# Create backup directories
create_backup_dirs() {
    mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"
    log_debug "Backup directories created"
}

# Check if database exists
check_database() {
    if [ ! -f "$DB_PATH" ]; then
        log_error "Database not found: $DB_PATH"
        exit 1
    fi
    log_debug "Database found: $DB_PATH"
}

# Perform backup
perform_backup() {
    local backup_type=$1
    local backup_dir=$2
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="itsm_nexus_${backup_type}_${timestamp}"

    log_info "Starting $backup_type backup..."

    # SQL dump
    log_debug "Creating SQL dump..."
    sqlite3 "$DB_PATH" ".dump" | gzip > "${backup_dir}/${backup_name}.sql.gz"

    # Binary copy (includes WAL files)
    log_debug "Creating binary backup..."
    cp "$DB_PATH" "${backup_dir}/${backup_name}.db"

    # Copy WAL and SHM files if they exist
    if [ -f "${DB_PATH}-wal" ]; then
        cp "${DB_PATH}-wal" "${backup_dir}/${backup_name}.db-wal"
    fi
    if [ -f "${DB_PATH}-shm" ]; then
        cp "${DB_PATH}-shm" "${backup_dir}/${backup_name}.db-shm"
    fi

    # Create checksum
    log_debug "Generating SHA256 checksum..."
    (cd "$backup_dir" && sha256sum "${backup_name}."* > "${backup_name}.sha256")

    # Get backup size
    local backup_size=$(du -sh "${backup_dir}/${backup_name}.db" | cut -f1)

    log_info "✓ $backup_type backup completed: ${backup_name} (${backup_size})"
    echo "${backup_dir}/${backup_name}"
}

# Clean old backups
clean_old_backups() {
    local backup_dir=$1
    local retention_days=$2
    local backup_type=$3

    log_debug "Cleaning old $backup_type backups (retention: $retention_days days)..."

    # Find and delete backups older than retention period
    find "$backup_dir" -name "itsm_nexus_${backup_type}_*" -type f -mtime +${retention_days} -delete

    local remaining=$(find "$backup_dir" -name "itsm_nexus_${backup_type}_*" -type f | wc -l)
    log_debug "Remaining $backup_type backups: $remaining files"
}

# Upload to remote (optional)
upload_remote() {
    local backup_path=$1

    if [ -n "$BACKUP_REMOTE_HOST" ] && [ -n "$BACKUP_REMOTE_PATH" ]; then
        log_info "Uploading backup to remote server..."

        # Using rsync for efficient remote backup
        rsync -avz --progress \
            "$backup_path"* \
            "${BACKUP_REMOTE_USER:-root}@${BACKUP_REMOTE_HOST}:${BACKUP_REMOTE_PATH}/" \
            2>&1 | grep -v "sending incremental file list" || true

        log_info "✓ Remote backup uploaded"
    fi

    # AWS S3 backup (if configured)
    if [ -n "$BACKUP_S3_BUCKET" ]; then
        if command -v aws &> /dev/null; then
            log_info "Uploading backup to AWS S3..."
            aws s3 cp "$backup_path.sql.gz" "s3://${BACKUP_S3_BUCKET}/backups/$(basename $backup_path).sql.gz"
            aws s3 cp "$backup_path.db" "s3://${BACKUP_S3_BUCKET}/backups/$(basename $backup_path).db"
            log_info "✓ S3 backup uploaded"
        else
            log_warn "AWS CLI not installed, skipping S3 backup"
        fi
    fi
}

# ============================================================
# Main Execution
# ============================================================

main() {
    echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
    echo -e "${COLOR_GREEN}ITSM-Sec Nexus Backup${COLOR_RESET}"
    echo -e "${COLOR_GREEN}================================${COLOR_RESET}"
    echo ""

    # Determine backup type
    local backup_type="daily"
    local backup_dir="$DAILY_DIR"

    # Check if it's Sunday (weekly backup)
    if [ "$(date +%u)" -eq 7 ]; then
        backup_type="weekly"
        backup_dir="$WEEKLY_DIR"
    fi

    # Check if it's the 1st of the month (monthly backup)
    if [ "$(date +%d)" -eq 01 ]; then
        backup_type="monthly"
        backup_dir="$MONTHLY_DIR"
    fi

    # Allow override via command line argument
    if [ "$1" == "daily" ] || [ "$1" == "weekly" ] || [ "$1" == "monthly" ]; then
        backup_type="$1"
        case "$1" in
            daily)   backup_dir="$DAILY_DIR" ;;
            weekly)  backup_dir="$WEEKLY_DIR" ;;
            monthly) backup_dir="$MONTHLY_DIR" ;;
        esac
    fi

    log_info "Backup type: $backup_type"

    # Execute backup
    create_backup_dirs
    check_database
    local backup_path=$(perform_backup "$backup_type" "$backup_dir")

    # Clean old backups
    case "$backup_type" in
        daily)   clean_old_backups "$DAILY_DIR" "$DAILY_RETENTION" "daily" ;;
        weekly)  clean_old_backups "$WEEKLY_DIR" $((WEEKLY_RETENTION * 7)) "weekly" ;;
        monthly) clean_old_backups "$MONTHLY_DIR" $((MONTHLY_RETENTION * 30)) "monthly" ;;
    esac

    # Upload to remote (if configured)
    upload_remote "$backup_path"

    echo ""
    log_info "Backup completed successfully!"
    echo ""
}

# Run main function
main "$@"
