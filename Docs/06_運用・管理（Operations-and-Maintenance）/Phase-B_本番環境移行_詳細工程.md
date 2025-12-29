# Phase B: 本番環境移行フェーズ - 詳細開発工程

**フェーズ目的**: 開発環境で完成したシステムを本番環境に移行し、安定稼働を実現する

**開始条件**: Phase A完了（テストカバレッジ70%、全機能実装、CI/CD稼働）
**完了条件**: 本番環境で安定稼働、SLA達成、運用体制確立
**想定期間**: 6-8週間
**リスクレベル**: High

---

## B-1: 本番環境インフラ準備（Week 1-2）

### B-1-1: インフラ要件定義

**工数**: 2日

**実施内容**:
1. **サーバースペック決定**
   - CPU: 4コア以上
   - メモリ: 8GB以上
   - ストレージ: SSD 100GB以上
   - ネットワーク: 1Gbps

2. **環境構成**
   ```
   本番環境:
   - Webサーバー: Nginx (リバースプロキシ)
   - アプリケーションサーバー: Node.js (PM2管理)
   - データベース: PostgreSQL 15.x
   - キャッシュ: Redis (オプション)

   ステージング環境:
   - 本番環境と同一構成
   - テストデータ使用
   ```

3. **ネットワーク設計**
   - DMZ配置
   - ファイアウォールルール
   - SSL/TLS証明書（Let's Encrypt）

**成果物**:
- インフラ要件定義書
- ネットワーク構成図
- コスト見積もり

---

### B-1-2: データベース移行準備（SQLite → PostgreSQL）

**工数**: 3日

**実施内容**:

#### 1. PostgreSQLインストール・設定
```bash
# PostgreSQL 15インストール
sudo apt-get install postgresql-15

# データベース作成
sudo -u postgres createdb itsm_nexus_prod
sudo -u postgres createuser itsm_user --pwprompt
```

#### 2. マイグレーションツール導入
```bash
npm install sequelize sequelize-cli pg pg-hstore
```

#### 3. Sequelize初期化
```bash
npx sequelize-cli init
```

#### 4. モデル定義作成
**ファイル**: `backend/models/incident.js`

```javascript
module.exports = (sequelize, DataTypes) => {
  const Incident = sequelize.define('Incident', {
    ticket_id: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    priority: {
      type: DataTypes.ENUM('Critical', 'High', 'Medium', 'Low'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('New', 'Assigned', 'In-Progress', 'Resolved', 'Closed'),
      defaultValue: 'New'
    },
    is_security_incident: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'incidents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Incident;
};
```

#### 5. マイグレーションファイル作成
```bash
npx sequelize-cli migration:generate --name create-tables
```

#### 6. データ移行スクリプト
**ファイル**: `scripts/migrate-sqlite-to-postgres.js`

```javascript
const sqlite3 = require('sqlite3');
const { Sequelize } = require('sequelize');

async function migrateData() {
  const sqliteDb = new sqlite3.Database('./backend/itsm_nexus.db');
  const postgresDb = new Sequelize(process.env.DATABASE_URL);

  // データ移行処理
  // ...

  console.log('Migration completed successfully');
}

migrateData();
```

**成果物**:
- PostgreSQL設定完了
- Sequelizeモデル定義
- マイグレーションスクリプト
- データ移行ツール

---

### B-1-3: Nginx リバースプロキシ設定

**工数**: 1日

**実施内容**:

#### nginx.conf
```nginx
upstream backend {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name itsm.yourdomain.com;

    # Force HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name itsm.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/itsm.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/itsm.yourdomain.com/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (static files)
    location / {
        root /var/www/itsm-nexus;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    location /api/v1/auth/login {
        limit_req zone=api burst=5;
        proxy_pass http://backend;
    }
}
```

**成果物**:
- Nginx設定ファイル
- SSL/TLS証明書設定
- リバースプロキシ動作確認

---

### B-1-4: PM2プロセス管理設定

**工数**: 1日

**実施内容**:

```bash
npm install -g pm2
```

**ecosystem.config.js**:
```javascript
module.exports = {
  apps: [{
    name: 'itsm-nexus-api',
    script: './backend/server.js',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/itsm/error.log',
    out_file: '/var/log/itsm/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

**起動・管理**:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**成果物**:
- PM2設定ファイル
- クラスタリング設定
- 自動再起動設定

---

## B-2: セキュリティ強化（Week 2-3）

### B-2-1: SSL/TLS証明書設定

**工数**: 1日

**実施内容**:

```bash
# Certbot (Let's Encrypt) インストール
sudo apt-get install certbot python3-certbot-nginx

# 証明書取得
sudo certbot --nginx -d itsm.yourdomain.com

# 自動更新設定
sudo crontab -e
# 0 3 * * * certbot renew --quiet
```

**検証**:
- SSL Labs評価 A+
- TLS 1.2以上のみ許可
- 強力な暗号スイート使用

**成果物**:
- SSL/TLS証明書
- HTTPS完全対応
- HTTP→HTTPS自動リダイレクト

---

### B-2-2: ファイアウォール設定

**工数**: 1日

**実施内容**:

```bash
# UFW (Uncomplicated Firewall)
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 5000/tcp   # Node.jsは外部非公開
sudo ufw status verbose
```

**iptables ルール**:
```bash
# レート制限（SSH Brute Force対策）
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --set
sudo iptables -A INPUT -p tcp --dport 22 -m state --state NEW -m recent --update --seconds 60 --hitcount 4 -j DROP
```

**成果物**:
- ファイアウォール設定
- ポート制限
- DDoS対策基本設定

---

### B-2-3: 侵入検知システム（IDS）導入

**工数**: 2日

**実施内容**:

```bash
# Fail2Ban インストール
sudo apt-get install fail2ban

# 設定
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

**/etc/fail2ban/jail.local**:
```ini
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 600
```

**成果物**:
- Fail2Ban設定
- 自動IP遮断機能

---

### B-2-4: セキュリティスキャン・脆弱性診断

**工数**: 3日

**実施内容**:

#### 1. OWASP ZAP自動スキャン
```bash
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://itsm.yourdomain.com
```

#### 2. Snyk脆弱性スキャン
```bash
npm install -g snyk
snyk auth
snyk test
snyk monitor
```

#### 3. npm audit
```bash
npm audit
npm audit fix
```

#### 4. ペネトレーションテスト
- SQL Injection テスト
- XSS テスト
- CSRF テスト
- 認証バイパステスト
- 権限昇格テスト

**成果物**:
- セキュリティスキャンレポート
- 脆弱性修正リスト
- ペネトレーションテスト報告書

---

## B-3: パフォーマンス最適化（Week 3-4）

### B-3-1: データベースチューニング

**工数**: 2日

**実施内容**:

#### PostgreSQL設定最適化
**/etc/postgresql/15/main/postgresql.conf**:
```conf
# Memory
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB

# Checkpoint
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Query Planner
random_page_cost = 1.1  # SSD使用の場合
effective_io_concurrency = 200

# Logging
log_min_duration_statement = 1000  # 1秒以上のクエリをログ
```

#### インデックス戦略
```sql
-- 複合インデックス
CREATE INDEX idx_incidents_status_priority ON incidents(status, priority);
CREATE INDEX idx_incidents_security_created ON incidents(is_security_incident, created_at DESC);

-- 部分インデックス
CREATE INDEX idx_active_incidents ON incidents(status) WHERE status != 'Closed';

-- フルテキスト検索
CREATE INDEX idx_incidents_title_fts ON incidents USING gin(to_tsvector('japanese', title));
```

**成果物**:
- PostgreSQL最適化設定
- インデックス戦略ドキュメント
- クエリパフォーマンスレポート

---

### B-3-2: APMツール導入

**工数**: 2日

**ツール**: New Relic / Datadog / Elastic APM

**実施内容**:
```bash
npm install newrelic
```

**newrelic.js**:
```javascript
exports.config = {
  app_name: ['ITSM-Sec Nexus Production'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info'
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization'
    ]
  }
};
```

**監視項目**:
- レスポンスタイム
- エラー率
- スループット
- データベースクエリ時間
- メモリ使用量

**成果物**:
- APMツール設定
- ダッシュボード構築
- アラート設定

---

### B-3-3: Redis キャッシング実装

**工数**: 3日

**実施内容**:

```bash
npm install redis
```

**backend/cache.js**:
```javascript
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: 6379
});

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    const key = `cache:${req.originalUrl}`;

    client.get(key, (err, data) => {
      if (err) throw err;

      if (data !== null) {
        return res.json(JSON.parse(data));
      }

      res.sendResponse = res.json;
      res.json = (body) => {
        client.setex(key, duration, JSON.stringify(body));
        res.sendResponse(body);
      };
      next();
    });
  };
};

module.exports = { cacheMiddleware };
```

**適用例**:
```javascript
// ダッシュボードKPIは5分キャッシュ
app.get('/api/v1/dashboard/kpi',
  authenticateJWT,
  cacheMiddleware(300),
  ...
);
```

**成果物**:
- Redisキャッシュ実装
- レスポンス時間50%削減

---

### B-3-4: CDN導入（静的ファイル）

**工数**: 1日

**実施内容**:
- CloudflareまたはAWS CloudFront設定
- CSS, JS, 画像ファイルをCDN経由配信
- キャッシュポリシー設定

**成果物**:
- CDN設定
- ページロード時間短縮

---

## B-4: 監視・ログ基盤構築（Week 4）

### B-4-1: ログ集約システム

**工数**: 3日

**ツール**: ELK Stack (Elasticsearch, Logstash, Kibana)

**実施内容**:

#### Winston ログライブラリ導入
```bash
npm install winston winston-daily-rotate-file
```

**backend/logger.js**:
```javascript
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'itsm-nexus-api' },
  transports: [
    new DailyRotateFile({
      filename: '/var/log/itsm/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    }),
    new DailyRotateFile({
      level: 'error',
      filename: '/var/log/itsm/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '90d'
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

**ログカテゴリ**:
- アプリケーションログ
- エラーログ
- アクセスログ
- 監査ログ
- セキュリティログ

**成果物**:
- Winston設定
- ログローテーション設定
- ELK Stack連携（オプション）

---

### B-4-2: 監視・アラート設定

**工数**: 2日

**ツール**: Prometheus + Grafana

**実施内容**:

#### Prometheus Exporter導入
```bash
npm install prom-client
```

**backend/metrics.js**:
```javascript
const promClient = require('prom-client');

const register = new promClient.Registry();

// メトリクス定義
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const incidentCounter = new promClient.Counter({
  name: 'incidents_total',
  help: 'Total number of incidents',
  labelNames: ['priority', 'status'],
  registers: [register]
});

// Express ミドルウェア
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: res.statusCode },
      duration
    );
  });

  next();
};

module.exports = { register, metricsMiddleware };
```

**監視項目**:
- レスポンスタイム
- エラー率
- スループット（RPS）
- CPU/メモリ使用率
- データベース接続数
- キャッシュヒット率

**アラート設定**:
- レスポンスタイム > 1秒
- エラー率 > 1%
- CPU使用率 > 80%
- ディスク空き容量 < 10%
- データベース接続プール枯渇

**成果物**:
- Prometheusメトリクスエンドポイント
- Grafanaダッシュボード
- アラートルール設定

---

### B-4-3: ヘルスチェック・アップタイム監視

**工数**: 1日

**ツール**: UptimeRobot / Pingdom

**実施内容**:
- `/api/v1/health` エンドポイント監視（1分間隔）
- `/api/v1/healthz/live` - Liveness Probe
- `/api/v1/healthz/ready` - Readiness Probe

**ヘルスチェックエンドポイント強化**:
```javascript
app.get('/api/v1/healthz/live', (req, res) => {
  res.json({ status: 'alive' });
});

app.get('/api/v1/healthz/ready', async (req, res) => {
  try {
    // データベース接続確認
    await db.getAsync("SELECT 1");

    // Redis接続確認（オプション）
    await redisClient.ping();

    res.json({
      status: 'ready',
      database: 'connected',
      cache: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});
```

**成果物**:
- ヘルスチェックエンドポイント
- アップタイム監視設定
- SLA計測基盤

---

## B-5: バックアップ・ディザスタリカバリ（Week 4-5）

### B-5-1: データベースバックアップ戦略

**工数**: 2日

**実施内容**:

#### 自動バックアップスクリプト
**ファイル**: `scripts/backup-database.sh`

```bash
#!/bin/bash

BACKUP_DIR="/var/backups/itsm"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/itsm_nexus_$TIMESTAMP.sql.gz"

# PostgreSQLバックアップ
pg_dump -U itsm_user itsm_nexus_prod | gzip > $BACKUP_FILE

# 古いバックアップ削除（30日以上前）
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# S3にアップロード（オプション）
aws s3 cp $BACKUP_FILE s3://itsm-backups/database/

echo "Backup completed: $BACKUP_FILE"
```

**Cron設定**:
```bash
# 毎日午前3時にバックアップ
0 3 * * * /opt/itsm/scripts/backup-database.sh

# 毎時間 増分バックアップ（WAL）
0 * * * * /opt/itsm/scripts/backup-wal.sh
```

**バックアップ種別**:
- フルバックアップ: 1日1回
- 増分バックアップ: 1時間1回
- トランザクションログ: リアルタイム

**保存期間**:
- ローカル: 30日
- リモート（S3）: 1年

**成果物**:
- バックアップスクリプト
- リストアスクリプト
- バックアップ検証レポート

---

### B-5-2: ディザスタリカバリ計画

**工数**: 3日

**実施内容**:

#### RPO/RTO目標設定
- **RPO (Recovery Point Objective)**: 1時間
- **RTO (Recovery Time Objective)**: 4時間

#### リストア手順書
**ファイル**: `Docs/06_運用・管理（Operations-and-Maintenance）/ディザスタリカバリ手順.md`

**内容**:
1. バックアップファイル取得
2. 新サーバー準備
3. PostgreSQL復元
4. アプリケーション展開
5. 動作確認
6. DNS切り替え

#### 定期リストアテスト
- 月1回、バックアップからのリストアテスト実施
- テスト結果記録

**成果物**:
- DR計画書
- リストア手順書
- テストレポート

---

## B-6: 運用体制構築（Week 5）

### B-6-1: 運用マニュアル作成

**工数**: 3日

**ファイル**: `Docs/06_運用・管理（Operations-and-Maintenance）/運用マニュアル.md`

**内容**:

#### 1. 日次運用
- 朝会チェックリスト
- ダッシュボード確認
- アラート対応
- バックアップ確認

#### 2. 週次運用
- ログレビュー
- パフォーマンスレビュー
- セキュリティパッチ適用

#### 3. 月次運用
- SLA報告
- キャパシティプランニング
- セキュリティレビュー
- DRテスト

#### 4. トラブルシューティング
- よくある問題と対処法
- エスカレーションフロー
- ロールバック手順

**成果物**:
- 運用マニュアル（100ページ）
- チェックリスト
- インシデント対応フロー

---

### B-6-2: ユーザートレーニング

**工数**: 2日

**実施内容**:
1. 管理者向けトレーニング（4時間）
2. 一般ユーザー向けトレーニング（2時間）
3. トレーニング資料作成
4. ハンズオン演習

**成果物**:
- トレーニングスライド
- 操作マニュアル
- FAQ

---

### B-6-3: SLA定義

**工数**: 1日

**内容**:

| サービス | 稼働率目標 | レスポンスタイム | サポート時間 |
|---------|----------|---------------|------------|
| システム稼働 | 99.9% | < 200ms | 24/7 |
| インシデント対応 | - | < 1時間 | 9-18時 |
| 変更要求承認 | - | < 4時間 | 9-18時 |

**成果物**:
- SLA定義書
- SLA監視ダッシュボード

---

## B-7: データ移行（Week 5-6）

### B-7-1: 移行計画策定

**工数**: 2日

**実施内容**:

#### 移行戦略
- **Big Bang**: 一括移行（ダウンタイムあり）
- **Phased**: 段階的移行（推奨）

#### 移行手順
1. **準備フェーズ**
   - 本番データクレンジング
   - データ整合性チェック
   - 移行スクリプトテスト

2. **移行フェーズ**
   - メンテナンスモード設定
   - データエクスポート（SQLite）
   - データインポート（PostgreSQL）
   - 整合性検証

3. **検証フェーズ**
   - 全機能動作確認
   - データ件数確認
   - パフォーマンステスト

4. **本番切り替え**
   - DNS切り替え
   - ユーザー通知
   - 監視強化

**成果物**:
- データ移行計画書
- ロールバック手順書

---

### B-7-2: データ移行実施

**工数**: 1日

**実施内容**:

**移行スクリプト**: `scripts/production-migration.js`

```javascript
const sqlite3 = require('sqlite3');
const { Sequelize } = require('sequelize');

async function migrate() {
  const sqliteDb = new sqlite3.Database('./backend/itsm_nexus.db');
  const postgresDb = new Sequelize(process.env.DATABASE_URL);

  // 1. ユーザー移行
  const users = await getUsersFromSQLite(sqliteDb);
  await bulkInsertUsers(postgresDb, users);

  // 2. 資産移行
  const assets = await getAssetsFromSQLite(sqliteDb);
  await bulkInsertAssets(postgresDb, assets);

  // 3. インシデント移行
  const incidents = await getIncidentsFromSQLite(sqliteDb);
  await bulkInsertIncidents(postgresDb, incidents);

  // 4. 変更要求移行
  const changes = await getChangesFromSQLite(sqliteDb);
  await bulkInsertChanges(postgresDb, changes);

  // 5. 整合性検証
  await verifyDataIntegrity(sqliteDb, postgresDb);

  console.log('Migration completed successfully');
}
```

**検証**:
```sql
-- レコード数確認
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'incidents', COUNT(*) FROM incidents
UNION ALL
SELECT 'assets', COUNT(*) FROM assets
UNION ALL
SELECT 'changes', COUNT(*) FROM changes;
```

**成果物**:
- 移行完了データベース
- 移行レポート

---

## B-8: 本番デプロイメント（Week 6-7）

### B-8-1: 段階的ロールアウト

**工数**: 5日

**戦略**: Blue-Green Deployment

**実施内容**:

#### ステップ1: ステージング環境デプロイ
- コードデプロイ
- データベースマイグレーション実行
- スモークテスト
- ユーザー受け入れテスト（UAT）

#### ステップ2: カナリアリリース
- 5%のトラフィックを新環境へ
- 監視強化（24時間）
- 問題なければ段階的に増加（10% → 25% → 50% → 100%）

#### ステップ3: 本番全面展開
- 全トラフィックを新環境へ
- 旧環境を24時間待機
- 問題なければ旧環境停止

**ロールバック条件**:
- エラー率 > 5%
- レスポンスタイム > 2秒
- Critical バグ発見

**成果物**:
- デプロイメント実施記録
- ロールバック判定基準

---

### B-8-2: 本番環境変数設定

**工数**: 1日

**本番.env**:
```bash
# Server Configuration
PORT=5000
NODE_ENV=production
HOST=0.0.0.0

# Database (PostgreSQL)
DATABASE_URL=postgresql://itsm_user:password@localhost:5432/itsm_nexus_prod

# JWT Configuration
JWT_SECRET=<本番用強力な秘密鍵>
JWT_EXPIRES_IN=8h

# CORS Configuration
CORS_ORIGIN=https://itsm.yourdomain.com

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Monitoring
NEW_RELIC_LICENSE_KEY=<ライセンスキー>
LOG_LEVEL=warn

# Email (alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@yourdomain.com
SMTP_PASS=<password>
```

**機密情報管理**:
- AWS Secrets Manager
- HashiCorp Vault
- または環境変数

**成果物**:
- 本番環境変数設定
- シークレット管理体制

---

### B-8-3: デプロイメント自動化

**工数**: 2日

**GitHub Actions**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v3

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.5.4
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Deploy to server
        run: |
          ssh user@prod-server << 'ENDSSH'
            cd /opt/itsm-nexus
            git pull origin main
            npm ci --production
            npx sequelize-cli db:migrate
            pm2 reload ecosystem.config.js
          ENDSSH

      - name: Health check
        run: |
          sleep 10
          curl -f https://itsm.yourdomain.com/api/v1/health
```

**成果物**:
- 自動デプロイパイプライン
- ロールバック自動化

---

## B-9: 本番運用開始（Week 7-8）

### B-9-1: ソフトローンチ

**工数**: 1週間

**実施内容**:
- 限定ユーザーでの運用開始
- フィードバック収集
- 問題点の早期発見・修正

**成果物**:
- ソフトローンチレポート
- 改善リスト

---

### B-9-2: 本番運用開始

**工数**: 継続

**実施内容**:
- 全ユーザーへの展開
- 24/7監視体制
- インシデント対応

**成果物**:
- 本番運用開始宣言
- 運用体制確立

---

## Phase B チェックリスト

### インフラ
- [ ] PostgreSQLセットアップ完了
- [ ] Nginx設定完了
- [ ] PM2設定完了
- [ ] SSL/TLS証明書取得

### セキュリティ
- [ ] ファイアウォール設定
- [ ] IDS/IPS設定
- [ ] セキュリティスキャン合格
- [ ] ペネトレーションテスト合格

### パフォーマンス
- [ ] データベースチューニング
- [ ] Redisキャッシング
- [ ] CDN設定
- [ ] レスポンス < 200ms

### 監視
- [ ] Prometheus/Grafana設定
- [ ] ログ集約システム
- [ ] アラート設定
- [ ] アップタイム監視

### バックアップ
- [ ] 自動バックアップ設定
- [ ] リストアテスト成功
- [ ] DR計画策定

### デプロイ
- [ ] Blue-Green デプロイ設定
- [ ] CI/CD パイプライン
- [ ] ロールバック手順確認

### 運用
- [ ] 運用マニュアル完成
- [ ] ユーザートレーニング完了
- [ ] SLA定義
- [ ] サポート体制確立

---

## Phase B 完了判定基準

| カテゴリ | 基準 | 目標値 |
|---------|------|--------|
| **稼働率** | SLA達成 | 99.9%以上 |
| **レスポンスタイム** | 平均 | < 200ms |
| **エラー率** | 全リクエスト | < 0.1% |
| **セキュリティ** | 脆弱性 | ゼロ |
| **バックアップ成功率** | 自動バックアップ | 100% |
| **監視カバレッジ** | 全サービス | 100% |

---

## 工数サマリー

| フェーズ | 工数（日） | 工数（時間） |
|---------|----------|------------|
| B-1: インフラ準備 | 7日 | 56時間 |
| B-2: セキュリティ強化 | 7日 | 56時間 |
| B-3: パフォーマンス最適化 | 8日 | 64時間 |
| B-4: 監視・ログ基盤 | 6日 | 48時間 |
| B-5: バックアップ・DR | 5日 | 40時間 |
| B-6: 運用体制構築 | 6日 | 48時間 |
| B-7: データ移行 | 3日 | 24時間 |
| B-8: 本番デプロイ | 8日 | 64時間 |
| B-9: 本番運用開始 | 7日 | 56時間 |
| **合計** | **57日** | **456時間** |

**1人での作業想定**: 約3ヶ月
**2人での作業想定**: 約1.5ヶ月

---

## リスク管理

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| データ移行失敗 | 中 | Critical | 十分なテスト、ロールバック準備 |
| パフォーマンス劣化 | 中 | High | 負荷テスト、段階的展開 |
| セキュリティインシデント | 低 | Critical | ペネトレーションテスト、監視強化 |
| ダウンタイム超過 | 中 | High | Blue-Green デプロイ |
| ユーザー混乱 | 高 | Medium | トレーニング、サポート体制 |

---

## 本番環境システム要件

### ハードウェア

**本番サーバー:**
- CPU: 8コア（Intel Xeon または AMD EPYC）
- RAM: 16GB
- SSD: 256GB
- ネットワーク: 1Gbps

**データベースサーバー:**
- CPU: 4コア
- RAM: 16GB
- SSD: 512GB（RAID10推奨）

### ソフトウェア

- OS: Ubuntu Server 22.04 LTS
- Node.js: 18.x LTS
- PostgreSQL: 15.x
- Nginx: 1.24.x
- Redis: 7.x
- PM2: Latest

### ネットワーク

- 固定IPアドレス
- ドメイン名（例: itsm.yourdomain.com）
- SSL/TLS証明書
- CDN（オプション）

---

## Phase B完了後の状態

✅ 本番環境で安定稼働
✅ SLA 99.9%達成
✅ セキュリティ監査合格
✅ 運用体制確立
✅ ユーザートレーニング完了
✅ ドキュメント完備

**次のステップ**: 継続的改善（Phase C）、機能拡張

---
### 更新メモ (2025-12-29)
- 監査ダッシュボード/コンプライアンス管理のUI詳細を反映
- 脆弱性管理の編集・削除を有効化
- ドキュメント参照先をDocs/に統一（docs/フォルダ削除）

