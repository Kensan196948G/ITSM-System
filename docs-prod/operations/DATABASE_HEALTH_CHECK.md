# データベースヘルスチェック運用手順書

| 項目 | 内容 |
|------|------|
| **ドキュメントID** | OP-DBH-CHK-001 |
| **対象システム** | ITSM-Sec Nexus |
| **対象コンポーネント** | SQLite データベース (itsm_nexus.db) |
| **作成日** | 2026-02-15 |
| **最終更新日** | 2026-02-15 |
| **バージョン** | 1.0 |
| **承認者** | システム管理責任者 |
| **分類** | 運用手順書 |

---

## 目次

1. [概要](#1-概要)
2. [アーキテクチャと処理フロー](#2-アーキテクチャと処理フロー)
3. [PRAGMA integrity_check の仕組み](#3-pragma-integrity_check-の仕組み)
4. [自動チェック（スケジュール実行）](#4-自動チェックスケジュール実行)
5. [手動チェック（WebUI / CLI）](#5-手動チェックwebui--cli)
6. [アラートメール設定](#6-アラートメール設定)
7. [レスポンス形式とステータス](#7-レスポンス形式とステータス)
8. [エラーレスポンスフローと対応](#8-エラーレスポンスフローと対応)
9. [ヘルスチェックエンドポイント一覧](#9-ヘルスチェックエンドポイント一覧)
10. [ログの確認方法](#10-ログの確認方法)
11. [トラブルシューティング](#11-トラブルシューティング)
12. [FAQ](#12-faq)
13. [予防保守](#13-予防保守)
14. [チェックリスト](#14-チェックリスト)
15. [関連ドキュメント](#15-関連ドキュメント)
16. [改訂履歴](#16-改訂履歴)

---

## 1. 概要

### 1.1 本ドキュメントの目的

本ドキュメントは、ITSM-Sec Nexus が使用する SQLite データベースの整合性チェック機能について、設定手順、動作仕様、障害対応手順を記述します。

### 1.2 対象読者

- システム管理者
- 運用担当者
- インフラ担当者

### 1.3 機能概要

データベースヘルスチェック機能は、SQLite の `PRAGMA integrity_check` を利用してデータベースファイルの整合性を検証します。以下の 2 つの実行方法を提供します。

| 実行方法 | エンドポイント/設定 | スケジュール |
|----------|-------------------|-------------|
| **自動チェック** | schedulerService (node-cron) | 毎日 03:00 (デフォルト) |
| **手動チェック** | `GET /api/v1/backups/health/integrity` | オンデマンド |

### 1.4 前提条件

- sqlite3 コマンドがサーバーにインストールされていること
- Node.js プロセスがデータベースファイルへの読み取り権限を持つこと
- 手動チェック API の利用には admin ロールの JWT トークンが必要

```bash
# sqlite3 のインストール確認
which sqlite3
sqlite3 --version

# インストールされていない場合
# Ubuntu/Debian
sudo apt-get install sqlite3

# CentOS/RHEL
sudo yum install sqlite
```

---

## 2. アーキテクチャと処理フロー

### 2.1 コンポーネント構成

```
+-------------------+     +---------------------+     +--------------------+
| schedulerService  |---->| dbHealthService      |---->| backupService      |
| (cron: 03:00)     |     | checkDatabaseInteg() |     | runIntegrityCheck()|
+-------------------+     +---------------------+     +--------------------+
                                  |                            |
                                  |                            v
                                  |                    +----------------+
                                  |                    | sqlite3 process|
                                  |                    | PRAGMA         |
                                  |                    | integrity_check|
                                  |                    +----------------+
                                  |
                                  v
+-------------------+     +---------------------+
| routes/backups.js |---->| emailService         |
| GET /health/      |     | sendEmail()          |
| integrity         |     | (失敗時アラート)      |
+-------------------+     +---------------------+
```

### 2.2 処理フロー

```
整合性チェック開始
    |
    v
dbHealthService.checkDatabaseIntegrity()
    |
    +-- DATABASE_PATH 環境変数からDBパスを取得
    |   (未設定の場合: backend/itsm_nexus.db)
    |
    v
backupService.runIntegrityCheck(dbPath)
    |
    +-- sqlite3 子プロセスを起動
    |   コマンド: sqlite3 <dbPath> "PRAGMA integrity_check;"
    |
    v
sqlite3 実行結果を解析
    |
    +-- 出力が "ok" --> status: "ok" を返却
    |
    +-- 出力が "ok" 以外 --> status: "failed"
    |       |
    |       +-- DB_HEALTH_ALERT_EMAIL が設定されている場合
    |       |       |
    |       |       v
    |       |   emailService.sendEmail() でアラート送信
    |       |       |
    |       |       +-- 送信成功: ログ記録
    |       |       +-- 送信失敗: エラーログ記録（チェック結果には影響しない）
    |       |
    |       +-- DB_HEALTH_ALERT_EMAIL が未設定
    |               --> アラートなしで結果返却
    |
    +-- sqlite3 プロセスエラー --> status: "error"
        (sqlite3未インストール、権限不足など)
```

### 2.3 ソースコードの対応関係

| ファイル | 関数/エンドポイント | 行番号 | 役割 |
|---------|-------------------|--------|------|
| `backend/services/dbHealthService.js` | `checkDatabaseIntegrity()` | 15-65 | メインロジック |
| `backend/services/backupService.js` | `runIntegrityCheck()` | 377-403 | sqlite3 プロセス実行 |
| `backend/services/schedulerService.js` | `initializeScheduler()` 内 | 514-533 | cron ジョブ登録 |
| `backend/routes/backups.js` | `GET /health/integrity` | 555-564 | REST API エンドポイント |
| `backend/services/emailService.js` | `sendEmail()` | 96-132 | アラートメール送信 |

---

## 3. PRAGMA integrity_check の仕組み

### 3.1 SQLite PRAGMA integrity_check とは

`PRAGMA integrity_check` は SQLite が提供するデータベース整合性検証コマンドです。以下の項目をチェックします。

| チェック項目 | 説明 |
|-------------|------|
| **B-tree 構造** | テーブルとインデックスの B-tree ページが正しくリンクされているか |
| **レコード形式** | 各レコードのヘッダーとデータが正しい形式であるか |
| **インデックス整合性** | インデックスがテーブルデータと一致しているか |
| **ページアロケーション** | フリーリストとデータページの割り当てが重複していないか |
| **外部キー制約** | 外部キー参照が有効か（有効化されている場合） |

### 3.2 実行方法（システム内部）

ITSM-Sec Nexus では、sqlite3 コマンドラインツールを子プロセスとして起動して実行します。

```javascript
// backupService.js:377-403 の実装概要
const child = spawn('sqlite3', [dbFilePath, 'PRAGMA integrity_check;']);
```

**実行の流れ:**

1. `spawn()` で sqlite3 プロセスを起動
2. 標準出力 (stdout) と標準エラー出力 (stderr) を収集
3. プロセス終了コードを確認
   - 終了コード 0: 正常終了 → 出力が `"ok"` であれば `true` を返却
   - 終了コード 非0: 異常終了 → エラーを throw
4. プロセス起動自体に失敗した場合 → エラーを throw

### 3.3 正常時の出力

```
ok
```

整合性に問題がない場合、sqlite3 は `ok` のみを出力します。

### 3.4 異常時の出力例

```
*** in database main ***
Page 25: btreeInitPage() returns error code 11
Page 25 is never used
```

問題が検出された場合、具体的なエラー内容が 1 行ずつ出力されます。

### 3.5 処理時間の目安

| データベースサイズ | 処理時間（目安） |
|-------------------|----------------|
| 10 MB 未満 | 1 秒未満 |
| 10 - 100 MB | 1 - 5 秒 |
| 100 MB - 1 GB | 5 - 30 秒 |
| 1 GB 以上 | 30 秒以上 |

> **注意**: 整合性チェック中はデータベースに対して読み取りロックが発生します。
> 大規模なデータベースでは、低負荷時間帯（深夜 03:00 がデフォルト）に実行することを推奨します。

---

## 4. 自動チェック（スケジュール実行）

### 4.1 デフォルト設定

自動チェックは `schedulerService.js` の `initializeScheduler()` で登録されます。

| 項目 | デフォルト値 | 環境変数 |
|------|------------|---------|
| **実行スケジュール** | 毎日 03:00 | `DB_INTEGRITY_CHECK_CRON` |
| **タイムゾーン** | Asia/Tokyo | `TZ` |
| **スケジューラ有効/無効** | 有効 | `SCHEDULER_ENABLED` |

### 4.2 環境変数の設定

`.env` ファイルに以下を追加します。

```bash
# データベース整合性チェックのcronスケジュール（デフォルト: 毎日 03:00）
DB_INTEGRITY_CHECK_CRON=0 3 * * *

# タイムゾーン（デフォルト: Asia/Tokyo）
TZ=Asia/Tokyo

# スケジューラ全体の有効/無効（デフォルト: true）
SCHEDULER_ENABLED=true

# チェック対象のデータベースパス（デフォルト: backend/itsm_nexus.db）
DATABASE_PATH=/path/to/your/itsm_nexus.db

# 整合性チェック失敗時のアラートメール送信先
DB_HEALTH_ALERT_EMAIL=admin@example.com
```

### 4.3 cron 式の書式

```
* * * * *
| | | | |
| | | | +-- 曜日 (0-7, 0と7は日曜)
| | | +---- 月 (1-12)
| | +------ 日 (1-31)
| +-------- 時 (0-23)
+---------- 分 (0-59)
```

### 4.4 スケジュール設定例

| ユースケース | cron 式 | 説明 |
|-------------|---------|------|
| 毎日 03:00 (デフォルト) | `0 3 * * *` | 低負荷時間帯での日次チェック |
| 毎日 01:00 | `0 1 * * *` | バックアップ後のチェック |
| 6 時間ごと | `0 */6 * * *` | 高頻度チェック（ミッションクリティカル環境） |
| 毎週日曜 04:00 | `0 4 * * 0` | 週次チェック（低負荷環境） |
| 毎月 1 日 05:00 | `0 5 1 * *` | 月次チェック |

### 4.5 自動チェックのログ出力

正常時:
```
[Scheduler] Starting daily database integrity check
[DB Health] Integrity check passed
[Scheduler] Database integrity check result: { status: 'ok', details: 'Database integrity verified', timestamp: '2026-02-15T03:00:01.234Z' }
```

異常時:
```
[Scheduler] Starting daily database integrity check
[DB Health] Integrity check failed
[DB Health] Alert email sent to admin@example.com
[Scheduler] Database integrity check result: { status: 'failed', details: 'Integrity check failed', timestamp: '2026-02-15T03:00:01.567Z' }
```

エラー時（sqlite3 未インストールなど）:
```
[Scheduler] Starting daily database integrity check
[DB Health] Integrity check error: Error: Failed to run integrity check: spawn sqlite3 ENOENT
[Scheduler] Database integrity check result: { status: 'error', details: 'Failed to run integrity check: spawn sqlite3 ENOENT', timestamp: '...' }
```

### 4.6 他のスケジュールジョブとの関係

schedulerService には複数のジョブが登録されています。整合性チェックとの時間的な関係を把握してください。

| ジョブ | スケジュール | 環境変数 |
|--------|------------|---------|
| メトリクス取得 | 5 分ごと | `METRICS_SNAPSHOT_CRON` |
| アラート評価 | 1 分ごと | `ALERT_EVALUATION_CRON` |
| 古いメトリクス削除 | 毎日 01:00 | `METRICS_CLEANUP_CRON` |
| 日次バックアップ | 毎日 02:00 | `BACKUP_DAILY_CRON` |
| **DB整合性チェック** | **毎日 03:00** | **`DB_INTEGRITY_CHECK_CRON`** |
| 週次バックアップ | 毎週日曜 03:00 | `BACKUP_WEEKLY_CRON` |
| バックアップ整合性 | 毎週土曜 01:00 | `BACKUP_INTEGRITY_CHECK_CRON` |

> **推奨**: 日次バックアップ (02:00) の完了後に DB 整合性チェック (03:00) を実行する構成となっています。
> バックアップスケジュールを変更する場合は、整合性チェックも合わせて調整してください。

---

## 5. 手動チェック（WebUI / CLI）

### 5.1 WebUI 経由での実行

バックアップ管理画面から整合性チェックを実行できます（将来実装予定）。

| 項目 | 内容 |
|------|------|
| **画面** | 管理メニュー > バックアップ管理 |
| **操作** | 「整合性チェック」ボタンをクリック |
| **必要権限** | admin ロール |
| **結果表示** | 画面上にステータス (ok / failed / error) とタイムスタンプを表示 |

> **注意**: WebUI からの整合性チェック機能は現在実装予定段階です。
> 現時点では以下の CLI（API）経由での実行をご利用ください。

### 5.2 CLI 経由での実行（API エンドポイント）

#### エンドポイント仕様

| 項目 | 値 |
|------|---|
| **メソッド** | GET |
| **パス** | `/api/v1/backups/health/integrity` |
| **認証** | JWT トークン必須 |
| **必要ロール** | admin |
| **レートリミット** | なし（管理者判断で実行） |

### 5.3 リクエスト例

#### curl を使用する場合

```bash
# JWT トークンを取得
TOKEN=$(curl -s -k https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "YOUR_PASSWORD"}' \
  | jq -r '.token')

# 整合性チェックを実行
curl -s -k https://localhost:6443/api/v1/backups/health/integrity \
  -H "Authorization: Bearer ${TOKEN}" \
  | jq .
```

#### HTTPie を使用する場合

```bash
# JWT トークンを取得
TOKEN=$(http --verify=no POST https://localhost:6443/api/v1/auth/login \
  username=admin password=YOUR_PASSWORD \
  | jq -r '.token')

# 整合性チェックを実行
http --verify=no GET https://localhost:6443/api/v1/backups/health/integrity \
  "Authorization: Bearer ${TOKEN}"
```

### 5.4 レスポンス例

**正常時 (HTTP 200):**

```json
{
  "status": "ok",
  "details": "Database integrity verified",
  "timestamp": "2026-02-15T10:30:45.123Z"
}
```

**異常時 (HTTP 200 -- チェック失敗):**

```json
{
  "status": "failed",
  "details": "Integrity check failed",
  "timestamp": "2026-02-15T10:30:45.456Z"
}
```

**エラー時 (HTTP 200 -- 実行エラー):**

```json
{
  "status": "error",
  "details": "Failed to run integrity check: spawn sqlite3 ENOENT",
  "timestamp": "2026-02-15T10:30:45.789Z"
}
```

> **注意**: 現在の実装では、チェック結果に関わらず HTTP 200 が返却されます。
> `status` フィールドの値で結果を判断してください。

### 5.5 手動チェックを実行すべき場面

| 場面 | 説明 |
|------|------|
| サーバー異常停止後 | 突然のシャットダウンや電源断後にデータ破損がないか確認 |
| リストア実行後 | バックアップからのリストア後にデータ整合性を確認 |
| マイグレーション実行後 | DBスキーマ変更後の整合性確認 |
| ディスク障害復旧後 | ストレージ障害からの復旧後の確認 |
| 定期メンテナンス時 | 計画メンテナンスの事前/事後チェック |

---

## 6. アラートメール設定

### 6.1 環境変数

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| `DB_HEALTH_ALERT_EMAIL` | アラート送信先メールアドレス | 未設定（アラート無効） |
| `SMTP_HOST` | SMTP サーバーホスト | localhost |
| `SMTP_PORT` | SMTP サーバーポート | 587 |
| `SMTP_SECURE` | SSL/TLS 使用 | false |
| `SMTP_USER` | SMTP 認証ユーザー | 未設定 |
| `SMTP_PASSWORD` | SMTP 認証パスワード | 未設定 |
| `SMTP_FROM` | 送信元アドレス | `ITSM-Sec Nexus <noreply@itsm.local>` |

### 6.2 設定手順

#### 手順 1: SMTP 設定

`.env` ファイルに SMTP 情報を設定します（BACKUP_ALERTS.md の SMTP 設定と共通）。

```bash
# Gmail SMTP の例
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=ITSM-Sec Nexus <your-account@gmail.com>
```

#### 手順 2: アラートメール送信先の設定

```bash
# 単一のメールアドレス
DB_HEALTH_ALERT_EMAIL=admin@example.com
```

> **注意**: 現在の実装では `DB_HEALTH_ALERT_EMAIL` は単一のメールアドレスのみ対応しています。
> 複数宛先が必要な場合は、メーリングリストや配信グループを使用してください。

#### 手順 3: 設定の反映

```bash
# アプリケーションを再起動
sudo systemctl restart itsm-nexus

# または PM2 の場合
pm2 restart itsm-nexus
```

### 6.3 アラートメールの内容

整合性チェックが失敗した場合（`status: "failed"`）に送信されるメールの内容:

| 項目 | 値 |
|------|---|
| **件名** | `【緊急】データベース整合性チェック失敗` |
| **送信元** | SMTP_FROM の設定値 |
| **送信先** | DB_HEALTH_ALERT_EMAIL の設定値 |

**メール本文:**

```
データベースの整合性チェックが失敗しました。

発生時刻: 2026-02-15T03:00:01.234Z
DBパス: /path/to/itsm_nexus.db

速やかにデータベースのバックアップとリストアを検討してください。
```

### 6.4 アラートが送信されるケースと送信されないケース

| ケース | アラート送信 | 理由 |
|--------|------------|------|
| チェック成功 (ok) | 送信しない | 正常のため |
| チェック失敗 (failed) + EMAIL 設定あり | **送信する** | 整合性問題検出 |
| チェック失敗 (failed) + EMAIL 設定なし | 送信しない | 送信先未設定 |
| 実行エラー (error) | 送信しない | チェック自体が実行できなかったため |
| チェック失敗 + メール送信失敗 | 送信試行するが失敗 | SMTP エラー等 |

### 6.5 メール送信の独立性

アラートメール送信は try-catch で隔離されています。メール送信が失敗しても、整合性チェック結果には影響しません。

```
dbHealthService.js:34-49 の実装:

if (alertEmail) {
  try {
    await sendEmail({ ... });      // メール送信試行
    logger.info('Alert email sent');  // 成功ログ
  } catch (emailError) {
    logger.error('Failed to send alert email');  // 失敗ログ（結果に影響なし）
  }
}
```

---

## 7. レスポンス形式とステータス

### 7.1 レスポンス構造

`checkDatabaseIntegrity()` は常に以下の形式のオブジェクトを返却します。

```typescript
{
  status: "ok" | "failed" | "error",
  details: string,
  timestamp: string  // ISO 8601 形式
}
```

### 7.2 ステータス値の定義

| status | 意味 | details の内容 | アクション |
|--------|------|---------------|-----------|
| `ok` | 整合性チェック成功 | `"Database integrity verified"` | 対応不要 |
| `failed` | 整合性チェック失敗 | `"Integrity check failed"` | **即時対応が必要** |
| `error` | チェック実行エラー | エラーメッセージ | 環境を確認 |

### 7.3 各ステータスのフローチャート

```
checkDatabaseIntegrity() 呼び出し
    |
    +-- runIntegrityCheck() 成功
    |       |
    |       +-- 結果 true  --> { status: "ok" }
    |       |
    |       +-- 結果 false --> { status: "failed" }
    |                              + アラートメール送信（設定時）
    |
    +-- runIntegrityCheck() 例外
            |
            +-- { status: "error", details: error.message }
```

---

## 8. エラーレスポンスフローと対応

### 8.1 status: "ok" の場合

```
結果: データベースは正常
対応: 不要
ログ: [DB Health] Integrity check passed
```

### 8.2 status: "failed" の場合

データベースの整合性に問題が検出されました。**即時対応が必要です。**

#### 対応手順

```
1. アプリケーションの状態を確認
   - 現在のリクエスト処理に影響はないか
   - エラーログに関連するエラーが出ていないか

2. データベースのバックアップを取得
   $ cp /path/to/itsm_nexus.db /path/to/itsm_nexus.db.emergency_$(date +%Y%m%d_%H%M%S)

3. 手動で PRAGMA integrity_check を実行して詳細を確認
   $ sqlite3 /path/to/itsm_nexus.db "PRAGMA integrity_check;"

4. 破損の程度を評価
   - 軽度: 特定のインデックスのみ破損
     --> REINDEX コマンドで修復を試行
   - 中度: 特定テーブルのページ破損
     --> .dump + .read で再構築を検討
   - 重度: 複数テーブル/ページの破損
     --> バックアップからのリストアを実行

5. 修復アクション
   -- 軽度の場合: インデックス再構築
   $ sqlite3 /path/to/itsm_nexus.db "REINDEX;"

   -- 中度の場合: データベース再構築
   $ sqlite3 /path/to/itsm_nexus.db ".dump" > dump.sql
   $ sqlite3 /path/to/itsm_nexus_new.db < dump.sql
   $ mv /path/to/itsm_nexus_new.db /path/to/itsm_nexus.db

   -- 重度の場合: バックアップリストア
   --> BACKUP_RESTORE_PROCEDURES.md を参照

6. 修復後、再度整合性チェックを実行して結果を確認
   $ curl -s -k https://localhost:6443/api/v1/backups/health/integrity \
     -H "Authorization: Bearer ${TOKEN}" | jq .
```

### 8.3 status: "error" の場合

チェック自体の実行に失敗しました。環境の問題を調査します。

#### よくあるエラーと対応

| エラーメッセージ | 原因 | 対応 |
|----------------|------|------|
| `spawn sqlite3 ENOENT` | sqlite3 がインストールされていない | `apt install sqlite3` を実行 |
| `Failed to run integrity check: spawn sqlite3 ENOENT` | sqlite3 が PATH に含まれていない | `which sqlite3` で確認、シンボリックリンクを作成 |
| `Integrity check process failed: Error: database is locked` | 他のプロセスがDBをロック中 | ロックしているプロセスを特定して終了を待つ |
| `Integrity check process failed: Error: unable to open database file` | DBファイルが見つからない | `DATABASE_PATH` 環境変数を確認 |
| `EACCES: permission denied` | 権限不足 | DBファイルの読み取り権限を確認 |

---

## 9. ヘルスチェックエンドポイント一覧

ITSM-Sec Nexus は整合性チェック以外にも複数のヘルスチェックエンドポイントを提供しています。

### 9.1 エンドポイント一覧

| エンドポイント | 認証 | 用途 | レスポンス |
|---------------|------|------|-----------|
| `GET /health` | 不要 | 基本ヘルスチェック | `{ status, timestamp, version }` |
| `GET /health/live` | 不要 | ライブネスプローブ | `{ status: "UP" }` |
| `GET /health/ready` | 不要 | レディネスプローブ | DB/ディスク/メモリチェック |
| `GET /health/detailed` | 不要 | 詳細ヘルスチェック | DB/ディスク/メモリ/キャッシュ/スケジューラ |
| `GET /health/auto-fix` | 不要 | 自動修復ステータス | 自動修復サービスの状態 |
| `GET /api/v1/backups/health/integrity` | **admin** | **DB整合性チェック** | **PRAGMA integrity_check 結果** |

### 9.2 使い分けガイド

| シナリオ | 使用するエンドポイント |
|---------|---------------------|
| ロードバランサーのヘルスチェック | `/health/live` |
| Kubernetes Liveness Probe | `/health/live` |
| Kubernetes Readiness Probe | `/health/ready` |
| 監視ダッシュボード | `/health/detailed` |
| 定期的なDB整合性検証 | `/api/v1/backups/health/integrity` |
| インシデント調査時 | `/health/detailed` + `/api/v1/backups/health/integrity` |

### 9.3 レディネスプローブのチェック項目

`GET /health/ready` はデータベース接続性を含むシステム全体の健全性を確認します。整合性チェック (`PRAGMA integrity_check`) とは異なり、`SELECT 1` による接続確認のみを行います。

| チェック項目 | 閾値 | DOWN 判定 |
|-------------|------|----------|
| データベース接続 | `SELECT 1` 成功 | クエリ失敗時 |
| ディスク空き容量 | 10% 以上 | 10% 未満 |
| メモリ使用率 | 90% 未満 | 90% 以上 |

---

## 10. ログの確認方法

### 10.1 ログファイルの場所

整合性チェックのログは、アプリケーションの統合ログファイルに出力されます。

| ログファイル | パス | 内容 |
|-------------|------|------|
| **統合ログ** | `backend/logs/combined.log` | 全レベルのログ（info, warn, error） |
| **エラーログ** | `backend/logs/error.log` | error レベルのみ |

### 10.2 ログフォーマット

ログは JSON 形式で出力されます。整合性チェック関連のログには `[DB Health]` または `[Scheduler]` プレフィックスが付与されます。

```json
{
  "level": "info",
  "message": "[DB Health] Integrity check passed",
  "timestamp": "2026-02-15T03:00:01.234Z"
}
```

### 10.3 成功時のログサンプル

```
[2026-02-15T03:00:00.100Z] info: [Scheduler] Starting daily database integrity check
[2026-02-15T03:00:01.234Z] info: [DB Health] Integrity check passed
[2026-02-15T03:00:01.235Z] info: [Scheduler] Database integrity check result: {"status":"ok","details":"Database integrity verified","timestamp":"2026-02-15T03:00:01.234Z"}
```

### 10.4 失敗時のログサンプル（アラートメールあり）

```
[2026-02-15T03:00:00.100Z] info: [Scheduler] Starting daily database integrity check
[2026-02-15T03:00:01.567Z] error: [DB Health] Integrity check failed
[2026-02-15T03:00:02.890Z] info: [DB Health] Alert email sent to admin@example.com
[2026-02-15T03:00:02.891Z] info: [Scheduler] Database integrity check result: {"status":"failed","details":"Integrity check failed","timestamp":"2026-02-15T03:00:01.567Z"}
```

### 10.5 エラー時のログサンプル（sqlite3 未検出）

```
[2026-02-15T03:00:00.100Z] info: [Scheduler] Starting daily database integrity check
[2026-02-15T03:00:00.150Z] error: [DB Health] Integrity check error: Error: Failed to run integrity check: spawn sqlite3 ENOENT
[2026-02-15T03:00:00.151Z] info: [Scheduler] Database integrity check result: {"status":"error","details":"Failed to run integrity check: spawn sqlite3 ENOENT","timestamp":"..."}
```

### 10.6 ログの検索コマンド

```bash
# 整合性チェック関連のログを抽出
grep "DB Health" backend/logs/combined.log

# 失敗のみ抽出
grep "DB Health.*failed\|DB Health.*error" backend/logs/combined.log

# 直近24時間のチェック結果を確認
grep "DB Health" backend/logs/combined.log | grep "$(date -d '1 day ago' +%Y-%m-%d)"

# スケジューラ起動時の登録確認
grep "Database integrity check scheduled" backend/logs/combined.log

# アラートメール送信ログ
grep "DB Health.*Alert email" backend/logs/combined.log

# tail -f でリアルタイム監視
tail -f backend/logs/combined.log | grep "DB Health"
```

### 10.7 ログローテーション

ログファイルが肥大化した場合は、logrotate を設定してください。

```bash
# /etc/logrotate.d/itsm-nexus
/path/to/backend/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## 11. トラブルシューティング

### 11.1 自動チェックが実行されない

**症状**: ログに `[Scheduler] Starting daily database integrity check` が記録されない。

**確認手順:**

```bash
# 1. スケジューラが有効か確認
grep SCHEDULER_ENABLED .env
# SCHEDULER_ENABLED=false の場合は無効化されている

# 2. cron 式が有効か確認
# 無効な cron 式の場合、ジョブは登録されない
grep DB_INTEGRITY_CHECK_CRON .env

# 3. スケジューラ初期化ログを確認
grep -i "Database integrity check scheduled" /path/to/app.log

# 4. アプリケーションが再起動されたか確認
# 環境変数変更後は再起動が必要
pm2 show itsm-nexus | grep "uptime"
```

**対処:**

```bash
# スケジューラを有効化
echo "SCHEDULER_ENABLED=true" >> .env

# アプリケーションを再起動
pm2 restart itsm-nexus
```

### 11.2 sqlite3 コマンドが見つからない

**症状**: `status: "error"`, `details: "Failed to run integrity check: spawn sqlite3 ENOENT"`

**確認手順:**

```bash
# sqlite3 のインストール確認
which sqlite3

# パスの確認
echo $PATH

# Node.js プロセスの PATH 確認
node -e "console.log(process.env.PATH)"
```

**対処:**

```bash
# Ubuntu/Debian
sudo apt-get install sqlite3

# CentOS/RHEL
sudo yum install sqlite

# インストール後の確認
sqlite3 --version
```

### 11.3 データベースファイルが見つからない

**症状**: `status: "error"`, `details` に `unable to open database file` を含む。

**確認手順:**

```bash
# 環境変数を確認
grep DATABASE_PATH .env

# デフォルトパスにファイルが存在するか確認
ls -la backend/itsm_nexus.db

# ファイルの権限を確認
stat backend/itsm_nexus.db
```

**対処:**

```bash
# DATABASE_PATH を正しく設定
echo "DATABASE_PATH=/absolute/path/to/itsm_nexus.db" >> .env

# アプリケーションを再起動
pm2 restart itsm-nexus
```

### 11.4 データベースロックエラー

**症状**: `status: "error"`, `details` に `database is locked` を含む。

**確認手順:**

```bash
# データベースファイルのロック状態を確認
fuser backend/itsm_nexus.db

# WAL (Write-Ahead Log) ファイルの確認
ls -la backend/itsm_nexus.db*
# itsm_nexus.db-wal が大きい場合、書き込みトランザクションが進行中

# 接続中のプロセスを確認
lsof backend/itsm_nexus.db
```

**対処:**

```bash
# 通常はロックが解放されるまで待機（最大30秒）
# それでも解放されない場合:

# 1. 該当プロセスの特定
lsof backend/itsm_nexus.db

# 2. WAL チェックポイントを強制実行
sqlite3 backend/itsm_nexus.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 3. 最終手段: アプリケーションの再起動
pm2 restart itsm-nexus
```

### 11.5 アラートメールが届かない

**症状**: チェック失敗のログはあるが、メールが届かない。

**確認手順:**

```bash
# 1. DB_HEALTH_ALERT_EMAIL が設定されているか確認
grep DB_HEALTH_ALERT_EMAIL .env

# 2. SMTP 設定が正しいか確認
grep SMTP .env

# 3. メール送信エラーログを確認
grep "Failed to send alert email" /path/to/app.log

# 4. SMTP 接続テスト
# テストメール送信API を使用
curl -s -k https://localhost:6443/api/v1/email/test \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**対処:**

```bash
# DB_HEALTH_ALERT_EMAIL を設定
echo "DB_HEALTH_ALERT_EMAIL=admin@example.com" >> .env

# SMTP 設定を確認・修正（BACKUP_ALERTS.md のセクション4を参照）

# アプリケーションを再起動
pm2 restart itsm-nexus
```

### 11.6 整合性チェックに時間がかかりすぎる

**症状**: チェック実行後、レスポンスが返るまで 30 秒以上かかる。

**確認手順:**

```bash
# データベースファイルのサイズを確認
ls -lh backend/itsm_nexus.db

# VACUUM でデータベースを最適化（サイズ削減）
sqlite3 backend/itsm_nexus.db "VACUUM;"

# WAL ファイルのサイズを確認
ls -lh backend/itsm_nexus.db-wal
```

**対処:**

```bash
# 1. VACUUM でデータベースを最適化（低負荷時間帯に実行）
sqlite3 backend/itsm_nexus.db "VACUUM;"

# 2. 自動チェックを低頻度に変更
echo "DB_INTEGRITY_CHECK_CRON=0 3 * * 0" >> .env  # 週1回に変更

# 3. quick_check を使用する場合（将来的な拡張）
# PRAGMA quick_check は integrity_check より高速だが検査範囲が限定的
sqlite3 backend/itsm_nexus.db "PRAGMA quick_check;"
```

---

## 12. FAQ

### Q1: 整合性チェックは自動で実行されますか？

**A**: はい、`schedulerService.js` により自動的に実行されます。デフォルトでは毎日 03:00（Asia/Tokyo タイムゾーン）に実行されます。スケジュールは `DB_INTEGRITY_CHECK_CRON` 環境変数で変更可能です。スケジューラ全体を無効化するには `SCHEDULER_ENABLED=false` を設定してください（セクション4参照）。

### Q2: チェック中にサービスを停止する必要がありますか？

**A**: いいえ、サービスを停止する必要はありません。`PRAGMA integrity_check` は読み取り専用の操作であり、SQLite の WAL (Write-Ahead Logging) モードが有効な場合、読み取りと書き込みは並行して行えるため、通常のサービス運用に影響しません。ただし、データベースサイズが非常に大きい場合（1GB以上）は、I/O 負荷による応答遅延が発生する可能性があるため、低負荷時間帯（デフォルト 03:00）での実行を推奨します。

### Q3: 整合性チェックが失敗した場合、自動でリストアされますか？

**A**: いいえ、自動リストアは行われません。整合性チェック失敗時のアクションは以下の通りです。

1. ログに `[DB Health] Integrity check failed` が記録される
2. `DB_HEALTH_ALERT_EMAIL` が設定されている場合、アラートメールが送信される
3. **リストアは管理者が手動で判断・実行する必要がある**

自動リストアを採用しない理由:
- 破損の程度によって最適な対応（REINDEX / dump再構築 / バックアップリストア）が異なる
- 自動リストアによるデータ損失リスクを回避する
- リストア前に破損原因の調査が必要な場合がある

リストア手順は [BACKUP_RESTORE_PROCEDURES.md](./BACKUP_RESTORE_PROCEDURES.md) を参照してください。

### Q4: 今すぐ手動でチェックするにはどうすればよいですか？

**A**: 以下の 2 つの方法があります。

**方法 1: REST API 経由（推奨）**

```bash
# JWT トークンを取得
TOKEN=$(curl -s -k https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "YOUR_PASSWORD"}' \
  | jq -r '.token')

# 整合性チェックを実行
curl -s -k https://localhost:6443/api/v1/backups/health/integrity \
  -H "Authorization: Bearer ${TOKEN}" | jq .
```

**方法 2: sqlite3 コマンド直接実行**

```bash
sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"
```

詳細はセクション5を参照してください。

### Q5: チェックスケジュールを変更するにはどうすればよいですか？

**A**: `.env` ファイルの `DB_INTEGRITY_CHECK_CRON` を変更し、アプリケーションを再起動してください。

```bash
# 例: 6時間ごとに変更
DB_INTEGRITY_CHECK_CRON=0 */6 * * *

# 例: 週1回（日曜 04:00）に変更
DB_INTEGRITY_CHECK_CRON=0 4 * * 0

# 変更後、アプリケーションを再起動
pm2 restart itsm-nexus
```

cron 式の書式とスケジュール例はセクション4.3、4.4を参照してください。

> **注意**: 日次バックアップ（02:00）との時間的な関係を考慮してスケジュールを設定してください。バックアップ完了後に整合性チェックを実行する構成が推奨です。

### Q6: DB_HEALTH_ALERT_EMAIL と BACKUP_ALERT_EMAIL は何が違いますか？

**A**: 2 つの環境変数は異なる機能のアラートに使用されます。

| 環境変数 | トリガー | 送信元サービス |
|---------|---------|-------------|
| `DB_HEALTH_ALERT_EMAIL` | データベース本体の整合性チェック失敗 | dbHealthService |
| `BACKUP_ALERT_EMAIL` | バックアップ処理（作成/リストア）の失敗 | backupService |

同じメールアドレスを設定しても問題ありません。両方とも `emailService.sendEmail()` を使用するため、SMTP 設定は共通です。

### Q7: status が "error" の場合もアラートメールは送信されますか？

**A**: いいえ、送信されません。アラートメールは `status: "failed"`（整合性チェック自体は実行できたが、問題が検出された場合）のみ送信されます。`status: "error"` は sqlite3 の実行自体に失敗したケース（未インストール、権限不足など）であり、環境の問題として別途対応が必要です。

### Q8: 整合性チェックの結果はどこに保存されますか？

**A**: 現在の実装では、チェック結果はデータベースに永続化されず、アプリケーションログにのみ記録されます。結果を保持したい場合は以下の方法を検討してください。

1. **ログ監視ツール** (Datadog, CloudWatch Logs 等) でログを収集・分析
2. **外部監視** で API エンドポイントを定期的にポーリングし、結果を記録
3. **cron + スクリプト** で API を呼び出し、結果をファイルに保存

```bash
# 例: 結果をファイルに記録するスクリプト
#!/bin/bash
RESULT=$(curl -s -k https://localhost:6443/api/v1/backups/health/integrity \
  -H "Authorization: Bearer ${TOKEN}")
echo "$(date -Iseconds) ${RESULT}" >> /var/log/itsm/db_integrity.log
```

### Q9: 複数のデータベースファイルを同時にチェックできますか？

**A**: 現在の実装では、`DATABASE_PATH` 環境変数で指定された単一のデータベースファイルのみが対象です。複数のデータベースをチェックする場合は、直接 sqlite3 コマンドを実行してください。

```bash
# 手動で複数のDBをチェック
for db in /path/to/db1.db /path/to/db2.db; do
  echo "=== Checking: ${db} ==="
  sqlite3 "${db}" "PRAGMA integrity_check;"
done
```

### Q10: PRAGMA integrity_check と PRAGMA quick_check の違いは何ですか？

**A**:

| 項目 | integrity_check | quick_check |
|------|----------------|-------------|
| **チェック範囲** | 全ページ + インデックス整合性 | ページ構造のみ |
| **処理時間** | 長い（全データスキャン） | 短い（構造チェックのみ） |
| **検出精度** | 高い | 中程度 |
| **用途** | 定期的な完全チェック | 頻繁な簡易チェック |

ITSM-Sec Nexus は `integrity_check`（完全チェック）を使用しています。

---

## 13. 予防保守

### 13.1 推奨確認頻度

| 項目 | 推奨頻度 | 備考 |
|------|---------|------|
| **自動整合性チェック** | 毎日 (デフォルト 03:00) | `DB_INTEGRITY_CHECK_CRON` で設定 |
| **手動整合性チェック** | インシデント発生後・メンテナンス前後 | セクション5.5参照 |
| **データベースサイズ確認** | 週次 | 急激な増加は異常の兆候 |
| **ディスク空き容量確認** | 週次 | `/health/ready` で自動確認（閾値10%） |
| **VACUUM 実行** | 月次 または DB サイズが倍増した時 | 低負荷時間帯に実行 |
| **WAL ファイルサイズ確認** | 週次 | 異常に大きい場合はチェックポイント実行 |
| **sqlite3 バージョン確認** | 四半期 | セキュリティパッチの適用 |
| **バックアップ整合性検証** | 毎週土曜 01:00 (自動) | `BACKUP_INTEGRITY_CHECK_CRON` |

### 13.2 監視すべきメトリクス

以下のメトリクスを定期的に監視し、データベースの健全性を把握してください。

#### データベースファイル関連

```bash
# データベースファイルのサイズ（MB）
du -m backend/itsm_nexus.db

# WAL ファイルのサイズ
ls -lh backend/itsm_nexus.db-wal 2>/dev/null || echo "WAL file not found"

# SHM ファイルの存在確認
ls -lh backend/itsm_nexus.db-shm 2>/dev/null || echo "SHM file not found"

# ページ数とページサイズ
sqlite3 backend/itsm_nexus.db "PRAGMA page_count; PRAGMA page_size;"

# フリーリストのページ数（未使用領域）
sqlite3 backend/itsm_nexus.db "PRAGMA freelist_count;"
```

#### ディスク・システム関連

```bash
# ディスク空き容量
df -h $(dirname backend/itsm_nexus.db)

# I/O 統計（データベースファイルへのアクセス頻度）
iostat -x 1 5

# ファイルロック状態
fuser backend/itsm_nexus.db 2>/dev/null || echo "No locks"
```

#### アプリケーション関連

```bash
# ヘルスチェック結果（レディネス）
curl -s http://localhost:5000/health/ready | jq .

# 詳細ヘルスチェック結果
curl -s http://localhost:5000/health/detailed | jq .
```

### 13.3 長期トレンド分析

以下の指標の長期トレンドを追跡し、問題の予兆を検知してください。

#### トレンド監視項目

| 指標 | 正常範囲 | 注意が必要なトレンド | 対応 |
|------|---------|-------------------|------|
| **DB ファイルサイズ** | 業務量に比例した緩やかな増加 | 急激な増加（前月比 50% 以上） | 不要データの削除、VACUUM 実行 |
| **WAL ファイルサイズ** | 数 MB 以下 | 100MB 以上が継続 | チェックポイント実行、書き込みパターン調査 |
| **フリーリストページ数** | 全ページの 10% 以下 | 30% 以上 | VACUUM 実行 |
| **整合性チェック所要時間** | DB サイズに比例 | 同一サイズで処理時間が増加 | I/O 性能調査、ディスク健全性確認 |
| **チェック失敗頻度** | 0 回 | 1 回でも発生 | 即時対応（セクション8.2参照） |

#### トレンド記録用スクリプト

```bash
#!/bin/bash
# /opt/itsm/scripts/db_metrics.sh
# cron で日次実行: 0 6 * * * /opt/itsm/scripts/db_metrics.sh

METRICS_LOG="/var/log/itsm/db_metrics.csv"
DB_PATH="backend/itsm_nexus.db"
APP_DIR="/opt/itsm/ITSM-System"

cd "${APP_DIR}"

# ヘッダー作成（初回のみ）
if [ ! -f "${METRICS_LOG}" ]; then
  echo "timestamp,db_size_bytes,wal_size_bytes,page_count,freelist_count,disk_free_pct" > "${METRICS_LOG}"
fi

# メトリクス収集
TIMESTAMP=$(date -Iseconds)
DB_SIZE=$(stat -c%s "${DB_PATH}" 2>/dev/null || echo 0)
WAL_SIZE=$(stat -c%s "${DB_PATH}-wal" 2>/dev/null || echo 0)
PAGE_COUNT=$(sqlite3 "${DB_PATH}" "PRAGMA page_count;" 2>/dev/null || echo 0)
FREELIST=$(sqlite3 "${DB_PATH}" "PRAGMA freelist_count;" 2>/dev/null || echo 0)
DISK_FREE=$(df --output=pcent $(dirname "${DB_PATH}") | tail -1 | tr -d ' %')

echo "${TIMESTAMP},${DB_SIZE},${WAL_SIZE},${PAGE_COUNT},${FREELIST},${DISK_FREE}" >> "${METRICS_LOG}"
```

### 13.4 定期メンテナンス作業

#### VACUUM の実行

`VACUUM` はデータベースファイルを再構築し、未使用領域を解放します。

```bash
# 実行前にバックアップを取得
cp backend/itsm_nexus.db backend/itsm_nexus.db.pre_vacuum_$(date +%Y%m%d)

# VACUUM を実行（低負荷時間帯に実行すること）
sqlite3 backend/itsm_nexus.db "VACUUM;"

# 実行後の確認
ls -lh backend/itsm_nexus.db
sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"
```

> **注意**: VACUUM は一時的にデータベースサイズの 2 倍のディスク容量を使用します。
> ディスク空き容量が十分であることを事前に確認してください。

#### WAL チェックポイントの実行

WAL ファイルが大きくなりすぎた場合、手動でチェックポイントを実行します。

```bash
# WAL ファイルサイズの確認
ls -lh backend/itsm_nexus.db-wal

# チェックポイントの実行
sqlite3 backend/itsm_nexus.db "PRAGMA wal_checkpoint(TRUNCATE);"
```

#### インデックスの再構築

パフォーマンスが劣化した場合、インデックスを再構築します。

```bash
# 全インデックスの再構築
sqlite3 backend/itsm_nexus.db "REINDEX;"

# 再構築後の整合性確認
sqlite3 backend/itsm_nexus.db "PRAGMA integrity_check;"
```

---

## 14. チェックリスト

### 14.1 初期セットアップチェックリスト

- [ ] sqlite3 がインストールされていること
- [ ] `DATABASE_PATH` が正しく設定されていること（または未設定でデフォルトパスのDBが存在すること）
- [ ] `DB_INTEGRITY_CHECK_CRON` が適切に設定されていること
- [ ] `DB_HEALTH_ALERT_EMAIL` が設定されていること
- [ ] SMTP 設定が完了していること（BACKUP_ALERTS.md 参照）
- [ ] `SCHEDULER_ENABLED` が `true` であること
- [ ] アプリケーション起動ログに `Database integrity check scheduled` が記録されていること
- [ ] 手動で API を実行して `status: "ok"` が返ることを確認

### 14.2 定期運用チェックリスト（月次）

- [ ] 過去 1 ヶ月の整合性チェックログにエラーがないこと
- [ ] アラートメールの送信テストが成功すること
- [ ] データベースファイルのサイズが異常に増加していないこと
- [ ] ディスク空き容量が十分であること（10% 以上）
- [ ] sqlite3 コマンドのバージョンが最新であること

### 14.3 障害対応チェックリスト

- [ ] `status: "failed"` の場合、手動で `PRAGMA integrity_check` を実行して詳細を確認
- [ ] 緊急バックアップを取得
- [ ] 破損の程度を評価（軽度/中度/重度）
- [ ] 適切な修復アクションを実行
- [ ] 修復後の再チェックで `status: "ok"` を確認
- [ ] インシデント報告を作成
- [ ] 根本原因を調査（ディスク障害、不正シャットダウンなど）

---

## 15. 関連ドキュメント

| ドキュメント | ドキュメントID | 説明 |
|-------------|-------------|------|
| [バックアップリストア運用手順書](./BACKUP_RESTORE_PROCEDURES.md) | OP-BKP-RST-001 | バックアップの作成・リストア・検証手順 |
| [バックアップアラート設定手順書](./BACKUP_ALERTS.md) | OP-BKP-ALT-001 | バックアップ失敗時のアラート設定 |
| [災害復旧手順書](./DISASTER_RECOVERY.md) | OP-DR-001 | 災害発生時の復旧手順（策定予定） |
| ITSM-Sec Nexus API リファレンス | - | Swagger UI (`/api-docs`) |
| SQLite PRAGMA Reference | - | https://www.sqlite.org/pragma.html |

---

## 16. 改訂履歴

| バージョン | 日付 | 変更内容 | 担当者 |
|-----------|------|---------|--------|
| 1.0 | 2026-02-15 | 初版作成 | ops-runbook |
