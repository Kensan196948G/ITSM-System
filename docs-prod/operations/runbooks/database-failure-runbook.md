# データベース障害対応Runbook

**文書ID**: RB-DB-001
**対象システム**: ITSM-Sec Nexus
**最終更新**: 2026-02-14
**レビュー周期**: 四半期ごと

---

## 1. 概要

本Runbookは、ITSM-Sec Nexusで使用するSQLiteデータベース (`backend/itsm_nexus.db`) の障害発生時における診断・対応・復旧手順を定義する。

### 対象障害

| 障害種別 | 症状 | 影響度 |
|---------|------|--------|
| DB接続不可 | APIが500エラーを返す | 重大 |
| DBファイル破損 | PRAGMA integrity_check失敗 | 重大 |
| DBロック | SQLITE_BUSY エラー多発 | 高 |
| ディスク容量不足 | 書込み失敗 | 高 |
| WALファイル肥大化 | レスポンス遅延 | 中 |
| マイグレーション失敗 | 起動エラー | 高 |

### RTO / RPO

| 指標 | 目標値 | 備考 |
|------|--------|------|
| **RTO** | ≤ 15分 | サービス復旧まで |
| **RPO** | ≤ 24時間 | 日次バックアップ基準 |

---

## 2. 診断フローチャート

```
[DB障害検知/報告]
       │
       ▼
[1] ヘルスチェック確認 ─── 正常 ──→ [アプリケーション層の問題]
       │                              → 「認証・認可障害対応Runbook」参照
       │ 異常
       ▼
[2] DBファイル存在確認 ─── 不在 ──→ [4A] DBファイル復旧
       │
       │ 存在
       ▼
[3] DB接続テスト ─── 失敗 ──→ [3A] ロック状態確認
       │                         │
       │ 成功                    ├─ ロック中 → [4B] ロック解除
       ▼                         │
[4] 整合性チェック               └─ その他 → [4C] プロセス確認
       │
       ├─ 正常 → [5] WALチェック → 肥大化 → [5A] WALチェックポイント
       │                          │
       │                          └─ 正常 → [6] ディスク容量確認
       │
       └─ 破損 → [4D] バックアップから復旧
```

---

## 3. 対応手順（ステップバイステップ）

### 手順 3.1: 初期診断

#### Step 1: ヘルスチェック確認

```bash
# ヘルスエンドポイント確認（本番環境）
curl -k https://localhost:6443/api/v1/health

# ライブネスチェック
curl -k https://localhost:6443/api/v1/health/live

# レディネスチェック
curl -k https://localhost:6443/api/v1/health/ready
```

**期待される正常レスポンス**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-14T10:00:00.000Z",
  "uptime": 86400,
  "database": "connected"
}
```

**異常レスポンスの例**:
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "SQLITE_CANTOPEN"
}
```

#### Step 2: DBファイル存在・権限確認

```bash
# DBファイルの存在確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# WALファイルの確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db-wal
ls -la /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db-shm

# ファイルサイズ確認
du -sh /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db*
```

#### Step 3: DB接続テスト

```bash
# SQLite CLIで接続テスト
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "SELECT 1;"

# テーブル一覧取得
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db ".tables"
```

#### Step 4: 整合性チェック

```bash
# 整合性チェック（PRAGMA integrity_check）
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"

# 期待結果: "ok"
# 異常の場合: 破損箇所が列挙される
```

#### Step 5: WAL状態確認

```bash
# WALモード確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA journal_mode;"
# 期待結果: "wal"

# WALファイルサイズ確認（10MB超は肥大化の可能性）
ls -lh /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db-wal
```

#### Step 6: ディスク容量確認

```bash
# ディスク使用状況
df -h /mnt/LinuxHDD/ITSM-System/

# ディレクトリ使用量
du -sh /mnt/LinuxHDD/ITSM-System/backend/
du -sh /mnt/LinuxHDD/ITSM-System/backend/backups/
```

---

### 手順 3.2: 障害別対応

#### [4A] DBファイルが存在しない場合

**原因**: 誤削除、ディスク障害、パス設定ミス

```bash
# 1. バックアップ一覧確認
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz 2>/dev/null
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/*.db 2>/dev/null

# 2. 最新バックアップから復旧（復旧スクリプト使用）
bash /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/restore.sh

# 3. 手動復旧（スクリプトが使えない場合）
# 最新のバックアップファイルを特定
LATEST_BACKUP=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz | head -1)

# 圧縮バックアップを解凍
gunzip -c "$LATEST_BACKUP" > /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# 4. 復旧後の整合性確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"

# 5. サービス再起動
sudo systemctl restart itsm-nexus-prod
```

#### [4B] DBロック解除

**原因**: 長時間実行トランザクション、プロセス異常終了

```bash
# 1. ロック状態の確認
fuser /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# 2. ロックしているプロセスの特定
lsof /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# 3. Node.jsプロセスの確認
ps aux | grep -E "node|itsm"

# 4. SQLITE_BUSY タイムアウトの確認（アプリケーション設定）
# better-sqlite3 は busy_timeout で設定
# デフォルト: 5000ms

# 5. サービス再起動によるロック解放
sudo systemctl restart itsm-nexus-prod

# 6. WALチェックポイントの実行
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

#### [4C] プロセス異常

```bash
# 1. サービス状態確認
sudo systemctl status itsm-nexus-prod

# 2. ログ確認
sudo journalctl -u itsm-nexus-prod --since "30 minutes ago" --no-pager

# 3. サービス再起動
sudo systemctl restart itsm-nexus-prod

# 4. 起動確認
sleep 5
curl -k https://localhost:6443/api/v1/health
```

#### [4D] バックアップからの復旧

**原因**: DBファイル破損（integrity_check失敗）

```bash
# 1. 破損したDBファイルのバックアップ（調査用）
cp /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
   /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db.corrupted.$(date +%Y%m%d%H%M%S)

# 2. サービス停止
sudo systemctl stop itsm-nexus-prod

# 3. 復旧スクリプト実行（推奨）
bash /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/restore.sh

# 4. 手動復旧の場合
# バックアップ一覧（日時降順）
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/

# 最新バックアップから復旧
LATEST_BACKUP=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*.db.gz | head -1)
echo "Restoring from: $LATEST_BACKUP"

# チェックサムの検証（SHA-256）
sha256sum "$LATEST_BACKUP"
# 対応する .sha256 ファイルと比較

# 解凍・復旧
gunzip -c "$LATEST_BACKUP" > /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# 5. 復旧後の整合性確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "SELECT COUNT(*) FROM users;"

# 6. サービス起動
sudo systemctl start itsm-nexus-prod

# 7. 動作確認
sleep 5
curl -k https://localhost:6443/api/v1/health
```

#### [5A] WALチェックポイント実行

**原因**: WALファイル肥大化（通常は自動チェックポイントで処理されるが、失敗する場合がある）

```bash
# 1. WALファイルサイズ確認
ls -lh /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db-wal

# 2. チェックポイント実行
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 3. WALファイルサイズ再確認（大幅に縮小されるはず）
ls -lh /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db-wal

# 4. VACUUM実行（ディスク領域の回収、負荷が高いため注意）
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "VACUUM;"
```

---

### 手順 3.3: マイグレーション失敗対応

```bash
# 1. マイグレーション状態確認
cd /mnt/LinuxHDD/ITSM-System && npx knex migrate:status

# 2. 最新マイグレーションのロールバック
cd /mnt/LinuxHDD/ITSM-System && npx knex migrate:rollback

# 3. マイグレーション再実行
cd /mnt/LinuxHDD/ITSM-System && npx knex migrate:latest

# 4. マイグレーションファイルの確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/migrations/
```

---

## 4. エスカレーション基準

### エスカレーションレベル

| レベル | 条件 | 対応者 | 時間枠 |
|--------|------|--------|--------|
| **L1** | ヘルスチェック異常、DBロック | 運用担当者 | 0〜30分 |
| **L2** | DBファイル破損、復旧失敗 | システム管理者 | 30分〜2時間 |
| **L3** | 全バックアップ破損、データ損失 | 管理職 + 外部ベンダー | 2時間〜 |

### エスカレーション判断フロー

```
[障害発生]
    │
    ├─ 手順 3.1 の初期診断で解決 → L1で完了
    │
    ├─ バックアップ復旧で解決 → L1で完了（L2へ事後報告）
    │
    ├─ バックアップ復旧失敗 → L2へエスカレーション
    │     │
    │     ├─ 別バックアップで復旧成功 → L2で完了
    │     │
    │     └─ 全バックアップ不正 → L3へエスカレーション
    │
    └─ 30分経過しても未解決 → L2へエスカレーション
```

### エスカレーション連絡テンプレート

```
【DB障害報告】
■ 発生日時: YYYY-MM-DD HH:MM
■ 障害種別: [接続不可 / ファイル破損 / ロック / ディスク容量不足]
■ 影響範囲: [全面停止 / 一部機能停止 / パフォーマンス劣化]
■ 実施済み対応:
  - [実施した手順を記載]
■ 現在の状態: [復旧中 / エスカレーション待ち]
■ RPO影響: 最終バックアップ日時 YYYY-MM-DD HH:MM
■ 対応者: [担当者名]
```

---

## 5. 参考コマンド一覧

### ヘルスチェック

```bash
curl -k https://localhost:6443/api/v1/health
curl -k https://localhost:6443/api/v1/health/live
curl -k https://localhost:6443/api/v1/health/ready
```

### サービス管理

```bash
sudo systemctl status itsm-nexus-prod
sudo systemctl restart itsm-nexus-prod
sudo systemctl stop itsm-nexus-prod
sudo systemctl start itsm-nexus-prod
sudo journalctl -u itsm-nexus-prod -f
```

### SQLite操作

```bash
# 接続テスト
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "SELECT 1;"

# 整合性チェック
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"

# WALチェックポイント
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA wal_checkpoint(TRUNCATE);"

# テーブル一覧
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db ".tables"

# レコード数確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "SELECT COUNT(*) FROM users;"
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "SELECT COUNT(*) FROM incidents;"
```

### バックアップ・復旧

```bash
# バックアップ一覧
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/

# 復旧スクリプト実行
bash /mnt/LinuxHDD/ITSM-System/scripts/Linux/operations/restore.sh

# 手動復旧
gunzip -c /mnt/LinuxHDD/ITSM-System/backend/backups/LATEST.db.gz > /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# マイグレーション
cd /mnt/LinuxHDD/ITSM-System && npx knex migrate:status
cd /mnt/LinuxHDD/ITSM-System && npx knex migrate:latest
```

### ディスク・プロセス

```bash
# ディスク使用量
df -h /mnt/LinuxHDD/ITSM-System/
du -sh /mnt/LinuxHDD/ITSM-System/backend/backups/

# プロセス確認
ps aux | grep node
lsof /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db
fuser /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db
```

---

## 6. 復旧確認チェックリスト

| # | 確認項目 | コマンド/方法 | 合格基準 |
|---|---------|--------------|---------|
| 1 | ヘルスチェック | `curl -k https://localhost:6443/api/v1/health` | `"status": "healthy"` |
| 2 | DB整合性 | `PRAGMA integrity_check` | `ok` |
| 3 | レコード数 | `SELECT COUNT(*) FROM users` | 0より大きい |
| 4 | API応答 | `curl -k https://localhost:6443/api/v1/incidents` | 200 OK |
| 5 | ログイン | ブラウザでログイン確認 | 正常ログイン可能 |
| 6 | WAL状態 | `PRAGMA journal_mode` | `wal` |
| 7 | ディスク容量 | `df -h` | 使用率80%未満 |

---

## 7. 予防措置

| 措置 | 内容 | 頻度 |
|------|------|------|
| バックアップ検証 | チェックサム照合 + integrity_check | 週次 |
| ディスク監視 | 使用率80%でアラート | 常時 |
| WAL監視 | WALファイルサイズ10MB超でアラート | 常時 |
| VACUUM実行 | DB最適化（メンテナンス時間帯に実施） | 月次 |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 | 担当 |
|------|-----------|---------|------|
| 2026-02-14 | 1.0 | 初版作成 | ops-runbook |
