# ITSM-Sec Nexus - Systemdサービス管理ガイド

このドキュメントでは、ITSM-Sec NexusをSystemdサービスとして管理する方法を説明します。

## 📋 目次

1. [概要](#概要)
2. [インストール](#インストール)
3. [サービス管理](#サービス管理)
4. [トラブルシューティング](#トラブルシューティング)
5. [アンインストール](#アンインストール)

---

## 概要

Systemdサービスとして登録することで、以下のメリットがあります：

✅ **自動起動**: システム起動時に自動的にサービスが開始
✅ **自動再起動**: クラッシュ時に自動的に再起動
✅ **ログ管理**: journalctlでログを一元管理
✅ **リソース制限**: CPU、メモリなどのリソース制限を設定可能
✅ **依存関係管理**: 他のサービスとの起動順序を制御

---

## インストール

### 前提条件

- Linuxシステム（Systemd搭載）
- Node.js v20以上
- sudo権限

### インストール手順

#### ステップ1: 既存プロセスの確認

現在実行中のITSM-Sec Nexusプロセスを確認：

```bash
ps aux | grep -E "node.*server.js" | grep -v grep
```

プロセスが実行中の場合は停止：

```bash
pkill -f "node.*server.js"
```

#### ステップ2: サービスのインストール

プロジェクトディレクトリに移動：

```bash
cd /mnt/LinuxHDD/ITSM-System
```

インストールスクリプトを実行：

```bash
sudo ./install-service.sh
```

#### ステップ3: サービスの起動

```bash
sudo systemctl start itsm-sec-nexus
```

#### ステップ4: 状態の確認

```bash
sudo systemctl status itsm-sec-nexus
```

正常に起動している場合、以下のような表示になります：

```
● itsm-sec-nexus.service - ITSM-Sec Nexus - ISO 20000 & NIST CSF 2.0 Management System
     Loaded: loaded (/etc/systemd/system/itsm-sec-nexus.service; disabled; vendor preset: enabled)
     Active: active (running) since ...
```

#### ステップ5: 自動起動の有効化（オプション）

システム起動時に自動起動させたい場合：

```bash
sudo systemctl enable itsm-sec-nexus
```

---

## サービス管理

### 便利な管理スクリプトの使用

プロジェクトには便利な管理スクリプト `service-manager.sh` が含まれています。

#### 基本的な使い方

```bash
# サービスを起動
sudo ./service-manager.sh start

# サービスを停止
sudo ./service-manager.sh stop

# サービスを再起動
sudo ./service-manager.sh restart

# サービスの状態を確認
./service-manager.sh status

# ログをリアルタイム表示
./service-manager.sh logs

# 自動起動を有効化
sudo ./service-manager.sh enable

# 自動起動を無効化
sudo ./service-manager.sh disable

# サービスが実行中かチェック
./service-manager.sh is-running
```

### Systemctlコマンドの使用

#### サービスの制御

```bash
# 起動
sudo systemctl start itsm-sec-nexus

# 停止
sudo systemctl stop itsm-sec-nexus

# 再起動
sudo systemctl restart itsm-sec-nexus

# リロード（設定の再読み込み）
sudo systemctl reload itsm-sec-nexus

# 状態確認
sudo systemctl status itsm-sec-nexus
```

#### 自動起動の管理

```bash
# 自動起動を有効化
sudo systemctl enable itsm-sec-nexus

# 自動起動を無効化
sudo systemctl disable itsm-sec-nexus

# 自動起動の状態を確認
sudo systemctl is-enabled itsm-sec-nexus
```

#### ログの確認

```bash
# 最新のログを表示
sudo journalctl -u itsm-sec-nexus -n 50

# リアルタイムでログを表示
sudo journalctl -u itsm-sec-nexus -f

# 今日のログのみ表示
sudo journalctl -u itsm-sec-nexus --since today

# 特定期間のログを表示
sudo journalctl -u itsm-sec-nexus --since "2026-01-01" --until "2026-01-31"

# エラーのみ表示
sudo journalctl -u itsm-sec-nexus -p err
```

---

## トラブルシューティング

### サービスが起動しない

#### 1. ログを確認

```bash
sudo journalctl -u itsm-sec-nexus -n 100 --no-pager
```

#### 2. サービスファイルの構文チェック

```bash
sudo systemd-analyze verify /etc/systemd/system/itsm-sec-nexus.service
```

#### 3. 環境変数の確認

`.env`ファイルが正しく配置されているか確認：

```bash
ls -la /mnt/LinuxHDD/ITSM-System/.env
```

#### 4. パーミッションの確認

```bash
# サービスファイルのパーミッション
ls -la /etc/systemd/system/itsm-sec-nexus.service

# プロジェクトディレクトリのパーミッション
ls -la /mnt/LinuxHDD/ITSM-System/
```

### サービスがクラッシュする

#### 1. クラッシュログを確認

```bash
sudo journalctl -u itsm-sec-nexus -p err -n 50
```

#### 2. メモリ不足の確認

```bash
sudo systemctl status itsm-sec-nexus
```

出力に「Out of memory」などのメッセージがある場合は、サービスファイルでメモリ制限を増やします。

#### 3. ポート競合の確認

```bash
sudo netstat -tlnp | grep -E ":(6000|6443)"
```

### ポート番号の変更

デフォルトポート（6000/6443）を変更したい場合：

1. `.env`ファイルを編集
2. サービスを再起動

```bash
sudo ./service-manager.sh restart
```

---

## アンインストール

### ステップ1: サービスの停止と無効化

```bash
sudo systemctl stop itsm-sec-nexus
sudo systemctl disable itsm-sec-nexus
```

### ステップ2: アンインストールスクリプトの実行

```bash
cd /mnt/LinuxHDD/ITSM-System
sudo ./uninstall-service.sh
```

これにより、以下が実行されます：
- サービスの停止
- 自動起動の無効化
- サービスファイルの削除
- Systemdデーモンのリロード

---

## サービス設定のカスタマイズ

### サービスファイルの編集

サービスファイルを直接編集する場合：

```bash
sudo nano /etc/systemd/system/itsm-sec-nexus.service
```

編集後は、必ずデーモンをリロード：

```bash
sudo systemctl daemon-reload
sudo systemctl restart itsm-sec-nexus
```

### 主な設定項目

#### 再起動ポリシー

```ini
[Service]
Restart=always          # 常に再起動
RestartSec=10          # 再起動までの待機時間（秒）
```

オプション：
- `no`: 再起動しない
- `on-success`: 正常終了時のみ再起動
- `on-failure`: 異常終了時のみ再起動
- `always`: 常に再起動

#### リソース制限

```ini
[Service]
LimitNOFILE=65536      # ファイルディスクリプタの上限
MemoryLimit=2G         # メモリ使用量の上限
CPUQuota=200%          # CPU使用率の上限（200% = 2コア）
```

#### 環境変数

```ini
[Service]
Environment=NODE_ENV=production
Environment=PORT=6000
EnvironmentFile=/path/to/.env
```

---

## セキュリティ設定

サービスファイルには以下のセキュリティ設定が含まれています：

```ini
[Service]
NoNewPrivileges=true   # 新しい権限の取得を禁止
PrivateTmp=true        # 専用の/tmpディレクトリを使用
```

さらに強化する場合：

```ini
[Service]
ProtectSystem=full     # システムディレクトリを読み取り専用に
ProtectHome=true       # ホームディレクトリへのアクセスを制限
ReadWritePaths=/mnt/LinuxHDD/ITSM-System  # 書き込み可能なパス
```

---

## よくある質問（FAQ）

### Q: サービスが自動起動しない

A: 以下を確認してください：

```bash
sudo systemctl is-enabled itsm-sec-nexus
```

`disabled`の場合は有効化：

```bash
sudo systemctl enable itsm-sec-nexus
```

### Q: ログファイルが見つからない

A: Systemdサービスとして実行する場合、ログは以下で確認：

```bash
sudo journalctl -u itsm-sec-nexus -f
```

ファイルにも出力する場合は、サービスファイルで指定：

```ini
StandardOutput=append:/var/log/itsm-sec-nexus.log
StandardError=append:/var/log/itsm-sec-nexus-error.log
```

### Q: 複数のインスタンスを実行したい

A: ポート番号を変えて、別のサービスファイルを作成してください。

---

## 参考リンク

- [Systemd公式ドキュメント](https://www.freedesktop.org/software/systemd/man/)
- [Systemdサービスユニットの書き方](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [journalctlの使い方](https://www.freedesktop.org/software/systemd/man/journalctl.html)

---

## サポート

問題が発生した場合は、以下の情報を含めてIssueを作成してください：

1. OSバージョン
2. Node.jsバージョン
3. エラーログ（`sudo journalctl -u itsm-sec-nexus -n 100`）
4. サービスの状態（`sudo systemctl status itsm-sec-nexus`）

---

**ITSM-Sec Nexus Team**
