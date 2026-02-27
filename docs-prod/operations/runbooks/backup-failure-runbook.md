# バックアップ失敗対応Runbook

**文書ID**: RB-BKP-001
**対象システム**: ITSM-Sec Nexus
**最終更新**: 2026-02-14
**レビュー周期**: 四半期ごと

---

## 1. 概要

本Runbookは、ITSM-Sec Nexusのバックアップ処理（自動・手動）が失敗した場合の診断・対応・復旧手順を定義する。

### バックアップスケジュール

| 種別 | スケジュール | 保持期間 | 格納先 |
|------|------------|---------|--------|
| **日次バックアップ** | 毎日 02:00 | 7日間 | `backend/backups/` |
| **週次バックアップ** | 毎週日曜 03:00 | 4週間 | `backend/backups/` |
| **月次バックアップ** | 毎月1日 04:00 | 12ヶ月 | `backend/backups/` |
| **手動バックアップ** | 随時 | 手動削除まで | `backend/backups/` |

### バックアップ方式

- **形式**: SQLiteデータベースファイルのコピー
- **圧縮**: gzip圧縮 (`.db.gz`)
- **検証**: SHA-256チェックサム (`.sha256`)
- **スケジューラ**: node-cron

### 対象障害

| 障害種別 | 症状 | 影響度 |
|---------|------|--------|
| 自動バックアップ未実行 | スケジュール時刻にバックアップなし | 高 |
| バックアップファイル破損 | チェックサム不一致 | 高 |
| ディスク容量不足 | バックアップ書込み失敗 | 重大 |
| 古いバックアップ未削除 | 保持期間超過分が残存 | 中 |
| リストア失敗 | バックアップからの復旧不可 | 重大 |
| 手動バックアップ失敗 | Web UI/API/CLIでのバックアップ失敗 | 高 |

---

## 2. 診断フローチャート

```
[バックアップ失敗検知/報告]
       │
       ▼
[1] バックアップ一覧確認 ─── 最新あり ──→ [A] チェックサム検証
       │                                      │
       │ 最新なし                               ├─ 正常 → バックアップ正常
       ▼                                       └─ 不一致 → [D] 再バックアップ
[2] サービス稼働確認 ─── 停止 ──→ サービス再起動
       │
       │ 稼働中
       ▼
[3] 原因調査
       │
       ├─ スケジューラ停止 → [B] スケジューラ復旧
       ├─ ディスク容量不足 → [C] ディスク容量確保
       ├─ DB接続エラー → 「DB障害Runbook」参照
       ├─ 権限エラー → [E] ファイル権限修正
       └─ 不明 → [F] ログ詳細分析
```

---

## 3. 対応手順（ステップバイステップ）

### 手順 3.1: 初期診断

#### Step 1: バックアップ一覧確認

```bash
# バックアップファイル一覧（日時降順）
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/

# 直近のバックアップファイル確認
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz 2>/dev/null | head -5

# バックアップファイルのサイズ確認（0バイトは異常）
ls -la /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz 2>/dev/null

# バックアップ総容量
du -sh /mnt/LinuxHDD/ITSM-System/backend/backups/
```

#### Step 2: 最新バックアップの日時確認

```bash
# 最新バックアップの日時
LATEST=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz 2>/dev/null | head -1)
echo "Latest backup: $LATEST"
stat "$LATEST" 2>/dev/null

# 24時間以上経過していないか確認
find /mnt/LinuxHDD/ITSM-System/backend/backups/ -name "*.db.gz" -mtime -1 -ls
# 結果が空の場合、24時間以内のバックアップが存在しない
```

#### Step 3: チェックサム検証

```bash
# SHA-256チェックサムファイルの確認
ls /mnt/LinuxHDD/ITSM-System/backend/backups/*.sha256 2>/dev/null

# チェックサム検証
LATEST_BACKUP=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz | head -1)
LATEST_SHA="${LATEST_BACKUP}.sha256"

if [ -f "$LATEST_SHA" ]; then
    echo "Verifying checksum..."
    cd /mnt/LinuxHDD/ITSM-System/backend/backups/ && sha256sum -c "$(basename "$LATEST_SHA")"
else
    echo "No checksum file found. Generating..."
    sha256sum "$LATEST_BACKUP" > "${LATEST_BACKUP}.sha256"
fi
```

#### Step 4: バックアップファイルの整合性テスト

```bash
# gzip圧縮ファイルの整合性テスト
LATEST_BACKUP=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz | head -1)
gunzip -t "$LATEST_BACKUP"
echo "Exit code: $?"
# 0 = 正常、1 = 破損

# バックアップからSQLite整合性チェック（一時展開）
TEMP_DB="/tmp/itsm_backup_test_$(date +%s).db"
gunzip -c "$LATEST_BACKUP" > "$TEMP_DB"
sqlite3 "$TEMP_DB" "PRAGMA integrity_check;"
rm -f "$TEMP_DB"
```

#### Step 5: スケジューラ確認

```bash
# サービスログでスケジューラの動作確認
sudo journalctl -u itsm-nexus-prod | grep -iE "cron|schedule|backup" | tail -20

# 直近のバックアップ関連ログ
sudo journalctl -u itsm-nexus-prod --since "24 hours ago" | grep -i backup
```

#### Step 6: ディスク容量確認

```bash
# ディスク使用状況
df -h /mnt/LinuxHDD/ITSM-System/

# バックアップディレクトリの使用量
du -sh /mnt/LinuxHDD/ITSM-System/backend/backups/

# ファイル数確認
ls /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz 2>/dev/null | wc -l
```

---

### 手順 3.2: 障害別対応

#### [A] チェックサム不一致

**原因**: バックアップ中のディスクI/Oエラー、ファイル転送中の破損

```bash
# 1. 不一致のバックアップファイルを特定
for gz in /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz; do
    sha_file="${gz}.sha256"
    if [ -f "$sha_file" ]; then
        cd /mnt/LinuxHDD/ITSM-System/backend/backups/
        if ! sha256sum -c "$(basename "$sha_file")" 2>/dev/null; then
            echo "CORRUPTED: $gz"
        fi
    fi
done

# 2. 破損バックアップのリネーム（削除ではなく保全）
mv /mnt/LinuxHDD/ITSM-System/backend/backups/CORRUPTED_FILE.db.gz \
   /mnt/LinuxHDD/ITSM-System/backend/backups/CORRUPTED_FILE.db.gz.bad

# 3. 手動バックアップの即時実行
# Web UIから: 設定 → バックアップ → 今すぐバックアップ
# APIから:
curl -k -X POST https://localhost:6443/api/v1/backup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

#### [B] スケジューラ復旧

**原因**: Node.jsプロセス再起動後のスケジューラ未起動、node-cronの設定エラー

```bash
# 1. サービスの稼働時間確認
sudo systemctl status itsm-nexus-prod | grep "Active:"

# 2. node-cronのログ確認
sudo journalctl -u itsm-nexus-prod | grep -iE "cron|schedule" | tail -20

# 3. サービス再起動（スケジューラのリセット）
sudo systemctl restart itsm-nexus-prod

# 4. スケジューラの動作確認（次回実行時刻をログで確認）
sleep 10
sudo journalctl -u itsm-nexus-prod --since "1 minute ago" | grep -iE "cron|schedule|backup"

# 5. 即時バックアップの実行（RPO確保のため）
curl -k -X POST https://localhost:6443/api/v1/backup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

#### [C] ディスク容量確保

**原因**: バックアップファイルの蓄積、ログファイルの肥大化

```bash
# 1. ディスク使用量の詳細確認
du -sh /mnt/LinuxHDD/ITSM-System/backend/backups/
du -sh /mnt/LinuxHDD/ITSM-System/backend/logs/ 2>/dev/null
du -sh /mnt/LinuxHDD/ITSM-System/backend/

# 2. 保持期間を超過した古いバックアップの確認
# 日次: 7日超過
find /mnt/LinuxHDD/ITSM-System/backend/backups/ -name "daily_*.db.gz" -mtime +7 -ls
# 週次: 28日超過
find /mnt/LinuxHDD/ITSM-System/backend/backups/ -name "weekly_*.db.gz" -mtime +28 -ls
# 月次: 365日超過
find /mnt/LinuxHDD/ITSM-System/backend/backups/ -name "monthly_*.db.gz" -mtime +365 -ls

# 3. 古いバックアップの削除（保持期間超過分のみ）
# 注意: 削除前に最新の正常バックアップが存在することを確認
find /mnt/LinuxHDD/ITSM-System/backend/backups/ -name "daily_*.db.gz" -mtime +7 -delete
find /mnt/LinuxHDD/ITSM-System/backend/backups/ -name "daily_*.sha256" -mtime +7 -delete

# 4. ログファイルの圧縮・削除
find /mnt/LinuxHDD/ITSM-System/backend/logs/ -name "*.log" -mtime +30 -delete 2>/dev/null

# 5. ディスク容量の再確認
df -h /mnt/LinuxHDD/ITSM-System/

# 6. バックアップの再実行
curl -k -X POST https://localhost:6443/api/v1/backup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

#### [D] 手動バックアップの再実行

```bash
# 方法1: Web UI
# 設定 → バックアップ管理 → 「今すぐバックアップ」ボタン

# 方法2: API
TOKEN=$(curl -k -s -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"'"$ADMIN_PASSWORD"'"}' | jq -r '.token')

curl -k -X POST https://localhost:6443/api/v1/backup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 方法3: CLI（直接DBコピー）
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/mnt/LinuxHDD/ITSM-System/backend/backups/manual_${TIMESTAMP}.db.gz"

# SQLiteのsafe backup（オンラインバックアップ）
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db ".backup /tmp/itsm_backup_${TIMESTAMP}.db"
gzip -c "/tmp/itsm_backup_${TIMESTAMP}.db" > "$BACKUP_FILE"
sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
rm -f "/tmp/itsm_backup_${TIMESTAMP}.db"

# バックアップ検証
gunzip -t "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"
```

#### [E] ファイル権限修正

```bash
# 1. バックアップディレクトリの権限確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/backups/

# 2. 権限修正
chmod 755 /mnt/LinuxHDD/ITSM-System/backend/backups/
chown -R $(whoami):$(whoami) /mnt/LinuxHDD/ITSM-System/backend/backups/

# 3. DBファイルの読み取り権限確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# 4. テストバックアップ実行
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db ".backup /tmp/test_backup.db"
echo "Test backup exit code: $?"
rm -f /tmp/test_backup.db
```

#### [F] ログ詳細分析

```bash
# 1. バックアップ関連の全ログ
sudo journalctl -u itsm-nexus-prod --since "48 hours ago" | grep -iE "backup|cron|schedule"

# 2. エラーログ
sudo journalctl -u itsm-nexus-prod --since "48 hours ago" --priority=err

# 3. Node.jsのunhandled error
sudo journalctl -u itsm-nexus-prod | grep -iE "unhandled|uncaught|ENOSPC|EACCES|EPERM"

# 4. OOMキラーの確認
dmesg | grep -i "oom\|killed"
```

---

### 手順 3.3: リストア失敗時の対応

バックアップからのリストアが失敗する場合の追加手順。

```bash
# 1. リストアスクリプトの実行
bash /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/restore.sh

# 2. スクリプトが失敗する場合の手動リストア
sudo systemctl stop itsm-nexus-prod

# 現在のDBをバックアップ（安全策）
cp /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
   /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db.pre_restore.$(date +%Y%m%d%H%M%S)

# 複数バックアップを試行（新しい順）
for BACKUP in $(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz); do
    echo "Trying: $BACKUP"
    gunzip -t "$BACKUP" 2>/dev/null
    if [ $? -eq 0 ]; then
        gunzip -c "$BACKUP" > /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db
        RESULT=$(sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;" 2>/dev/null)
        if [ "$RESULT" = "ok" ]; then
            echo "SUCCESS: Restored from $BACKUP"
            break
        else
            echo "FAILED integrity check: $BACKUP"
        fi
    else
        echo "CORRUPTED gzip: $BACKUP"
    fi
done

# サービス起動
sudo systemctl start itsm-nexus-prod
sleep 5
curl -k https://localhost:6443/api/v1/health
```

---

## 4. エスカレーション基準

### エスカレーションレベル

| レベル | 条件 | 対応者 | 時間枠 |
|--------|------|--------|--------|
| **L1** | 単発のバックアップ失敗、古いバックアップ未削除 | 運用担当者 | 0〜30分 |
| **L1** | ディスク容量警告（80-90%） | 運用担当者 | 0〜30分 |
| **L2** | 連続2回以上のバックアップ失敗 | システム管理者 | 30分〜2時間 |
| **L2** | ディスク容量危機（90%超） | システム管理者 | 即時 |
| **L3** | 全バックアップ破損、RPO超過 | 管理職 | 即時 |

### RPO超過の判断基準

```
最終正常バックアップ日時と現在時刻の差:
  - 24時間未満: 正常範囲
  - 24〜48時間: 警告（L1で即時対応）
  - 48時間超: 危機（L2へエスカレーション）
  - 正常バックアップなし: 緊急（L3へエスカレーション）
```

### エスカレーション連絡テンプレート

```
【バックアップ障害報告】
■ 発生日時: YYYY-MM-DD HH:MM
■ 障害種別: [自動バックアップ未実行 / ファイル破損 / ディスク容量不足 / リストア失敗]
■ 最終正常バックアップ: YYYY-MM-DD HH:MM
■ RPO影響: [範囲内 / 超過（XX時間）]
■ ディスク使用率: XX%
■ 実施済み対応:
  - [実施した手順を記載]
■ 現在の状態: [復旧済 / 対応中 / エスカレーション待ち]
■ 対応者: [担当者名]
```

---

## 5. 参考コマンド一覧

### バックアップ操作

```bash
# バックアップ一覧
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/

# 手動バックアップ（API）
curl -k -X POST https://localhost:6443/api/v1/backup \
  -H "Authorization: Bearer $TOKEN"

# 手動バックアップ（CLI）
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db ".backup /tmp/manual_backup.db"
gzip -c /tmp/manual_backup.db > /mnt/LinuxHDD/ITSM-System/backend/backups/manual_$(date +%Y%m%d_%H%M%S).db.gz

# リストア
bash /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/restore.sh
```

### 検証

```bash
# gzip整合性
gunzip -t /mnt/LinuxHDD/ITSM-System/backend/backups/FILENAME.db.gz

# SHA-256チェックサム
sha256sum /mnt/LinuxHDD/ITSM-System/backend/backups/FILENAME.db.gz

# SQLite整合性（一時展開）
gunzip -c FILENAME.db.gz > /tmp/test.db && sqlite3 /tmp/test.db "PRAGMA integrity_check;" && rm /tmp/test.db
```

### ディスク管理

```bash
# ディスク使用量
df -h /mnt/LinuxHDD/ITSM-System/
du -sh /mnt/LinuxHDD/ITSM-System/backend/backups/

# 古いバックアップの確認
find /mnt/LinuxHDD/ITSM-System/backend/backups/ -name "*.db.gz" -mtime +7 -ls

# バックアップ数
ls /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz 2>/dev/null | wc -l
```

### サービス・ログ

```bash
# スケジューラログ
sudo journalctl -u itsm-nexus-prod | grep -iE "cron|schedule|backup"

# エラーログ
sudo journalctl -u itsm-nexus-prod --priority=err --since "24 hours ago"

# サービス再起動
sudo systemctl restart itsm-nexus-prod
```

---

## 6. 復旧確認チェックリスト

| # | 確認項目 | コマンド/方法 | 合格基準 |
|---|---------|--------------|---------|
| 1 | サービス稼働 | `systemctl status itsm-nexus-prod` | active (running) |
| 2 | 最新バックアップ | `ls -lt backups/*.db.gz \| head -1` | 24時間以内 |
| 3 | gzip整合性 | `gunzip -t LATEST.db.gz` | exit code 0 |
| 4 | チェックサム | `sha256sum -c LATEST.db.gz.sha256` | OK |
| 5 | DB整合性 | 一時展開 + `PRAGMA integrity_check` | ok |
| 6 | ディスク容量 | `df -h` | 使用率80%未満 |
| 7 | スケジューラ | ログでcron確認 | 次回実行予定あり |

---

## 7. 予防措置

| 措置 | 内容 | 頻度 |
|------|------|------|
| バックアップ検証 | 自動チェックサム照合 + gzip整合性テスト | 日次 |
| リストア訓練 | バックアップからの復旧テスト | 月次 |
| ディスク監視 | 使用率80%でアラート、90%で即時対応 | 常時 |
| 保持期間管理 | 古いバックアップの自動削除確認 | 週次 |
| バックアップ一覧レビュー | 期待されるバックアップファイルの存在確認 | 日次 |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 | 担当 |
|------|-----------|---------|------|
| 2026-02-14 | 1.0 | 初版作成 | ops-runbook |
