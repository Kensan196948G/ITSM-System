# Phase D: 本番環境移行準備計画

**作成日**: 2026-02-02
**対象システム**: ITSM-Sec Nexus v2.1.0
**前提条件**: Phase C 完了（テストカバレッジ70%、全機能実装）
**目標**: 本番環境での安定稼働、SLA達成

---

## 🎯 Phase D の目的

開発環境で完成したシステムを本番環境に移行し、以下を実現する：

1. **安定稼働**: 稼働率 99.9% 以上
2. **パフォーマンス**: レスポンスタイム < 200ms (P95)
3. **セキュリティ**: セキュリティスコア 9/10 以上
4. **運用体制**: 24/7 監視・インシデント対応

---

## 📋 Phase D の構成

### D-1: インフラ構築（Week 1-2）

#### D-1-1: サーバー環境準備

**選択肢**:

##### オプション A: クラウド（AWS/Azure/GCP）
**推奨構成**:
- **EC2/VM**: t3.medium または同等（2vCPU, 4GB RAM）
- **データベース**: RDS PostgreSQL 15.x（db.t3.small）
- **ストレージ**: EBS/Managed Disk 100GB SSD
- **ネットワーク**: VPC/VNet、セキュリティグループ
- **ロードバランサー**: ALB/Application Gateway
- **SSL証明書**: ACM/Azure Certificate（自動更新）

**メリット**:
- スケーラビリティ（需要に応じて拡張）
- 自動バックアップ・リストア
- 高可用性（Multi-AZ）
- マネージドサービス活用

**コスト見積もり（月額）**:
```
EC2 t3.medium:        $30-40
RDS PostgreSQL:       $15-25
EBS 100GB:           $10
データ転送:          $5-10
合計:                $60-85/月
```

---

##### オプション B: オンプレミス
**推奨構成**:
- **サーバー**: 物理サーバーまたはVMware/Hyper-V
  - CPU: 4コア以上
  - メモリ: 8GB以上
  - ストレージ: SSD 200GB以上
- **OS**: Ubuntu 24.04 LTS
- **ネットワーク**: 固定IP、ファイアウォール
- **バックアップ**: NAS/外部ストレージ

**メリット**:
- 初期投資のみ（ランニングコスト低）
- データ完全管理
- カスタマイズ自由度高

**コスト見積もり（初期）**:
```
サーバー:            $1,000-2,000
ストレージ:          $200-500
ネットワーク機器:     $300-800
合計:                $1,500-3,300（初期投資）
```

---

#### D-1-2: データベース移行（SQLite → PostgreSQL）

**移行手順**:

```bash
# 1. PostgreSQL インストール
sudo apt-get install postgresql-15 postgresql-contrib

# 2. データベース作成
sudo -u postgres psql
CREATE DATABASE itsm_nexus_prod;
CREATE USER itsm_user WITH ENCRYPTED PASSWORD 'SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE itsm_nexus_prod TO itsm_user;

# 3. Knex設定更新（knexfile.js）
production: {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'itsm_nexus_prod',
    user: process.env.DB_USER || 'itsm_user',
    password: process.env.DB_PASSWORD
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: './backend/migrations'
  }
}

# 4. マイグレーション実行
NODE_ENV=production npm run migrate:latest

# 5. データ移行（必要に応じて）
# SQLite → PostgreSQL データエクスポート/インポート
```

**必要なパッケージ**:
```bash
npm install pg
```

---

#### D-1-3: SSL/TLS証明書取得

**オプション A: Let's Encrypt（無料）**

```bash
# Certbot インストール
sudo apt-get install certbot python3-certbot-nginx

# 証明書取得（Nginx使用）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自動更新設定（90日ごと）
sudo certbot renew --dry-run
```

**オプション B: 商用証明書**
- DigiCert, GlobalSign, Sectigo など
- ワイルドカード証明書対応
- 組織検証（OV）推奨

---

### D-2: アプリケーションデプロイ（Week 2-3）

#### D-2-1: 本番環境設定

**環境変数（.env.production）**:
```bash
# アプリケーション
NODE_ENV=production
PORT=6443
ENABLE_HTTPS=true

# データベース
DB_HOST=localhost
DB_PORT=5432
DB_NAME=itsm_nexus_prod
DB_USER=itsm_user
DB_PASSWORD=<SECURE_PASSWORD>

# JWT
JWT_SECRET=<GENERATED_SECRET_64_CHARS>
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_DAYS=7

# セキュリティ
RATE_LIMIT_ENABLED=true
CORS_ORIGIN=https://your-domain.com

# 監視
PROMETHEUS_ENABLED=true
HEALTH_CHECK_INTERVAL=60000

# バックアップ
BACKUP_ENABLED=true
BACKUP_RETENTION_DAYS=30
REMOTE_BACKUP_ENABLED=true
REMOTE_BACKUP_PATH=/mnt/backup
```

---

#### D-2-2: Systemd サービス設定

**ファイル**: `/etc/systemd/system/itsm-nexus.service`

```ini
[Unit]
Description=ITSM-Sec Nexus Production Server
After=network.target postgresql.service

[Service]
Type=simple
User=itsm
WorkingDirectory=/opt/itsm-nexus
Environment=NODE_ENV=production
EnvironmentFile=/opt/itsm-nexus/.env.production
ExecStart=/usr/bin/node /opt/itsm-nexus/backend/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-nexus

# セキュリティ
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/itsm-nexus/backend/logs /opt/itsm-nexus/backend/backups

# リソース制限
MemoryLimit=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

**有効化**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable itsm-nexus
sudo systemctl start itsm-nexus
sudo systemctl status itsm-nexus
```

---

#### D-2-3: Nginx リバースプロキシ設定

**ファイル**: `/etc/nginx/sites-available/itsm-nexus`

```nginx
upstream itsm_backend {
    server 127.0.0.1:6443;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL証明書
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL設定
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # セキュリティヘッダー
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ログ
    access_log /var/log/nginx/itsm-nexus-access.log;
    error_log /var/log/nginx/itsm-nexus-error.log;

    # プロキシ設定
    location / {
        proxy_pass https://itsm_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 静的ファイル
    location /static/ {
        alias /opt/itsm-nexus/frontend/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

### D-3: 監視・運用体制（Week 3-4）

#### D-3-1: Prometheus + Grafana 監視

**Prometheus 設定**:
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'itsm-nexus'
    static_configs:
      - targets: ['localhost:6443']
    metrics_path: '/metrics'
```

**Grafana ダッシュボード**:
- HTTPリクエスト/秒
- レスポンスタイム（P50, P95, P99）
- エラー率
- アクティブユーザー数
- データベースクエリ数
- SLAコンプライアンス

---

#### D-3-2: アラート設定

**Prometheus アラートルール**:
```yaml
groups:
  - name: itsm-nexus
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "高いエラー率を検出"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_response_time_seconds_bucket[5m])) > 1
        for: 5m
        annotations:
          summary: "レスポンスタイムが遅い"

      - alert: DatabaseDown
        expr: up{job="itsm-nexus"} == 0
        for: 1m
        annotations:
          summary: "データベース接続失敗"
```

---

#### D-3-3: バックアップ運用

**自動バックアップスケジュール**:
```bash
# crontab -e
# 日次バックアップ（2:00 AM）
0 2 * * * /opt/itsm-nexus/scripts/backup.sh daily

# 週次バックアップ（日曜 3:00 AM）
0 3 * * 0 /opt/itsm-nexus/scripts/backup.sh weekly

# 月次バックアップ（1日 4:00 AM）
0 4 1 * * /opt/itsm-nexus/scripts/backup.sh monthly

# バックアップ整合性チェック（土曜 1:00 AM）
0 1 * * 6 /opt/itsm-nexus/scripts/check-backup-integrity.sh
```

**リモートバックアップ**:
```bash
# AWS S3 へのバックアップ
aws s3 sync /opt/itsm-nexus/backend/backups/ s3://itsm-nexus-backups/ --delete

# または rsync（別サーバー）
rsync -avz /opt/itsm-nexus/backend/backups/ backup-server:/backups/itsm-nexus/
```

---

### D-4: 本番デプロイ手順（Week 4）

#### チェックリスト

**デプロイ前**:
- [ ] インフラ構築完了
- [ ] PostgreSQL セットアップ完了
- [ ] SSL証明書取得完了
- [ ] .env.production 設定完了
- [ ] Systemd サービス設定完了
- [ ] Nginx 設定完了
- [ ] バックアップスクリプト設定完了
- [ ] 監視ダッシュボード設定完了

**デプロイ実施**:
```bash
# 1. リポジトリクローン
cd /opt
sudo git clone https://github.com/Kensan196948G/ITSM-System.git itsm-nexus
cd itsm-nexus

# 2. 依存関係インストール
npm ci --omit=dev

# 3. 環境変数設定
sudo cp .env.example .env.production
sudo nano .env.production  # 本番設定を入力

# 4. データベースマイグレーション
NODE_ENV=production npm run migrate:latest

# 5. サービス起動
sudo systemctl start itsm-nexus
sudo systemctl status itsm-nexus

# 6. 動作確認
curl https://your-domain.com/api/v1/health
curl https://your-domain.com/metrics

# 7. ログ確認
sudo journalctl -u itsm-nexus -f
```

**デプロイ後**:
- [ ] ヘルスチェックAPI正常応答
- [ ] Prometheusメトリクス取得可能
- [ ] フロントエンド表示確認
- [ ] ログイン機能確認
- [ ] バックアップ実行確認
- [ ] 監視アラート動作確認

---

## 📊 SLA 目標

| 指標 | 目標値 | 測定方法 |
|------|--------|---------|
| **稼働率** | ≥ 99.9% | Prometheus uptime |
| **レスポンスタイム（P95）** | < 200ms | Prometheus histogram |
| **エラー率** | < 0.1% | HTTP 5xx / total requests |
| **同時接続数** | ≥ 1,000 | アクティブユーザーゲージ |
| **バックアップ成功率** | 100% | バックアップログ |
| **復旧時間目標（RTO）** | < 1時間 | リストア訓練 |
| **復旧ポイント目標（RPO）** | < 24時間 | バックアップ頻度 |

---

## 🚨 インシデント対応体制

### 重要度レベル

| レベル | 定義 | 対応時間 | 対応者 |
|--------|------|---------|--------|
| **P1 - Critical** | サービス全停止 | 15分以内 | 全員 |
| **P2 - High** | 主要機能停止 | 1時間以内 | オンコール |
| **P3 - Medium** | 一部機能停止 | 4時間以内 | 担当者 |
| **P4 - Low** | 軽微な問題 | 1営業日以内 | 担当者 |

### エスカレーションフロー

```
P1発生 → アラート送信（Slack/Email/SMS）
       ↓
  オンコール担当者対応開始（15分以内）
       ↓
  30分で解決しない場合 → マネージャーエスカレーション
       ↓
  1時間で解決しない場合 → 全員召集
```

---

## 🔒 セキュリティチェックリスト

**本番環境セキュリティ要件**:
- [ ] ファイアウォール設定（ポート6443, 443のみ開放）
- [ ] SSH鍵認証のみ（パスワード認証無効化）
- [ ] sudo権限の最小化
- [ ] データベース接続の暗号化
- [ ] 定期的なセキュリティアップデート
- [ ] Fail2ban導入（ブルートフォース対策）
- [ ] ログ監視（異常アクセス検知）
- [ ] 定期的な脆弱性スキャン

---

## 📈 Phase D タイムライン

```
Week 1: インフラ構築
├─ Day 1-2: サーバー準備・OS設定
├─ Day 3-4: PostgreSQL セットアップ
└─ Day 5:   SSL証明書取得

Week 2: アプリケーションデプロイ
├─ Day 6-7: 環境設定・依存関係インストール
├─ Day 8:   マイグレーション実行
├─ Day 9:   サービス起動・動作確認
└─ Day 10:  Nginx設定・SSL有効化

Week 3: 監視・運用準備
├─ Day 11-12: Prometheus + Grafana 設定
├─ Day 13:    アラート設定
├─ Day 14:    バックアップ運用開始
└─ Day 15:    ログローテーション設定

Week 4: 負荷テスト・最終調整
├─ Day 16-17: 負荷テスト実施
├─ Day 18:    パフォーマンスチューニング
├─ Day 19:    リストア訓練
└─ Day 20:    本番運用開始判定
```

---

## 💰 コスト分析

### クラウド（AWS例）- 年間コスト

| 項目 | 月額 | 年額 |
|------|------|------|
| EC2 t3.medium | $35 | $420 |
| RDS PostgreSQL | $20 | $240 |
| EBS 100GB | $10 | $120 |
| データ転送 | $8 | $96 |
| **合計** | **$73** | **$876** |

### オンプレミス - 初期投資

| 項目 | コスト |
|------|--------|
| サーバーハードウェア | $1,500 |
| ストレージ | $300 |
| ネットワーク | $500 |
| 電力（年間） | $200 |
| **合計（初期）** | **$2,300** |
| **年間ランニング** | **$200** |

**ROI**: オンプレミスは2.6年で元が取れる

---

## 🎯 Phase D 完了判定基準

以下をすべて満たすことで Phase D 完了とする：

### 技術要件
- [x] 本番環境でアプリケーション稼働
- [ ] PostgreSQL 本番運用中
- [ ] SSL/TLS 有効（A+評価）
- [ ] Prometheus監視稼働
- [ ] 自動バックアップ稼働
- [ ] 負荷テスト合格（1000同時接続）
- [ ] セキュリティスキャン合格

### 運用要件
- [ ] 運用マニュアル完成
- [ ] インシデント対応フロー確立
- [ ] バックアップ・リストア手順確立
- [ ] 24/7監視体制確立

### SLA要件
- [ ] 稼働率 ≥ 99.9%（1週間継続）
- [ ] レスポンスタイム < 200ms (P95)
- [ ] エラー率 < 0.1%
- [ ] バックアップ成功率 100%

---

## 🚀 次のアクション

### Phase C完了後（2026年2月末）
1. インフラ選定（クラウド or オンプレミス）
2. サーバー準備開始
3. PostgreSQL移行計画詳細化

### Phase D開始時（2026年3月初旬）
1. Week 1: インフラ構築
2. Week 2: デプロイ実施
3. Week 3: 監視・運用準備
4. Week 4: 負荷テスト・本番運用開始判定

---

**作成者**: Claude Sonnet 4.5 (1M context)
**次回更新**: Phase C 完了時
