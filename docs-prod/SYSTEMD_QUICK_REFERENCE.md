# ITSM-Sec Nexus - Systemd クイックリファレンス

## 目次

- [インストール](#インストール)
- [基本コマンド](#基本コマンド)
- [ログ管理](#ログ管理)
- [トラブルシューティング](#トラブルシューティング)
- [管理ツール](#管理ツール)

---

## インストール

### ワンライナーインストール

```bash
cd /mnt/LinuxHDD/ITSM-System && sudo ./scripts/install-systemd.sh
```

---

## 基本コマンド

### 管理ツールを使用（推奨）

```bash
# 開発環境を起動
sudo ./scripts/systemd-manager.sh dev start

# 本番環境を起動
sudo ./scripts/systemd-manager.sh prod start

# 状態確認
sudo ./scripts/systemd-manager.sh prod status

# ログ表示
sudo ./scripts/systemd-manager.sh prod logs
```

### systemctl コマンド直接使用

#### 開発環境

```bash
# 起動
sudo systemctl start itsm-nexus-dev

# 停止
sudo systemctl stop itsm-nexus-dev

# 再起動
sudo systemctl restart itsm-nexus-dev

# 状態確認
sudo systemctl status itsm-nexus-dev

# 自動起動有効化
sudo systemctl enable itsm-nexus-dev

# 自動起動無効化
sudo systemctl disable itsm-nexus-dev
```

#### 本番環境

```bash
# 起動
sudo systemctl start itsm-nexus-prod

# 停止
sudo systemctl stop itsm-nexus-prod

# 再起動
sudo systemctl restart itsm-nexus-prod

# 状態確認
sudo systemctl status itsm-nexus-prod

# 自動起動有効化
sudo systemctl enable itsm-nexus-prod

# 自動起動無効化
sudo systemctl disable itsm-nexus-prod
```

---

## ログ管理

### 管理ツール使用

```bash
# リアルタイムログ表示
sudo ./scripts/systemd-manager.sh prod logs

# 最新100行
sudo ./scripts/systemd-manager.sh prod logs-100

# 最新1000行
sudo ./scripts/systemd-manager.sh prod logs-1000

# エラーログのみ
sudo ./scripts/systemd-manager.sh prod logs-err
```

### journalctl コマンド直接使用

```bash
# リアルタイム表示
sudo journalctl -u itsm-nexus-prod -f

# 最新100行
sudo journalctl -u itsm-nexus-prod -n 100

# 今日のログ
sudo journalctl -u itsm-nexus-prod --since today

# エラーのみ
sudo journalctl -u itsm-nexus-prod -p err

# ログをファイルに保存
sudo journalctl -u itsm-nexus-prod --since today > itsm-nexus-$(date +%Y%m%d).log
```

---

## トラブルシューティング

### サービスが起動しない

```bash
# 1. 状態確認
sudo systemctl status itsm-nexus-prod

# 2. エラーログ確認
sudo journalctl -u itsm-nexus-prod -n 50 -p err

# 3. 環境変数ファイル確認
ls -l /mnt/LinuxHDD/ITSM-System/config/env/.env.production

# 4. 手動起動テスト
cd /mnt/LinuxHDD/ITSM-System
source config/env/.env.production
node backend/server.js
```

### ポート衝突

```bash
# 使用中のポートを確認
sudo lsof -i :6443

# プロセスを停止
sudo kill -9 <PID>

# サービスを再起動
sudo systemctl restart itsm-nexus-prod
```

### 設定変更後

```bash
# systemdデーモン再読み込み
sudo systemctl daemon-reload

# サービス再起動
sudo systemctl restart itsm-nexus-prod
```

### 再起動ループ

```bash
# 再起動カウンターリセット
sudo systemctl reset-failed itsm-nexus-prod

# 詳細ログ確認
sudo journalctl -u itsm-nexus-prod | grep -i restart
```

---

## 管理ツール

### systemd-manager.sh

場所: `/mnt/LinuxHDD/ITSM-System/scripts/systemd-manager.sh`

#### 使用方法

```bash
sudo ./scripts/systemd-manager.sh [環境] [コマンド]
```

#### 環境

- `dev` - 開発環境
- `prod` - 本番環境

#### コマンド

| コマンド | 説明 |
|---------|------|
| `start` | サービスを起動 |
| `stop` | サービスを停止 |
| `restart` | サービスを再起動 |
| `status` | サービスの状態を表示 |
| `enable` | 自動起動を有効化 |
| `disable` | 自動起動を無効化 |
| `logs` | ログをリアルタイム表示 |
| `logs-100` | 最新100行のログを表示 |
| `logs-1000` | 最新1000行のログを表示 |
| `logs-err` | エラーログのみ表示 |

#### 例

```bash
# 開発環境を起動
sudo ./scripts/systemd-manager.sh dev start

# 本番環境の状態確認
sudo ./scripts/systemd-manager.sh prod status

# 本番環境のログをリアルタイム表示
sudo ./scripts/systemd-manager.sh prod logs

# 開発環境の自動起動を有効化
sudo ./scripts/systemd-manager.sh dev enable
```

---

## ファイル構成

### サービスファイル

```
/etc/systemd/system/
├── itsm-nexus-dev.service   # 開発環境
└── itsm-nexus-prod.service  # 本番環境
```

### 環境変数ファイル

```
/mnt/LinuxHDD/ITSM-System/config/env/
├── .env.development         # 開発環境設定
├── .env.production          # 本番環境設定（要作成）
└── .env.production.example  # 本番環境テンプレート
```

### スクリプト

```
/mnt/LinuxHDD/ITSM-System/scripts/
├── install-systemd.sh       # インストールスクリプト
└── systemd-manager.sh       # 管理ツール
```

---

## よく使うコマンド集

### 開発環境

```bash
# 起動
sudo ./scripts/systemd-manager.sh dev start

# 停止
sudo ./scripts/systemd-manager.sh dev stop

# ログ表示
sudo ./scripts/systemd-manager.sh dev logs
```

### 本番環境

```bash
# 起動 + 自動起動有効化
sudo systemctl start itsm-nexus-prod
sudo systemctl enable itsm-nexus-prod

# 状態確認
sudo ./scripts/systemd-manager.sh prod status

# ログ監視
sudo ./scripts/systemd-manager.sh prod logs

# エラー確認
sudo ./scripts/systemd-manager.sh prod logs-err
```

### デバッグ

```bash
# サービスのプロパティ確認
sudo systemctl show itsm-nexus-prod

# 環境変数の確認
sudo systemctl show itsm-nexus-prod --property=Environment

# 再起動回数の確認
sudo systemctl show itsm-nexus-prod --property=NRestarts

# メモリ使用量の確認
sudo systemctl show itsm-nexus-prod --property=MemoryCurrent
```

---

## チートシート

### 起動・停止

| 操作 | 開発環境 | 本番環境 |
|------|----------|----------|
| 起動 | `sudo systemctl start itsm-nexus-dev` | `sudo systemctl start itsm-nexus-prod` |
| 停止 | `sudo systemctl stop itsm-nexus-dev` | `sudo systemctl stop itsm-nexus-prod` |
| 再起動 | `sudo systemctl restart itsm-nexus-dev` | `sudo systemctl restart itsm-nexus-prod` |

### 自動起動

| 操作 | 開発環境 | 本番環境 |
|------|----------|----------|
| 有効化 | `sudo systemctl enable itsm-nexus-dev` | `sudo systemctl enable itsm-nexus-prod` |
| 無効化 | `sudo systemctl disable itsm-nexus-dev` | `sudo systemctl disable itsm-nexus-prod` |
| 確認 | `sudo systemctl is-enabled itsm-nexus-dev` | `sudo systemctl is-enabled itsm-nexus-prod` |

### ログ表示

| 操作 | コマンド |
|------|----------|
| リアルタイム | `sudo journalctl -u itsm-nexus-prod -f` |
| 最新N行 | `sudo journalctl -u itsm-nexus-prod -n 100` |
| 今日のログ | `sudo journalctl -u itsm-nexus-prod --since today` |
| エラーのみ | `sudo journalctl -u itsm-nexus-prod -p err` |
| 時間範囲 | `sudo journalctl -u itsm-nexus-prod --since "1 hour ago"` |

---

## アクセスURL

### 開発環境 (HTTPS: 5443)

```
https://localhost:5443
https://192.168.0.187:5443
```

### 本番環境 (HTTPS: 6443, HTTP: 8080)

```
https://localhost:6443    # HTTPS（推奨）
http://localhost:8080     # HTTP（開発・デバッグ用）
```

---

## サポート

詳細なドキュメント:
- `/mnt/LinuxHDD/ITSM-System/docs-prod/SYSTEMD_SETUP.md`

問題が発生した場合:
- GitHub Issue: https://github.com/Kensan196948G/ITSM-System/issues

---

**最終更新**: 2026-01-31
