#!/bin/bash

###############################################################################
# ITSM Nexus - Grafanaインストールスクリプト
#
# このスクリプトはGrafanaを自動的にインストールし、
# ITSM Nexusシステム用のダッシュボードをセットアップします。
#
# 使用方法:
#   sudo ./install-grafana.sh
#
###############################################################################

set -e

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ログ関数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# root権限チェック
if [ "$EUID" -ne 0 ]; then
    log_error "このスクリプトはroot権限で実行する必要があります"
    echo "使用方法: sudo $0"
    exit 1
fi

log_info "ITSM Nexus - Grafanaインストーラー"

# OSの検出
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    log_error "OSを検出できませんでした"
    exit 1
fi

log_info "検出されたOS: ${OS} ${VERSION}"

# 既存のGrafanaをチェック
if systemctl is-active --quiet grafana-server 2>/dev/null; then
    log_warn "Grafanaサービスが既に実行中です"
    read -p "既存のGrafanaを保持しますか？ (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        log_info "既存のGrafanaを使用します"
        SKIP_INSTALL=true
    fi
fi

# Grafanaのインストール
if [ "$SKIP_INSTALL" != true ]; then
    case $OS in
        ubuntu|debian)
            log_info "Grafanaをインストール中（Debian/Ubuntu）..."

            # 依存パッケージ
            apt-get install -y software-properties-common apt-transport-packages gnupg2 curl

            # GPGキーとリポジトリの追加
            curl -fsSL https://packages.grafana.com/gpg.key | apt-key add -
            add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"

            # インストール
            apt-get update
            apt-get install -y grafana
            ;;

        centos|rhel|fedora)
            log_info "Grafanaをインストール中（CentOS/RHEL/Fedora）..."

            # リポジトリファイルの作成
            cat > /etc/yum.repos.d/grafana.repo <<EOF
[grafana]
name=grafana
baseurl=https://packages.grafana.com/oss/rpm
repo_gpgcheck=1
enabled=1
gpgcheck=1
gpgkey=https://packages.grafana.com/gpg.key
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
EOF

            # インストール
            yum install -y grafana
            ;;

        *)
            log_error "サポートされていないOS: ${OS}"
            log_info "手動でGrafanaをインストールしてください: https://grafana.com/grafana/download"
            exit 1
            ;;
    esac
fi

# Grafanaの起動
log_info "Grafanaサービスを起動中..."
systemctl daemon-reload
systemctl start grafana-server
systemctl enable grafana-server

# 動作確認
sleep 3
if systemctl is-active --quiet grafana-server; then
    log_info "✓ Grafanaが正常に起動しました"
else
    log_error "Grafanaの起動に失敗しました"
    log_error "ログを確認してください: sudo journalctl -u grafana-server -n 50"
    exit 1
fi

# Grafanaが準備完了するまで待機
log_info "Grafanaの起動を待機中..."
MAX_WAIT=30
WAIT_COUNT=0
while ! curl -s http://localhost:3000/api/health > /dev/null; do
    sleep 2
    WAIT_COUNT=$((WAIT_COUNT + 2))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        log_error "Grafanaの起動タイムアウト"
        exit 1
    fi
done

log_info "✓ Grafanaが準備完了しました"

# ダッシュボードファイルの確認
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DASHBOARD_FILE="${SCRIPT_DIR}/grafana/dashboards/itsm-system-dashboard.json"

log_info ""
log_info "=========================================="
log_info "インストールが完了しました！"
log_info "=========================================="
log_info ""
log_info "Grafana UI: http://localhost:3000"
log_info "デフォルト認証情報:"
log_info "  ユーザー名: admin"
log_info "  パスワード: admin"
log_info ""
log_info "次のステップ:"
log_info "1. ブラウザで http://localhost:3000 にアクセス"
log_info "2. admin/admin でログイン（初回はパスワード変更を求められます）"
log_info "3. Configuration > Data Sources でPrometheusを追加"
log_info "   - URL: http://localhost:9090"
log_info "4. Dashboards > Import でダッシュボードをインポート"

if [ -f "$DASHBOARD_FILE" ]; then
    log_info "   - ファイル: ${DASHBOARD_FILE}"
else
    log_warn "ダッシュボードファイルが見つかりません: ${DASHBOARD_FILE}"
fi

log_info ""
log_info "詳細: /mnt/LinuxHDD/ITSM-System/Docs/monitoring-setup.md"
log_info ""

log_info "インストールスクリプトが完了しました"
