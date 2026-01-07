# ITSM-Sec Nexus 運用マニュアル

**バージョン:** 1.0
**最終更新:** 2026-01-07
**対象システム:** ITSM-Sec Nexus - ITサービスマネジメント & セキュリティ統合管理システム

---

## 目次

1. [システム概要](#1-システム概要)
2. [環境構築](#2-環境構築)
3. [スケジューラ運用](#3-スケジューラ運用)
4. [SLAアラート運用](#4-slaアラート運用)
5. [メール通知設定](#5-メール通知設定)
6. [バックアップ・リストア](#6-バックアップリストア)
7. [監視・ログ](#7-監視ログ)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. システム概要

### 1.1 アーキテクチャ図

```
                                    ITSM-Sec Nexus システム構成
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|    +-------------------+          +-------------------+          +-------------------+           |
|    |                   |          |                   |          |                   |           |
|    |    クライアント     |  HTTPS   |   フロントエンド    |   API    |   バックエンド      |           |
|    |    (ブラウザ)       | -------> |   (Node.js/静的)   | -------> |   (Express.js)    |           |
|    |                   |  :5050   |                   |  :5000   |                   |           |
|    +-------------------+          +-------------------+          +--------+----------+           |
|                                                                           |                      |
|                                           +-------------------------------+                      |
|                                           |                                                      |
|                          +----------------+----------------+----------------+                    |
|                          |                |                |                |                    |
|                          v                v                v                v                    |
|                   +-----------+    +-----------+    +-----------+    +-----------+              |
|                   |           |    |           |    |           |    |           |              |
|                   |  SQLite   |    | Scheduler |    |   Email   |    |  Metrics  |              |
|                   |    DB     |    | (node-cron)|   |  Service  |    | Prometheus|              |
|                   |           |    |           |    | (nodemailer)|  |           |              |
|                   +-----------+    +-----------+    +-----------+    +-----------+              |
|                        |                |                |                                       |
|                        v                v                v                                       |
|                   +-----------+    +-----------+    +-----------+                               |
|                   |           |    |           |    |           |                               |
|                   | backups/  |    | SLAレポート |    |   SMTP    |                               |
|                   | daily/    |    | 週次・月次  |    |  Server   |                               |
|                   | weekly/   |    |           |    |           |                               |
|                   | monthly/  |    +-----------+    +-----------+                               |
|                   +-----------+                                                                  |
|                                                                                                  |
+--------------------------------------------------------------------------------------------------+
```

### 1.2 コンポーネント説明

| コンポーネント | 説明 | ポート |
|--------------|------|-------|
| フロントエンド | 静的ファイル配信（HTML/CSS/JS） | 5050 (HTTPS) / 8080 (HTTP) |
| バックエンドAPI | Express.js REST API | 5000 (HTTPS) / 5443 |
| SQLiteデータベース | 永続化ストレージ | - |
| スケジューラ | SLAレポート自動送信（node-cron） | - |
| メールサービス | 通知メール送信（nodemailer） | SMTP 587/465 |
| メトリクス | Prometheusメトリクス収集 | /metrics |

### 1.3 主要機能

- **ITSM機能**: インシデント管理、問題管理、変更管理、構成管理（CMDB）
- **セキュリティ機能**: NIST CSF 2.0準拠、脆弱性管理、セキュリティダッシュボード
- **SLA管理**: サービスレベル契約管理、達成率監視、アラート通知
- **コンプライアンス**: 監査ダッシュボード、ポリシー管理、証跡収集

---

## 2. 環境構築

### 2.1 前提条件

| 項目 | 要件 |
|-----|------|
| OS | Linux (Ubuntu 20.04+推奨) / Windows 10+ |
| Node.js | v20.x LTS |
| npm | v10.x 以上 |
| メモリ | 4GB以上 |
| ディスク | 50GB以上の空き容量 |
| Python3 | フロントエンドHTTPサーバー用（オプション） |

### 2.2 インストール手順

#### ステップ1: リポジトリのクローン

```bash
git clone https://github.com/Kensan196948G/ITSM-System.git
cd ITSM-System
```

#### ステップ2: 依存関係のインストール

```bash
npm install
```

#### ステップ3: 環境変数の設定

```bash
# .env.example をコピー
cp .env.example .env

# 環境変数を編集
nano .env
```

#### ステップ4: データベースマイグレーション

```bash
npm run migrate:latest
```

#### ステップ5: サーバー起動

**開発環境:**
```bash
# Linux
./scripts/Linux/startup/start-system.sh

# Windows
scripts\Windows\start-dev.bat
```

**本番環境（systemd）:**
```bash
# サービスセットアップ
./scripts/Linux/setup/setup-services.sh

# サービス起動
sudo systemctl start itsm-system-https itsm-frontend-https
```

### 2.3 環境変数設定ガイド

`.env` ファイルの主要設定項目:

```bash
# ============================================================
# サーバー設定
# ============================================================
PORT=5000                          # バックエンドAPIポート
NODE_ENV=production                # 環境（development/production）
HOST=0.0.0.0                       # リスンアドレス
SYSTEM_IP=192.168.x.x              # サーバーIPアドレス

# ============================================================
# JWT認証設定
# ============================================================
JWT_SECRET=your-secure-random-key  # 64バイト以上のランダム文字列
JWT_EXPIRES_IN=24h                 # トークン有効期限

# ============================================================
# CORS設定
# ============================================================
CORS_ORIGIN=https://192.168.x.x:5050,http://localhost:8080

# ============================================================
# データベース設定
# ============================================================
DATABASE_PATH=./backend/itsm_nexus.db

# ============================================================
# SMTP設定（メール通知）
# ============================================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=ITSM-Sec Nexus <noreply@itsm.local>

# ============================================================
# メール通知設定
# ============================================================
ENABLE_EMAIL_NOTIFICATIONS=true
ADMIN_EMAIL=admin@example.com
SECURITY_TEAM_EMAIL=security@example.com

# ============================================================
# SLA管理設定
# ============================================================
SLA_ALERT_EMAIL=admin@example.com
SLA_ALERT_THRESHOLD=90             # アラートしきい値（%）

# ============================================================
# スケジューラ設定
# ============================================================
SCHEDULER_ENABLED=true
SLA_REPORT_EMAIL=admin@example.com
SLA_WEEKLY_REPORT_CRON=0 9 * * 1   # 毎週月曜9:00
SLA_MONTHLY_REPORT_CRON=0 9 1 * *  # 毎月1日9:00
TZ=Asia/Tokyo                      # タイムゾーン
```

---

## 3. スケジューラ運用

### 3.1 概要

スケジューラサービスは `node-cron` を使用して定期タスクを実行します。主な機能:

- 週次SLAレポート自動送信
- 月次SLAレポート自動送信

### 3.2 SLA定期レポート設定

#### 環境変数設定

```bash
# スケジューラ有効化
SCHEDULER_ENABLED=true

# レポート送信先
SLA_REPORT_EMAIL=admin@example.com

# 週次レポートスケジュール（毎週月曜9:00）
SLA_WEEKLY_REPORT_CRON=0 9 * * 1

# 月次レポートスケジュール（毎月1日9:00）
SLA_MONTHLY_REPORT_CRON=0 9 1 * *

# タイムゾーン
TZ=Asia/Tokyo
```

### 3.3 cron式の説明

```
 ┌────────────── 分 (0-59)
 │ ┌──────────── 時 (0-23)
 │ │ ┌────────── 日 (1-31)
 │ │ │ ┌──────── 月 (1-12)
 │ │ │ │ ┌────── 曜日 (0-7, 0と7=日曜)
 │ │ │ │ │
 * * * * *
```

**設定例:**

| cron式 | 説明 |
|--------|------|
| `0 9 * * 1` | 毎週月曜日 9:00 |
| `0 9 1 * *` | 毎月1日 9:00 |
| `0 18 * * 5` | 毎週金曜日 18:00 |
| `30 8 * * 1-5` | 平日 8:30 |
| `0 */6 * * *` | 6時間ごと |

### 3.4 レポート送信先設定

複数の送信先を設定する場合は、カンマ区切りで指定:

```bash
SLA_REPORT_EMAIL=admin@example.com,manager@example.com
```

### 3.5 手動レポート送信

APIエンドポイントを使用して手動でレポートを送信:

```bash
# 週次レポート送信
curl -X POST http://localhost:5000/api/v1/scheduler/trigger \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reportType": "weekly"}'

# 月次レポート送信
curl -X POST http://localhost:5000/api/v1/scheduler/trigger \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reportType": "monthly"}'
```

### 3.6 スケジューラのトラブルシューティング

| 症状 | 原因 | 対処法 |
|-----|------|--------|
| レポートが送信されない | SCHEDULER_ENABLED=false | `.env`で`SCHEDULER_ENABLED=true`に設定 |
| レポートが送信されない | SLA_REPORT_EMAIL未設定 | メールアドレスを設定 |
| 時間がずれる | タイムゾーン設定 | `TZ=Asia/Tokyo`を設定 |
| cron式エラー | 無効なcron式 | cron式の形式を確認 |

**ログでの確認:**
```bash
# スケジューラの動作確認
journalctl -u itsm-system -f | grep Scheduler
```

---

## 4. SLAアラート運用

### 4.1 アラートしきい値設定

```bash
# アラートしきい値（達成率がこの値を下回るとアラート）
SLA_ALERT_THRESHOLD=90

# アラート送信先
SLA_ALERT_EMAIL=admin@example.com
```

### 4.2 アラートタイプ

| タイプ | 説明 | トリガー条件 |
|-------|------|-------------|
| `violation` | SLA違反 | 達成率が目標値を下回った |
| `at_risk` | リスク状態 | 達成率がしきい値付近 |
| `threshold_breach` | しきい値超過 | 設定しきい値を下回った |
| `recovery` | 回復 | 違反状態から正常に復帰 |

### 4.3 アラート確認・対応フロー

```
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
|  アラート発生       | --> |  アラート確認       | --> |  対応実施         |
|                   |     |                   |     |                   |
+-------------------+     +-------------------+     +-------------------+
         |                         |                         |
         v                         v                         v
  +-------------+           +-------------+           +-------------+
  | メール通知   |           | ダッシュボード|           | 確認登録     |
  | 送信        |           | で確認      |           | (Acknowledge)|
  +-------------+           +-------------+           +-------------+
```

#### アラート一覧取得

```bash
curl -X GET http://localhost:5000/api/v1/sla-alerts \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 未確認アラートのみ取得

```bash
curl -X GET "http://localhost:5000/api/v1/sla-alerts?acknowledged=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### アラート確認（Acknowledge）

```bash
curl -X PUT http://localhost:5000/api/v1/sla-alerts/ALERT-001/acknowledge \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "調査中。担当：山田"}'
```

#### 一括確認

```bash
curl -X POST http://localhost:5000/api/v1/sla-alerts/acknowledge-bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"alert_ids": ["ALERT-001", "ALERT-002", "ALERT-003"]}'
```

### 4.4 エスカレーション手順

1. **レベル1（0-30分）**: 担当者が対応開始
2. **レベル2（30分-2時間）**: チームリーダーに報告
3. **レベル3（2時間以上）**: マネージャーにエスカレーション

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  レベル1         |     |  レベル2          |     |  レベル3         |
|  担当者対応       | --> |  チームリーダー    | --> |  マネージャー     |
|  (0-30分)        |     |  (30分-2時間)     |     |  (2時間以上)     |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

### 4.5 アラート統計確認

```bash
curl -X GET http://localhost:5000/api/v1/sla-alerts/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

レスポンス例:
```json
{
  "total": 42,
  "unacknowledged": 5,
  "acknowledged": 37,
  "by_type": {
    "violation": 10,
    "at_risk": 15,
    "threshold_breach": 12,
    "recovery": 5
  },
  "last_7_days": 8,
  "last_30_days": 25
}
```

---

## 5. メール通知設定

### 5.1 SMTP設定方法

#### 基本設定

```bash
SMTP_HOST=smtp.example.com        # SMTPサーバーホスト
SMTP_PORT=587                     # ポート（587=TLS, 465=SSL）
SMTP_SECURE=false                 # true=SSL, false=TLS
SMTP_USER=your-email@example.com  # 認証ユーザー
SMTP_PASSWORD=your-password       # 認証パスワード
SMTP_FROM=ITSM-Sec Nexus <noreply@itsm.local>
```

### 5.2 Gmail設定例

1. **Googleアカウント設定**
   - https://myaccount.google.com/apppasswords にアクセス
   - 2段階認証を有効化
   - アプリパスワードを生成

2. **.env設定**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # アプリパスワード
```

### 5.3 Office 365設定例

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-password
```

### 5.4 SendGrid設定例

```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

### 5.5 Amazon SES設定例

```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

### 5.6 テストメール送信方法

#### サーバー起動時の確認

サーバー起動時に以下のログが出力されればSMTP接続成功:
```
[EmailService] SMTP server is ready to send emails
```

#### APIでテストメール送信

```bash
curl -X POST http://localhost:5000/api/v1/email/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

### 5.7 メール通知の種類

| 通知タイプ | 説明 | テンプレート |
|-----------|------|-------------|
| パスワードリセット | パスワードリセット要求通知 | `password-reset.hbs` |
| 脆弱性アラート | Critical脆弱性検出通知 | `vulnerability-alert.hbs` |
| SLA違反 | SLA違反発生通知 | `sla-violation.hbs` |
| SLAレポート | 週次/月次SLAレポート | (動的生成) |

---

## 6. バックアップ・リストア

### 6.1 SQLiteデータベースバックアップ

#### 手動バックアップ

```bash
# 日次バックアップ
./scripts/Linux/operations/backup.sh daily

# 週次バックアップ
./scripts/Linux/operations/backup.sh weekly

# 月次バックアップ
./scripts/Linux/operations/backup.sh monthly

# 自動判定（日付に基づく）
./scripts/Linux/operations/backup.sh
```

#### 自動バックアップ（cron設定）

```bash
# crontab編集
crontab -e

# 以下を追加
# 日次バックアップ（毎日 2:00）
0 2 * * * /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/backup.sh daily
# 週次バックアップ（毎週日曜 3:00）
0 3 * * 0 /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/backup.sh weekly
# 月次バックアップ（毎月1日 4:00）
0 4 1 * * /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/backup.sh monthly
```

#### バックアップ保存場所

```
backend/backups/
├── daily/      # 日次バックアップ（7日間保持）
├── weekly/     # 週次バックアップ（4週間保持）
└── monthly/    # 月次バックアップ（12ヶ月保持）
```

#### バックアップファイル形式

各バックアップで以下のファイルが生成:

| ファイル | 説明 |
|---------|------|
| `itsm_nexus_TYPE_TIMESTAMP.db` | バイナリバックアップ |
| `itsm_nexus_TYPE_TIMESTAMP.sql.gz` | SQLダンプ（圧縮） |
| `itsm_nexus_TYPE_TIMESTAMP.sha256` | チェックサム |

### 6.2 リストア手順

#### 手順

```bash
# 1. 利用可能なバックアップを確認
ls -la backend/backups/daily/

# 2. リストア実行
./scripts/Linux/operations/restore.sh backend/backups/daily/itsm_nexus_daily_20260107_020000.db
```

#### リストアプロセス

1. チェックサム検証
2. 現在のデータベースを安全バックアップ
3. サービス自動停止
4. データベース復元
5. 整合性チェック
6. サービス再起動
7. ヘルスチェック

#### リストア失敗時の自動ロールバック

リストアが失敗した場合、自動的に安全バックアップから復元:

```
[ERROR] Database verification failed! Rolling back...
Rollback completed
```

### 6.3 リモートバックアップ（オプション）

#### SSH/rsync設定

```bash
# 環境変数設定
export BACKUP_REMOTE_HOST=backup-server.example.com
export BACKUP_REMOTE_USER=backup
export BACKUP_REMOTE_PATH=/backup/itsm
```

#### AWS S3設定

```bash
# 環境変数設定
export BACKUP_S3_BUCKET=my-backup-bucket

# AWS CLIインストール
sudo apt install awscli
aws configure
```

---

## 7. 監視・ログ

### 7.1 ログファイル場所

| ログ種類 | 場所 | 説明 |
|---------|------|------|
| アプリケーションログ | journalctl -u itsm-system | systemdサービスログ |
| アクセスログ | journalctl -u itsm-system | HTTPリクエストログ（Morgan） |
| エラーログ | journalctl -u itsm-system -p err | エラーのみ |
| フロントエンドログ | journalctl -u itsm-frontend-https | フロントエンドサーバーログ |

### 7.2 ログ確認コマンド

```bash
# リアルタイムログ表示
sudo journalctl -u itsm-system -f

# 最新100行
sudo journalctl -u itsm-system -n 100

# 今日のログのみ
sudo journalctl -u itsm-system --since today

# 特定期間のログ
sudo journalctl -u itsm-system --since "2026-01-07 00:00" --until "2026-01-07 12:00"

# エラーログのみ
sudo journalctl -u itsm-system -p err

# キーワード検索
sudo journalctl -u itsm-system | grep "error"
```

### 7.3 監視項目

#### ヘルスチェックエンドポイント

| エンドポイント | 用途 | レスポンス |
|---------------|------|-----------|
| `/api/v1/health` | 基本ヘルスチェック | `{"status":"ok"}` |
| `/api/v1/health/live` | Liveness Probe | `{"status":"live"}` |
| `/api/v1/health/ready` | Readiness Probe | `{"status":"ready"}` |
| `/metrics` | Prometheusメトリクス | メトリクスデータ |

#### 監視スクリプト例

```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:5000/api/v1/health"
ALERT_EMAIL="admin@example.com"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$response" != "200" ]; then
    echo "Health check failed! Status: $response" | mail -s "ITSM Alert" $ALERT_EMAIL
fi
```

### 7.4 Prometheusメトリクス

収集されるメトリクス:

| メトリクス | 説明 |
|-----------|------|
| `http_requests_total` | HTTPリクエスト総数 |
| `http_request_duration_seconds` | レスポンスタイム |
| `active_users` | アクティブユーザー数 |
| `db_queries_total` | データベースクエリ数 |
| `auth_errors_total` | 認証エラー数 |
| `nodejs_heap_size_total_bytes` | Node.jsヒープサイズ |
| `process_cpu_seconds_total` | CPU使用時間 |

### 7.5 アラート対応

#### 重要度レベル

| レベル | 説明 | 対応時間 |
|-------|------|---------|
| Critical | サービス停止 | 即時対応 |
| High | 主要機能障害 | 1時間以内 |
| Medium | 一部機能障害 | 4時間以内 |
| Low | 軽微な問題 | 1営業日以内 |

#### 対応フロー

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  アラート検知     | --> |  影響範囲確認     | --> |  対応実施         |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
         |                         |                         |
         v                         v                         v
  +-------------+           +-------------+           +-------------+
  | 通知受信    |           | ログ確認     |           | 復旧作業    |
  +-------------+           +-------------+           +-------------+
                                   |                         |
                                   v                         v
                            +-------------+           +-------------+
                            | 原因特定    |           | 動作確認    |
                            +-------------+           +-------------+
                                                             |
                                                             v
                                                      +-------------+
                                                      | 報告書作成  |
                                                      +-------------+
```

---

## 8. トラブルシューティング

### 8.1 サービスが起動しない

**症状:**
```
● itsm-system.service
     Active: failed (Result: exit-code)
```

**対処法:**

1. ポート競合確認
```bash
sudo lsof -ti:5000
sudo kill -9 $(sudo lsof -ti:5000)
```

2. 環境変数確認
```bash
ls -la /mnt/LinuxHDD/ITSM-System/.env
```

3. Node.jsパス確認
```bash
which node
```

4. 依存関係確認
```bash
cd /mnt/LinuxHDD/ITSM-System
npm install
```

5. ログ確認
```bash
sudo journalctl -u itsm-system -n 50
```

### 8.2 データベースエラー

**症状:** `SQLITE_CORRUPT` または `SQLITE_BUSY`

**対処法:**

1. 整合性チェック
```bash
sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"
```

2. WALチェックポイント
```bash
sqlite3 backend/itsm_nexus.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

3. バックアップからリストア
```bash
./scripts/Linux/operations/restore.sh backend/backups/daily/latest.db
```

### 8.3 メールが送信されない

**対処法:**

1. SMTP設定確認
```bash
grep SMTP .env
```

2. SMTP接続テスト
```bash
# サーバー起動時のログ確認
journalctl -u itsm-system | grep EmailService
```

3. ファイアウォール確認
```bash
sudo ufw status
sudo ufw allow 587/tcp  # TLS
sudo ufw allow 465/tcp  # SSL
```

4. テストメール送信
```bash
curl -X POST http://localhost:5000/api/v1/email/test \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

### 8.4 スケジューラが動作しない

**対処法:**

1. 環境変数確認
```bash
grep SCHEDULER .env
# SCHEDULER_ENABLED=true であることを確認
```

2. cron式検証
```bash
# オンラインツールでcron式を検証
# https://crontab.guru/
```

3. ログ確認
```bash
journalctl -u itsm-system | grep Scheduler
```

### 8.5 認証エラー

**症状:** `401 Unauthorized` または `403 Forbidden`

**対処法:**

1. トークン有効期限確認
```bash
# JWTトークンをデコードして有効期限確認
# https://jwt.io/
```

2. JWT_SECRET確認
```bash
grep JWT_SECRET .env
```

3. ユーザー権限確認
```bash
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8.6 パフォーマンス問題

**対処法:**

1. リソース使用状況確認
```bash
top -p $(pgrep -f "node backend/server.js")
```

2. メモリ使用量
```bash
curl http://localhost:5000/metrics | grep nodejs_heap
```

3. データベース最適化
```bash
sqlite3 backend/itsm_nexus.db "VACUUM;"
sqlite3 backend/itsm_nexus.db "ANALYZE;"
```

4. ログローテーション
```bash
sudo journalctl --vacuum-time=7d
```

---

## 付録

### A. 重要なファイルパス

| ファイル/ディレクトリ | 説明 |
|---------------------|------|
| `/mnt/LinuxHDD/ITSM-System/.env` | 環境変数設定 |
| `/mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db` | SQLiteデータベース |
| `/mnt/LinuxHDD/ITSM-System/backend/backups/` | バックアップディレクトリ |
| `/mnt/LinuxHDD/ITSM-System/ssl/` | SSL証明書 |
| `/etc/systemd/system/itsm-system*.service` | systemdサービス定義 |

### B. デフォルトユーザー

| ユーザー名 | パスワード | ロール | 権限 |
|-----------|----------|--------|------|
| admin | admin123 | admin | 全権限 |
| analyst | analyst123 | analyst | 閲覧・作成権限 |

**注意:** 本番環境では必ずパスワードを変更してください。

### C. APIエンドポイント一覧

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/v1/auth/login` | ログイン |
| GET | `/api/v1/auth/me` | 現在のユーザー情報 |
| GET | `/api/v1/dashboard/kpi` | KPI統計 |
| GET | `/api/v1/incidents` | インシデント一覧 |
| GET | `/api/v1/sla-alerts` | SLAアラート一覧 |
| GET | `/api/v1/sla-alerts/stats` | アラート統計 |
| PUT | `/api/v1/sla-alerts/:id/acknowledge` | アラート確認 |
| GET | `/api/v1/health` | ヘルスチェック |
| GET | `/metrics` | Prometheusメトリクス |

### D. 連絡先

- **システム管理者**: admin@example.com
- **セキュリティチーム**: security@example.com

---

**ドキュメント終了**
