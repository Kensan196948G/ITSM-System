#!/bin/bash

###############################################################################
# ITSM Nexus - Prometheusインストールスクリプト
#
# このスクリプトはPrometheusを自動的にインストールし、
# ITSM Nexusシステム用に設定します。
#
# 使用方法:
#   sudo ./install-prometheus.sh
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

# バージョン設定
PROMETHEUS_VERSION="2.48.0"
PROMETHEUS_USER="prometheus"
PROMETHEUS_GROUP="prometheus"

log_info "ITSM Nexus - Prometheusインストーラー"
log_info "Prometheusバージョン: ${PROMETHEUS_VERSION}"

# 既存のPrometheusをチェック
if systemctl is-active --quiet prometheus 2>/dev/null; then
    log_warn "Prometheusサービスが既に実行中です"
    read -p "既存のPrometheusを停止して再インストールしますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Prometheusを停止中..."
        systemctl stop prometheus
    else
        log_info "インストールをキャンセルしました"
        exit 0
    fi
fi

# 1. ユーザーとグループの作成
log_info "Prometheusユーザーを作成中..."
if ! id -u $PROMETHEUS_USER > /dev/null 2>&1; then
    useradd --no-create-home --shell /bin/false $PROMETHEUS_USER
    log_info "ユーザー '${PROMETHEUS_USER}' を作成しました"
else
    log_info "ユーザー '${PROMETHEUS_USER}' は既に存在します"
fi

# 2. ディレクトリの作成
log_info "ディレクトリを作成中..."
mkdir -p /var/lib/prometheus
mkdir -p /etc/prometheus/alerts
chown -R $PROMETHEUS_USER:$PROMETHEUS_GROUP /var/lib/prometheus
chown -R $PROMETHEUS_USER:$PROMETHEUS_GROUP /etc/prometheus

# 3. Prometheusのダウンロード
log_info "Prometheusをダウンロード中..."
cd /tmp
PROMETHEUS_TARBALL="prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz"
PROMETHEUS_URL="https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/${PROMETHEUS_TARBALL}"

if [ ! -f "/tmp/${PROMETHEUS_TARBALL}" ]; then
    wget -q --show-progress "${PROMETHEUS_URL}" || {
        log_error "Prometheusのダウンロードに失敗しました"
        exit 1
    }
else
    log_info "既存のtarballを使用します"
fi

# 4. 解凍とインストール
log_info "Prometheusをインストール中..."
tar xvfz "${PROMETHEUS_TARBALL}" > /dev/null 2>&1

# 既存のインストールをバックアップ
if [ -d "/opt/prometheus" ]; then
    log_info "既存のPrometheusをバックアップ中..."
    mv /opt/prometheus /opt/prometheus.backup.$(date +%Y%m%d_%H%M%S)
fi

mv "prometheus-${PROMETHEUS_VERSION}.linux-amd64" /opt/prometheus

# 5. 設定ファイルのコピー
log_info "設定ファイルをコピー中..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -f "${SCRIPT_DIR}/prometheus/prometheus.yml" ]; then
    cp "${SCRIPT_DIR}/prometheus/prometheus.yml" /etc/prometheus/
    log_info "prometheus.ymlをコピーしました"
else
    log_error "prometheus.ymlが見つかりません: ${SCRIPT_DIR}/prometheus/prometheus.yml"
    exit 1
fi

if [ -f "${SCRIPT_DIR}/prometheus/alerts/itsm-alerts.yml" ]; then
    cp "${SCRIPT_DIR}/prometheus/alerts/itsm-alerts.yml" /etc/prometheus/alerts/
    log_info "itsm-alerts.ymlをコピーしました"
else
    log_warn "itsm-alerts.ymlが見つかりません（スキップします）"
fi

# 権限設定
chown $PROMETHEUS_USER:$PROMETHEUS_GROUP /etc/prometheus/prometheus.yml
chown $PROMETHEUS_USER:$PROMETHEUS_GROUP /etc/prometheus/alerts/itsm-alerts.yml 2>/dev/null || true

# 6. systemdサービスの作成
log_info "systemdサービスを作成中..."
cat > /etc/systemd/system/prometheus.service <<EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=$PROMETHEUS_USER
Group=$PROMETHEUS_GROUP
Type=simple
ExecStart=/opt/prometheus/prometheus \\
  --config.file=/etc/prometheus/prometheus.yml \\
  --storage.tsdb.path=/var/lib/prometheus/ \\
  --storage.tsdb.retention.time=30d \\
  --web.console.templates=/opt/prometheus/consoles \\
  --web.console.libraries=/opt/prometheus/console_libraries

Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 7. サービスの起動
log_info "Prometheusサービスを起動中..."
systemctl daemon-reload
systemctl start prometheus
systemctl enable prometheus

# 8. 動作確認
sleep 3
if systemctl is-active --quiet prometheus; then
    log_info "✓ Prometheusが正常に起動しました"
    log_info ""
    log_info "=========================================="
    log_info "インストールが完了しました！"
    log_info "=========================================="
    log_info ""
    log_info "Prometheus UI: http://localhost:9090"
    log_info "メトリクスエンドポイント: http://localhost:5000/api/metrics"
    log_info ""
    log_info "次のステップ:"
    log_info "1. ブラウザでPrometheus UIにアクセス"
    log_info "2. Status > Targets で 'itsm-nexus-backend' が UP であることを確認"
    log_info "3. Grafanaをインストールして可視化"
    log_info ""
    log_info "詳細: /mnt/LinuxHDD/ITSM-System/Docs/monitoring-setup.md"
else
    log_error "Prometheusの起動に失敗しました"
    log_error "ログを確認してください: sudo journalctl -u prometheus -n 50"
    exit 1
fi

# クリーンアップ
log_info "一時ファイルをクリーンアップ中..."
rm -f "/tmp/${PROMETHEUS_TARBALL}"

log_info "インストールスクリプトが完了しました"
