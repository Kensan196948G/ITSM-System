# Runbook: データベース破損時対応

## 概要

ITSM-Sec Nexus が使用する SQLite データベース（`backend/itsm.db`）が破損した場合の
診断・復旧手順書です。SQLite は WAL（Write-Ahead Logging）モードで動作しています。

---

## 1. 検知方法

### 1.1 症状

| 症状 | 重大度 | 原因の可能性 |
|------|--------|-------------|
| `SQLITE_CORRUPT` エラー | 高 | DBファイル破損 |
| `SQLITE_IOERR` エラー | 高 | ディスクI/Oエラー |
| `database disk image is malformed` | 高 | 物理破損 |
| API が 500 エラーを返す | 中 | DB接続障害 |
| データが部分的に欠落 | 中 | 不完全なトランザクション |
| WAL ファイルが肥大化（100MB超） | 低 | チェックポイント未実行 |

### 1.2 アラート条件

```bash
# アプリケーションログでDB関連エラーを検知
grep -i "SQLITE_CORRUPT\|SQLITE_IOERR\|malformed\|database is locked" /var/log/itsm/server.log
```

### 1.3 定期チェックスクリプト

```bash
# DBの整合性チェック
sqlite3 backend/itsm.db "PRAGMA integrity_check;"
# 期待出力: ok

# DBファイルサイズ確認
ls -lh backend/itsm.db backend/itsm.db-wal backend/itsm.db-shm 2>/dev/null
```

---

## 2. 初動対応（10分以内）

### 2.1 サービス停止

データベース破損が疑われる場合、追加のデータ破損を防ぐためサービスを即座に停止します。

```bash
# 1. サービス停止
sudo systemctl stop itsm-system 2>/dev/null || pkill -f "node backend/server.js"

# 2. DBにアクセスしているプロセスがないことを確認
fuser backend/itsm.db 2>/dev/null
# 出力が空であることを確認
```

### 2.2 現状保全

```bash
# 破損したDBのバックアップ（証拠保全）
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp backend/itsm.db "backend/itsm.db.corrupted_${TIMESTAMP}"
cp backend/itsm.db-wal "backend/itsm.db-wal.corrupted_${TIMESTAMP}" 2>/dev/null
cp backend/itsm.db-shm "backend/itsm.db-shm.corrupted_${TIMESTAMP}" 2>/dev/null
echo "破損DB保全完了: corrupted_${TIMESTAMP}"
```

---

## 3. 診断

### 3.1 整合性チェック

```bash
# 基本整合性チェック
sqlite3 backend/itsm.db "PRAGMA integrity_check;"

# 詳細チェック（全ページ検査）
sqlite3 backend/itsm.db "PRAGMA integrity_check(100);"

# ジャーナルモード確認
sqlite3 backend/itsm.db "PRAGMA journal_mode;"
# 期待: wal

# フリーリスト確認
sqlite3 backend/itsm.db "PRAGMA freelist_count;"
```

### 3.2 テーブル別チェック

```bash
# テーブル一覧
sqlite3 backend/itsm.db ".tables"

# 主要テーブルの行数確認
sqlite3 backend/itsm.db "
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'incidents', COUNT(*) FROM incidents
UNION ALL SELECT 'changes', COUNT(*) FROM changes
UNION ALL SELECT 'assets', COUNT(*) FROM assets
UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs;
"

# マイグレーション状態確認
sqlite3 backend/itsm.db "SELECT * FROM knex_migrations ORDER BY id DESC LIMIT 5;"
```

### 3.3 ディスク状態確認

```bash
# ディスク容量
df -h $(dirname backend/itsm.db)

# ディスクI/Oエラー確認
dmesg | grep -i "i/o error\|disk\|sda\|nvme" | tail -20

# ファイルシステム状態
stat backend/itsm.db
```

---

## 4. 復旧手順

### 4.1 方法A: WALチェックポイント強制実行（軽度の場合）

WALファイルの肥大化やチェックポイント未完了が原因の場合に有効です。

```bash
# WALチェックポイント実行
sqlite3 backend/itsm.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 整合性を再確認
sqlite3 backend/itsm.db "PRAGMA integrity_check;"

# 結果が ok なら復旧完了
```

### 4.2 方法B: ダンプ＆リストア（中度の場合）

部分的に破損している場合、読み取り可能なデータをダンプして新しいDBに復元します。

```bash
# 1. 既存データをダンプ（破損部分はスキップされる）
sqlite3 backend/itsm.db ".dump" > /tmp/itsm_dump_$(date +%Y%m%d).sql

# 2. ダンプの内容を確認（エラー行がないか）
grep -c "^INSERT" /tmp/itsm_dump_$(date +%Y%m%d).sql
grep -i "error\|corrupt" /tmp/itsm_dump_$(date +%Y%m%d).sql

# 3. 新しいDBにリストア
mv backend/itsm.db backend/itsm.db.old
sqlite3 backend/itsm.db < /tmp/itsm_dump_$(date +%Y%m%d).sql

# 4. 整合性確認
sqlite3 backend/itsm.db "PRAGMA integrity_check;"

# 5. WALモードを再設定
sqlite3 backend/itsm.db "PRAGMA journal_mode=WAL;"
```

### 4.3 方法C: バックアップからの完全復旧（重度の場合）

DBファイルが読み取り不能な場合、バックアップから復旧します。

```bash
# 1. バックアップ一覧を確認
ls -lah backups/ 2>/dev/null

# 2. 最新のバックアップを特定
LATEST_BACKUP=$(ls -t backups/itsm_*.db 2>/dev/null | head -1)
echo "使用するバックアップ: ${LATEST_BACKUP}"

# 3. バックアップの整合性を確認
sqlite3 "${LATEST_BACKUP}" "PRAGMA integrity_check;"

# 4. 現在のDBを退避してバックアップで置き換え
mv backend/itsm.db backend/itsm.db.corrupted
rm -f backend/itsm.db-wal backend/itsm.db-shm
cp "${LATEST_BACKUP}" backend/itsm.db

# 5. 不足しているマイグレーションを適用
NODE_ENV=production npx knex migrate:latest

# 6. 整合性最終確認
sqlite3 backend/itsm.db "PRAGMA integrity_check;"
```

### 4.4 方法D: 初期状態からの再構築（最終手段）

バックアップもなく、ダンプも不可能な場合の最終手段です。

```bash
# 1. 破損DBを退避
mv backend/itsm.db backend/itsm.db.destroyed_$(date +%Y%m%d)
rm -f backend/itsm.db-wal backend/itsm.db-shm

# 2. マイグレーションで新規DB作成
NODE_ENV=production npx knex migrate:latest

# 3. シードデータ投入（必要な場合）
NODE_ENV=production npx knex seed:run 2>/dev/null || echo "シードデータなし"

# 注意: ユーザーデータ、インシデント履歴等は全て失われます
echo "警告: この方法ではデータは復旧できません"
```

---

## 5. 復旧後の確認

### 5.1 データ整合性検証

```bash
# 整合性チェック
sqlite3 backend/itsm.db "PRAGMA integrity_check;"

# 主要テーブルの行数確認（バックアップ前の件数と比較）
sqlite3 backend/itsm.db "
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'incidents', COUNT(*) FROM incidents
UNION ALL SELECT 'changes', COUNT(*) FROM changes
UNION ALL SELECT 'assets', COUNT(*) FROM assets;
"

# 外部キー制約の検証
sqlite3 backend/itsm.db "PRAGMA foreign_key_check;"
```

### 5.2 サービス再起動と動作確認

```bash
# サービス起動
sudo systemctl start itsm-system 2>/dev/null || \
  (NODE_ENV=production nohup node backend/server.js > /var/log/itsm/server.log 2>&1 &)

# ヘルスチェック
sleep 5
curl -sk https://localhost:6443/api/v1/health

# ログイン確認
curl -sk -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```

---

## 6. エスカレーション

| 状況 | エスカレーション先 |
|------|-------------------|
| 方法A（WALチェックポイント）で復旧 | ログ記録のみ |
| 方法B（ダンプ＆リストア）で復旧 | プロジェクトリーダーへ報告 |
| 方法C（バックアップ復旧）が必要 | プロジェクトリーダー + データ欠損評価 |
| 方法D（再構築）が必要 | 全チーム + 経営判断 |

---

## 7. 事後対応

### 7.1 ポストモーテム

GitHub Issue で以下を記録:

1. 破損が発生した日時と検知方法
2. 破損の種類と範囲
3. 使用した復旧方法
4. データの欠損有無と範囲
5. 根本原因（ディスク障害、プロセスクラッシュ、停電等）

### 7.2 再発防止

- [ ] バックアップスクリプトの頻度を見直し
- [ ] UPS（無停電電源装置）の導入検討
- [ ] WAL チェックポイントの定期実行設定
- [ ] DB 整合性チェックの自動化
- [ ] ディスクの S.M.A.R.T. 監視設定

---

## 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-03-02 | 初版作成 | 運用チーム |
