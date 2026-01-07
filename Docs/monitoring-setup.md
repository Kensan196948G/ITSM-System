# ITSM Nexus モニタリングセットアップガイド

このドキュメントでは、ITSM NexusシステムのPrometheusとGrafanaによるモニタリング環境の構築手順を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [Prometheusのインストール](#prometheusのインストール)
4. [Grafanaのインストール](#grafanaのインストール)
5. [Prometheus設定](#prometheus設定)
6. [Grafanaダッシュボードのインポート](#grafanaダッシュボードのインポート)
7. [アラート設定](#アラート設定)
8. [トラブルシューティング](#トラブルシューティング)

---

## 概要

ITSM Nexusシステムは、Prometheus形式のメトリクスを `/api/metrics` エンドポイントで公開しています。このガイドでは、以下を構築します：

- **Prometheus**: メトリクスの収集と保存
- **Grafana**: メトリクスの可視化
- **アラートルール**: システム異常の自動検知

### 監視対象メトリクス

- システム概要（リクエスト数、レスポンスタイム、CPU、メモリ）
- インシデント統計（優先度別、ステータス別）
- SLAメトリクス（達成率、違反数）
- キャッシュパフォーマンス（ヒット率、メモリ使用量）
- データベースパフォーマンス（クエリ実行時間）
- 認証・セキュリティ（認証エラー、HTTPステータスコード）

---

## 前提条件

- Linux OS（Ubuntu 20.04以降推奨）
- ITSM Nexusバックエンドが稼働中（デフォルト: `http://localhost:5000`）
- rootまたはsudo権限を持つユーザー
- 十分なディスクスペース（Prometheusデータ保存用に最低10GB推奨）

---

## Prometheusのインストール

### 1. Prometheusのダウンロード

最新版のPrometheusを[公式サイト](https://prometheus.io/download/)からダウンロードします。

```bash
# 最新版のバージョンを確認（2024年1月時点: v2.48.0）
PROMETHEUS_VERSION="2.48.0"

# ダウンロード
cd /tmp
wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz

# 解凍
tar xvfz prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz

# インストール
sudo mv prometheus-${PROMETHEUS_VERSION}.linux-amd64 /opt/prometheus
```

### 2. Prometheusユーザーの作成

```bash
sudo useradd --no-create-home --shell /bin/false prometheus
```

### 3. ディレクトリの作成

```bash
sudo mkdir -p /var/lib/prometheus
sudo mkdir -p /etc/prometheus/alerts

sudo chown prometheus:prometheus /var/lib/prometheus
sudo chown -R prometheus:prometheus /etc/prometheus
```

### 4. 設定ファイルのコピー

```bash
# ITSM-Systemプロジェクトの設定をコピー
sudo cp /mnt/LinuxHDD/ITSM-System/monitoring/prometheus/prometheus.yml /etc/prometheus/
sudo cp /mnt/LinuxHDD/ITSM-System/monitoring/prometheus/alerts/itsm-alerts.yml /etc/prometheus/alerts/

sudo chown prometheus:prometheus /etc/prometheus/prometheus.yml
sudo chown prometheus:prometheus /etc/prometheus/alerts/itsm-alerts.yml
```

### 5. 設定ファイルの編集

`/etc/prometheus/prometheus.yml` を開き、バックエンドのアドレスを環境に合わせて変更します。

```yaml
scrape_configs:
  - job_name: 'itsm-nexus-backend'
    static_configs:
      - targets:
          # バックエンドが別サーバーの場合はIPアドレスを変更
          - 'localhost:5000'
```

### 6. systemdサービスの作成

```bash
sudo tee /etc/systemd/system/prometheus.service > /dev/null <<EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
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
```

### 7. サービスの起動

```bash
sudo systemctl daemon-reload
sudo systemctl start prometheus
sudo systemctl enable prometheus

# ステータス確認
sudo systemctl status prometheus
```

### 8. 動作確認

ブラウザで `http://localhost:9090` にアクセスし、Prometheus UIが表示されることを確認します。

Status > Targets から `itsm-nexus-backend` が **UP** になっていることを確認します。

---

## Grafanaのインストール

### 1. Grafanaのインストール（Ubuntu/Debian）

```bash
# 必要なパッケージのインストール
sudo apt-get install -y software-properties-common

# Grafanaのリポジトリを追加
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# インストール
sudo apt-get update
sudo apt-get install -y grafana
```

### 2. Grafanaの起動

```bash
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# ステータス確認
sudo systemctl status grafana-server
```

### 3. 初回ログイン

ブラウザで `http://localhost:3000` にアクセスします。

- デフォルトユーザー名: `admin`
- デフォルトパスワード: `admin`

初回ログイン時にパスワード変更を求められるので、安全なパスワードに変更してください。

---

## Prometheus設定

### 1. データソースの追加

1. Grafana UIにログイン
2. サイドバーの **Configuration** > **Data Sources** をクリック
3. **Add data source** をクリック
4. **Prometheus** を選択
5. 以下の設定を入力：
   - **Name**: `Prometheus`
   - **URL**: `http://localhost:9090`
   - **Access**: `Server (default)`
6. **Save & Test** をクリックして接続を確認

---

## Grafanaダッシュボードのインポート

### 方法1: ファイルからインポート

1. サイドバーの **Dashboards** > **Import** をクリック
2. **Upload JSON file** をクリック
3. `/mnt/LinuxHDD/ITSM-System/monitoring/grafana/dashboards/itsm-system-dashboard.json` を選択
4. Prometheus データソースとして先ほど作成した **Prometheus** を選択
5. **Import** をクリック

### 方法2: JSONを直接貼り付け

1. サイドバーの **Dashboards** > **Import** をクリック
2. **Import via panel json** にJSONファイルの内容をコピー&ペースト
3. **Load** をクリック
4. Prometheus データソースを選択
5. **Import** をクリック

### ダッシュボードの確認

インポート後、以下のパネルが表示されることを確認します：

#### システム概要
- 総リクエスト数（5分間）
- 平均レスポンスタイム（P95）
- アクティブユーザー数
- エラー率
- CPU使用率
- メモリ使用量
- HTTPリクエスト数（メソッド別）
- レスポンスタイム（パーセンタイル）

#### インシデント管理
- インシデント数（優先度別）
- オープンインシデント数（優先度別）
- インシデントタイプ分布

#### SLAメトリクス
- SLA達成率（サービス別）
- SLA達成率推移

#### キャッシュパフォーマンス
- キャッシュヒット率
- キャッシュメモリ使用量
- キャッシュキー数
- キャッシュエビクション率
- キャッシュヒット/ミス（エンドポイント別）
- キャッシュヒット率推移

#### データベースパフォーマンス
- データベースクエリ数（操作別）
- データベースクエリ数（テーブル別）

#### 認証・セキュリティ
- 認証エラー数
- HTTPステータスコード分布

---

## アラート設定

### Prometheusアラートルールの確認

アラートルールは `/etc/prometheus/alerts/itsm-alerts.yml` に定義されています。

主なアラート：

| アラート名 | 条件 | 深刻度 |
|-----------|------|--------|
| HighResponseTime | P95レスポンスタイム > 2秒 | Warning |
| VeryHighResponseTime | P95レスポンスタイム > 5秒 | Critical |
| HighErrorRate | 5xxエラー率 > 5% | Critical |
| HighCPUUsage | CPU使用率 > 80% | Warning |
| HighMemoryUsage | メモリ使用量 > 1GB | Warning |
| LowSLACompliance | SLA達成率 < 95% | Warning |
| CriticalSLACompliance | SLA達成率 < 90% | Critical |
| HighCriticalIncidents | クリティカルインシデント > 10件 | Critical |
| SecurityIncidentDetected | セキュリティインシデント発生 | Critical |
| LowCacheHitRate | キャッシュヒット率 < 50% | Warning |
| HighAuthenticationFailures | 認証失敗 > 5回/秒 | Warning |
| ServiceDown | サービスダウン | Critical |

### アラートの確認

Prometheus UIの **Alerts** タブでアラートの状態を確認できます。

```
http://localhost:9090/alerts
```

### Alertmanagerの設定（オプション）

より高度なアラート通知（メール、Slack、PagerDutyなど）を使用する場合は、Alertmanagerをインストールします。

```bash
# Alertmanagerのダウンロード
ALERTMANAGER_VERSION="0.26.0"
cd /tmp
wget https://github.com/prometheus/alertmanager/releases/download/v${ALERTMANAGER_VERSION}/alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz

# 解凍とインストール
tar xvfz alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz
sudo mv alertmanager-${ALERTMANAGER_VERSION}.linux-amd64 /opt/alertmanager
```

Alertmanagerの詳細設定は[公式ドキュメント](https://prometheus.io/docs/alerting/latest/alertmanager/)を参照してください。

---

## 高度な設定

### Grafanaでのアラート設定

Grafana自体でもアラートを設定できます。

1. ダッシュボードのパネルを開く
2. **Alert** タブを選択
3. **Create alert rule from this panel** をクリック
4. 条件とアクションを設定
5. 通知チャンネル（Slack、Emailなど）を設定

### データ保持期間の変更

Prometheusのデータ保持期間を変更する場合、`/etc/systemd/system/prometheus.service` の `--storage.tsdb.retention.time` を編集します。

```bash
sudo systemctl edit prometheus.service
```

```ini
--storage.tsdb.retention.time=90d  # 90日間保持
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart prometheus
```

### リモート監視

Prometheusを別サーバーに配置する場合、`prometheus.yml` のターゲットを変更します。

```yaml
scrape_configs:
  - job_name: 'itsm-nexus-backend'
    static_configs:
      - targets:
          - '192.168.1.100:5000'  # バックエンドサーバーのIPアドレス
```

ファイアウォールで5000番ポート（バックエンド）と9090番ポート（Prometheus）を開放してください。

---

## トラブルシューティング

### 問題: Prometheusがメトリクスを収集できない

**症状**: Targets ページで `itsm-nexus-backend` が **DOWN** になっている

**解決方法**:

1. バックエンドが稼働していることを確認
   ```bash
   curl http://localhost:5000/api/metrics
   ```

2. ファイアウォールを確認
   ```bash
   sudo ufw status
   ```

3. prometheus.ymlのターゲット設定を確認
   ```bash
   cat /etc/prometheus/prometheus.yml
   ```

4. Prometheusログを確認
   ```bash
   sudo journalctl -u prometheus -f
   ```

### 問題: Grafanaダッシュボードにデータが表示されない

**症状**: パネルに "No data" と表示される

**解決方法**:

1. データソース接続を確認
   - Grafana UI > Configuration > Data Sources > Prometheus
   - **Test** ボタンをクリック

2. Prometheusがメトリクスを収集しているか確認
   - Prometheus UI (`http://localhost:9090`) でクエリを実行
   - 例: `itsm_http_requests_total`

3. 時間範囲を確認
   - ダッシュボード右上の時間範囲を調整
   - 直近6時間（デフォルト）にデータがあるか確認

### 問題: アラートが発火しない

**解決方法**:

1. アラートルールの構文を確認
   ```bash
   /opt/prometheus/promtool check rules /etc/prometheus/alerts/itsm-alerts.yml
   ```

2. Prometheusを再起動
   ```bash
   sudo systemctl restart prometheus
   ```

3. アラートの評価状態を確認
   - Prometheus UI > Alerts

### 問題: ディスク容量不足

**症状**: Prometheusが停止またはメトリクスが保存されない

**解決方法**:

1. データ保持期間を短縮
   ```bash
   sudo systemctl edit prometheus.service
   # --storage.tsdb.retention.time=15d に変更
   sudo systemctl daemon-reload
   sudo systemctl restart prometheus
   ```

2. 古いデータを手動削除
   ```bash
   sudo systemctl stop prometheus
   sudo rm -rf /var/lib/prometheus/data/
   sudo systemctl start prometheus
   ```

---

## メンテナンス

### バックアップ

#### Prometheusデータのバックアップ

```bash
sudo systemctl stop prometheus
sudo tar czf prometheus-backup-$(date +%Y%m%d).tar.gz /var/lib/prometheus
sudo systemctl start prometheus
```

#### Grafanaダッシュボードのエクスポート

1. Grafana UI > Dashboards > Browse
2. ダッシュボードを開く
3. 右上の **Share** > **Export** > **Save to file**

### 更新

#### Prometheusの更新

```bash
# 新しいバージョンをダウンロード
cd /tmp
wget https://github.com/prometheus/prometheus/releases/download/vX.X.X/prometheus-X.X.X.linux-amd64.tar.gz
tar xvfz prometheus-X.X.X.linux-amd64.tar.gz

# サービスを停止
sudo systemctl stop prometheus

# バイナリを更新
sudo mv /opt/prometheus /opt/prometheus.old
sudo mv prometheus-X.X.X.linux-amd64 /opt/prometheus

# 設定ファイルをコピー
sudo cp /opt/prometheus.old/prometheus.yml /opt/prometheus/

# サービスを起動
sudo systemctl start prometheus

# 動作確認後、古いバージョンを削除
# sudo rm -rf /opt/prometheus.old
```

#### Grafanaの更新

```bash
sudo apt-get update
sudo apt-get upgrade grafana
sudo systemctl restart grafana-server
```

---

## 参考リンク

- [Prometheus公式ドキュメント](https://prometheus.io/docs/introduction/overview/)
- [Grafana公式ドキュメント](https://grafana.com/docs/grafana/latest/)
- [PromQLクエリ言語](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafanaダッシュボード作成ガイド](https://grafana.com/docs/grafana/latest/dashboards/)

---

## まとめ

このガイドに従って、ITSM Nexusシステムの包括的なモニタリング環境を構築できます。

- **Prometheus**: メトリクスの収集と保存
- **Grafana**: 視覚的なダッシュボード
- **アラート**: 自動的な異常検知

定期的にメトリクスを確認し、システムの健全性を維持してください。

---

**最終更新日**: 2025年1月7日
