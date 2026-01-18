# ITSM-System systemdサービス自動起動設定ガイド

## 📋 概要

このガイドでは、ITSM-Systemをsystemdサービスとして登録し、サーバー再起動時に自動的に起動するように設定する方法を説明します。

---

## 🚀 クイックセットアップ

### 自動セットアップスクリプトを使用（推奨）

```bash
# セットアップスクリプトを実行
/tmp/itsm-setup-service.sh
```

このスクリプトは以下を自動実行します：
1. ✅ サービスファイルを systemd にコピー
2. ✅ systemd デーモンをリロード
3. ✅ サービスを有効化（自動起動設定）
4. ✅ サービスを起動
5. ✅ 起動状態を確認

---

## 🛠️ 手動セットアップ手順

### ステップ1: サービスファイルをコピー

```bash
sudo cp /mnt/LinuxHDD/ITSM-System/itsm-system.service /etc/systemd/system/
```

### ステップ2: systemdデーモンをリロード

```bash
sudo systemctl daemon-reload
```

### ステップ3: サービスを有効化（自動起動設定）

```bash
sudo systemctl enable itsm-system.service
```

### ステップ4: サービスを起動

```bash
sudo systemctl start itsm-system.service
```

### ステップ5: ステータス確認

```bash
sudo systemctl status itsm-system.service
```

**期待される出力**:
```
● itsm-system.service - ITSM-System - IT Service Management & NIST CSF 2.0 Compliance System
     Loaded: loaded (/etc/systemd/system/itsm-system.service; enabled; vendor preset: enabled)
     Active: active (running) since Wed 2026-01-01 12:00:00 JST; 10s ago
```

---

## 📊 サービス管理コマンド

### 基本操作

| コマンド | 説明 |
|---------|------|
| `sudo systemctl start itsm-system` | サービスを起動 |
| `sudo systemctl stop itsm-system` | サービスを停止 |
| `sudo systemctl restart itsm-system` | サービスを再起動 |
| `sudo systemctl reload itsm-system` | 設定を再読み込み（可能な場合） |
| `sudo systemctl status itsm-system` | サービスの状態を確認 |

### 自動起動設定

| コマンド | 説明 |
|---------|------|
| `sudo systemctl enable itsm-system` | 自動起動を有効化 |
| `sudo systemctl disable itsm-system` | 自動起動を無効化 |
| `sudo systemctl is-enabled itsm-system` | 自動起動設定を確認 |

### ログ確認

```bash
# リアルタイムログ表示（tail -f 相当）
sudo journalctl -u itsm-system -f

# 最新100行のログ表示
sudo journalctl -u itsm-system -n 100

# 今日のログのみ表示
sudo journalctl -u itsm-system --since today

# エラーログのみ表示
sudo journalctl -u itsm-system -p err
```

---

## 🔧 サービスファイル詳細

### ファイル場所

- **プロジェクト内**: `/mnt/LinuxHDD/ITSM-System/itsm-system.service`
- **systemd登録先**: `/etc/systemd/system/itsm-system.service`

### サービス設定内容

```ini
[Unit]
Description=ITSM-System - IT Service Management & NIST CSF 2.0 Compliance System
Documentation=https://github.com/Kensan196948G/ITSM-System
After=network.target

[Service]
Type=simple
User=kensan
WorkingDirectory=/mnt/LinuxHDD/ITSM-System
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env

# ExecStart - プロダクション環境でのNode.js直接起動
ExecStart=/usr/bin/node backend/server.js

# 自動再起動設定
Restart=always
RestartSec=10

# プロセス管理
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

# リソース制限
LimitNOFILE=65536
LimitNPROC=4096

# セキュリティ設定
NoNewPrivileges=true
PrivateTmp=true

# ログ設定
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-system

[Install]
WantedBy=multi-user.target
```

### 主要設定項目の説明

| 項目 | 値 | 説明 |
|------|-----|------|
| **User** | kensan | サービスを実行するユーザー |
| **WorkingDirectory** | /mnt/LinuxHDD/ITSM-System | プロジェクトディレクトリ |
| **EnvironmentFile** | .env | 環境変数ファイル |
| **ExecStart** | /usr/bin/node backend/server.js | 起動コマンド |
| **Restart** | always | クラッシュ時に自動再起動 |
| **RestartSec** | 10 | 再起動までの待機時間（秒） |
| **LimitNOFILE** | 65536 | 最大オープンファイル数 |
| **After** | network.target | ネットワーク起動後に開始 |

---

## ✅ 動作確認

### 1. サービス起動確認

```bash
sudo systemctl is-active itsm-system
# 期待される出力: active
```

### 2. 自動起動設定確認

```bash
sudo systemctl is-enabled itsm-system
# 期待される出力: enabled
```

### 3. ポート待ち受け確認

```bash
sudo ss -tlnp | grep 3000
# 期待される出力: LISTEN 0 511 *:3000 *:* users:(("node",pid=XXXX,fd=XX))
```

### 4. APIエンドポイント確認

```bash
curl http://localhost:3000/api/v1/health
# 期待される出力: {"status":"ok","timestamp":"..."}
```

### 5. Webブラウザ確認

ブラウザで以下にアクセス：
- **メインページ**: http://localhost:3000
- **ヘルスチェック**: http://localhost:3000/api/v1/health

---

## 🐛 トラブルシューティング

### 問題1: サービスが起動しない

**症状**:
```
● itsm-system.service - ITSM-System
     Active: failed (Result: exit-code)
```

**原因と対処**:

#### a) ポート競合
```bash
# ポート3000を使用しているプロセスを確認
sudo lsof -ti:3000

# プロセスを停止
sudo kill -9 $(sudo lsof -ti:3000)

# サービス再起動
sudo systemctl restart itsm-system
```

#### b) 環境変数エラー
```bash
# .envファイルの存在確認
ls -la /mnt/LinuxHDD/ITSM-System/.env

# .envファイルの権限確認（kensan が読み取れるか）
sudo chmod 600 /mnt/LinuxHDD/ITSM-System/.env
sudo chown kensan:kensan /mnt/LinuxHDD/ITSM-System/.env
```

#### c) Node.jsパスエラー
```bash
# Node.jsパス確認
which node
# 出力: /usr/bin/node

# サービスファイルのExecStartと一致しているか確認
sudo nano /etc/systemd/system/itsm-system.service
```

### 問題2: ログが表示されない

```bash
# journalログの確認
sudo journalctl -u itsm-system --no-pager

# ログレベルを変更して詳細表示
sudo journalctl -u itsm-system -p debug --no-pager
```

### 問題3: 自動起動が有効にならない

```bash
# サービスファイルの再読み込み
sudo systemctl daemon-reload

# 再度有効化
sudo systemctl enable itsm-system.service

# 確認
sudo systemctl is-enabled itsm-system.service
```

### 問題4: サービスが頻繁にクラッシュする

```bash
# 詳細ログを確認
sudo journalctl -u itsm-system -n 200 --no-pager

# 再起動回数を確認
sudo systemctl show itsm-system -p NRestarts

# データベースマイグレーション実行
cd /mnt/LinuxHDD/ITSM-System
npm run migrate:latest
```

---

## 🔄 サービス設定の変更

サービスファイル（`itsm-system.service`）を変更した場合の手順：

```bash
# 1. サービスを停止
sudo systemctl stop itsm-system

# 2. サービスファイルを編集
sudo nano /etc/systemd/system/itsm-system.service

# 3. systemdデーモンをリロード
sudo systemctl daemon-reload

# 4. サービスを再起動
sudo systemctl start itsm-system

# 5. ステータス確認
sudo systemctl status itsm-system
```

---

## 🗑️ サービスの削除（アンインストール）

```bash
# 1. サービスを停止
sudo systemctl stop itsm-system

# 2. 自動起動を無効化
sudo systemctl disable itsm-system

# 3. サービスファイルを削除
sudo rm /etc/systemd/system/itsm-system.service

# 4. systemdデーモンをリロード
sudo systemctl daemon-reload

# 5. systemdキャッシュをリセット
sudo systemctl reset-failed
```

---

## 📊 パフォーマンス監視

### リソース使用状況確認

```bash
# CPU・メモリ使用率
systemctl status itsm-system

# 詳細なリソース情報
systemd-cgtop -1

# プロセス詳細
ps aux | grep "node backend/server.js"
```

---

## 🔒 セキュリティ考慮事項

### 1. 環境変数ファイルのパーミッション

```bash
# .envファイルは600（所有者のみ読み書き）に設定
chmod 600 /mnt/LinuxHDD/ITSM-System/.env
```

### 2. サービス実行ユーザー

- 本番環境では、専用の低権限ユーザー（例: `itsm`）を作成することを推奨
- 現在は `kensan` ユーザーで実行

### 3. systemdセキュリティオプション

サービスファイルに以下のセキュリティ設定が含まれています：
- `NoNewPrivileges=true` - 特権昇格を防止
- `PrivateTmp=true` - 独立したtmpディレクトリを使用

---

## 📚 関連ドキュメント

- [systemd公式ドキュメント](https://www.freedesktop.org/software/systemd/man/)
- [ITSM-System運用マニュアル](./運用マニュアル.md)
- [ITSM-Systemデプロイメントガイド](./デプロイメントガイド.md)

---

## 🎯 チェックリスト

本番環境デプロイ前の確認事項：

- [ ] サービスファイルが `/etc/systemd/system/` にコピーされている
- [ ] `sudo systemctl daemon-reload` を実行済み
- [ ] `sudo systemctl enable itsm-system` を実行済み
- [ ] サービスが起動している（`systemctl status itsm-system`）
- [ ] ポート3000でアクセス可能
- [ ] ヘルスチェックエンドポイントが応答する
- [ ] ログが正常に記録されている（`journalctl -u itsm-system`）
- [ ] 再起動テスト実施済み（`sudo reboot` → 自動起動確認）
- [ ] .envファイルのパーミッションが適切（600）
- [ ] データベースマイグレーションが最新

---

**作成日**: 2026-01-01
**最終更新**: 2026-01-01
**バージョン**: 1.0
