/**
 * Phase 9.3: 自動修復システム - データベースマイグレーション
 *
 * テーブル作成:
 * - auto_fix_history: 自動修復実行履歴
 * - auto_fix_cooldowns: クールダウン管理（重複修復防止）
 *
 * NIST CSF 2.0 準拠:
 * - RS.MI-01: インシデント対応の自動化
 * - RS.MI-02: 修復アクションの記録と追跡
 */

exports.up = function (knex) {
  return (
    knex.schema
      // 1. auto_fix_history テーブル: 自動修復実行履歴
      .createTable('auto_fix_history', (table) => {
        table.increments('id').primary();
        table.text('error_pattern').notNullable().comment('エラーパターン（正規表現または識別子）');
        table
          .enu('severity', ['low', 'medium', 'high', 'critical'])
          .notNullable()
          .comment('重要度レベル');
        table.text('fix_action').notNullable().comment('実行した修復アクション（JSON形式）');
        table
          .enu('status', ['success', 'failure', 'skipped'])
          .notNullable()
          .comment('修復結果ステータス');
        table.text('error_message').nullable().comment('エラーメッセージ（失敗時の詳細）');
        table.integer('execution_time_ms').nullable().comment('実行時間（ミリ秒）');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).comment('実行日時');

        // インデックス: エラーパターンでの検索
        table.index('error_pattern', 'idx_auto_fix_history_pattern');
        // インデックス: 日時での検索（レポート生成用）
        table.index('created_at', 'idx_auto_fix_history_created_at');
        // インデックス: ステータスでのフィルタリング
        table.index('status', 'idx_auto_fix_history_status');
      })

      // 2. auto_fix_cooldowns テーブル: クールダウン管理
      .createTable('auto_fix_cooldowns', (table) => {
        table.increments('id').primary();
        table.text('error_hash').notNullable().unique().comment('エラーの一意ハッシュ（SHA-256）');
        table.text('error_pattern').notNullable().comment('元のエラーパターン');
        table.timestamp('last_fixed_at').notNullable().comment('最後に修復した日時');
        table
          .timestamp('expires_at')
          .notNullable()
          .comment('クールダウン期限（この時刻以降は再修復可能）');
        table
          .timestamp('created_at')
          .notNullable()
          .defaultTo(knex.fn.now())
          .comment('レコード作成日時');

        // インデックス: 期限での検索（クリーンアップ用）
        table.index('expires_at', 'idx_auto_fix_cooldowns_expires_at');
        // インデックス: ハッシュでの検索（重複チェック用）
        table.index('error_hash', 'idx_auto_fix_cooldowns_error_hash');
      })
  );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('auto_fix_cooldowns').dropTableIfExists('auto_fix_history');
};
