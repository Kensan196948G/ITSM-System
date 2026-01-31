/**
 * Add Backup & Restore tables
 * Phase 9.1: Backup and Restore functionality
 * ISO 20000 & NIST CSF 2.0 compliant
 */

exports.up = function (knex) {
  return (
    knex.schema
      // backup_logs テーブル: バックアップ実行履歴
      .createTable('backup_logs', (table) => {
        table.increments('id').primary();
        table
          .string('backup_id', 100)
          .notNullable()
          .unique()
          .comment('ユニークバックアップID: BKP-YYYYMMDD-HHMMSS-type');
        table
          .enu('backup_type', ['daily', 'weekly', 'monthly', 'manual'])
          .notNullable()
          .comment('バックアップ種別');
        table.string('file_path', 500).nullable().comment('バックアップファイルパス');
        table.bigInteger('file_size').nullable().comment('ファイルサイズ（バイト）');
        table.string('checksum', 100).nullable().comment('SHA-256チェックサム');
        table
          .enu('status', ['in_progress', 'success', 'failure', 'deleted'])
          .notNullable()
          .defaultTo('in_progress')
          .comment('ステータス');
        table.text('error_message').nullable().comment('エラーメッセージ（失敗時）');
        table
          .text('metadata')
          .nullable()
          .comment('メタデータ（JSON）: compression_ratio, duration_seconds等');
        table.text('description').nullable().comment('バックアップ説明（manual時）');
        table
          .integer('created_by')
          .unsigned()
          .nullable()
          .references('id')
          .inTable('users')
          .onDelete('SET NULL')
          .comment('実行ユーザーID（NULL=system）');
        table.timestamp('started_at').notNullable().defaultTo(knex.fn.now()).comment('開始日時');
        table.timestamp('completed_at').nullable().comment('完了日時');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

        // インデックス
        table.index('backup_type', 'idx_backup_logs_type');
        table.index('status', 'idx_backup_logs_status');
        table.index('created_at', 'idx_backup_logs_created_at');
        table.index('created_by', 'idx_backup_logs_created_by');
        table.index('started_at', 'idx_backup_logs_started_at');
      })

      // backup_audit_logs テーブル: バックアップ操作の監査ログ
      .createTable('backup_audit_logs', (table) => {
        table.increments('id').primary();
        table
          .enu('operation', ['create', 'restore', 'delete', 'download', 'list', 'verify'])
          .notNullable()
          .comment('操作種別');
        table.string('backup_id', 100).nullable().comment('対象バックアップID（NULL=一覧取得）');
        table
          .integer('user_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('users')
          .onDelete('CASCADE')
          .comment('ユーザーID');
        table.string('username', 255).notNullable().comment('ユーザー名（スナップショット）');
        table.string('ip_address', 50).nullable().comment('クライアントIPアドレス');
        table.text('user_agent').nullable().comment('User-Agent文字列');
        table.enu('status', ['success', 'failure']).notNullable().comment('操作結果');
        table.text('error_message').nullable().comment('エラー詳細（失敗時）');
        table.text('details').nullable().comment('操作詳細（JSON）');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).comment('操作日時');

        // インデックス
        table.index('operation', 'idx_backup_audit_operation');
        table.index('user_id', 'idx_backup_audit_user_id');
        table.index('backup_id', 'idx_backup_audit_backup_id');
        table.index('created_at', 'idx_backup_audit_created_at');
        table.index('status', 'idx_backup_audit_status');
      })

      // backup_integrity_checks テーブル: バックアップファイルの整合性チェック結果
      .createTable('backup_integrity_checks', (table) => {
        table.increments('id').primary();
        table
          .string('check_id', 100)
          .notNullable()
          .unique()
          .comment('チェックID: CHK-YYYYMMDD-HHMMSS-NNN');
        table.string('backup_id', 100).notNullable().comment('バックアップID');
        table
          .enu('check_type', [
            'file_exists',
            'checksum',
            'decompression',
            'pragma_check',
            'full_suite'
          ])
          .notNullable()
          .comment('チェック種別');
        table.enu('status', ['pass', 'fail']).notNullable().comment('チェック結果');
        table.text('error_message').nullable().comment('エラー詳細（失敗時）');
        table.text('details').nullable().comment('チェック詳細（JSON）');
        table
          .timestamp('checked_at')
          .notNullable()
          .defaultTo(knex.fn.now())
          .comment('チェック日時');

        // インデックス
        table.index('backup_id', 'idx_backup_integrity_backup_id');
        table.index('status', 'idx_backup_integrity_status');
        table.index('checked_at', 'idx_backup_integrity_checked_at');
        table.index('check_type', 'idx_backup_integrity_check_type');
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('backup_integrity_checks')
    .dropTableIfExists('backup_audit_logs')
    .dropTableIfExists('backup_logs');
};
