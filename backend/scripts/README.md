# 自動エラー検知・修復システム

ITSM-Sec Nexus用の永続的な監視・自動修復デーモンです。

## 概要

本システムは、24時間365日稼働し、エラーを自動検知して可能な場合は自動的に修復を行います。

### 主な機能

- **エラー検知**: ログファイルをスキャンして12種類のエラーパターンを検出
- **ヘルスチェック**: SQLite、HTTP API、ディスク、メモリの状態を監視
- **自動修復**: 検出されたエラーに対して自動修復アクションを実行
- **クールダウン**: 同一エラーの連続修復を防止（300秒）
- **ログ管理**: 詳細なログとアラート記録

## ファイル構成

```
backend/scripts/
├── auto_fix_daemon.py          # メイン修復デーモン
├── health_monitor.py           # ヘルスモニタリング
├── error_patterns.json         # エラーパターン定義
├── auto-fix-daemon.service     # systemdサービス定義
└── README.md                   # このファイル
```

## 必要な環境

- **Python**: 3.8以上
- **依存パッケージ**: requests
- **権限**: 一部のアクション（サービス再起動など）にはsudo権限が必要

## インストール

### 1. Python依存パッケージのインストール

```bash
pip install requests
```

### 2. 実行権限の付与

```bash
chmod +x auto_fix_daemon.py
chmod +x health_monitor.py
```

### 3. sudoers設定（オプション）

自動修復でサービス再起動などを実行する場合、sudoers設定が必要です。

```bash
sudo visudo
```

以下を追加：

```
kensan ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart itsm-nexus
kensan ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart postgresql
kensan ALL=(ALL) NOPASSWD: /bin/chown
kensan ALL=(ALL) NOPASSWD: /bin/chmod
kensan ALL=(ALL) NOPASSWD: /usr/bin/kill
```

## 使用方法

### 手動実行（1回のみ）

```bash
cd /mnt/LinuxHDD/ITSM-System/backend/scripts
python3 auto_fix_daemon.py
```

### 継続的監視モード

```bash
python3 auto_fix_daemon.py --continuous
```

**デフォルト設定**:
- ループ回数: 15回/イテレーション
- 待機時間: 5分（イテレーション間）

### カスタム設定

```bash
python3 auto_fix_daemon.py --continuous \
  --loop-count 20 \
  --wait-minutes 10 \
  --config /path/to/custom_config.json \
  --log-file /path/to/custom.log
```

### systemdサービスとしてインストール

```bash
# サービスファイルをコピー
sudo cp auto-fix-daemon.service /etc/systemd/system/

# systemd設定を再読み込み
sudo systemctl daemon-reload

# サービスを有効化（自動起動）
sudo systemctl enable auto-fix-daemon

# サービスを起動
sudo systemctl start auto-fix-daemon

# ステータス確認
sudo systemctl status auto-fix-daemon

# ログ確認
sudo journalctl -u auto-fix-daemon -f
```

### サービス管理コマンド

```bash
# 再起動
sudo systemctl restart auto-fix-daemon

# 停止
sudo systemctl stop auto-fix-daemon

# 自動起動を無効化
sudo systemctl disable auto-fix-daemon
```

## コマンドラインオプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--continuous` | 継続的監視モード | False |
| `--config PATH` | 設定ファイルパス | `./error_patterns.json` |
| `--log-file PATH` | ログファイルパス | `../logs/auto_fix.log` |
| `--loop-count N` | ループ回数 | 15 |
| `--wait-minutes N` | 待機時間（分） | 5 |
| `--once` | 1回のみ実行 | - |

## エラーパターン

`error_patterns.json`で定義されたエラーパターンを検知します。

### 検知可能なエラー

1. **HTTP 4xxエラー** - クライアントエラー
2. **HTTP 5xxエラー** - サーバーエラー
3. **データベース接続エラー** - DB接続失敗
4. **Python例外** - プログラム例外
5. **ファイル不存在** - 必要なファイルが見つからない
6. **権限エラー** - アクセス権限不足
7. **メモリ不足** - システムメモリ枯渇
8. **ディスク容量不足** - ストレージ容量不足
9. **ポート使用中** - ポート競合
10. **JSON解析エラー** - JSON形式エラー
11. **Redis接続エラー** - Redis接続失敗
12. **SSL証明書エラー** - 証明書の問題

## 自動修復アクション

以下のアクションが自動実行されます（設定により）：

- **service_restart**: サービス再起動
- **log_rotate**: ログローテーション（10MB超）
- **cache_clear**: キャッシュクリア
- **temp_file_cleanup**: 一時ファイル削除
- **create_missing_dirs**: ディレクトリ作成
- **fix_permissions**: 権限修正
- **check_port**: ポート確認
- **kill_process_on_port**: プロセス終了
- **old_file_cleanup**: 古いファイル削除
- **alert**: アラート送信のみ

## ヘルスチェック

### チェック項目

1. **database_connection** - SQLite接続チェック
2. **http_endpoint** - HTTP APIチェック
3. **disk_space** - ディスク容量チェック（90%閾値）
4. **memory_usage** - メモリ使用量チェック（85%閾値）

### ヘルスチェックのみ実行

```bash
cd /mnt/LinuxHDD/ITSM-System/backend/scripts
python3 health_monitor.py
```

出力例：

```json
{
  "timestamp": "2026-02-01T10:00:00",
  "checks": {
    "database_connection": {
      "status": "healthy",
      "message": "Connection successful (15 tables)"
    },
    "disk_space": {
      "status": "healthy",
      "usage_percent": 45
    }
  },
  "overall_status": "healthy",
  "metrics": {
    "cpu": {"usage_percent": 25.3},
    "memory": {"total_gb": 16.0, "used_gb": 9.6}
  }
}
```

## ログファイル

| ファイル | 説明 | ローテーション |
|---------|------|---------------|
| `../logs/auto_fix.log` | 修復処理の詳細ログ | 10MB超で自動 |
| `../logs/alerts.log` | 重要アラート（JSON） | - |
| `../logs/app.log` | アプリケーションログ | 10MB超で自動 |

### ログフォーマット

```
2026-02-01 14:30:15 - AutoFixDaemon - [INFO] - === 検知サイクル 1 開始 ===
2026-02-01 14:30:16 - AutoFixDaemon - [WARNING] - エラー検出: HTTP 5xxエラー
2026-02-01 14:30:17 - AutoFixDaemon - [INFO] - 修復アクション実行: service_restart
```

## 設定ファイル（error_patterns.json）

### 基本構造

```json
{
  "error_patterns": [...],     // エラーパターン定義
  "health_checks": [...],      // ヘルスチェック設定
  "auto_fix_config": {...}     // 自動修復設定
}
```

### auto_fix_config

```json
{
  "max_retries": 3,                    // 最大リトライ回数
  "retry_delay": 60,                   // リトライ遅延（秒）
  "cooldown_period": 300,              // クールダウン期間（秒）
  "enable_notifications": true,        // 通知有効化
  "notification_channels": ["log"],    // 通知チャンネル
  "backup_before_fix": true            // 修復前バックアップ
}
```

## トラブルシューティング

### デーモンが起動しない

```bash
# ログ確認
sudo journalctl -u auto-fix-daemon -n 50

# 権限確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/scripts/

# 手動実行でエラー確認
python3 auto_fix_daemon.py
```

### 自動修復が動作しない

1. `error_patterns.json` の `auto_fix` が `true` か確認
2. クールダウン期間（300秒）内でないか確認
3. ログファイルのパスが正しいか確認
4. 必要な権限があるか確認

### ヘルスチェックが失敗する

```bash
# SQLite確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# HTTP API確認
curl http://localhost:5100/api/health

# ポート確認
netstat -tlnp | grep 5100

# ディスク容量確認
df -h /
```

## GitHub Actions連携

`.github/workflows/auto-error-fix-continuous.yml` で5分間隔の自動実行が設定されています。

- **実行間隔**: 5分（cron: `*/5 * * * *`）
- **ループ回数**: 15回/実行
- **Artifact保存**: 30日間保持
- **Issue作成**: 失敗時に自動作成

## セキュリティ考慮事項

1. **実行権限**: 必要最小限の権限で実行
2. **sudoers設定**: 特定のコマンドのみ許可
3. **リソース制限**: systemdでメモリ512MB、CPU50%に制限
4. **PrivateTmp**: 一時ファイルを隔離
5. **NoNewPrivileges**: 特権昇格を防止

## パフォーマンス指標

| 項目 | 通常時 | 最大値 |
|------|--------|--------|
| メモリ使用量 | 50-100MB | 512MB |
| CPU使用率 | 1-5% | 50% |
| ディスクI/O | 低い | 中程度（スキャン時） |

## ライセンス

ISC License

Copyright (c) 2026 Mirai Knowledge Systems

## サポート

問題が発生した場合は、GitHubのIssueを作成してください。

https://github.com/Kensan196948G/ITSM-System/issues
