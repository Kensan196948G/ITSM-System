# バックアップ・リストア機能 運用ガイド

**作成日**: 2026-01-31
**バージョン**: 1.0
**対象システム**: ITSM-Sec Nexus
**対象読者**: システム管理者、運用担当者

---

## 目次

1. [概要](#1-概要)
2. [バックアップ種別](#2-バックアップ種別)
3. [自動バックアップスケジュール](#3-自動バックアップスケジュール)
4. [手動バックアップ手順](#4-手動バックアップ手順)
5. [バックアップ確認](#5-バックアップ確認)
6. [バックアップ削除](#6-バックアップ削除)
7. [ストレージ管理](#7-ストレージ管理)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. 概要

### 1.1 目的

ITSM-Sec Nexusのバックアップ・リストア機能は、データベースの定期的なバックアップと迅速なリストアを提供し、システムの可用性とデータの完全性を保証します。

### 1.2 機能範囲

- **自動バックアップ**: 日次/週次/月次の定期実行
- **手動バックアップ**: Web UI/CLI/APIによるオンデマンド実行
- **整合性チェック**: 週次の自動検証
- **リストア機能**: バックアップからのデータベース復元
- **監査ログ**: すべての操作を記録（ISO 20000準拠）

### 1.3 対応データベース

- **SQLite**: itsm_nexus.db（メインデータベース）
- **バックアップ形式**: gzip圧縮（.db.gz）
- **圧縮率**: 約75%（元の25%サイズ）

---

## 2. バックアップ種別

### 2.1 日次バックアップ（Daily）

| 項目 | 詳細 |
|------|------|
| **実行タイミング** | 毎日 02:00 AM（JST） |
| **保存先** | `/backups/daily/` |
| **保存期間** | 7日間 |
| **自動削除** | 7日経過後、毎日 05:00 AM に削除 |
| **用途** | 直近の作業日のデータ復旧 |

**ファイル命名例**:
```
/backups/daily/itsm_nexus_daily_20260131_020015.db.gz
```

### 2.2 週次バックアップ（Weekly）

| 項目 | 詳細 |
|------|------|
| **実行タイミング** | 毎週日曜 03:00 AM（JST） |
| **保存先** | `/backups/weekly/` |
| **保存期間** | 4週間（28日） |
| **自動削除** | 4週経過後、毎週月曜 05:00 AM に削除 |
| **用途** | 週単位のデータ復旧 |

**ファイル命名例**:
```
/backups/weekly/itsm_nexus_weekly_20260126_030012.db.gz
```

### 2.3 月次バックアップ（Monthly）

| 項目 | 詳細 |
|------|------|
| **実行タイミング** | 毎月1日 04:00 AM（JST） |
| **保存先** | `/backups/monthly/` |
| **保存期間** | 12ヶ月 |
| **自動削除** | 12ヶ月経過後、毎月2日 05:00 AM に削除 |
| **用途** | 長期データ復旧、監査対応 |

**ファイル命名例**:
```
/backups/monthly/itsm_nexus_monthly_20260201_040008.db.gz
```

### 2.4 手動バックアップ（Manual）

| 項目 | 詳細 |
|------|------|
| **実行タイミング** | ユーザーが任意に実行 |
| **保存先** | `/backups/manual/` |
| **保存期間** | 無期限（手動削除のみ） |
| **用途** | デプロイ前、メンテナンス前のバックアップ |

**ファイル命名例**:
```
/backups/manual/itsm_nexus_manual_20260131_143025.db.gz
```

---

## 3. 自動バックアップスケジュール

### 3.1 実行スケジュール

```
┌─────────────── 分 (0 - 59)
│ ┌───────────── 時 (0 - 23)
│ │ ┌─────────── 日 (1 - 31)
│ │ │ ┌───────── 月 (1 - 12)
│ │ │ │ ┌─────── 曜日 (0 - 6) (日曜 = 0)
│ │ │ │ │
* * * * *

日次:   0  2  *  *  *   (毎日 02:00)
週次:   0  3  *  *  0   (毎週日曜 03:00)
月次:   0  4  1  *  *   (毎月1日 04:00)
整合性: 0  1  *  *  6   (毎週土曜 01:00)
削除:   0  5  *  *  *   (毎日 05:00 - 古いバックアップ削除)
```

### 3.2 スケジューラー確認

```bash
# スケジューラーステータス確認
sudo systemctl status itsm-nexus-prod | grep -i scheduler

# ログ確認
sudo journalctl -u itsm-nexus-prod -f | grep -i backup

# 次回実行予定確認（backend/services/schedulerService.jsを参照）
```

### 3.3 スケジューラー設定変更

スケジュール変更は `backend/services/schedulerService.js` を編集します。

```javascript
// 例: 日次バックアップを毎日 01:00 AM に変更
cron.schedule('0 1 * * *', async () => {
  await backupService.createBackup('daily', null, 'Scheduled daily backup');
}, { timezone: 'Asia/Tokyo' });
```

変更後は必ずサービスを再起動してください。

```bash
sudo systemctl restart itsm-nexus-prod
```

---

## 4. 手動バックアップ手順

### 4.1 Web UIからの実行

#### ステップ1: バックアップ管理画面にアクセス

```
https://192.168.0.187:6443/views/backup.html
```

#### ステップ2: 認証

- 管理者アカウントでログイン（Admin権限必須）

#### ステップ3: バックアップ実行

1. 「今すぐバックアップ実行」ボタンをクリック
2. 確認ダイアログで「実行」をクリック
3. プログレスバーでバックアップの進行状況を確認
4. 完了後、成功メッセージが表示される

#### ステップ4: バックアップ確認

- バックアップ一覧テーブルに新しいエントリが追加される
- ステータスが「成功」になっていることを確認

### 4.2 CLI（コマンドライン）からの実行

#### 基本コマンド

```bash
# 手動バックアップ実行
cd /mnt/LinuxHDD/ITSM-System
sudo ./scripts/backup.sh --type manual --description "デプロイ前バックアップ"

# 実行権限がない場合
sudo chmod +x ./scripts/backup.sh
```

#### オプション

| オプション | 説明 | 例 |
|-----------|------|-----|
| `--type` | バックアップ種別 | `--type daily` |
| `--description` | バックアップ説明 | `--description "before-migration"` |
| `--help` | ヘルプ表示 | `--help` |

#### 実行例

```bash
# デフォルト（manual）
sudo ./scripts/backup.sh

# 日次バックアップを手動実行
sudo ./scripts/backup.sh --type daily

# 説明付き手動バックアップ
sudo ./scripts/backup.sh --type manual --description "メンテナンス前バックアップ"
```

#### 実行ログ例

```
[2026-01-31 14:30:25] Starting backup (type: manual)
[2026-01-31 14:30:26] Database size: 12.5 MB
[2026-01-31 14:30:27] Available disk space: 500 MB
[2026-01-31 14:30:28] Creating backup...
[2026-01-31 14:30:32] Backup created: /backups/manual/itsm_nexus_manual_20260131_143025.db
[2026-01-31 14:30:33] Running integrity check...
[2026-01-31 14:30:34] Integrity check: OK
[2026-01-31 14:30:35] Compressing backup...
[2026-01-31 14:30:37] Compression complete (12.5 MB -> 3.2 MB)
[2026-01-31 14:30:38] Backup completed successfully
[2026-01-31 14:30:38] File: /backups/manual/itsm_nexus_manual_20260131_143025.db.gz
[2026-01-31 14:30:38] Checksum: sha256:abcd1234efgh5678...
```

### 4.3 REST APIからの実行

#### エンドポイント

```
POST /api/v1/backups
```

#### リクエスト

```bash
curl -X POST https://192.168.0.187:6443/api/v1/backups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "manual",
    "description": "API経由バックアップ"
  }'
```

#### レスポンス（成功）

```json
{
  "backup_id": "BKP-20260131-143025-manual",
  "backup_type": "manual",
  "status": "in_progress",
  "started_at": "2026-01-31T14:30:25Z",
  "created_by": {
    "id": 1,
    "username": "admin"
  }
}
```

#### レスポンス（失敗 - ディスク容量不足）

```json
{
  "error": "insufficient_disk_space",
  "message": "バックアップを作成するためのディスク容量が不足しています。",
  "user_action": "不要なバックアップファイルを削除するか、ストレージを拡張してください。",
  "details": {
    "required_bytes": 20971520,
    "available_bytes": 10485760,
    "required_human": "20 MB",
    "available_human": "10 MB"
  }
}
```

---

## 5. バックアップ確認

### 5.1 バックアップ一覧表示（Web UI）

1. バックアップ管理画面にアクセス
2. バックアップ一覧テーブルで以下を確認:
   - バックアップ種別（Daily/Weekly/Monthly/Manual）
   - 作成日時
   - ファイルサイズ
   - ステータス（成功/失敗）
   - 作成者

### 5.2 バックアップ一覧表示（CLI）

```bash
# 最新5件を表示
ls -lth /backups/daily/ | head -6

# 日次バックアップ一覧
ls -lh /backups/daily/

# 週次バックアップ一覧
ls -lh /backups/weekly/

# 月次バックアップ一覧
ls -lh /backups/monthly/

# 手動バックアップ一覧
ls -lh /backups/manual/

# 全バックアップの合計サイズ
du -sh /backups/*
```

### 5.3 バックアップ詳細確認（API）

```bash
# バックアップ一覧取得
curl -X GET "https://192.168.0.187:6443/api/v1/backups?type=daily&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 特定バックアップの詳細
curl -X GET "https://192.168.0.187:6443/api/v1/backups/BKP-20260131-020015-daily" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5.4 整合性チェック

#### 自動チェック

- **実行タイミング**: 毎週土曜 01:00 AM
- **チェック内容**:
  1. ファイル存在確認
  2. ファイルサイズ検証
  3. チェックサム検証（SHA-256）
  4. 解凍テスト
  5. SQLite整合性チェック（`PRAGMA integrity_check`）

#### 手動チェック（Web UI）

1. バックアップ一覧で対象バックアップを選択
2. 「整合性チェック」ボタンをクリック
3. チェック結果を確認（PASS/FAIL）

#### 手動チェック（API）

```bash
curl -X POST "https://192.168.0.187:6443/api/v1/backups/BKP-20260131-020015-daily/verify" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### チェック結果の確認

整合性チェック結果は `backup_integrity_checks` テーブルに記録されます。

```sql
SELECT * FROM backup_integrity_checks
WHERE backup_id = 'BKP-20260131-020015-daily'
ORDER BY checked_at DESC
LIMIT 1;
```

---

## 6. バックアップ削除

### 6.1 制約事項

- **最新バックアップは削除不可**: 各種別（daily/weekly/monthly）の最新1件は削除できません
- **最小保持数**: 削除後、少なくとも1件のバックアップが残っている必要があります
- **権限**: Admin権限が必要です

### 6.2 手動削除（Web UI）

1. バックアップ管理画面にアクセス
2. バックアップ一覧で削除対象を選択
3. 「削除」ボタンをクリック
4. 確認ダイアログで「削除」をクリック
5. 削除成功メッセージを確認

### 6.3 手動削除（CLI）

```bash
# ファイルを直接削除（非推奨）
sudo rm /backups/manual/itsm_nexus_manual_20260131_143025.db.gz

# 注意: 直接削除した場合、データベースレコードとの不整合が発生する可能性があります
```

⚠️ **推奨**: Web UIまたはAPIから削除してください。データベースレコードも自動的に更新されます。

### 6.4 削除（API）

```bash
curl -X DELETE "https://192.168.0.187:6443/api/v1/backups/BKP-20260131-020015-daily" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 6.5 自動削除

古いバックアップは自動的に削除されます。

| 種別 | 保存期間 | 削除タイミング |
|------|---------|--------------|
| daily | 7日間 | 毎日 05:00 AM |
| weekly | 4週間 | 毎週月曜 05:00 AM |
| monthly | 12ヶ月 | 毎月2日 05:00 AM |
| manual | 無期限 | 自動削除なし |

自動削除のログは以下で確認できます。

```bash
sudo journalctl -u itsm-nexus-prod | grep -i "backup.*delete"
```

---

## 7. ストレージ管理

### 7.1 バックアップファイルの保存先

```
/backups/
├── daily/           # 日次バックアップ（7日間保持）
├── weekly/          # 週次バックアップ（4週間保持）
├── monthly/         # 月次バックアップ（12ヶ月保持）
├── manual/          # 手動バックアップ（無期限）
└── before_restore/  # リストア前の退避バックアップ
```

### 7.2 ディスク容量確認

```bash
# バックアップディレクトリの容量確認
df -h /backups

# 各バックアップ種別の使用量
du -sh /backups/*

# 詳細情報
du -h /backups/ | sort -h
```

### 7.3 容量管理の推奨事項

#### 初期容量設定

| データベースサイズ | 推奨バックアップ容量 |
|------------------|---------------------|
| 10 MB | 10 GB |
| 100 MB | 30 GB |
| 500 MB | 100 GB |
| 1 GB | 200 GB |

計算式:
```
必要容量 = (日次×7 + 週次×4 + 月次×12) × 圧縮後サイズ × 1.5（余裕）
```

#### 容量監視

システムは1時間ごとにディスク容量を監視し、以下の閾値でアラートを発します。

| 使用率 | アクション |
|-------|----------|
| 80% | WARNログ出力 + メール通知 |
| 90% | ERRORログ出力 + メール通知 + 古いバックアップ追加削除 |
| 95% | CRITICALログ出力 + 緊急通知 + 自動バックアップ停止 |

#### 容量不足時の対処

**方法1: 古いバックアップを削除**

```bash
# 古い手動バックアップを削除
ls -lt /backups/manual/ | tail -n +10 | awk '{print $9}' | xargs -I {} sudo rm /backups/manual/{}
```

**方法2: ストレージを拡張**

```bash
# 現在のマウントポイント確認
df -h /backups

# LVMボリュームの拡張（例）
sudo lvextend -L +50G /dev/mapper/vg-backups
sudo resize2fs /dev/mapper/vg-backups
```

**方法3: クラウドストレージへの移動**

Phase 9.2でクラウドストレージ連携が実装されます。

### 7.4 ファイルアクセス権限

バックアップファイルは厳格なアクセス権限で保護されています。

```bash
# ディレクトリ権限
drwx------ (700) root:root /backups/
drwx------ (700) root:root /backups/daily/

# ファイル権限
-rw------- (600) root:root /backups/daily/itsm_nexus_daily_20260131_020015.db.gz
```

権限修正が必要な場合:

```bash
# ディレクトリ権限修正
sudo chmod 700 /backups
sudo chmod 700 /backups/{daily,weekly,monthly,manual,before_restore}

# ファイル権限修正
sudo find /backups -type f -exec chmod 600 {} \;

# 所有者変更
sudo chown -R root:root /backups
```

---

## 8. トラブルシューティング

### 8.1 バックアップが失敗する

#### 症状

- バックアップステータスが「失敗」になる
- エラーメッセージが表示される

#### 原因と対処

**原因1: ディスク容量不足**

```bash
# 容量確認
df -h /backups

# 対処: 古いバックアップを削除
sudo rm /backups/manual/itsm_nexus_manual_YYYYMMDD_HHMMSS.db.gz
```

**原因2: データベースファイルが存在しない**

```bash
# データベース確認
ls -lh /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# 対処: データベースが削除されていないか確認
```

**原因3: 権限不足**

```bash
# 実行ユーザー確認
whoami

# 対処: sudoで実行
sudo ./scripts/backup.sh
```

**原因4: backup.shが実行権限を持っていない**

```bash
# 実行権限確認
ls -l scripts/backup.sh

# 対処: 実行権限を付与
sudo chmod +x scripts/backup.sh
```

### 8.2 整合性チェックに失敗する

#### 症状

- 整合性チェックで「FAIL」が表示される
- `PRAGMA integrity_check` エラー

#### 原因と対処

**原因1: バックアップファイルが破損**

```bash
# チェックサム確認
sha256sum /backups/daily/itsm_nexus_daily_20260131_020015.db.gz

# 対処: 別のバックアップを使用
```

**原因2: 解凍エラー**

```bash
# 手動解凍テスト
gunzip -t /backups/daily/itsm_nexus_daily_20260131_020015.db.gz

# エラーが出た場合は別のバックアップを使用
```

**原因3: データベース破損**

```bash
# 解凍してSQLite整合性チェック
gunzip -c /backups/daily/itsm_nexus_daily_20260131_020015.db.gz > /tmp/test.db
sqlite3 /tmp/test.db "PRAGMA integrity_check;"

# "ok"以外が表示された場合、バックアップが破損
# 別のバックアップを使用
```

### 8.3 スケジューラーが実行されない

#### 症状

- 自動バックアップが実行されない
- 指定時刻にバックアップが作成されない

#### 原因と対処

**原因1: スケジューラーサービスが停止**

```bash
# サービス状態確認
sudo systemctl status itsm-nexus-prod

# 対処: サービス再起動
sudo systemctl restart itsm-nexus-prod
```

**原因2: cron設定エラー**

```bash
# ログ確認
sudo journalctl -u itsm-nexus-prod | grep -i scheduler

# 対処: schedulerService.jsのcron式を確認
```

**原因3: タイムゾーン設定**

```bash
# タイムゾーン確認
timedatectl

# 対処: JST（Asia/Tokyo）に設定
sudo timedatectl set-timezone Asia/Tokyo
```

### 8.4 バックアップ一覧に表示されない

#### 症状

- バックアップファイルは存在するが、Web UIに表示されない

#### 原因と対処

**原因: データベースレコードが作成されていない**

```bash
# ファイル確認
ls -lh /backups/manual/

# データベース確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 10;"

# 対処: APIまたはCLIから再度バックアップを実行
```

### 8.5 ディスク容量警告が頻繁に発生する

#### 症状

- メール通知で「ディスク容量不足」アラートが頻繁に届く

#### 原因と対処

**対処1: 古いバックアップを削除**

```bash
# 古い手動バックアップを削除
sudo rm /backups/manual/itsm_nexus_manual_YYYYMMDD_HHMMSS.db.gz
```

**対処2: ストレージ拡張**

```bash
# ディスク追加またはLVM拡張
sudo lvextend -L +50G /dev/mapper/vg-backups
sudo resize2fs /dev/mapper/vg-backups
```

**対処3: 保存期間の見直し**

- 日次バックアップ: 7日 → 5日
- 週次バックアップ: 4週 → 3週
- 月次バックアップ: 12ヶ月 → 6ヶ月

（`schedulerService.js`で設定変更）

### 8.6 メール通知が届かない

#### 症状

- バックアップ失敗時のメール通知が届かない

#### 原因と対処

**原因: SMTP設定エラー**

```bash
# .env.productionを確認
cat config/env/.env.production | grep SMTP

# 必要項目:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
```

**対処: SMTP設定を確認**

```bash
# 設定ファイル編集
sudo nano config/env/.env.production

# サービス再起動
sudo systemctl restart itsm-nexus-prod
```

**テスト送信**

```bash
# テストメール送信
curl -X POST https://192.168.0.187:6443/api/v1/notifications/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 付録

### A. コマンドリファレンス

#### バックアップ操作

```bash
# 手動バックアップ実行
sudo ./scripts/backup.sh --type manual --description "説明"

# バックアップ一覧表示
ls -lth /backups/daily/ | head -10

# 容量確認
du -sh /backups/*

# ディスク容量確認
df -h /backups
```

#### サービス操作

```bash
# サービス状態確認
sudo systemctl status itsm-nexus-prod

# サービス再起動
sudo systemctl restart itsm-nexus-prod

# ログ確認
sudo journalctl -u itsm-nexus-prod -f
```

### B. エラーコード一覧

| コード | 説明 | 対処 |
|--------|------|------|
| 1 | ディスク容量不足 | 不要なファイル削除、ストレージ拡張 |
| 2 | データベース存在しない | データベースパス確認 |
| 3 | 整合性チェック失敗 | 別のバックアップ使用 |
| 4 | 権限不足 | sudo で実行 |

### C. 関連ドキュメント

- [ディザスタリカバリRunbook](DISASTER_RECOVERY.md)
- [Systemd自動起動設定ガイド](SYSTEMD_SETUP.md)
- [バックアップアーキテクチャ設計書](../docs-dev/BACKUP_ARCHITECTURE.md)
- [要件定義書](../specs/phase9-1-backup-requirements.md)

---

**ドキュメント履歴**:
- 2026-01-31: 初版作成
