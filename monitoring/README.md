# ITSM Nexus モニタリング

このディレクトリには、ITSM NexusシステムのPrometheusとGrafanaによるモニタリング設定ファイルが含まれています。

## ディレクトリ構造

```
monitoring/
├── README.md                          # このファイル
├── grafana/
│   └── dashboards/
│       └── itsm-system-dashboard.json # Grafanaダッシュボード定義
└── prometheus/
    ├── prometheus.yml                 # Prometheus設定ファイル
    └── alerts/
        └── itsm-alerts.yml            # アラートルール定義
```

## クイックスタート

詳細なセットアップ手順は `/Docs/monitoring-setup.md` を参照してください。

### 1. Prometheusのインストールと起動

```bash
# Prometheusをダウンロードしてインストール
wget https://github.com/prometheus/prometheus/releases/download/v2.48.0/prometheus-2.48.0.linux-amd64.tar.gz
tar xvfz prometheus-2.48.0.linux-amd64.tar.gz
sudo mv prometheus-2.48.0.linux-amd64 /opt/prometheus

# 設定ファイルをコピー
sudo mkdir -p /etc/prometheus/alerts
sudo cp prometheus/prometheus.yml /etc/prometheus/
sudo cp prometheus/alerts/itsm-alerts.yml /etc/prometheus/alerts/

# Prometheusを起動
/opt/prometheus/prometheus --config.file=/etc/prometheus/prometheus.yml
```

### 2. Grafanaのインストールと起動

```bash
# Ubuntu/Debianの場合
sudo apt-get install -y grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

ブラウザで `http://localhost:3000` にアクセスし、デフォルトの認証情報（admin/admin）でログインします。

### 3. ダッシュボードのインポート

1. Grafana UIで **Dashboards** > **Import** を選択
2. `grafana/dashboards/itsm-system-dashboard.json` をアップロード
3. Prometheusデータソースを選択して **Import** をクリック

## 監視メトリクス

### システムメトリクス
- `itsm_http_requests_total` - HTTP リクエスト総数
- `itsm_http_request_duration_seconds` - HTTPリクエスト処理時間
- `itsm_active_users_total` - アクティブユーザー数
- `itsm_process_cpu_user_seconds_total` - CPU使用時間
- `itsm_process_resident_memory_bytes` - メモリ使用量

### インシデントメトリクス
- `itsm_incidents_total` - インシデント作成総数
- `itsm_incidents_open` - オープンインシデント数

### SLAメトリクス
- `itsm_sla_compliance_rate` - SLA達成率（パーセント）

### キャッシュメトリクス
- `itsm_cache_hits_total` - キャッシュヒット総数
- `itsm_cache_misses_total` - キャッシュミス総数
- `itsm_cache_hit_rate` - キャッシュヒット率
- `itsm_cache_keys_total` - キャッシュキー数
- `itsm_cache_memory_bytes` - キャッシュメモリ使用量
- `itsm_cache_evictions_total` - キャッシュエビクション総数

### データベースメトリクス
- `itsm_database_queries_total` - データベースクエリ総数

### 認証メトリクス
- `itsm_auth_errors_total` - 認証エラー総数

## アラートルール

以下のアラートが定義されています（`prometheus/alerts/itsm-alerts.yml`）：

| アラート | 閾値 | 深刻度 |
|---------|------|--------|
| HighResponseTime | P95 > 2秒 | Warning |
| VeryHighResponseTime | P95 > 5秒 | Critical |
| HighErrorRate | 5xxエラー > 5% | Critical |
| HighCPUUsage | CPU > 80% | Warning |
| HighMemoryUsage | メモリ > 1GB | Warning |
| LowSLACompliance | SLA < 95% | Warning |
| CriticalSLACompliance | SLA < 90% | Critical |
| HighCriticalIncidents | クリティカル > 10件 | Critical |
| SecurityIncidentDetected | セキュリティインシデント発生 | Critical |
| LowCacheHitRate | ヒット率 < 50% | Warning |
| ServiceDown | サービスダウン | Critical |

## カスタマイズ

### Prometheusスクレイプ間隔の変更

`prometheus/prometheus.yml` の `scrape_interval` を編集します：

```yaml
global:
  scrape_interval: 15s  # デフォルト: 15秒
```

### データ保持期間の変更

Prometheusの起動オプションで指定します：

```bash
--storage.tsdb.retention.time=30d  # 30日間保持
```

### ダッシュボードのカスタマイズ

Grafana UIでダッシュボードを開き、パネルを編集します。変更後、**Share** > **Export** > **Save to file** でエクスポートできます。

### アラート閾値の変更

`prometheus/alerts/itsm-alerts.yml` を編集し、Prometheusを再起動します：

```bash
sudo systemctl restart prometheus
```

## トラブルシューティング

### メトリクスが収集されない

1. バックエンドが稼働していることを確認：
   ```bash
   curl http://localhost:5000/api/metrics
   ```

2. Prometheusのターゲット状態を確認：
   - ブラウザで `http://localhost:9090/targets` を開く
   - `itsm-nexus-backend` が **UP** であることを確認

3. Prometheusログを確認：
   ```bash
   sudo journalctl -u prometheus -f
   ```

### Grafanaダッシュボードにデータが表示されない

1. データソース接続を確認：
   - Grafana UI > Configuration > Data Sources > Prometheus
   - **Test** ボタンで接続確認

2. 時間範囲を調整：
   - ダッシュボード右上で時間範囲を変更

3. Prometheusでクエリをテスト：
   - `http://localhost:9090` で直接クエリを実行

## サポート

詳細なドキュメント：
- [モニタリングセットアップガイド](/Docs/monitoring-setup.md)
- [ITSM Nexus README](/README.md)

---

**バージョン**: 1.0.0
**最終更新**: 2025年1月7日
