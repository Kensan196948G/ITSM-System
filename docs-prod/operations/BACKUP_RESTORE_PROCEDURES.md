# バックアップリストア運用手順書

**文書ID**: OP-BKP-RST-001
**対象システム**: ITSM-Sec Nexus
**最終更新**: 2026-02-15
**バージョン**: 1.0
**レビュー周期**: 四半期ごと
**分類**: 運用手順書 / 災害復旧

---

## 目次

1. [概要](#1-概要)
2. [前提条件](#2-前提条件)
3. [リストア手順（WebUI経由）](#3-リストア手順webui経由)
4. [リストア手順（CLI経由）](#4-リストア手順cli経由)
5. [自動安全バックアップ](#5-自動安全バックアップ)
6. [整合性チェック](#6-整合性チェック)
7. [ロールバック手順](#7-ロールバック手順)
8. [トラブルシューティング](#8-トラブルシューティング)
9. [FAQ](#9-faq)
10. [リストア前チェックリスト](#10-リストア前チェックリスト)
11. [リストア後チェックリスト](#11-リストア後チェックリスト)
12. [エスカレーション基準](#12-エスカレーション基準)
13. [関連文書](#13-関連文書)
14. [改訂履歴](#14-改訂履歴)

---

## 1. 概要

### 1.1 本文書の目的

本文書は、ITSM-Sec Nexus のデータベースリストア機能に関する運用手順を定義します。
データベースの破損、誤操作によるデータ損失、災害復旧（DR）シナリオにおいて、
バックアップからデータベースを安全に復元するための手順を提供します。

### 1.2 リストア機能の概要

ITSM-Sec Nexus のリストア機能は、以下の安全機能を備えています。

| 機能 | 説明 |
|------|------|
| **安全バックアップの自動作成** | リストア実行前に、現在のデータベースを自動でバックアップ |
| **チェックサム検証** | バックアップファイルの SHA-256 チェックサムを検証し、改ざん・破損を検出 |
| **整合性チェック（リストア前）** | バックアップファイルに対して `PRAGMA integrity_check` を実行 |
| **整合性チェック（リストア後）** | 復元されたデータベースに対して `PRAGMA integrity_check` を実行 |
| **自動ロールバック** | リストア中にエラーが発生した場合、安全バックアップから自動的に復元 |
| **監査ログ記録** | すべてのリストア操作（成功/失敗）を監査ログに記録 |

### 1.3 リストアが必要となるシナリオ

| シナリオ | 緊急度 | 説明 |
|---------|--------|------|
| データベースファイルの破損 | 重大 | ディスク障害、不正なシャットダウン等によるDB破損 |
| 誤操作によるデータ削除 | 高 | ユーザーの操作ミスによる重要データの削除 |
| アプリケーション更新後の不具合 | 高 | マイグレーション失敗やバグによるデータ不整合 |
| セキュリティインシデント | 重大 | 不正アクセスによるデータ改ざんの復旧 |
| 災害復旧（DR） | 重大 | ハードウェア障害、自然災害等からの復旧 |
| 定期リストア訓練 | 低 | BCP計画に基づく定期的なリストアテスト |

### 1.4 リストアプロセスの全体フロー

```
[リストア開始]
     |
     v
[1] バックアップ選択
     |
     v
[2] 安全バックアップ作成（リストア前の現在DB）
     |        restore_safety_YYYYMMDDHHMMSS.db
     v
[3] チェックサム検証（SHA-256）
     |        一致 --> 続行 / 不一致 --> 中断 + ロールバック
     v
[4] 整合性チェック（バックアップファイル）
     |        ok --> 続行 / 失敗 --> 中断 + ロールバック
     v
[5] 現在のDBファイルを差し替え
     |        itsm_nexus.db, -wal, -shm, -journal を削除
     |        バックアップファイルをコピー
     v
[6] 整合性チェック（復元されたDB）
     |        ok --> 完了 / 失敗 --> 自動ロールバック
     v
[7] リストア完了 --> アプリケーションリロード
```

### 1.5 用語定義

| 用語 | 説明 |
|------|------|
| **バックアップID** | バックアップの一意識別子。形式: `BKP-YYYYMMDDHHMMSS-{type}` |
| **安全バックアップ** | リストア実行前に自動作成される現在DBのバックアップ |
| **ロールバック** | リストア失敗時に安全バックアップから元の状態に戻す操作 |
| **整合性チェック** | SQLiteの `PRAGMA integrity_check` による構造検証 |
| **チェックサム** | SHA-256によるファイルの改ざん・破損検出用ハッシュ値 |
| **RPO** | Recovery Point Objective（許容データ損失時間） |
| **RTO** | Recovery Time Objective（目標復旧時間）。本システムでは15分以内 |
| **WAL** | Write-Ahead Logging。SQLiteのジャーナルモード |

---

## 2. 前提条件

### 2.1 必要な権限

| 項目 | 要件 |
|------|------|
| **システム権限** | `admin` ロールが必須 |
| **認証** | 有効なJWTトークン（ログイン状態） |
| **CLI実行時** | サーバーへのSSHアクセス権限 |

> **注意**: `manager`, `analyst`, `viewer` ロールではリストア操作を実行できません。
> リストアが必要な場合は、admin権限を持つユーザーに依頼してください。

### 2.2 必要なファイル

リストアを実行するには、以下の条件を満たすバックアップが必要です。

| 条件 | 説明 |
|------|------|
| **ステータス** | `success`（成功）であること |
| **ファイル存在** | バックアップファイル（`.db`）がディスク上に存在すること |
| **ファイル整合性** | `PRAGMA integrity_check` が `ok` を返すこと |

### 2.3 バックアップファイルの保存場所

```
backend/backups/
  +-- daily/                 # 日次バックアップ（保持期間: 7日）
  |   +-- itsm_nexus_daily_YYYYMMDD_HHMMSS.db
  |   +-- itsm_nexus_daily_YYYYMMDD_HHMMSS.sql.gz
  |   +-- itsm_nexus_daily_YYYYMMDD_HHMMSS.sha256
  +-- weekly/                # 週次バックアップ（保持期間: 4週間）
  |   +-- itsm_nexus_weekly_YYYYMMDD_HHMMSS.db
  |   +-- ...
  +-- monthly/               # 月次バックアップ（保持期間: 12ヶ月）
  |   +-- itsm_nexus_monthly_YYYYMMDD_HHMMSS.db
  |   +-- ...
  +-- restore_safety_*.db    # リストア前の安全バックアップ
```

### 2.4 システム要件

| 項目 | 要件 |
|------|------|
| **ディスク空き容量** | 現在のDBサイズの2倍以上（安全バックアップ + リストアファイル） |
| **ネットワーク** | WebUI使用時、サーバーへのHTTPSアクセス（ポート6443） |
| **ブラウザ** | Chrome / Firefox / Edge（最新版推奨） |
| **sqlite3コマンド** | CLI操作時に必要（整合性チェックで使用） |

### 2.5 推奨事項

1. **テスト環境で事前検証**: 本番環境でリストアを実行する前に、テスト環境で同じバックアップを使ってリストアを検証してください
2. **ユーザーへの事前通知**: リストア中はサービスが一時的に利用できなくなります。関係者への事前通知を推奨します
3. **メンテナンスウィンドウ**: 可能であれば、業務時間外にリストアを実行してください
4. **複数人での作業**: 重要なリストア作業は、二人以上で確認しながら実施してください

---

## 3. リストア手順（WebUI経由）

### 3.1 概要

WebUI（管理画面）からのリストアは、最も簡単で推奨される方法です。
確認ダイアログ、進捗表示、結果表示が自動的に行われます。

### 3.2 ステップバイステップ手順

#### Step 1: バックアップ管理画面へアクセス

1. ブラウザで ITSM-Sec Nexus にアクセスします
   ```
   https://<サーバーアドレス>:6443/
   ```
2. `admin` 権限を持つユーザーでログインします
3. 左側メニューから **「設定」** をクリックします
4. サブメニューから **「バックアップ管理」** を選択します

> **確認ポイント**: バックアップ管理画面が表示され、バックアップ一覧テーブルが見えることを確認してください。

#### Step 2: リストアするバックアップを選択

バックアップ一覧テーブルから、リストアしたいバックアップを確認します。

確認すべき項目:

| 項目 | 確認内容 |
|------|---------|
| **種別** | Daily / Weekly / Monthly / Manual のいずれか |
| **作成日時** | いつ時点のデータに戻したいかを確認 |
| **ファイルサイズ** | 0 バイトでないこと（0の場合はバックアップが不正） |
| **ステータス** | 「成功」であること（失敗・削除済みのバックアップはリストア不可） |

> **注意**: リストアすると、選択したバックアップ作成時点のデータに戻ります。
> バックアップ作成後に追加・変更されたデータは失われます。

#### Step 3: 「リストア」ボタンをクリック

リストアしたいバックアップの行にある **「リストア」ボタン** をクリックします。

#### Step 4: 警告ダイアログの内容を確認

以下のような警告ダイアログが表示されます。内容を慎重に確認してください。

```
-----------------------------------------------------
  WARNING: データベースリストア
-----------------------------------------------------
  この操作により、現在のデータベースが以下のバックアップで
  上書きされます:

  - バックアップID: BKP-20260215-020015-daily
  - バックアップ種別: Daily
  - 作成日時: 2026-02-15 02:00:15
  - ファイルサイズ: 3.2 MB

  現在のデータベースはリストア前に自動的にバックアップされます。

  本当にリストアを実行しますか?
-----------------------------------------------------
  [キャンセル]  [実行]
```

確認事項:
- バックアップIDと作成日時が正しいことを確認
- 「リストア後に失われるデータ」を把握しているか確認

#### Step 5: パスワード入力（確認用）

セキュリティのため、admin ユーザーのパスワードを再入力します。
これは誤操作防止のための二重確認です。

#### Step 6: 実行ボタンをクリック

すべての確認が完了したら、**「実行」** ボタンをクリックします。

> **重要**: 実行ボタンをクリックした後は、ブラウザを閉じたり、
> ページを移動したりしないでください。

#### Step 7: 進捗を確認

リストアの進捗がスピナーまたはプログレスバーで表示されます。

```
リストア実行中...
  [1/5] 安全バックアップを作成中...     完了
  [2/5] チェックサムを検証中...         完了
  [3/5] 整合性チェックを実行中...       完了
  [4/5] データベースを差し替え中...     完了
  [5/5] 復元後の整合性チェック中...     実行中 ...
```

通常、リストアは数秒から数分で完了します。
データベースのサイズによっては時間がかかる場合があります。

| DBサイズ | 目安時間 |
|---------|---------|
| 10 MB 以下 | 10秒以内 |
| 100 MB | 1分以内 |
| 1 GB | 5分以内 |

#### Step 8: 成功確認とアプリケーションリロード

リストアが成功すると、以下のような成功メッセージが表示されます。

```
リストアが完了しました

リストア元: BKP-20260215-020015-daily
安全バックアップ: restore_safety_20260215150530.db
整合性チェック: 合格

アプリケーションをリロードしてください。
[リロード]
```

**「リロード」ボタン** をクリックして、アプリケーションを再読み込みします。

> **重要**: リストア後は必ずアプリケーションをリロードしてください。
> リロードしないと、キャッシュされた古いデータが表示される場合があります。

---

## 4. リストア手順（CLI経由）

### 4.1 概要

CLI（コマンドライン）からのリストアは、以下の場合に使用します。

- WebUI にアクセスできない場合
- 自動化スクリプトから実行する場合
- リモートからSSH経由で操作する場合
- 詳細なログ出力が必要な場合

### 4.2 API経由でのリストア

#### Step 1: 認証トークンの取得

```bash
# ログインしてJWTトークンを取得
TOKEN=$(curl -sk -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"'"$ADMIN_PASSWORD"'"}' \
  | jq -r '.token')

# トークンが取得できたか確認
echo "Token: ${TOKEN:0:20}..."
```

> **注意**: `$ADMIN_PASSWORD` は環境変数として事前に設定するか、
> 直接入力してください。シェルの履歴にパスワードが残らないよう注意してください。

#### Step 2: バックアップ一覧の確認

```bash
# バックアップ一覧を取得（成功ステータスのみ）
curl -sk -X GET "https://localhost:6443/api/v1/backups?status=success&sort=created_at&order=desc" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data.backups[] | {backup_id, backup_type, created_at, file_size}'
```

出力例:
```json
{
  "backup_id": "BKP-20260215-020015-daily",
  "backup_type": "daily",
  "created_at": "2026-02-15T02:00:15.000Z",
  "file_size": 3358720
}
{
  "backup_id": "BKP-20260209-030012-weekly",
  "backup_type": "weekly",
  "created_at": "2026-02-09T03:00:12.000Z",
  "file_size": 3276800
}
```

#### Step 3: バックアップの詳細確認

```bash
# 特定のバックアップの詳細を確認
BACKUP_ID="BKP-20260215-020015-daily"

curl -sk -X GET "https://localhost:6443/api/v1/backups/$BACKUP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | {backup_id, backup_type, status, file_path, file_size, checksum, created_at}'
```

#### Step 4: リストアの実行

```bash
# リストア実行（現在のDBの安全バックアップ付き）
BACKUP_ID="BKP-20260215-020015-daily"

curl -sk -X POST "https://localhost:6443/api/v1/backups/$BACKUP_ID/restore" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": true,
    "backup_current": true
  }' | jq '.'
```

成功時のレスポンス例:
```json
{
  "message": "Restore completed successfully",
  "data": {
    "status": "success",
    "restored_from": "BKP-20260215-020015-daily",
    "backup_before_restore": "/path/to/backend/backups/restore_safety_20260215150530.db",
    "integrity_check": "passed",
    "message": "Database restored successfully. Please reload the application."
  }
}
```

#### Step 5: サービスの再起動（推奨）

API経由でリストアした場合、アプリケーションの再起動を推奨します。

```bash
# サービス再起動（systemdの場合）
sudo systemctl restart itsm-nexus-prod

# 起動確認
sleep 5
curl -sk https://localhost:6443/api/v1/health | jq '.'
```

### 4.3 API リファレンス

#### エンドポイント

```
POST /api/v1/backups/:backupId/restore
```

#### ヘッダー

| ヘッダー | 値 | 必須 |
|---------|-----|------|
| `Authorization` | `Bearer <JWT_TOKEN>` | Yes |
| `Content-Type` | `application/json` | Yes |

#### リクエストボディ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `confirm` | boolean | `true` | リストア実行の確認フラグ。`false` の場合は 400 エラーを返す |
| `backup_current` | boolean | `true` | リストア前に現在のDBをバックアップするかどうか |

#### レスポンス

| ステータス | 説明 |
|-----------|------|
| `200` | リストア成功 |
| `400` | リクエストエラー（confirm が false の場合等） |
| `401` | 認証エラー（トークン無効・期限切れ） |
| `403` | 権限エラー（admin 権限なし） |
| `404` | バックアップが見つからない |
| `500` | リストア失敗（整合性チェック失敗等） |

#### エラーレスポンス例

```json
{
  "error": "Backup file checksum mismatch. The file may be corrupted.",
  "message": "Internal Server Error"
}
```

### 4.4 安全バックアップなしでのリストア（非推奨）

特殊な状況（ディスク容量不足等）で安全バックアップの作成をスキップする場合:

```bash
# 安全バックアップなしでリストア（非推奨 - 緊急時のみ）
curl -sk -X POST "https://localhost:6443/api/v1/backups/$BACKUP_ID/restore" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "confirm": true,
    "backup_current": false
  }' | jq '.'
```

> **WARNING**: `backup_current: false` を指定すると、リストア失敗時の
> 自動ロールバックができなくなります。この場合、手動での復旧が必要になります。
> 特別な理由がない限り、`backup_current: true`（デフォルト）を使用してください。

---

## 5. 自動安全バックアップ

### 5.1 概要

リストア機能は、実行前に現在のデータベースを自動的にバックアップします。
これにより、リストアが失敗した場合やリストア結果が期待と異なる場合に、
元の状態に戻すことができます。

### 5.2 安全バックアップの仕組み

```
[リストア実行開始]
     |
     v
backup_current == true ?
     |
     +-- true --> 現在のDBをコピー
     |            --> backend/backups/restore_safety_YYYYMMDDHHMMSS.db
     |
     +-- false --> スキップ（ロールバック不可）
     |
     v
[リストア処理続行]
```

### 5.3 安全バックアップのファイル

| 項目 | 詳細 |
|------|------|
| **保存場所** | `backend/backups/` ディレクトリ |
| **命名規則** | `restore_safety_YYYYMMDDHHMMSS.db` |
| **内容** | リストア実行直前のデータベースファイルの完全コピー |
| **自動削除** | されない（手動で管理が必要） |

### 5.4 安全バックアップの確認

```bash
# 安全バックアップの一覧を確認
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/restore_safety_*.db

# 安全バックアップの整合性を確認
SAFETY_BACKUP=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/restore_safety_*.db | head -1)
sqlite3 "$SAFETY_BACKUP" "PRAGMA integrity_check;"
```

### 5.5 安全バックアップの削除基準

安全バックアップは自動削除されません。以下の基準で手動削除してください。

| 条件 | 対応 |
|------|------|
| リストア成功後、動作確認完了 | 1週間後に削除可 |
| リストア成功後、問題が報告されていない | 2週間後に削除推奨 |
| ディスク容量が逼迫している | 最も古い安全バックアップから削除 |

```bash
# 2週間以上前の安全バックアップを削除
find /mnt/LinuxHDD/ITSM-System/backend/backups/ \
  -name "restore_safety_*.db" -mtime +14 -ls

# 確認後、削除を実行
find /mnt/LinuxHDD/ITSM-System/backend/backups/ \
  -name "restore_safety_*.db" -mtime +14 -delete
```

---

## 6. 整合性チェック

### 6.1 リストアプロセスにおける整合性チェック

リストアプロセスでは、3段階の整合性チェックが自動的に実行されます。

```
[チェック1] チェックサム検証（SHA-256）
     |
     |  バックアップに checksum が記録されている場合のみ実行
     |  - 記録された checksum とファイルから計算した checksum を比較
     |  - 不一致 --> "Backup file checksum mismatch" エラー + ロールバック
     |
     v
[チェック2] バックアップファイルの整合性チェック（リストア前）
     |
     |  sqlite3 <backup_file> "PRAGMA integrity_check;"
     |  - "ok" 以外 --> "Backup file integrity check failed" エラー + ロールバック
     |
     v
[DB差し替え実行]
     |
     v
[チェック3] 復元されたDBの整合性チェック（リストア後）
     |
     |  sqlite3 itsm_nexus.db "PRAGMA integrity_check;"
     |  - "ok" 以外 --> "Restored database integrity check failed" エラー + ロールバック
     |
     v
[リストア完了]
```

### 6.2 手動での整合性チェック

リストア前に手動でバックアップファイルの整合性を確認することも可能です。

#### API経由

```bash
# 特定のバックアップの整合性チェック
BACKUP_ID="BKP-20260215-020015-daily"

curl -sk -X POST "https://localhost:6443/api/v1/backups/$BACKUP_ID/verify" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data'
```

レスポンス例:
```json
{
  "total_checks": 2,
  "passed": 2,
  "failed": 0,
  "checks": [
    {
      "check_id": "CHK-20260215-150530-001",
      "backup_id": "BKP-20260215-020015-daily",
      "check_type": "file_exists",
      "status": "pass"
    },
    {
      "check_id": "CHK-20260215-150530-002",
      "backup_id": "BKP-20260215-020015-daily",
      "check_type": "checksum",
      "status": "pass"
    }
  ]
}
```

#### CLI経由

```bash
# バックアップファイルのパスを取得
BACKUP_FILE="/mnt/LinuxHDD/ITSM-System/backend/backups/daily/itsm_nexus_daily_20260215_020015.db"

# 1. ファイル存在確認
ls -la "$BACKUP_FILE"

# 2. ファイルサイズ確認（0バイトでないこと）
stat --format="%s bytes" "$BACKUP_FILE"

# 3. SQLite整合性チェック
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;"
# 出力が "ok" であれば正常

# 4. チェックサム検証（.sha256ファイルがある場合）
SHA_FILE="${BACKUP_FILE%.db}.sha256"
if [ -f "$SHA_FILE" ]; then
    cd "$(dirname "$SHA_FILE")" && sha256sum -c "$(basename "$SHA_FILE")"
fi

# 5. テーブル数の確認
sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
```

### 6.3 整合性チェックの結果と対応

| チェック結果 | 意味 | 対応 |
|------------|------|------|
| `pass` / `ok` | 整合性問題なし | リストア可能 |
| `fail` (file_exists) | ファイルが見つからない | バックアップファイルのパスを確認、別のバックアップを使用 |
| `fail` (checksum) | チェックサム不一致 | ファイルが破損している可能性。別のバックアップを使用 |
| `fail` (integrity) | DB構造が破損 | ファイルが破損。別のバックアップを使用 |

---

## 7. ロールバック手順

### 7.1 自動ロールバック

リストア中にエラーが発生した場合、システムは自動的にロールバックを試みます。
自動ロールバックは以下の条件で発生します。

| エラー | 自動ロールバック | 条件 |
|--------|----------------|------|
| チェックサム不一致 | あり | `backup_current: true` の場合 |
| バックアップ整合性チェック失敗 | あり | `backup_current: true` の場合 |
| DB差し替え中のエラー | あり | `backup_current: true` の場合 |
| 復元後の整合性チェック失敗 | あり | `backup_current: true` の場合 |

自動ロールバックが成功した場合、ログに以下のメッセージが出力されます:
```
[Restore] Rollback completed from safety backup
```

### 7.2 手動ロールバック

自動ロールバックが失敗した場合、または `backup_current: false` で
リストアを実行してしまった場合は、手動でロールバックが必要です。

#### 手動ロールバック手順

```bash
# 1. サービスを停止
sudo systemctl stop itsm-nexus-prod

# 2. 安全バックアップファイルを確認
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/restore_safety_*.db

# 3. 最新の安全バックアップを特定
SAFETY_BACKUP=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/restore_safety_*.db | head -1)
echo "Safety backup: $SAFETY_BACKUP"

# 4. 安全バックアップの整合性を確認
sqlite3 "$SAFETY_BACKUP" "PRAGMA integrity_check;"
# "ok" であることを確認

# 5. 現在の（破損した）DBをリネーム
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PATH="/mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db"
mv "$DB_PATH" "${DB_PATH}.broken.${TIMESTAMP}" 2>/dev/null

# WAL/SHMファイルも移動
mv "${DB_PATH}-wal" "${DB_PATH}-wal.broken.${TIMESTAMP}" 2>/dev/null
mv "${DB_PATH}-shm" "${DB_PATH}-shm.broken.${TIMESTAMP}" 2>/dev/null
mv "${DB_PATH}-journal" "${DB_PATH}-journal.broken.${TIMESTAMP}" 2>/dev/null

# 6. 安全バックアップからDBを復元
cp "$SAFETY_BACKUP" "$DB_PATH"

# 7. ファイル権限の確認
ls -la "$DB_PATH"

# 8. 復元したDBの整合性チェック
sqlite3 "$DB_PATH" "PRAGMA integrity_check;"

# 9. サービスを起動
sudo systemctl start itsm-nexus-prod

# 10. ヘルスチェック
sleep 5
curl -sk https://localhost:6443/api/v1/health | jq '.'
```

### 7.3 安全バックアップがない場合の復旧

安全バックアップが存在しない場合は、通常のバックアップからリストアします。

```bash
# 1. サービスを停止
sudo systemctl stop itsm-nexus-prod

# 2. 利用可能なバックアップを確認（新しい順）
echo "=== Daily backups ==="
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/daily/*.db 2>/dev/null | head -5
echo "=== Weekly backups ==="
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/weekly/*.db 2>/dev/null | head -5
echo "=== Monthly backups ==="
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/monthly/*.db 2>/dev/null | head -5

# 3. 最新の正常なバックアップを探す
for BACKUP in $(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*/*.db 2>/dev/null); do
    echo -n "Checking: $BACKUP ... "
    RESULT=$(sqlite3 "$BACKUP" "PRAGMA integrity_check;" 2>/dev/null)
    if [ "$RESULT" = "ok" ]; then
        echo "OK"
        echo "USE THIS: $BACKUP"
        break
    else
        echo "FAILED"
    fi
done

# 4. DBファイルを差し替え
DB_PATH="/mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mv "$DB_PATH" "${DB_PATH}.broken.${TIMESTAMP}" 2>/dev/null
mv "${DB_PATH}-wal" "${DB_PATH}-wal.broken.${TIMESTAMP}" 2>/dev/null
mv "${DB_PATH}-shm" "${DB_PATH}-shm.broken.${TIMESTAMP}" 2>/dev/null

cp "$BACKUP" "$DB_PATH"

# 5. 整合性チェック
sqlite3 "$DB_PATH" "PRAGMA integrity_check;"

# 6. サービス起動
sudo systemctl start itsm-nexus-prod
sleep 5
curl -sk https://localhost:6443/api/v1/health | jq '.'
```

---

## 8. トラブルシューティング

### 8.1 エラー一覧と対処法

#### ERROR: "Backup not found: {backupId}"

| 項目 | 内容 |
|------|------|
| **原因** | 指定されたバックアップIDが存在しない |
| **確認** | バックアップIDのスペルを確認。`GET /api/v1/backups` で一覧を取得 |
| **対処** | 正しいバックアップIDを使用してリストアを再実行 |

#### ERROR: "Backup is not available for restore. Status: {status}"

| 項目 | 内容 |
|------|------|
| **原因** | バックアップのステータスが `success` 以外（`failure`, `deleted`, `in_progress`） |
| **確認** | `GET /api/v1/backups/{id}` でステータスを確認 |
| **対処** | ステータスが `success` のバックアップを選択してリストアを再実行 |

#### ERROR: "Backup file not found: {file_path}"

| 項目 | 内容 |
|------|------|
| **原因** | バックアップのDBレコードは存在するが、実際のファイルがディスク上にない |
| **確認** | `ls -la {file_path}` でファイルの存在を確認 |
| **対処1** | 別のバックアップを使用してリストア |
| **対処2** | バックアップファイルが別の場所に移動されていないか確認 |
| **対処3** | ディスク障害の可能性がある場合は、リモートバックアップを確認 |

#### ERROR: "Backup file checksum mismatch. The file may be corrupted."

| 項目 | 内容 |
|------|------|
| **原因** | バックアップファイルの SHA-256 チェックサムが記録値と一致しない |
| **影響** | ファイルが破損している可能性があり、リストアは安全のため中断される |
| **自動対応** | 安全バックアップからの自動ロールバックが実行される |
| **対処1** | 別のバックアップを使用してリストア |
| **対処2** | チェックサムの元ファイル（`.sha256`）が正しいか手動で確認 |

```bash
# 手動でチェックサムを確認
BACKUP_FILE="/path/to/backup.db"
sha256sum "$BACKUP_FILE"
# 出力されたハッシュ値と .sha256 ファイルの内容を比較
```

#### ERROR: "Backup file integrity check failed. The backup may be corrupted."

| 項目 | 内容 |
|------|------|
| **原因** | バックアップファイルに対する `PRAGMA integrity_check` が失敗 |
| **影響** | SQLiteデータベースの内部構造が破損している |
| **自動対応** | 安全バックアップからの自動ロールバックが実行される |
| **対処1** | 別のバックアップを使用してリストア |
| **対処2** | `.sql.gz`（SQLダンプ）からの復旧を検討（セクション 8.2 参照） |

#### ERROR: "Restored database integrity check failed"

| 項目 | 内容 |
|------|------|
| **原因** | DB差し替え後の整合性チェックが失敗。コピー中の破損や、ディスク障害の可能性 |
| **影響** | 復元されたデータベースが破損状態。自動ロールバックが発動 |
| **自動対応** | 安全バックアップからの自動ロールバックが実行される |
| **対処1** | ディスクの健全性を確認（`dmesg | grep -i error`） |
| **対処2** | 別のバックアップを使用してリストア |
| **対処3** | ディスク障害の場合は、別のディスクにシステムを復旧 |

#### ERROR: "Confirmation required"

| 項目 | 内容 |
|------|------|
| **原因** | API呼び出しで `confirm` パラメータが `false` または未指定 |
| **対処** | リクエストボディに `"confirm": true` を追加 |

### 8.2 SQLダンプからの復旧（最終手段）

すべての `.db` バックアップファイルが破損している場合、`.sql.gz`（SQLダンプ）
から復旧を試みます。

```bash
# 1. サービスを停止
sudo systemctl stop itsm-nexus-prod

# 2. SQLダンプファイルを確認
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/*/*.sql.gz 2>/dev/null | head -5

# 3. 最新のSQLダンプを展開
SQL_DUMP=$(ls -t /mnt/LinuxHDD/ITSM-System/backend/backups/*/*.sql.gz | head -1)
echo "Using: $SQL_DUMP"

# 4. gzip整合性テスト
gunzip -t "$SQL_DUMP"
if [ $? -ne 0 ]; then
    echo "ERROR: SQL dump file is corrupted"
    exit 1
fi

# 5. 現在のDBをバックアップ
DB_PATH="/mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp "$DB_PATH" "${DB_PATH}.pre_sqldump_restore.${TIMESTAMP}" 2>/dev/null

# 6. SQLダンプから新しいDBを作成
gunzip -c "$SQL_DUMP" | sqlite3 "${DB_PATH}.new"

# 7. 新しいDBの整合性チェック
RESULT=$(sqlite3 "${DB_PATH}.new" "PRAGMA integrity_check;")
if [ "$RESULT" != "ok" ]; then
    echo "ERROR: Restored DB failed integrity check"
    rm "${DB_PATH}.new"
    exit 1
fi

# 8. DBファイルを差し替え
rm -f "$DB_PATH" "${DB_PATH}-wal" "${DB_PATH}-shm" "${DB_PATH}-journal"
mv "${DB_PATH}.new" "$DB_PATH"

# 9. サービス起動
sudo systemctl start itsm-nexus-prod
sleep 5
curl -sk https://localhost:6443/api/v1/health | jq '.'
```

### 8.3 ロールバック失敗時の対応

自動ロールバックが失敗した場合は、ログに以下のメッセージが出力されます:

```
[Restore] Rollback failed: {error_message}
```

この場合、手動でのロールバックが必要です。セクション 7.2 を参照してください。

### 8.4 ディスク容量不足時の対応

リストア前に「ディスク容量不足」が疑われる場合:

```bash
# 1. ディスク使用量を確認
df -h /mnt/LinuxHDD/ITSM-System/

# 2. バックアップディレクトリの使用量
du -sh /mnt/LinuxHDD/ITSM-System/backend/backups/

# 3. 不要な安全バックアップを削除
find /mnt/LinuxHDD/ITSM-System/backend/backups/ \
  -name "restore_safety_*.db" -mtime +14 -delete

# 4. 古い .broken ファイルを削除
find /mnt/LinuxHDD/ITSM-System/backend/ \
  -name "*.broken.*" -mtime +7 -delete

# 5. ディスク容量を再確認
df -h /mnt/LinuxHDD/ITSM-System/
```

---

## 9. FAQ

### Q1: リストア中にサーバーがクラッシュしたらどうなりますか?

**A**: リストアのタイミングによって異なります。

| タイミング | 状態 | 対応 |
|-----------|------|------|
| 安全バックアップ作成中 | 現在のDBは無傷 | サービス再起動のみで復旧 |
| チェックサム検証中 | 現在のDBは無傷 | サービス再起動のみで復旧 |
| DB差し替え中 | DBが不完全な状態の可能性 | 安全バックアップから手動ロールバック（セクション 7.2） |
| リストア後の整合性チェック中 | DBは差し替え済み | `PRAGMA integrity_check` を手動実行して確認 |

### Q2: 安全バックアップはいつ削除してよいですか?

**A**: 以下のガイドラインに従ってください。

- **最短**: リストア成功後、動作確認が完了してから **1週間後**
- **推奨**: リストアから **2週間** 経過し、問題が報告されていない場合
- **緊急時**: ディスク容量が逼迫している場合は、最も古い安全バックアップから削除
- **注意**: 最新の安全バックアップは常に1つ以上残しておくことを推奨

### Q3: リストア後にアプリケーションが起動しない場合は?

**A**: 以下の手順で確認してください。

```bash
# 1. サービスのステータス確認
sudo systemctl status itsm-nexus-prod

# 2. エラーログの確認
sudo journalctl -u itsm-nexus-prod --since "5 minutes ago" -n 50

# 3. DBファイルの権限確認
ls -la /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# 4. DB整合性チェック
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"

# 5. テーブル構造の確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db ".tables"
```

原因として多いケース:
- **マイグレーション不整合**: 古いバックアップにはマイグレーション済みテーブルがない場合があります。サービスログでマイグレーションエラーを確認してください。
- **権限エラー**: ファイルの所有者・権限が変わっている場合。`chown` / `chmod` で修正してください。
- **ポート競合**: 前のプロセスが残っている場合。`lsof -i :6443` で確認してください。

### Q4: 特定のテーブルだけリストアすることは可能ですか?

**A**: 現在のリストア機能はデータベース全体を対象としています。特定のテーブルのみの
リストアには、手動でのSQL操作が必要です。

```bash
# 例: incidents テーブルのみバックアップからコピー
BACKUP_FILE="/path/to/backup.db"
DB_PATH="/mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db"

# 1. バックアップからデータをエクスポート
sqlite3 "$BACKUP_FILE" ".dump incidents" > /tmp/incidents_dump.sql

# 2. 現在のDBのテーブルを空にして再インポート
# WARNING: 以下の操作は元に戻せません。事前に現在のDBをバックアップしてください。
sqlite3 "$DB_PATH" "DELETE FROM incidents;"
sqlite3 "$DB_PATH" < /tmp/incidents_dump.sql

# 3. クリーンアップ
rm /tmp/incidents_dump.sql
```

> **注意**: この操作はリレーション（外部キー）の整合性を壊す可能性があります。
> 慎重に検討し、事前にテスト環境で検証してください。

### Q5: リストア操作の監査ログはどこで確認できますか?

**A**: すべてのリストア操作は `backup_audit_logs` テーブルに記録されます。

```bash
# API経由で確認
curl -sk -X GET "https://localhost:6443/api/v1/backups" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'

# DB直接参照
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT operation, backup_id, username, status, error_message, created_at
   FROM backup_audit_logs
   WHERE operation = 'restore'
   ORDER BY created_at DESC
   LIMIT 10;"
```

### Q6: リストアのレート制限はありますか?

**A**: 仕様上は1時間あたり3回のレート制限が設計されています。
短期間に繰り返しリストアを実行することは推奨されません。
リストア後は十分な動作確認を行ってから、必要な場合のみ再実行してください。

### Q7: バックアップファイルを別のサーバーに移してリストアできますか?

**A**: バックアップファイル（`.db`）を別のサーバーにコピーし、
そのサーバーの `backend/backups/` ディレクトリに配置すれば、
API経由でリストアが可能です。ただし、以下の条件を満たす必要があります。

1. ITSM-Sec Nexus のバージョンが同じ（マイグレーションの互換性）
2. バックアップファイルが `backup_logs` テーブルに登録されていること
3. ファイルの整合性が保たれていること

---

## 10. リストア前チェックリスト

リストアを実行する前に、以下のチェックリストを確認してください。

| # | 確認項目 | 確認方法 | チェック |
|---|---------|---------|---------|
| 1 | admin 権限でログイン済みか | ユーザーメニューでロールを確認 | [ ] |
| 2 | リストア先のバックアップを特定したか | バックアップ一覧でID・日時を確認 | [ ] |
| 3 | バックアップのステータスが「成功」か | 一覧のステータス列を確認 | [ ] |
| 4 | バックアップのファイルサイズが 0 でないか | 一覧のサイズ列を確認 | [ ] |
| 5 | リストア後に失われるデータを把握しているか | バックアップ作成日時以降の変更を確認 | [ ] |
| 6 | ユーザーへの事前通知を行ったか | メール・チャット等で通知 | [ ] |
| 7 | ディスク空き容量が十分か（DB容量の2倍以上） | `df -h` で確認 | [ ] |
| 8 | テスト環境で事前検証を行ったか（推奨） | テスト環境でリストアを実施 | [ ] |
| 9 | ロールバック手順を理解しているか | セクション 7 を確認 | [ ] |
| 10 | 緊急連絡先を把握しているか | セクション 12 を確認 | [ ] |

---

## 11. リストア後チェックリスト

リストア完了後に、以下の確認を実施してください。

| # | 確認項目 | 確認方法 | 期待結果 | チェック |
|---|---------|---------|---------|---------|
| 1 | リストア成功メッセージを確認 | 画面表示 / APIレスポンス | `status: "success"` | [ ] |
| 2 | アプリケーションをリロード | ブラウザのリロードボタン | 画面が正常に表示される | [ ] |
| 3 | ログインが可能か | ログイン画面でログイン | 正常にログインできる | [ ] |
| 4 | インシデント一覧が表示されるか | インシデント管理画面を開く | データが表示される | [ ] |
| 5 | 変更管理（RFC）が表示されるか | 変更管理画面を開く | データが表示される | [ ] |
| 6 | ユーザー一覧が表示されるか | ユーザー管理画面を開く | データが表示される | [ ] |
| 7 | 新規レコードが作成可能か | インシデントの新規作成を試行 | 正常に作成できる | [ ] |
| 8 | 監査ログが記録されているか | 監査ログ画面を確認 | リストア操作のログが存在する | [ ] |
| 9 | 安全バックアップが作成されたか | `ls backend/backups/restore_safety_*` | ファイルが存在する | [ ] |
| 10 | バックアップスケジューラが動作しているか | サービスログで確認 | 次回実行がスケジュールされている | [ ] |

```bash
# CLI での確認コマンド

# ヘルスチェック
curl -sk https://localhost:6443/api/v1/health | jq '.'

# ログイン確認
curl -sk -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"'"$ADMIN_PASSWORD"'"}' | jq '.token'

# 主要テーブルのレコード数確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db << 'SQL'
SELECT 'incidents' as table_name, COUNT(*) as count FROM incidents
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'change_requests', COUNT(*) FROM change_requests
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs;
SQL

# 安全バックアップの確認
ls -lt /mnt/LinuxHDD/ITSM-System/backend/backups/restore_safety_*.db 2>/dev/null

# サービスログの確認
sudo journalctl -u itsm-nexus-prod --since "10 minutes ago" | tail -20
```

---

## 12. エスカレーション基準

### 12.1 エスカレーションレベル

| レベル | 条件 | 対応者 | 時間枠 |
|--------|------|--------|--------|
| **L1** | リストア成功、軽微な問題 | 運用担当者 | 0〜30分 |
| **L1** | 単一バックアップの整合性失敗（別のバックアップで代替可） | 運用担当者 | 0〜30分 |
| **L2** | リストア失敗、自動ロールバック成功 | システム管理者 | 30分〜2時間 |
| **L2** | 複数バックアップの整合性失敗 | システム管理者 | 即時 |
| **L3** | リストア失敗、自動ロールバック失敗 | 管理職 + ベンダー | 即時 |
| **L3** | 全バックアップの破損（復旧不可能） | 管理職 + ベンダー | 即時 |

### 12.2 エスカレーション連絡テンプレート

```
【データベースリストア報告】

■ 発生日時: YYYY-MM-DD HH:MM
■ 操作種別: [リストア実行 / リストア失敗 / ロールバック実行]
■ 実行者: [ユーザー名]
■ 使用バックアップ: [バックアップID / 作成日時]
■ リストア結果: [成功 / 失敗（エラー内容）]
■ ロールバック結果: [成功 / 失敗 / 未実行]
■ 現在のシステム状態: [正常稼働 / 停止中 / 部分的に利用可能]
■ データ損失の有無: [なし / あり（影響範囲を記載）]
■ 実施済み対応:
  - [実施した手順を記載]
■ 追加対応の要否: [あり / なし]
■ 対応者: [担当者名]
```

---

## 13. 関連文書

| 文書名 | ファイルパス | 内容 |
|--------|------------|------|
| バックアップ失敗対応Runbook | `docs-prod/operations/runbooks/backup-failure-runbook.md` | バックアップ失敗時の診断・復旧手順 |
| データベース障害Runbook | `docs-prod/operations/runbooks/database-failure-runbook.md` | DB障害全般の対応手順 |
| セキュリティインシデントRunbook | `docs-prod/operations/runbooks/security-incident-runbook.md` | セキュリティインシデント対応手順 |
| バックアップ要件定義書 | `specs/phase9-1-backup-requirements.md` | バックアップ機能の仕様詳細 |

---

## 14. 改訂履歴

| 日付 | バージョン | 変更内容 | 担当 |
|------|-----------|---------|------|
| 2026-02-15 | 1.0 | 初版作成 | ops-runbook |

---

**文書管理者**: ITSM-Sec Nexus 運用チーム
**次回レビュー予定**: 2026-05-15
