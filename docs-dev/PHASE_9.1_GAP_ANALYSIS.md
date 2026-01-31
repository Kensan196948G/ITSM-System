# Phase 9.1: バックアップ・リストア機能 - ギャップ分析レポート

**作成日**: 2026-01-31
**作成者**: arch-reviewer SubAgent
**バージョン**: 1.0
**ステータス**: Draft

---

## 📋 目次

1. [エグゼクティブサマリー](#1-エグゼクティブサマリー)
2. [既存インフラ分析](#2-既存インフラ分析)
3. [要件カバレッジマトリクス](#3-要件カバレッジマトリクス)
4. [ギャップ詳細](#4-ギャップ詳細)
5. [拡張・統合方針](#5-拡張統合方針)
6. [リスク評価](#6-リスク評価)
7. [推奨アプローチ](#7-推奨アプローチ)

---

## 1. エグゼクティブサマリー

### 1.1 分析結果サマリー

| 項目 | 評価 |
|------|------|
| **既存インフラの成熟度** | 🟡 中程度（60%実装済み） |
| **要件カバレッジ** | 🟡 60% (9/15機能要件) |
| **セキュリティ準拠** | 🔴 40% (5/12非機能要件) |
| **拡張コスト** | 🟢 低（既存コード再利用可） |
| **統合難易度** | 🟢 低 |

### 1.2 主要発見事項

✅ **強み:**
- 高品質なバックアップCLIスクリプト実装済み（`backup.sh`）
- node-cronベースのスケジューラーインフラ整備済み（`schedulerService.js`）
- レポート機能のテーブル設計パターンが参考可能
- SQLダンプ + バイナリバックアップの両方対応
- リモートバックアップ対応（rsync/S3）

⚠️ **ギャップ:**
- REST API未実装（バックアップ/リストア操作）
- データベーステーブル未作成（backup_logs, backup_audit_logs）
- 管理画面UI未実装
- リストア機能未実装
- 監査ログ統合なし
- 整合性チェック自動化なし

🚨 **重大な欠落:**
- RBAC統合なし（Admin権限チェック）
- 監査ログ記録なし（ISO 20000要件）
- リストアプロセス未検証（RTO未測定）

---

## 2. 既存インフラ分析

### 2.1 既存バックアップスクリプト分析

**ファイル**: `scripts/Linux/operations/backup.sh`

#### 実装済み機能

| 機能 | 実装状況 | 品質評価 | 備考 |
|------|---------|---------|------|
| **日次/週次/月次バックアップ** | ✅ 実装済み | 🟢 高品質 | 曜日・日付ベースの自動判定 |
| **SQLダンプ** | ✅ 実装済み | 🟢 高品質 | gzip圧縮対応 |
| **バイナリコピー** | ✅ 実装済み | 🟢 高品質 | WAL/SHMファイル対応 |
| **SHA256チェックサム** | ✅ 実装済み | 🟢 高品質 | 改ざん検知対応 |
| **保存期間管理** | ✅ 実装済み | 🟢 高品質 | daily:7日, weekly:4週, monthly:12ヶ月 |
| **リモートバックアップ** | ✅ 実装済み | 🟡 中品質 | rsync/S3対応（オプション） |
| **ログ出力** | ✅ 実装済み | 🟡 中品質 | カラー出力、構造化ログなし |

#### 未実装機能

| 機能 | Phase 9.1要件 | 優先度 |
|------|-------------|--------|
| **PRAGMA integrity_check** | 必須 (FR-1.1.3) | P0 |
| **データベース統合** | 必須 (FR-1.5.1) | P0 |
| **監査ログ記録** | 必須 (FR-1.5.1) | P0 |
| **メール通知** | 必須 (FR-1.5.2) | P1 |
| **ディスク容量チェック** | 必須 (FR-1.1.3) | P0 |
| **リストア機能** | 必須 (FR-1.3.3) | P0 |

#### コード品質評価

```bash
# 強み
✅ エラーハンドリング（set -e）
✅ カラー出力（視認性高い）
✅ 柔軟な設定（環境変数対応）
✅ 複数バックアップ方式（SQLダンプ+バイナリ）
✅ リモートバックアップ対応

# 改善点
⚠️ 構造化ログなし（JSON形式推奨）
⚠️ データベース統合なし（メタデータ記録）
⚠️ PRAGMA integrity_checkなし
⚠️ リカバリ機能なし
⚠️ RBAC統合なし
```

---

### 2.2 既存スケジューラー分析

**ファイル**: `backend/services/schedulerService.js`

#### 実装済み機能

| 機能 | 実装状況 | 活用可能性 |
|------|---------|----------|
| **node-cron統合** | ✅ 実装済み | 🟢 高 - バックアップスケジューリングに再利用可 |
| **cron式バリデーション** | ✅ 実装済み | 🟢 高 |
| **タイムゾーン対応** | ✅ 実装済み | 🟢 高 - Asia/Tokyo設定済み |
| **ジョブ管理** | ✅ 実装済み | 🟢 高 - start/stop機能 |
| **データベース統合** | ✅ 実装済み | 🟢 高 - scheduled_reports/report_history パターン |
| **メール通知** | ✅ 実装済み | 🟢 高 - emailService統合済み |
| **次回実行日時計算** | ✅ 実装済み | 🟢 高 - calculateNextRunAt() |
| **エラーハンドリング** | ✅ 実装済み | 🟢 高 - try-catch完備 |

#### 再利用可能パターン

```javascript
// ✅ そのまま再利用可能
- cron.schedule() パターン
- initializeScheduler() / stopScheduler() パターン
- calculateNextRunAt() ロジック
- メール通知テンプレート（HTML/Text）
- データベース履歴記録パターン

// 🔄 カスタマイズ必要
- ジョブ実行ロジック（バックアップ固有処理）
- テーブルスキーマ（backup_logs, backup_audit_logs）
- エラー通知条件（バックアップ失敗時）
```

---

### 2.3 既存テーブル設計パターン分析

**参考**: `backend/migrations/20260107135147_add_report_tables.js`

#### 設計パターン抽出

```javascript
// ✅ 優れた設計パターン
1. **IDパターン**
   - id (primary key, auto increment)
   - {entity}_id (unique string identifier)
   → backup_logs: id, backup_id

2. **ステータス管理**
   - status (pending, generating, completed, failed)
   → backup_logs: status (success, failure, in_progress)

3. **タイムスタンプ**
   - created_at, updated_at, started_at, completed_at
   → backup_logs: created_at, started_at, completed_at

4. **JSON格納**
   - parameters (JSON), recipients (JSON), filters (JSON)
   → backup_logs: metadata (JSON)

5. **外部キー**
   - created_by → users.id
   - scheduled_report_id → scheduled_reports.id

6. **インデックス**
   - 主要検索カラム（status, created_at, report_type）
```

#### バックアップテーブル適用例

```sql
CREATE TABLE backup_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  backup_id TEXT NOT NULL UNIQUE,              -- 'BKP-20260131-020015'
  backup_type TEXT NOT NULL,                   -- 'daily', 'weekly', 'monthly', 'manual'
  file_path TEXT NOT NULL,                     -- '/backups/daily/itsm_nexus_daily_...'
  file_size INTEGER,                           -- バイト単位
  checksum TEXT,                               -- 'sha256:abcd1234...'
  status TEXT NOT NULL DEFAULT 'in_progress',  -- 'success', 'failure', 'in_progress'
  error_message TEXT,
  metadata TEXT,                               -- JSON: {compression_ratio, duration, etc}
  created_by INTEGER REFERENCES users(id),
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_logs_type ON backup_logs(backup_type);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_created_at ON backup_logs(created_at);
```

---

## 3. 要件カバレッジマトリクス

### 3.1 機能要件カバレッジ

| 要件ID | 要件名 | 優先度 | 既存実装 | カバレッジ | ギャップ |
|--------|--------|--------|---------|----------|---------|
| **FR-1.1.1** | 定期バックアップスケジューリング | P0 | backup.sh + cron | 🟡 50% | node-cron統合なし、DB記録なし |
| **FR-1.1.2** | バックアップファイル命名規則 | P0 | backup.sh | 🟢 100% | - |
| **FR-1.1.3** | バックアップ実行ロジック | P0 | backup.sh | 🟡 60% | PRAGMA整合性チェックなし |
| **FR-1.2.1** | REST API - バックアップ作成 | P0 | なし | 🔴 0% | 完全未実装 |
| **FR-1.2.2** | CLI - backup.sh | P0 | backup.sh | 🟢 90% | integrity_check追加のみ |
| **FR-1.2.3** | 管理画面 - バックアップボタン | P1 | なし | 🔴 0% | 完全未実装 |
| **FR-1.3.1** | REST API - バックアップ一覧取得 | P0 | なし | 🔴 0% | 完全未実装 |
| **FR-1.3.2** | REST API - リストア実行 | P0 | なし | 🔴 0% | 完全未実装 |
| **FR-1.3.3** | CLI - restore.sh | P0 | なし | 🔴 0% | 完全未実装 |
| **FR-1.3.4** | 管理画面 - バックアップ一覧とリストアUI | P1 | なし | 🔴 0% | 完全未実装 |
| **FR-1.4.1** | 自動削除（保存期間管理） | P0 | backup.sh | 🟢 100% | - |
| **FR-1.4.2** | ディスク容量監視 | P1 | なし | 🔴 0% | 完全未実装 |
| **FR-1.4.3** | REST API - バックアップ削除 | P1 | なし | 🔴 0% | 完全未実装 |
| **FR-1.4.4** | 整合性チェック（週次） | P1 | なし | 🔴 0% | 完全未実装 |
| **FR-1.5.1** | 監査ログ記録 | P0 | なし | 🔴 0% | 完全未実装（ISO 20000要件） |
| **FR-1.5.2** | メール通知 | P1 | schedulerService | 🟡 50% | バックアップ失敗時の通知未実装 |

**カバレッジサマリー:**
- ✅ **完全実装**: 3/15 (20%)
- 🟡 **部分実装**: 3/15 (20%)
- 🔴 **未実装**: 9/15 (60%)

---

### 3.2 非機能要件カバレッジ

| 要件ID | 要件名 | 優先度 | 既存実装 | カバレッジ | ギャップ |
|--------|--------|--------|---------|----------|---------|
| **NFR-2.1.1** | バックアップ実行時間 | P0 | backup.sh | 🟡 50% | 未測定 |
| **NFR-2.1.2** | RTO（リストア実行時間） | P0 | なし | 🔴 0% | リストア機能未実装 |
| **NFR-2.1.3** | API応答時間 | P1 | なし | 🔴 0% | API未実装 |
| **NFR-2.2.1** | スケジューラー稼働率 | P0 | cron | 🟢 80% | ヘルスチェック未実装 |
| **NFR-2.2.2** | バックアップ成功率 | P0 | なし | 🔴 0% | 未測定 |
| **NFR-2.4.1** | アクセス制御 | P0 | なし | 🔴 0% | RBAC統合なし |
| **NFR-2.4.2** | ファイルアクセス権限 | P0 | backup.sh | 🟡 50% | chmod設定なし |
| **NFR-2.5.1** | ログ出力 | P0 | backup.sh | 🟡 60% | 構造化ログなし |
| **NFR-2.5.2** | エラーハンドリング | P1 | backup.sh | 🟢 80% | APIエラーハンドリング未実装 |
| **NFR-2.6.1** | ISO 20000準拠 | P0 | なし | 🔴 0% | 監査ログなし |
| **NFR-2.6.2** | NIST CSF 2.0準拠 | P0 | backup.sh | 🟡 40% | 整合性チェックテスト未実装 |

**カバレッジサマリー:**
- ✅ **達成**: 2/11 (18%)
- 🟡 **部分達成**: 5/11 (45%)
- 🔴 **未達成**: 4/11 (37%)

---

## 4. ギャップ詳細

### 4.1 P0（必須）ギャップ

#### ギャップ #1: REST API完全未実装

**影響度**: 🔴 Critical
**工数見積**: 3日

**詳細:**
- 4つのエンドポイント未実装:
  - `POST /api/v1/backups` - バックアップ作成
  - `GET /api/v1/backups` - バックアップ一覧取得
  - `POST /api/v1/backups/:id/restore` - リストア実行
  - `DELETE /api/v1/backups/:id` - バックアップ削除

**必要作業:**
1. `backend/routes/backups.js` 作成
2. RBAC統合（Admin権限チェック）
3. backup.shとの統合（child_process.spawn）
4. エラーハンドリング実装

---

#### ギャップ #2: データベーステーブル未作成

**影響度**: 🔴 Critical
**工数見積**: 1日

**詳細:**
3つのテーブルが必要:
- `backup_logs` - バックアップ実行履歴
- `backup_audit_logs` - 監査ログ（ISO 20000要件）
- `backup_integrity_checks` - 整合性チェック履歴

**必要作業:**
1. マイグレーションファイル作成: `backend/migrations/20260131_add_backup_tables.js`
2. scheduled_reports/report_history パターンに倣った設計
3. インデックス設計（検索パフォーマンス最適化）

---

#### ギャップ #3: リストア機能完全未実装

**影響度**: 🔴 Critical
**工数見積**: 2日

**詳細:**
- restore.sh 未実装
- リストアプロセス未定義
- RTO未測定
- ロールバック機能なし

**必要作業:**
1. `scripts/Linux/operations/restore.sh` 作成
2. リストアプロセス設計（サービス停止→DB置き換え→起動）
3. ロールバック機能実装
4. RTOパフォーマンステスト

---

#### ギャップ #4: 監査ログ統合なし

**影響度**: 🔴 Critical（ISO 20000要件）
**工数見積**: 1日

**詳細:**
- すべてのバックアップ/リストア操作の監査ログ記録が必須
- 現在は通常のログ出力のみ

**必要作業:**
1. `backup_audit_logs` テーブル設計
2. 既存の監査ログミドルウェアとの統合
3. 操作者、IPアドレス、操作結果の記録

---

#### ギャップ #5: PRAGMA integrity_check未実装

**影響度**: 🟡 High
**工数見積**: 0.5日

**詳細:**
- backup.sh でSQLite整合性チェックなし
- バックアップファイルの妥当性検証が不十分

**必要作業:**
1. backup.sh に `PRAGMA integrity_check` 追加
2. チェック失敗時の処理（バックアップファイル削除）
3. エラー通知

---

### 4.2 P1（高優先度）ギャップ

#### ギャップ #6: 管理画面UI未実装

**影響度**: 🟡 High
**工数見積**: 2日

**必要作業:**
1. `frontend/views/backup.html` 作成
2. バックアップ一覧表示（テーブル）
3. ワンクリックバックアップボタン
4. リストア実行UI（確認ダイアログ含む）

---

#### ギャップ #7: ディスク容量監視未実装

**影響度**: 🟡 High
**工数見積**: 1日

**必要作業:**
1. ディスク容量チェック機能（schedulerService統合）
2. 閾値設定（80%, 90%, 95%）
3. アラート通知（メール）

---

#### ギャップ #8: 整合性チェック自動化未実装

**影響度**: 🟡 High
**工数見積**: 1日

**必要作業:**
1. 週次整合性チェックジョブ（schedulerService統合）
2. `backup_integrity_checks` テーブル記録
3. 失敗時のアラート

---

## 5. 拡張・統合方針

### 5.1 アーキテクチャ方針

#### 原則1: 既存コードの最大再利用

```
✅ DO:
- backup.sh を REST API から child_process で呼び出し
- schedulerService.js パターンを BackupScheduler に適用
- emailService.js をそのまま利用

❌ DON'T:
- backup.sh を完全書き換え
- 新しいスケジューラーライブラリ導入
- メール送信ロジックの再実装
```

#### 原則2: レイヤー分離

```
┌─────────────────────────────────────┐
│  Presentation Layer                 │
│  - REST API (routes/backups.js)     │
│  - Frontend UI (views/backup.html)  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Business Logic Layer               │
│  - BackupService (services/)        │
│  - BackupScheduler (services/)      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Infrastructure Layer               │
│  - CLI Scripts (backup.sh, etc.)    │
│  - Database (backup_logs tables)    │
│  - File System (backups/ directory) │
└─────────────────────────────────────┘
```

---

### 5.2 統合ポイント

#### 統合 #1: backup.sh → BackupService

```javascript
// backend/services/backupService.js
const { spawn } = require('child_process');

async function createBackup(type = 'manual', userId, description) {
  // 1. データベースレコード作成（backup_logs）
  const backupId = `BKP-${Date.now()}`;
  await db('backup_logs').insert({
    backup_id: backupId,
    backup_type: type,
    status: 'in_progress',
    created_by: userId,
    started_at: new Date()
  });

  // 2. backup.sh 実行（既存スクリプト再利用）
  const backupProcess = spawn('./scripts/Linux/operations/backup.sh', [type]);

  backupProcess.on('close', async (code) => {
    if (code === 0) {
      // 成功: データベース更新
      await db('backup_logs').where('backup_id', backupId).update({
        status: 'success',
        completed_at: new Date()
      });

      // 監査ログ記録
      await recordAuditLog('backup_create', backupId, userId, 'success');
    } else {
      // 失敗: エラー記録 + 通知
      await db('backup_logs').where('backup_id', backupId).update({
        status: 'failure',
        error_message: stderr,
        completed_at: new Date()
      });

      // エラー通知
      await sendEmail({
        to: process.env.BACKUP_NOTIFICATION_EMAIL,
        subject: '[CRITICAL] ITSM Backup Failed',
        text: `Backup ${backupId} failed: ${stderr}`
      });
    }
  });

  return { backupId, status: 'in_progress' };
}
```

---

#### 統合 #2: schedulerService → BackupScheduler

```javascript
// backend/services/backupScheduler.js
const cron = require('node-cron');
const { createBackup } = require('./backupService');

const scheduledJobs = {};

function initializeBackupScheduler(db) {
  // 日次バックアップ（毎日 02:00 AM）
  scheduledJobs.daily = cron.schedule('0 2 * * *', async () => {
    console.log('[BackupScheduler] Running daily backup job');
    await createBackup('daily', null, 'Scheduled daily backup');
  }, { timezone: process.env.TZ || 'Asia/Tokyo' });

  // 週次バックアップ（毎週日曜 03:00 AM）
  scheduledJobs.weekly = cron.schedule('0 3 * * 0', async () => {
    console.log('[BackupScheduler] Running weekly backup job');
    await createBackup('weekly', null, 'Scheduled weekly backup');
  }, { timezone: process.env.TZ || 'Asia/Tokyo' });

  // 月次バックアップ（毎月1日 04:00 AM）
  scheduledJobs.monthly = cron.schedule('0 4 1 * *', async () => {
    console.log('[BackupScheduler] Running monthly backup job');
    await createBackup('monthly', null, 'Scheduled monthly backup');
  }, { timezone: process.env.TZ || 'Asia/Tokyo' });

  // 整合性チェック（毎週土曜 01:00 AM）
  scheduledJobs.integrityCheck = cron.schedule('0 1 * * 6', async () => {
    console.log('[BackupScheduler] Running integrity check job');
    await runIntegrityCheck(db);
  }, { timezone: process.env.TZ || 'Asia/Tokyo' });

  console.log('[BackupScheduler] Backup scheduler initialized');
}

function stopBackupScheduler() {
  Object.values(scheduledJobs).forEach(job => job.stop());
  console.log('[BackupScheduler] All backup jobs stopped');
}

module.exports = { initializeBackupScheduler, stopBackupScheduler };
```

---

### 5.3 新規実装コンポーネント

#### コンポーネント #1: REST API Routes

**ファイル**: `backend/routes/backups.js`

```javascript
const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/rbac');
const { createBackup, listBackups, restoreBackup, deleteBackup } = require('../services/backupService');

// POST /api/v1/backups - バックアップ作成
router.post('/', requireRole('admin'), async (req, res) => {
  const { type = 'manual', description } = req.body;
  const result = await createBackup(type, req.user.id, description);
  res.json(result);
});

// GET /api/v1/backups - バックアップ一覧
router.get('/', requireRole('admin'), async (req, res) => {
  const backups = await listBackups(req.query);
  res.json(backups);
});

// POST /api/v1/backups/:id/restore - リストア実行
router.post('/:id/restore', requireRole('admin'), async (req, res) => {
  const result = await restoreBackup(req.params.id, req.user.id, req.body);
  res.json(result);
});

// DELETE /api/v1/backups/:id - バックアップ削除
router.delete('/:id', requireRole('admin'), async (req, res) => {
  await deleteBackup(req.params.id, req.user.id);
  res.json({ success: true });
});

module.exports = router;
```

---

#### コンポーネント #2: Database Migration

**ファイル**: `backend/migrations/20260131_add_backup_tables.js`

```javascript
exports.up = function(knex) {
  return knex.schema
    // backup_logs テーブル
    .createTable('backup_logs', table => {
      table.increments('id').primary();
      table.string('backup_id', 50).notNullable().unique();
      table.string('backup_type', 50).notNullable(); // daily, weekly, monthly, manual
      table.string('file_path', 500);
      table.integer('file_size');
      table.string('checksum', 100);
      table.string('status', 50).notNullable().defaultTo('in_progress');
      table.text('error_message');
      table.text('metadata'); // JSON: {compression_ratio, duration, etc}
      table.text('description');
      table.integer('created_by').references('id').inTable('users');
      table.timestamp('started_at').defaultTo(knex.fn.now());
      table.timestamp('completed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('backup_type');
      table.index('status');
      table.index('created_at');
    })

    // backup_audit_logs テーブル
    .createTable('backup_audit_logs', table => {
      table.increments('id').primary();
      table.string('operation', 50).notNullable(); // create, restore, delete, download
      table.string('backup_id', 50);
      table.integer('user_id').notNullable().references('id').inTable('users');
      table.string('username', 255).notNullable();
      table.string('ip_address', 50);
      table.text('user_agent');
      table.string('status', 50).notNullable(); // success, failure
      table.text('error_message');
      table.text('details'); // JSON
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('operation');
      table.index('user_id');
      table.index('created_at');
    })

    // backup_integrity_checks テーブル
    .createTable('backup_integrity_checks', table => {
      table.increments('id').primary();
      table.string('check_id', 50).notNullable().unique();
      table.string('backup_id', 50).notNullable();
      table.string('check_type', 50).notNullable(); // file_exists, checksum, decompression, pragma_check
      table.string('status', 50).notNullable(); // pass, fail
      table.text('error_message');
      table.text('details'); // JSON
      table.timestamp('checked_at').defaultTo(knex.fn.now());

      table.index('backup_id');
      table.index('status');
      table.index('checked_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('backup_integrity_checks')
    .dropTableIfExists('backup_audit_logs')
    .dropTableIfExists('backup_logs');
};
```

---

## 6. リスク評価

### 6.1 技術リスク

| リスク | 確率 | 影響 | 対策 |
|-------|------|------|------|
| **backup.sh と Node.js の統合失敗** | 🟡 中 | 🔴 高 | child_process のエラーハンドリング強化 |
| **リストア時のダウンタイム延長** | 🟡 中 | 🔴 高 | リストアプロセスの事前テスト |
| **ディスク容量不足** | 🟢 低 | 🔴 高 | ディスク容量監視ジョブ実装 |
| **バックアップファイル破損** | 🟢 低 | 🔴 高 | 整合性チェック週次実行 |
| **RBAC統合不備** | 🟢 低 | 🟡 中 | 既存のrequireRole ミドルウェア活用 |

---

### 6.2 運用リスク

| リスク | 確率 | 影響 | 対策 |
|-------|------|------|------|
| **バックアップ失敗の見逃し** | 🟡 中 | 🔴 高 | メール通知 + ダッシュボード表示 |
| **リストア手順の誤操作** | 🟡 中 | 🔴 高 | 確認ダイアログ + Runbook整備 |
| **保存期間設定ミス** | 🟢 低 | 🟡 中 | デフォルト値設定 + 設定バリデーション |

---

## 7. 推奨アプローチ

### 7.1 実装戦略

#### 戦略: インクリメンタル拡張

```
Week 1 (Day 1-5):
  Phase 1: Backend実装
    ✅ データベーステーブル作成（Day 1）
    ✅ BackupService 実装（Day 2-3）
    ✅ REST API実装（Day 4）
    ✅ BackupScheduler 実装（Day 5）

Week 2 (Day 6-10):
  Phase 2: Frontend + リストア実装
    ✅ 管理画面UI実装（Day 6-7）
    ✅ restore.sh 実装（Day 8）
    ✅ RestoreService 実装（Day 9）
    ✅ テスト + ドキュメント（Day 10）
```

---

### 7.2 コード再利用マトリクス

| 既存コンポーネント | 再利用方法 | 修正必要性 |
|------------------|----------|----------|
| **backup.sh** | child_process で呼び出し | 🟡 軽微（integrity_check追加） |
| **schedulerService.js** | パターンをBackupSchedulerに適用 | 🟢 なし（新規ファイル） |
| **emailService.js** | そのまま利用 | 🟢 なし |
| **rbac middleware** | requireRole('admin') 使用 | 🟢 なし |
| **report_tables migration** | テーブル設計パターン参考 | 🟢 なし（新規ファイル） |

---

### 7.3 成功要因

✅ **DO:**
1. 既存コードを最大限再利用する
2. schedulerService.js のパターンを踏襲する
3. RBAC統合を必ず実装する
4. 監査ログを100%記録する
5. リストアプロセスを事前テストする

❌ **DON'T:**
1. backup.sh を完全書き換えしない
2. 新しいライブラリを導入しない（node-cron, better-sqlite3で十分）
3. セキュリティ要件（RBAC, 監査ログ）をスキップしない
4. パフォーマンス要件（RTO ≤ 15分）を軽視しない

---

## 8. 次のステップ

### 8.1 即時アクション

1. ✅ **Task #2完了**: ギャップ分析完了
2. 🔄 **Task #1開始**: アーキテクチャ設計書作成
   - データベーススキーマ詳細設計
   - API仕様詳細設計
   - シーケンス図作成
   - セキュリティ設計

### 8.2 Week 1 準備

- [ ] arch-reviewer レビュー実施
- [ ] spec-planner との最終調整
- [ ] code-implementer へのタスク引継ぎ

---

**承認履歴**:
- 2026-01-31: 初版作成（arch-reviewer）
- 承認待ち

**次のドキュメント**:
- `docs-dev/BACKUP_ARCHITECTURE.md` - アーキテクチャ設計書
