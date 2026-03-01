# Runbook: サービス停止時対応

## 概要

ITSM-Sec Nexus サービスが完全停止または応答不能になった場合の対応手順書です。
Node.js + Express サーバー（ポート 6443/HTTPS, 8080/HTTP）の停止を想定しています。

---

## 1. 検知方法

### 1.1 ヘルスチェックによる検知

```bash
# HTTPSエンドポイント（本番）
curl -sk https://localhost:6443/api/v1/health --max-time 5
# 期待: {"status":"ok"} (200)

# HTTPエンドポイント（開発・デバッグ用）
curl -s http://localhost:8080/api/v1/health --max-time 5
```

### 1.2 プロセス確認

```bash
# Node.jsプロセスの確認
ps aux | grep "node backend/server.js" | grep -v grep

# ポート使用状況
lsof -i :6443
lsof -i :8080
```

### 1.3 アラート条件

| 条件 | 重大度 | アクション |
|------|--------|-----------|
| ヘルスチェック3回連続失敗 | 警告 | 調査開始 |
| ヘルスチェック5回連続失敗 | 重大 | 即時対応 |
| プロセス消失 | 緊急 | 即時復旧 |

---

## 2. 初動対応（5分以内）

### 2.1 状況確認

```bash
# 1. プロセス状態を確認
ps aux | grep "node backend/server.js" | grep -v grep

# 2. systemdサービス状態（systemd管理の場合）
sudo systemctl status itsm-system

# 3. ポートの使用状況
ss -tlnp | grep -E "6443|8080"

# 4. ディスク容量確認
df -h

# 5. メモリ使用状況
free -h

# 6. 最新ログ確認
tail -100 /var/log/itsm/server.log 2>/dev/null
journalctl -u itsm-system --since "10 minutes ago" --no-pager 2>/dev/null
```

### 2.2 即時復旧（プロセス再起動）

```bash
# systemd管理の場合
sudo systemctl restart itsm-system
sudo systemctl status itsm-system

# 手動管理の場合
# 既存プロセスを確実に停止
kill $(lsof -t -i:6443) 2>/dev/null || true
kill $(lsof -t -i:8080) 2>/dev/null || true

# 環境変数を設定して起動
cd /mnt/LinuxHDD/ITSM-System
export NODE_ENV=production
export JWT_SECRET="<設定済みのJWT_SECRET>"
export ADMIN_PASSWORD="<設定済みのパスワード>"
nohup node backend/server.js > /var/log/itsm/server.log 2>&1 &

# 起動確認（5秒待機後）
sleep 5
curl -sk https://localhost:6443/api/v1/health
```

---

## 3. 原因調査

### 3.1 一般的な停止原因と対処

| 原因 | 確認方法 | 対処 |
|------|---------|------|
| OOMKill（メモリ不足） | `dmesg \| grep -i oom` | メモリ増設、プロセス最適化 |
| ディスク容量不足 | `df -h` | 不要ファイル削除、ログローテーション |
| ポート競合 | `ss -tlnp \| grep 6443` | 競合プロセスを停止 |
| SSL証明書期限切れ | ログに TLS エラー | 証明書更新、ENABLE_HTTPS=false で一時復旧 |
| DBロック | `fuser backend/itsm.db` | ロック保持プロセスを特定・終了 |
| 未処理例外 | アプリケーションログ確認 | コード修正、ロールバック |

### 3.2 SQLiteデータベース確認

```bash
# DBファイルの存在とサイズ確認
ls -la backend/itsm.db

# DB整合性チェック
sqlite3 backend/itsm.db "PRAGMA integrity_check;"

# WALファイル確認
ls -la backend/itsm.db-wal backend/itsm.db-shm 2>/dev/null
```

### 3.3 Node.jsプロセスのデバッグ

```bash
# コアダンプ確認
ls -la /tmp/core.* 2>/dev/null

# Node.jsバージョン確認
node --version

# 依存関係の整合性確認
npm ls --depth=0 2>&1 | grep -i "ERR\|missing\|invalid"
```

---

## 4. 復旧手順

### 4.1 標準復旧手順

```bash
# 1. 既存プロセスの完全停止
pkill -f "node backend/server.js" || true
sleep 2

# 2. 依存関係の再インストール（必要な場合）
cd /mnt/LinuxHDD/ITSM-System
npm ci --omit=dev

# 3. データベースマイグレーション確認
NODE_ENV=production npx knex migrate:status

# 4. サーバー起動
NODE_ENV=production nohup node backend/server.js > /var/log/itsm/server.log 2>&1 &

# 5. 動作確認
sleep 5
curl -sk https://localhost:6443/api/v1/health
echo "復旧確認完了"
```

### 4.2 クリーンスタート（深刻な場合）

```bash
# 1. 完全停止
pkill -f "node backend/server.js" || true

# 2. DBバックアップ
cp backend/itsm.db backend/itsm.db.backup_$(date +%Y%m%d_%H%M%S)

# 3. WALファイルクリア
rm -f backend/itsm.db-wal backend/itsm.db-shm

# 4. node_modules再構築
rm -rf node_modules
npm ci --omit=dev

# 5. マイグレーション再実行
NODE_ENV=production npx knex migrate:latest

# 6. サーバー起動
NODE_ENV=production nohup node backend/server.js > /var/log/itsm/server.log 2>&1 &
```

---

## 5. 確認方法

### 5.1 サービス正常性確認

```bash
# ヘルスチェック
curl -sk https://localhost:6443/api/v1/health

# ログイン確認
curl -sk -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'

# プロセスの安定稼働確認（数分間）
for i in $(seq 1 6); do
  sleep 10
  curl -sk https://localhost:6443/api/v1/health && echo " [$(date +%H:%M:%S)] OK"
done
```

---

## 6. エスカレーション

| 状況 | エスカレーション先 | 判断基準 |
|------|-------------------|---------|
| 再起動で復旧 | ログ記録のみ | - |
| 再起動しても3回以上落ちる | プロジェクトリーダー | 根本原因調査が必要 |
| データ損失の疑い | プロジェクトリーダー + DBA | DB破損 Runbook 参照 |
| 原因不明で復旧不能 | 全チーム | 30分以上停止 |

---

## 7. 事後対応

### 7.1 ポストモーテム作成

以下の項目を記録し、GitHub Issue として作成:

1. **発生日時**: YYYY-MM-DD HH:MM
2. **検知方法**: どのように問題を認知したか
3. **影響範囲**: 影響ユーザー数、停止時間
4. **根本原因**: 調査結果
5. **復旧手順**: 実際に行った手順
6. **再発防止策**: 必要な改善事項
7. **タイムライン**: 発生から復旧までの時系列

### 7.2 改善アクション

- [ ] 監視アラートの閾値見直し
- [ ] 自動復旧スクリプトの導入検討
- [ ] ログローテーション設定の確認
- [ ] リソース（メモリ、ディスク）の増強検討

---

## 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-03-02 | 初版作成 | 運用チーム |
