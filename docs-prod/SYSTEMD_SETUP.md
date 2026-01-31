# ITSM-Sec Nexus - Systemd 自動起動設定ガイド

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [クイックスタート](#クイックスタート)
4. [詳細設定](#詳細設定)
5. [サービス管理](#サービス管理)
6. [ログ管理](#ログ管理)
7. [トラブルシューティング](#トラブルシューティング)
8. [セキュリティ設定](#セキュリティ設定)

---

## 概要

ITSM-Sec Nexusは、systemdによる自動起動とプロセス管理をサポートしています。
このドキュメントでは、開発環境と本番環境それぞれのsystemdサービス設定方法を説明します。

### サービスファイル

- **開発環境**: `itsm-nexus-dev.service`
- **本番環境**: `itsm-nexus-prod.service`

### 主な機能

- システム起動時の自動起動
- プロセス障害時の自動再起動
- journald によるログ管理
- リソース制限とセキュリティ強化
- graceful shutdown 対応

---

## 前提条件

### システム要件

- Linux OS (Ubuntu 20.04+, CentOS 8+, Debian 11+ など)
- systemd (バージョン 237 以降推奨)
- Node.js (v18 以降)
- sudo 権限

### 確認コマンド

```bash
# systemdバージョン確認
systemctl --version

# Node.jsバージョン確認
node --version

# npmパッケージのインストール確認
cd /mnt/LinuxHDD/ITSM-System
npm list --depth=0
```

---

## クイックスタート

### 1. インストールスクリプトの実行

```bash
cd /mnt/LinuxHDD/ITSM-System
sudo ./scripts/install-systemd.sh
```

インストーラーが起動し、環境選択画面が表示されます。

```
======================================
 ITSM-Sec Nexus Systemd Installer
======================================

📋 インストールする環境を選択してください:

  1) 開発環境 (Development)
  2) 本番環境 (Production)
  3) 両方インストール

選択 (1/2/3):
```

### 2. 環境変数の設定

#### 開発環境

```bash
# 開発環境は config/env/.env.development が使用されます
# 既に設定済みの場合は編集不要
cat config/env/.env.development
```

#### 本番環境

```bash
# 本番環境の設定ファイルを作成
cp config/env/.env.production.example config/env/.env.production

# 必須項目を編集
nano config/env/.env.production
```

**必須設定項目:**

```bash
# JWT認証シークレット（必ず変更すること）
JWT_SECRET=$(openssl rand -base64 64)

# セッションシークレット（必ず変更すること）
SESSION_SECRET=$(openssl rand -base64 64)

# CORSオリジン
CORS_ORIGIN=https://your-domain.com

# その他の設定...
```

### 3. サービスの起動

#### 開発環境

```bash
# サービスを起動
sudo systemctl start itsm-nexus-dev

# 状態確認
sudo systemctl status itsm-nexus-dev

# 自動起動を有効化
sudo systemctl enable itsm-nexus-dev
```

#### 本番環境

```bash
# サービスを起動
sudo systemctl start itsm-nexus-prod

# 状態確認
sudo systemctl status itsm-nexus-prod

# 自動起動を有効化
sudo systemctl enable itsm-nexus-prod
```

---

## 詳細設定

### 開発環境サービスファイル

ファイルパス: `/etc/systemd/system/itsm-nexus-dev.service`

```ini
[Unit]
Description=ITSM-Sec Nexus - Development Environment
Documentation=https://github.com/Kensan196948G/ITSM-System
After=network.target

[Service]
Type=simple
User=kensan
Group=kensan
WorkingDirectory=/mnt/LinuxHDD/ITSM-System
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/config/env/.env.development

ExecStart=/usr/bin/node backend/server.js

# 開発環境では失敗時のみ再起動
Restart=on-failure
RestartSec=5
StartLimitInterval=300
StartLimitBurst=5

# プロセス管理
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

# リソース制限（開発環境では緩め）
LimitNOFILE=4096
LimitNPROC=2048

# セキュリティ設定
NoNewPrivileges=true
PrivateTmp=true

# ログ設定
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-nexus-dev

[Install]
WantedBy=multi-user.target
```

### 本番環境サービスファイル

ファイルパス: `/etc/systemd/system/itsm-nexus-prod.service`

```ini
[Unit]
Description=ITSM-Sec Nexus - Production Environment
Documentation=https://github.com/Kensan196948G/ITSM-System
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=kensan
Group=kensan
WorkingDirectory=/mnt/LinuxHDD/ITSM-System
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/config/env/.env.production

ExecStart=/usr/bin/node backend/server.js
ExecStartPre=/bin/sleep 2

# 本番環境では常に再起動
Restart=always
RestartSec=10
StartLimitInterval=600
StartLimitBurst=3

# プロセス管理
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=45

# リソース制限（本番環境）
LimitNOFILE=65536
LimitNPROC=4096

# セキュリティ強化
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/backend
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/logs

# ログ設定
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-nexus-prod

# OOM対策
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target
```

### 設定項目の説明

#### [Unit] セクション

| 項目 | 説明 |
|------|------|
| `Description` | サービスの説明 |
| `Documentation` | ドキュメントのURL |
| `After` | このサービスの起動前に起動すべきサービス |
| `Wants` | 推奨される依存サービス（失敗しても起動可能） |

#### [Service] セクション

| 項目 | 説明 |
|------|------|
| `Type=simple` | プロセスがフォアグラウンドで実行 |
| `User/Group` | 実行ユーザー・グループ |
| `WorkingDirectory` | 作業ディレクトリ |
| `EnvironmentFile` | 環境変数ファイル |
| `ExecStart` | 起動コマンド |
| `Restart` | 再起動ポリシー |
| `RestartSec` | 再起動までの待機時間（秒） |
| `KillMode=mixed` | メインプロセスにSIGTERM、子プロセスにSIGKILL |
| `TimeoutStopSec` | 停止タイムアウト（秒） |

#### リソース制限

| 項目 | 開発環境 | 本番環境 |
|------|----------|----------|
| `LimitNOFILE` | 4096 | 65536 |
| `LimitNPROC` | 2048 | 4096 |

#### セキュリティ設定

| 項目 | 説明 |
|------|------|
| `NoNewPrivileges` | 新しい権限の取得を禁止 |
| `PrivateTmp` | プライベートな/tmpディレクトリを使用 |
| `ProtectSystem` | システムディレクトリを読み取り専用に |
| `ProtectHome` | ホームディレクトリを保護 |
| `ReadWritePaths` | 書き込み可能なパスを明示的に指定 |

---

## サービス管理

### 基本コマンド

#### 起動・停止・再起動

```bash
# 開発環境
sudo systemctl start itsm-nexus-dev
sudo systemctl stop itsm-nexus-dev
sudo systemctl restart itsm-nexus-dev

# 本番環境
sudo systemctl start itsm-nexus-prod
sudo systemctl stop itsm-nexus-prod
sudo systemctl restart itsm-nexus-prod
```

#### 状態確認

```bash
# 詳細な状態表示
sudo systemctl status itsm-nexus-dev
sudo systemctl status itsm-nexus-prod

# プロセスIDの確認
sudo systemctl show itsm-nexus-prod --property=MainPID

# 起動時刻の確認
sudo systemctl show itsm-nexus-prod --property=ActiveEnterTimestamp
```

#### 自動起動設定

```bash
# 自動起動を有効化
sudo systemctl enable itsm-nexus-dev
sudo systemctl enable itsm-nexus-prod

# 自動起動を無効化
sudo systemctl disable itsm-nexus-dev
sudo systemctl disable itsm-nexus-prod

# 自動起動設定の確認
sudo systemctl is-enabled itsm-nexus-prod
```

### 設定の再読み込み

サービスファイルを編集した後は、以下のコマンドで再読み込みが必要です。

```bash
# systemdデーモンの再読み込み
sudo systemctl daemon-reload

# サービスの再起動
sudo systemctl restart itsm-nexus-prod
```

---

## ログ管理

### journalctl によるログ表示

#### リアルタイムログ表示

```bash
# 開発環境のログをリアルタイム表示
sudo journalctl -u itsm-nexus-dev -f

# 本番環境のログをリアルタイム表示
sudo journalctl -u itsm-nexus-prod -f
```

#### 過去ログの表示

```bash
# 最新100行を表示
sudo journalctl -u itsm-nexus-prod -n 100

# 最新1000行を表示
sudo journalctl -u itsm-nexus-prod -n 1000

# すべてのログを表示
sudo journalctl -u itsm-nexus-prod --no-pager
```

#### 時間範囲指定

```bash
# 今日のログ
sudo journalctl -u itsm-nexus-prod --since today

# 昨日のログ
sudo journalctl -u itsm-nexus-prod --since yesterday --until today

# 特定時間範囲
sudo journalctl -u itsm-nexus-prod --since "2026-01-31 00:00:00" --until "2026-01-31 23:59:59"

# 直近1時間
sudo journalctl -u itsm-nexus-prod --since "1 hour ago"
```

#### エラーログのみ表示

```bash
# 優先度がエラー以上のログのみ
sudo journalctl -u itsm-nexus-prod -p err

# 優先度レベル:
# 0: emerg
# 1: alert
# 2: crit
# 3: err
# 4: warning
# 5: notice
# 6: info
# 7: debug
```

#### ログのエクスポート

```bash
# JSONフォーマットでエクスポート
sudo journalctl -u itsm-nexus-prod -o json > itsm-nexus-prod.json

# ファイルに保存
sudo journalctl -u itsm-nexus-prod --since today > itsm-nexus-prod-$(date +%Y%m%d).log
```

### ログローテーション設定

journaldのログは自動的にローテーションされますが、設定を変更することも可能です。

```bash
# journald設定ファイル
sudo nano /etc/systemd/journald.conf
```

推奨設定:

```ini
[Journal]
# ログの最大サイズ
SystemMaxUse=500M
SystemKeepFree=1G

# ログの保持期間
MaxRetentionSec=1month

# ログの圧縮
Compress=yes
```

設定変更後:

```bash
# journaldサービスの再起動
sudo systemctl restart systemd-journald
```

---

## トラブルシューティング

### サービスが起動しない

#### 1. 状態確認

```bash
sudo systemctl status itsm-nexus-prod
```

出力例:

```
● itsm-nexus-prod.service - ITSM-Sec Nexus - Production Environment
     Loaded: loaded (/etc/systemd/system/itsm-nexus-prod.service; enabled; vendor preset: enabled)
     Active: failed (Result: exit-code) since Fri 2026-01-31 10:00:00 JST; 5s ago
```

#### 2. ログ確認

```bash
# 最新のエラーログを確認
sudo journalctl -u itsm-nexus-prod -n 50 -p err

# 詳細ログを確認
sudo journalctl -u itsm-nexus-prod -n 100
```

#### 3. 環境変数ファイルの確認

```bash
# ファイルの存在確認
ls -l /mnt/LinuxHDD/ITSM-System/config/env/.env.production

# ファイルの内容確認（機密情報に注意）
sudo cat /mnt/LinuxHDD/ITSM-System/config/env/.env.production
```

#### 4. 権限の確認

```bash
# サービスファイルの権限
ls -l /etc/systemd/system/itsm-nexus-prod.service

# 作業ディレクトリの権限
ls -ld /mnt/LinuxHDD/ITSM-System

# ログディレクトリの権限
ls -ld /mnt/LinuxHDD/ITSM-System/logs
```

#### 5. 手動起動テスト

```bash
# 直接Node.jsで起動してエラーを確認
cd /mnt/LinuxHDD/ITSM-System
source config/env/.env.production
node backend/server.js
```

### ポートが既に使用されている

```bash
# ポート6443を使用しているプロセスを確認
sudo lsof -i :6443

# プロセスを停止
sudo kill -9 <PID>

# サービスを再起動
sudo systemctl restart itsm-nexus-prod
```

### サービスが頻繁に再起動される

```bash
# 再起動履歴を確認
sudo journalctl -u itsm-nexus-prod | grep -i restart

# 再起動制限の確認
sudo systemctl show itsm-nexus-prod --property=StartLimitBurst
sudo systemctl show itsm-nexus-prod --property=StartLimitInterval

# 再起動カウンターのリセット
sudo systemctl reset-failed itsm-nexus-prod
```

### メモリ不足エラー

```bash
# メモリ使用状況の確認
free -h

# サービスのメモリ使用量確認
sudo systemctl status itsm-nexus-prod

# OOM Killerのログ確認
sudo journalctl -k | grep -i oom
```

---

## セキュリティ設定

### ファイアウォール設定

#### 開発環境 (HTTPS: 5443)

```bash
# UFWの場合
sudo ufw allow 5443/tcp

# firewalldの場合
sudo firewall-cmd --permanent --add-port=5443/tcp
sudo firewall-cmd --reload
```

#### 本番環境 (HTTPS: 6443, HTTP: 8080)

```bash
# UFWの場合
sudo ufw allow 6443/tcp
sudo ufw allow 8080/tcp

# firewalldの場合
sudo firewall-cmd --permanent --add-port=6443/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

### SELinux設定（CentOS/RHEL）

```bash
# SELinuxの状態確認
getenforce

# ポリシーの確認
sudo ausearch -m avc -ts recent

# ポート許可
sudo semanage port -a -t http_port_t -p tcp 6443
sudo semanage port -a -t http_port_t -p tcp 8080
```

### サービスユーザーの権限制限

本番環境では、専用ユーザーでサービスを実行することを推奨します。

```bash
# 専用ユーザーの作成
sudo useradd -r -s /bin/false itsm-nexus

# ディレクトリの所有権変更
sudo chown -R itsm-nexus:itsm-nexus /mnt/LinuxHDD/ITSM-System/backend
sudo chown -R itsm-nexus:itsm-nexus /mnt/LinuxHDD/ITSM-System/logs

# サービスファイルのUser設定を変更
sudo nano /etc/systemd/system/itsm-nexus-prod.service
```

```ini
[Service]
User=itsm-nexus
Group=itsm-nexus
```

```bash
# 設定の再読み込みと再起動
sudo systemctl daemon-reload
sudo systemctl restart itsm-nexus-prod
```

---

## 高度な設定

### ログ分離

アプリケーションログとsystemdログを分離する場合:

```bash
# ログディレクトリの作成
sudo mkdir -p /var/log/itsm-nexus
sudo chown kensan:kensan /var/log/itsm-nexus

# サービスファイルの編集
sudo nano /etc/systemd/system/itsm-nexus-prod.service
```

```ini
[Service]
StandardOutput=append:/var/log/itsm-nexus/access.log
StandardError=append:/var/log/itsm-nexus/error.log
```

### 監視とアラート

#### systemdによる監視

```bash
# サービス監視スクリプト
cat > /usr/local/bin/itsm-nexus-monitor.sh << 'EOF'
#!/bin/bash
if ! systemctl is-active --quiet itsm-nexus-prod; then
    echo "CRITICAL: itsm-nexus-prod is not running"
    # メール送信やSlack通知などを追加
fi
EOF

chmod +x /usr/local/bin/itsm-nexus-monitor.sh

# cronで定期実行
echo "*/5 * * * * /usr/local/bin/itsm-nexus-monitor.sh" | sudo crontab -
```

### バックアップ連携

```bash
# サービス停止前にバックアップ
sudo nano /etc/systemd/system/itsm-nexus-prod.service
```

```ini
[Service]
ExecStopPost=/mnt/LinuxHDD/ITSM-System/scripts/backup.sh
```

---

## アンインストール

サービスを完全に削除する場合:

```bash
# サービスを停止
sudo systemctl stop itsm-nexus-dev
sudo systemctl stop itsm-nexus-prod

# 自動起動を無効化
sudo systemctl disable itsm-nexus-dev
sudo systemctl disable itsm-nexus-prod

# サービスファイルを削除
sudo rm /etc/systemd/system/itsm-nexus-dev.service
sudo rm /etc/systemd/system/itsm-nexus-prod.service

# systemdデーモンを再読み込み
sudo systemctl daemon-reload
sudo systemctl reset-failed
```

---

## まとめ

### 推奨構成

- **開発環境**: `itsm-nexus-dev.service` + `.env.development`
- **本番環境**: `itsm-nexus-prod.service` + `.env.production` + 自動起動有効

### チェックリスト

- [ ] Node.js と npm のインストール確認
- [ ] 環境変数ファイルの作成と設定
- [ ] サービスファイルのインストール
- [ ] サービスの起動確認
- [ ] ログの確認
- [ ] ファイアウォールの設定
- [ ] 自動起動の有効化
- [ ] 監視設定の追加（本番環境）

### サポート

問題が発生した場合は、以下の情報を添えてGitHub Issueを作成してください。

- OS とバージョン
- systemd バージョン
- `sudo systemctl status itsm-nexus-prod` の出力
- `sudo journalctl -u itsm-nexus-prod -n 100` の出力

---

**ドキュメント作成日**: 2026-01-31
**バージョン**: 1.0.0
**対象システム**: ITSM-Sec Nexus
