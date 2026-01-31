# ITSM-Sec Nexus - Systemd サービスファイル

## 概要

このディレクトリには、ITSM-Sec Nexusアプリケーションのsystemd自動起動設定ファイルが含まれています。

## ファイル一覧

### 開発環境

- **itsm-nexus-dev.service** - 開発環境用サービス定義
  - ポート: 5443 (HTTPS)
  - 環境変数: `config/env/.env.development`
  - 再起動ポリシー: `on-failure` (失敗時のみ)
  - リソース制限: 緩め (開発用)

### 本番環境

- **itsm-nexus-prod.service** - 本番環境用サービス定義
  - ポート: 6443 (HTTPS), 8080 (HTTP)
  - 環境変数: `config/env/.env.production`
  - 再起動ポリシー: `always` (常時)
  - リソース制限: 厳格 (本番用)
  - セキュリティ強化: 有効

### レガシーファイル（参考用）

- **itsm-system.service** - 旧バックエンドサービス（非推奨）
- **itsm-system-https.service** - 旧HTTPSサービス（非推奨）
- **itsm-frontend.service** - 旧フロントエンドサービス（非推奨）
- **itsm-frontend-https.service** - 旧HTTPS対応フロントエンド（非推奨）

**注意**: 新しいシステムでは `itsm-nexus-dev.service` または `itsm-nexus-prod.service` を使用してください。

## インストール

### クイックインストール

```bash
cd /mnt/LinuxHDD/ITSM-System
sudo ./scripts/install-systemd.sh
```

インストーラーが対話的にセットアップをガイドします。

### 手動インストール

#### 1. サービスファイルをコピー

```bash
# 開発環境
sudo cp systemd/itsm-nexus-dev.service /etc/systemd/system/

# 本番環境
sudo cp systemd/itsm-nexus-prod.service /etc/systemd/system/
```

#### 2. systemdデーモンを再読み込み

```bash
sudo systemctl daemon-reload
```

#### 3. サービスを起動

```bash
# 開発環境
sudo systemctl start itsm-nexus-dev

# 本番環境
sudo systemctl start itsm-nexus-prod
```

#### 4. 自動起動を有効化

```bash
# 開発環境
sudo systemctl enable itsm-nexus-dev

# 本番環境
sudo systemctl enable itsm-nexus-prod
```

## 管理

### 管理ツールの使用（推奨）

```bash
# サービスを起動
sudo ../scripts/systemd-manager.sh prod start

# 状態確認
sudo ../scripts/systemd-manager.sh prod status

# ログ表示
sudo ../scripts/systemd-manager.sh prod logs
```

### systemctlコマンドの直接使用

```bash
# サービスの起動
sudo systemctl start itsm-nexus-prod

# サービスの停止
sudo systemctl stop itsm-nexus-prod

# サービスの再起動
sudo systemctl restart itsm-nexus-prod

# 状態確認
sudo systemctl status itsm-nexus-prod

# ログ表示
sudo journalctl -u itsm-nexus-prod -f
```

## ドキュメント

- **詳細ドキュメント**: `/mnt/LinuxHDD/ITSM-System/docs-prod/SYSTEMD_SETUP.md`
- **クイックリファレンス**: `/mnt/LinuxHDD/ITSM-System/docs-prod/SYSTEMD_QUICK_REFERENCE.md`

## アンインストール

```bash
sudo /mnt/LinuxHDD/ITSM-System/scripts/uninstall-systemd.sh
```

## トラブルシューティング

### サービスが起動しない

```bash
# 状態確認
sudo systemctl status itsm-nexus-prod

# エラーログ確認
sudo journalctl -u itsm-nexus-prod -n 50 -p err

# 環境変数ファイルの確認
ls -l /mnt/LinuxHDD/ITSM-System/config/env/.env.production
```

### 設定変更後

```bash
# systemdデーモンの再読み込み
sudo systemctl daemon-reload

# サービスの再起動
sudo systemctl restart itsm-nexus-prod
```

## サービスファイルの比較

| 項目 | 開発環境 | 本番環境 |
|------|----------|----------|
| サービス名 | itsm-nexus-dev | itsm-nexus-prod |
| ポート | 5443 (HTTPS) | 6443 (HTTPS), 8080 (HTTP) |
| 環境変数ファイル | .env.development | .env.production |
| 再起動ポリシー | on-failure | always |
| 再起動間隔 | 5秒 | 10秒 |
| ファイルディスクリプタ制限 | 4096 | 65536 |
| プロセス数制限 | 2048 | 4096 |
| セキュリティ強化 | 最小限 | 有効 |
| ファイルシステム保護 | なし | あり |

## サポート

問題が発生した場合は、以下の情報を含めてGitHub Issueを作成してください。

- OSとバージョン
- systemdバージョン (`systemctl --version`)
- サービス状態 (`sudo systemctl status itsm-nexus-prod`)
- エラーログ (`sudo journalctl -u itsm-nexus-prod -n 100`)

---

**最終更新**: 2026-01-31
**メンテナー**: ITSM-Sec Nexus Team
