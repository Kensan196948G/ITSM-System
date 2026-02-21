# Phase 9.1: バックアップ・リストア機能 - 要件定義書

**作成日**: 2026-01-31
**バージョン**: 1.0
**ステータス**: Draft
**担当**: spec-planner SubAgent

---

## 目次

1. [機能要件](#1-機能要件)
2. [非機能要件](#2-非機能要件)
3. [制約事項](#3-制約事項)
4. [受入基準](#4-受入基準)

---

## 1. 機能要件

### 1.1 自動バックアップ機能

#### FR-1.1.1: 定期バックアップスケジューリング

**要件**:
システムは以下のスケジュールで自動的にバックアップを実行しなければならない：

| 種別 | 実行タイミング | 保存先 | 保存期間 |
|------|--------------|--------|---------|
| 日次フルバックアップ | 毎日 02:00 AM | `/backups/daily/` | 7日間 |
| 週次フルバックアップ | 毎週日曜 03:00 AM | `/backups/weekly/` | 4週間 |
| 月次フルバックアップ | 毎月1日 04:00 AM | `/backups/monthly/` | 12ヶ月 |

**詳細仕様**:
- node-cronを使用してスケジューリング
- cron式:
  - 日次: `0 2 * * *`
  - 週次: `0 3 * * 0`
  - 月次: `0 4 1 * *`
- システム起動時に前回実行時刻を確認し、未実行分を補完

**優先度**: P0（必須）

---

#### FR-1.1.2: バックアップファイル命名規則

**要件**:
バックアップファイルは以下の命名規則に従わなければならない：

```
itsm_nexus_{type}_{timestamp}.db.gz

例:
- itsm_nexus_daily_20260131_020015.db.gz
- itsm_nexus_weekly_20260126_030012.db.gz
- itsm_nexus_monthly_20260201_040008.db.gz
```

**フォーマット詳細**:
- `{type}`: daily / weekly / monthly
- `{timestamp}`: YYYYMMDDHHmmss形式
- 拡張子: `.db.gz`（gzip圧縮）

**優先度**: P0（必須）

---

#### FR-1.1.3: バックアップ実行ロジック

**要件**:
バックアップ実行時、システムは以下の手順を実行しなければならない：

1. **事前チェック**
   - データベースファイルの存在確認
   - ディスク容量確認（必要容量: DB容量×2以上）
   - バックアップディレクトリの存在・権限確認

2. **バックアップ作成**
   ```javascript
   // SQLiteの.backup() APIを使用
   const db = require('better-sqlite3')('itsm_nexus.db');
   await db.backup(`backups/daily/itsm_nexus_daily_${timestamp}.db`);
   ```

3. **整合性チェック**
   ```sql
   PRAGMA integrity_check;
   -- 結果が "ok" であることを確認
   ```

4. **圧縮**
   ```bash
   gzip backups/daily/itsm_nexus_daily_${timestamp}.db
   ```

5. **メタデータ記録**
   ```sql
   INSERT INTO backup_logs (backup_type, file_path, file_size, checksum, status, created_at)
   VALUES ('daily', '/backups/daily/...', 12345678, 'sha256:...', 'success', CURRENT_TIMESTAMP);
   ```

6. **通知**
   - 成功時: INFOログ出力 + （オプション）メール通知
   - 失敗時: ERRORログ出力 + （必須）メール通知

**優先度**: P0（必須）

---

### 1.2 手動バックアップ機能

#### FR-1.2.1: REST API - バックアップ作成

**エンドポイント**: `POST /api/v1/backups`

**リクエスト**:
```json
{
  "type": "manual",           // 必須: manual / daily / weekly / monthly
  "description": "pre-deploy backup"  // 任意: バックアップの説明
}
```

**レスポンス（成功）**:
```json
{
  "id": "backup-uuid-12345",
  "type": "manual",
  "file_path": "/backups/manual/itsm_nexus_manual_20260131_143025.db.gz",
  "file_size": 12345678,
  "checksum": "sha256:abcd1234...",
  "status": "success",
  "created_at": "2026-01-31T14:30:25Z",
  "created_by": "admin"
}
```

**レスポンス（失敗）**:
```json
{
  "error": "backup_failed",
  "message": "Insufficient disk space",
  "details": {
    "required": "20MB",
    "available": "10MB"
  }
}
```

**認証**: JWT トークン必須、Admin権限のみ

**レート制限**: 1分あたり5回

**優先度**: P0（必須）

---

#### FR-1.2.2: CLI スクリプト - backup.sh

**ファイル**: `scripts/backup.sh`

**使用方法**:
```bash
# フルバックアップ（デフォルト）
./scripts/backup.sh

# バックアップ種別指定
./scripts/backup.sh --type daily
./scripts/backup.sh --type weekly
./scripts/backup.sh --type monthly
./scripts/backup.sh --type manual --description "before-migration"

# オプション
./scripts/backup.sh --help
```

**実行条件**:
- Linux環境
- 実行権限: `chmod +x scripts/backup.sh`
- 実行ユーザー: root または sudoers

**出力**:
```
[2026-01-31 14:30:25] Starting backup (type: daily)
[2026-01-31 14:30:26] Database size: 12.5 MB
[2026-01-31 14:30:27] Available disk space: 500 MB
[2026-01-31 14:30:28] Creating backup...
[2026-01-31 14:30:32] Backup created: /backups/daily/itsm_nexus_daily_20260131_143025.db
[2026-01-31 14:30:33] Running integrity check...
[2026-01-31 14:30:34] Integrity check: OK
[2026-01-31 14:30:35] Compressing backup...
[2026-01-31 14:30:37] Compression complete (12.5 MB -> 3.2 MB)
[2026-01-31 14:30:38] Backup completed successfully
[2026-01-31 14:30:38] File: /backups/daily/itsm_nexus_daily_20260131_143025.db.gz
[2026-01-31 14:30:38] Checksum: sha256:abcd1234...
```

**エラーハンドリング**:
- ディスク容量不足: `exit 1`, エラーメッセージ出力
- DB存在しない: `exit 2`, エラーメッセージ出力
- 整合性チェック失敗: `exit 3`, エラーメッセージ + バックアップファイル削除

**優先度**: P0（必須）

---

#### FR-1.2.3: 管理画面 - バックアップボタン

**画面**: バックアップ管理画面（`/views/backup.html`）

**UI要素**:
```html
<button id="btn-backup-now" class="btn btn-primary">
  <i class="fas fa-database"></i> 今すぐバックアップ実行
</button>
```

**動作**:
1. ボタンクリック時、確認ダイアログ表示
   ```
   本当にバックアップを実行しますか？
   この操作には数秒〜数分かかる場合があります。
   [キャンセル] [実行]
   ```
2. 「実行」クリック後、プログレスバー表示
3. `POST /api/v1/backups` をコール
4. 成功時: 成功メッセージ + バックアップ一覧を更新
5. 失敗時: エラーメッセージ表示

**優先度**: P1（高）

---

### 1.3 リストア機能

#### FR-1.3.1: REST API - バックアップ一覧取得

**エンドポイント**: `GET /api/v1/backups`

**クエリパラメータ**:
```
?type=daily          // 任意: フィルター (daily/weekly/monthly/manual)
&limit=20            // 任意: 取得件数 (デフォルト: 20, 最大: 100)
&offset=0            // 任意: オフセット
&sort=created_at     // 任意: ソート項目 (created_at, file_size)
&order=desc          // 任意: ソート順 (asc, desc)
```

**レスポンス**:
```json
{
  "total": 15,
  "limit": 20,
  "offset": 0,
  "backups": [
    {
      "id": "backup-uuid-001",
      "type": "daily",
      "file_path": "/backups/daily/itsm_nexus_daily_20260131_020015.db.gz",
      "file_size": 3221225,
      "file_size_human": "3.2 MB",
      "checksum": "sha256:abcd1234...",
      "status": "success",
      "created_at": "2026-01-31T02:00:15Z",
      "created_by": "system",
      "description": null
    },
    {
      "id": "backup-uuid-002",
      "type": "weekly",
      "file_path": "/backups/weekly/itsm_nexus_weekly_20260126_030012.db.gz",
      "file_size": 3145728,
      "file_size_human": "3.0 MB",
      "checksum": "sha256:def56789...",
      "status": "success",
      "created_at": "2026-01-26T03:00:12Z",
      "created_by": "system",
      "description": null
    }
  ]
}
```

**認証**: JWT トークン必須、Admin権限のみ

**優先度**: P0（必須）

---

#### FR-1.3.2: REST API - リストア実行

**エンドポイント**: `POST /api/v1/backups/:id/restore`

**リクエスト**:
```json
{
  "confirm": true,  // 必須: 確認フラグ（誤操作防止）
  "backup_current": true  // 任意: リストア前に現在のDBをバックアップ（デフォルト: true）
}
```

**レスポンス（成功）**:
```json
{
  "status": "success",
  "restored_from": {
    "id": "backup-uuid-001",
    "file_path": "/backups/daily/itsm_nexus_daily_20260131_020015.db.gz",
    "created_at": "2026-01-31T02:00:15Z"
  },
  "backup_before_restore": {
    "file_path": "/backups/before_restore/itsm_nexus_before_restore_20260131_150530.db.gz",
    "file_size": 3456789
  },
  "restored_at": "2026-01-31T15:05:35Z"
}
```

**レスポンス（失敗）**:
```json
{
  "error": "restore_failed",
  "message": "Backup file integrity check failed",
  "details": {
    "file_path": "/backups/daily/itsm_nexus_daily_20260131_020015.db.gz",
    "error": "SQLITE_CORRUPT"
  }
}
```

**リストアプロセス**:
1. バックアップファイルの存在確認
2. 整合性チェック（解凍後、PRAGMA integrity_check）
3. 現在のDBを退避（`backup_current: true`の場合）
4. サービス停止（graceful shutdown、最大30秒待機）
5. DBファイルを置き換え
6. サービス起動
7. 検証クエリ実行（`SELECT COUNT(*) FROM sqlite_master`）
8. 監査ログ記録

**認証**: JWT トークン必須、Admin権限のみ

**レート制限**: 1時間あたり3回（誤操作防止）

**優先度**: P0（必須）

---

#### FR-1.3.3: CLI スクリプト - restore.sh

**ファイル**: `scripts/restore.sh`

**使用方法**:
```bash
# バックアップIDを指定してリストア
./scripts/restore.sh --id backup-uuid-001

# バックアップファイルパスを指定してリストア
./scripts/restore.sh --file /backups/daily/itsm_nexus_daily_20260131_020015.db.gz

# 最新のバックアップからリストア
./scripts/restore.sh --latest

# リストア前に現在のDBをバックアップしない（非推奨）
./scripts/restore.sh --id backup-uuid-001 --no-backup

# オプション
./scripts/restore.sh --help
```

**実行条件**:
- Linux環境
- 実行権限: `chmod +x scripts/restore.sh`
- 実行ユーザー: root または sudoers

**対話型確認**:
```
===============================================
  WARNING: データベースリストア
===============================================
リストア元: /backups/daily/itsm_nexus_daily_20260131_020015.db.gz
バックアップ作成日時: 2026-01-31 02:00:15

このリストアにより、現在のデータベースは上書きされます。
現在のデータベースは自動的にバックアップされますが、念のため確認してください。

本当にリストアを実行しますか？ (yes/no):
```

**出力**:
```
[2026-01-31 15:05:30] Starting database restore
[2026-01-31 15:05:31] Backup file: /backups/daily/itsm_nexus_daily_20260131_020015.db.gz
[2026-01-31 15:05:32] Decompressing backup...
[2026-01-31 15:05:34] Running integrity check...
[2026-01-31 15:05:35] Integrity check: OK
[2026-01-31 15:05:36] Creating safety backup of current database...
[2026-01-31 15:05:39] Safety backup: /backups/before_restore/itsm_nexus_before_restore_20260131_150530.db.gz
[2026-01-31 15:05:40] Stopping ITSM services...
[2026-01-31 15:05:45] Services stopped
[2026-01-31 15:05:46] Replacing database file...
[2026-01-31 15:05:47] Database replaced successfully
[2026-01-31 15:05:48] Starting ITSM services...
[2026-01-31 15:05:53] Services started
[2026-01-31 15:05:54] Running verification queries...
[2026-01-31 15:05:55] Verification: SUCCESS
[2026-01-31 15:05:56] Restore completed successfully
[2026-01-31 15:05:56] Database restored to: 2026-01-31 02:00:15
```

**ロールバック機能**:
リストア中にエラーが発生した場合、自動的にロールバック（退避したDBに戻す）

**優先度**: P0（必須）

---

#### FR-1.3.4: 管理画面 - バックアップ一覧とリストアUI

**画面**: バックアップ管理画面（`/views/backup.html`）

**UI要素**:

```html
<div class="backup-list">
  <table class="table">
    <thead>
      <tr>
        <th>バックアップ種別</th>
        <th>作成日時</th>
        <th>ファイルサイズ</th>
        <th>作成者</th>
        <th>ステータス</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="badge badge-primary">Daily</span></td>
        <td>2026-01-31 02:00:15</td>
        <td>3.2 MB</td>
        <td>system</td>
        <td><span class="badge badge-success">成功</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="restoreBackup('backup-uuid-001')">
            <i class="fas fa-undo"></i> リストア
          </button>
          <button class="btn btn-sm btn-secondary" onclick="downloadBackup('backup-uuid-001')">
            <i class="fas fa-download"></i> ダウンロード
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteBackup('backup-uuid-001')">
            <i class="fas fa-trash"></i> 削除
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**リストアボタン動作**:
1. クリック時、警告ダイアログ表示
   ```
   ⚠️ 警告: データベースリストア

   この操作により、現在のデータベースが以下のバックアップで上書きされます：
   - バックアップ日時: 2026-01-31 02:00:15
   - ファイルサイズ: 3.2 MB

   現在のデータベースは自動的にバックアップされますが、
   念のため重要なデータが保存されていることを確認してください。

   本当にリストアを実行しますか？
   [キャンセル] [実行]
   ```
2. 「実行」クリック後、プログレスバー表示
3. `POST /api/v1/backups/:id/restore` をコール
4. 完了後、ページリロード + 成功メッセージ

**優先度**: P1（高）

---

### 1.4 バックアップ管理

#### FR-1.4.1: 自動削除（保存期間管理）

**要件**:
システムは保存期間を超えた古いバックアップを自動的に削除しなければならない：

| 種別 | 保存期間 | 削除タイミング |
|------|---------|--------------|
| daily | 7日間 | 毎日 05:00 AM |
| weekly | 4週間（28日） | 毎週月曜 05:00 AM |
| monthly | 12ヶ月 | 毎月2日 05:00 AM |
| manual | 無期限 | 削除しない |

**削除プロセス**:
1. 対象ファイルを検索（ファイル名のタイムスタンプで判定）
2. `backup_logs`テーブルから対象レコードを取得
3. ファイル削除前に確認（ファイルサイズ、チェックサム）
4. ファイル削除
5. `backup_logs`のステータスを`deleted`に更新
6. 削除ログを記録

**優先度**: P0（必須）

---

#### FR-1.4.2: ディスク容量監視

**要件**:
システムはバックアップディレクトリのディスク容量を監視し、閾値を超えた場合にアラートを発しなければならない：

| 閾値 | アクション |
|------|----------|
| 使用率 80% | WARNログ出力 + メール通知 |
| 使用率 90% | ERRORログ出力 + メール通知 + 古いバックアップを追加削除 |
| 使用率 95% | CRITICALログ出力 + 緊急通知 + 自動バックアップ停止 |

**監視頻度**: 1時間ごと

**優先度**: P1（高）

---

#### FR-1.4.3: REST API - バックアップ削除

**エンドポイント**: `DELETE /api/v1/backups/:id`

**レスポンス（成功）**:
```json
{
  "status": "success",
  "deleted": {
    "id": "backup-uuid-001",
    "file_path": "/backups/daily/itsm_nexus_daily_20260131_020015.db.gz",
    "file_size": 3221225,
    "deleted_at": "2026-01-31T16:00:00Z",
    "deleted_by": "admin"
  }
}
```

**制約**:
- 最新のバックアップ（各種別の最新1件）は削除不可
- 削除後、少なくとも1件のバックアップが残っていること

**認証**: JWT トークン必須、Admin権限のみ

**優先度**: P1（高）

---

#### FR-1.4.4: 整合性チェック（週次）

**要件**:
システムは週次で全バックアップファイルの整合性をチェックしなければならない：

**実行タイミング**: 毎週土曜 01:00 AM

**チェック内容**:
1. ファイル存在確認
2. ファイルサイズが記録と一致するか
3. チェックサム検証（SHA-256）
4. 解凍テスト
5. SQLite整合性チェック（`PRAGMA integrity_check`）

**結果記録**:
- 整合性チェック結果を`backup_integrity_checks`テーブルに記録
- 失敗したバックアップはステータスを`corrupted`に更新
- アラート通知（メール）

**優先度**: P1（高）

---

### 1.5 監視・通知

#### FR-1.5.1: 監査ログ記録

**要件**:
すべてのバックアップ/リストア操作を監査ログに記録しなければならない：

**記録項目**:
```sql
CREATE TABLE backup_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,        -- 'create', 'restore', 'delete'
  backup_id TEXT,
  user_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL,           -- 'success', 'failure'
  error_message TEXT,
  details TEXT,                   -- JSON形式の詳細情報
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**記録対象操作**:
- バックアップ作成（自動/手動）
- リストア実行
- バックアップ削除
- バックアップダウンロード

**優先度**: P0（必須、コンプライアンス要件）

---

#### FR-1.5.2: メール通知

**要件**:
重要なイベント発生時、指定されたメールアドレスに通知を送信しなければならない：

**通知対象イベント**:

| イベント | 件名 | 優先度 |
|---------|------|--------|
| バックアップ失敗 | `[CRITICAL] ITSM Backup Failed` | 即座 |
| リストア実行 | `[WARNING] ITSM Database Restored` | 即座 |
| ディスク容量不足 | `[WARNING] ITSM Backup Storage Low` | 1時間ごと |
| 整合性チェック失敗 | `[ERROR] ITSM Backup Integrity Failed` | 即座 |

**メールテンプレート例**:
```
件名: [CRITICAL] ITSM Backup Failed

システム: ITSM-Sec Nexus
発生日時: 2026-01-31 02:00:15
エラー内容: Insufficient disk space

詳細:
- バックアップ種別: daily
- 必要容量: 20 MB
- 利用可能容量: 10 MB

対応:
1. ディスク容量を確認してください
2. 不要なバックアップファイルを削除してください
3. ストレージの拡張を検討してください

ダッシュボード: https://192.168.0.187:6443/views/backup.html
```

**設定**:
通知先メールアドレスは`.env`で設定：
```
BACKUP_NOTIFICATION_EMAIL=admin@example.com,ops@example.com
```

**優先度**: P1（高）

---

## 2. 非機能要件

### 2.1 パフォーマンス

#### NFR-2.1.1: バックアップ実行時間

| データベースサイズ | 最大実行時間 | 測定基準 |
|------------------|------------|---------|
| 10 MB | ≤ 5秒 | P95 |
| 100 MB | ≤ 30秒 | P95 |
| 1 GB | ≤ 5分 | P95 |

**優先度**: P0

---

#### NFR-2.1.2: リストア実行時間（RTO）

**目標**: ≤ 15分（Recovery Time Objective）

**内訳**:
- ファイル解凍: ≤ 2分
- 整合性チェック: ≤ 1分
- サービス停止: ≤ 30秒
- ファイル置き換え: ≤ 10秒
- サービス起動: ≤ 1分
- 検証: ≤ 30秒
- 余裕: 10分

**優先度**: P0（SLA要件）

---

#### NFR-2.1.3: API応答時間

| API | 目標応答時間 | 測定基準 |
|-----|------------|---------|
| GET /api/v1/backups | ≤ 200ms | P95 |
| POST /api/v1/backups | ≤ 30秒 | P95 |
| POST /api/v1/backups/:id/restore | ≤ 15分 | P95 |
| DELETE /api/v1/backups/:id | ≤ 500ms | P95 |

**優先度**: P1

---

### 2.2 可用性

#### NFR-2.2.1: スケジューラー稼働率

**目標**: ≥ 99.9%（月間ダウンタイム: 43分以内）

**測定方法**: スケジューラーのヘルスチェック（1分ごと）

**優先度**: P0

---

#### NFR-2.2.2: バックアップ成功率

**目標**: ≥ 99%

**計算式**: 成功回数 / 総実行回数 × 100

**優先度**: P0

---

### 2.3 スケーラビリティ

#### NFR-2.3.1: ストレージ容量

**初期容量**: 50 GB

**拡張性**: 500 GBまで対応可能

**優先度**: P1

---

#### NFR-2.3.2: バックアップ保存数

**想定保存数**:
- daily: 7件
- weekly: 4件
- monthly: 12件
- manual: 最大100件

**合計**: 最大123件

**優先度**: P1

---

### 2.4 セキュリティ

#### NFR-2.4.1: アクセス制御

**要件**:
- すべてのバックアップ/リストア操作はAdmin権限が必須
- RBACによる権限チェック
- JWTトークン検証

**優先度**: P0（セキュリティ要件）

---

#### NFR-2.4.2: ファイルアクセス権限

**要件**:
バックアップディレクトリとファイルのアクセス権限：

```bash
/backups/         : drwx------ (700) - root:root
/backups/daily/   : drwx------ (700) - root:root
/backups/*.db.gz  : -rw------- (600) - root:root
```

**優先度**: P0（セキュリティ要件）

---

#### NFR-2.4.3: データ暗号化

**要件**（Phase 9.2で実装予定）:
- バックアップファイルをAES-256で暗号化
- 暗号化キーは環境変数またはキー管理サービスで管理

**優先度**: P2（将来実装）

---

### 2.5 保守性

#### NFR-2.5.1: ログ出力

**要件**:
すべてのバックアップ/リストア操作でログを出力：

**ログレベル**:
- INFO: 正常な操作（バックアップ成功、削除成功）
- WARN: 警告（ディスク容量警告、古いバックアップ削除）
- ERROR: エラー（バックアップ失敗、整合性チェック失敗）
- CRITICAL: 致命的エラー（リストア失敗、ディスク容量枯渇）

**ログフォーマット**:
```
[2026-01-31 02:00:15] [INFO] [BackupService] Daily backup created successfully (file: /backups/daily/itsm_nexus_daily_20260131_020015.db.gz, size: 3.2 MB, duration: 4.2s)
```

**優先度**: P0

---

#### NFR-2.5.2: エラーハンドリング

**要件**:
すべてのエラーは適切にハンドリングし、ユーザーフレンドリーなメッセージを返す：

**エラーメッセージ例**:
```json
{
  "error": "insufficient_disk_space",
  "message": "バックアップを作成するためのディスク容量が不足しています。",
  "user_action": "不要なバックアップファイルを削除するか、ストレージを拡張してください。",
  "details": {
    "required": "20 MB",
    "available": "10 MB"
  }
}
```

**優先度**: P1

---

### 2.6 コンプライアンス

#### NFR-2.6.1: ISO 20000準拠

**要件**:
ISO/IEC 20000-1:2018の以下の要件に準拠：

- **6.2 サービス継続性および可用性管理**
  - バックアップ手順の文書化 ✅
  - 定期的なバックアップ実行 ✅
  - リストアテストの実施 ✅（週次）

**証跡**:
- バックアップログ（`backup_logs`テーブル）
- 監査ログ（`backup_audit_logs`テーブル）
- 週次整合性チェックレポート

**優先度**: P0（監査要件）

---

#### NFR-2.6.2: NIST CSF 2.0準拠

**要件**:
NIST CSF 2.0の以下の要件に準拠：

- **PR.IP-4: Backups of information are conducted, maintained, and tested**
  - 定期的なバックアップ ✅
  - バックアップの保守（整合性チェック） ✅
  - バックアップのテスト（週次整合性チェック、月次リストアテスト） ✅

**証跡**:
- バックアップスケジュール実行ログ
- 整合性チェックレポート
- リストアテスト結果

**優先度**: P0（監査要件）

---

## 3. 制約事項

### 3.1 技術的制約

| 制約 | 詳細 |
|------|------|
| データベース | SQLiteのみ対応（PostgreSQLは将来対応） |
| 圧縮形式 | gzipのみ（tar.gzは対応しない） |
| 暗号化 | Phase 9.1では未対応（Phase 9.2で実装予定） |
| クラウドストレージ | Phase 9.1では未対応（Phase 9.3で実装予定） |
| オンラインバックアップ | SQLiteの制約により、バックアップ中は短時間のロックが発生 |

---

### 3.2 運用上の制約

| 制約 | 詳細 |
|------|------|
| バックアップ実行時間 | 深夜時間帯（02:00-05:00）に実行（サービスへの影響を最小化） |
| リストア実行 | サービス停止が必要（ダウンタイム発生） |
| ディスク容量 | バックアップには最低でもDB容量の2倍のディスク容量が必要 |
| 実行ユーザー | CLIスクリプトはroot権限が必要 |

---

### 3.3 環境制約

| 制約 | 詳細 |
|------|------|
| OS | Linux（Ubuntu 20.04+ 推奨）、Windows（WSL2経由） |
| Node.js | v20.x LTS |
| ディスク | 最低50GB（推奨100GB） |
| メモリ | バックアップ実行時に最低2GB必要 |

---

## 4. 受入基準

### 4.1 機能テスト

**テストケース**: 50件以上

**主要テストシナリオ**:
1. 自動バックアップ実行（日次/週次/月次）
2. 手動バックアップ実行（API/CLI/UI）
3. バックアップ一覧取得
4. リストア実行（成功ケース）
5. リストア実行（失敗ケース・ロールバック）
6. バックアップ削除
7. 古いバックアップ自動削除
8. ディスク容量監視・アラート
9. 整合性チェック
10. 監査ログ記録

**合格基準**: 全テストケースPASS

---

### 4.2 非機能テスト

**パフォーマンステスト**:
- 10MB DBで5秒以内にバックアップ完了
- リストアが15分以内に完了（RTO達成）

**セキュリティテスト**:
- Admin権限なしでAPI呼び出し → 403エラー
- 不正なJWTトークン → 401エラー

**負荷テスト**:
- 100件のバックアップファイルが存在する状態でAPI応答時間 ≤ 200ms

**合格基準**: 全非機能要件を満たす

---

### 4.3 ディザスタリカバリテスト

**テストシナリオ**:
1. データベースファイルを完全削除
2. 最新のバックアップからリストア実行
3. データ整合性確認（レコード数、主要データ）

**合格基準**:
- リストア成功
- データ損失ゼロ
- RTO 15分以内達成

---

### 4.4 ドキュメント

**必須ドキュメント**:
- [ ] 運用ガイド（`docs-prod/BACKUP_OPERATIONS.md`）
- [ ] 技術仕様書（`docs-dev/BACKUP_DESIGN.md`）
- [ ] Runbook（`docs-prod/DISASTER_RECOVERY.md`）
- [ ] README更新

**合格基準**: 全ドキュメント作成完了、レビューPASS

---

## 5. 優先順位マトリクス

| 要件ID | 要件名 | 優先度 | 実装Week |
|--------|--------|--------|---------|
| FR-1.1.1 | 定期バックアップスケジューリング | P0 | Week 1 |
| FR-1.1.3 | バックアップ実行ロジック | P0 | Week 1 |
| FR-1.2.1 | REST API - バックアップ作成 | P0 | Week 1 |
| FR-1.2.2 | CLI - backup.sh | P0 | Week 1 |
| FR-1.3.1 | REST API - バックアップ一覧取得 | P0 | Week 1 |
| FR-1.3.2 | REST API - リストア実行 | P0 | Week 1 |
| FR-1.3.3 | CLI - restore.sh | P0 | Week 1 |
| FR-1.4.1 | 自動削除（保存期間管理） | P0 | Week 1 |
| FR-1.5.1 | 監査ログ記録 | P0 | Week 1 |
| FR-1.2.3 | 管理画面 - バックアップボタン | P1 | Week 2 |
| FR-1.3.4 | 管理画面 - バックアップ一覧とリストアUI | P1 | Week 2 |
| FR-1.4.2 | ディスク容量監視 | P1 | Week 2 |
| FR-1.4.3 | REST API - バックアップ削除 | P1 | Week 2 |
| FR-1.4.4 | 整合性チェック（週次） | P1 | Week 2 |
| FR-1.5.2 | メール通知 | P1 | Week 2 |

---

**承認履歴**:
- 2026-01-31: 初版作成（spec-planner）
- 承認待ち

**次のステップ**:
- arch-reviewer による設計レビュー
- アーキテクチャ設計書の作成
