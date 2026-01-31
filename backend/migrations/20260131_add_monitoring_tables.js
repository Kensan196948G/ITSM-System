/**
 * Phase 9.2: 監視・ヘルスチェック強化 - データベースマイグレーション
 *
 * テーブル作成:
 * - metric_history: メトリクス履歴(30日間保存)
 * - alert_rules: アラートルール定義
 * - alert_history: アラート履歴
 * - notification_channels: 通知チャネル設定
 * - notification_history: 通知送信履歴
 */

exports.up = function (knex) {
  return (
    knex.schema
      // 1. metric_history テーブル
      .createTable('metric_history', (table) => {
        table.increments('id').primary();
        table.string('metric_name', 255).notNullable().comment('メトリクス名');
        table.float('metric_value').notNullable().comment('メトリクス値');
        table.text('labels').nullable().comment('ラベル（JSON）');
        table
          .timestamp('timestamp')
          .notNullable()
          .defaultTo(knex.fn.now())
          .comment('タイムスタンプ');

        // インデックス
        table.index('metric_name', 'idx_metric_history_name');
        table.index('timestamp', 'idx_metric_history_timestamp');
        table.index(['metric_name', 'timestamp'], 'idx_metric_history_composite');
      })

      // 2. alert_rules テーブル
      .createTable('alert_rules', (table) => {
        table.increments('id').primary();
        table.string('rule_name', 255).notNullable().unique().comment('ルール名');
        table.string('metric_name', 255).notNullable().comment('監視対象メトリクス');
        table.string('condition', 10).notNullable().comment('条件演算子');
        table.float('threshold').notNullable().comment('閾値');
        table.integer('duration').nullable().comment('継続時間（秒）');
        table.string('severity', 20).notNullable().comment('重要度');
        table.boolean('enabled').notNullable().defaultTo(true).comment('有効フラグ');
        table.text('notification_channels').nullable().comment('通知チャネル（JSON配列）');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        // インデックス
        table.index('enabled', 'idx_alert_rules_enabled');
        table.index('metric_name', 'idx_alert_rules_metric');
      })

      // 3. alert_history テーブル
      .createTable('alert_history', (table) => {
        table.increments('id').primary();
        table.integer('rule_id').unsigned().notNullable().comment('アラートルールID');
        table.string('rule_name', 255).notNullable().comment('ルール名');
        table.string('metric_name', 255).notNullable().comment('メトリクス名');
        table.float('current_value').notNullable().comment('現在値');
        table.float('threshold').notNullable().comment('閾値');
        table.string('severity', 20).notNullable().comment('重要度');
        table.string('status', 20).notNullable().defaultTo('firing').comment('ステータス');
        table.text('message').nullable().comment('アラートメッセージ');
        table.integer('acknowledged_by').unsigned().nullable().comment('確認者ID');
        table.timestamp('acknowledged_at').nullable().comment('確認日時');
        table.timestamp('resolved_at').nullable().comment('解決日時');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now()).comment('作成日時');

        // インデックス
        table.index('rule_id', 'idx_alert_history_rule');
        table.index('status', 'idx_alert_history_status');
        table.index('severity', 'idx_alert_history_severity');
        table.index('created_at', 'idx_alert_history_created_at');
      })

      // 4. alert_notification_channels テーブル
      .createTable('alert_notification_channels', (table) => {
        table.increments('id').primary();
        table.string('channel_name', 255).notNullable().unique().comment('チャネル名');
        table.string('channel_type', 50).notNullable().comment('チャネル種別');
        table.text('config').notNullable().comment('設定（暗号化JSON）');
        table.boolean('enabled').notNullable().defaultTo(true).comment('有効フラグ');
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

        // インデックス
        table.index('enabled', 'idx_alert_notification_channels_enabled');
        table.index('channel_type', 'idx_alert_notification_channels_type');
      })

      // 5. alert_notification_history テーブル
      .createTable('alert_notification_history', (table) => {
        table.increments('id').primary();
        table.integer('channel_id').unsigned().notNullable().comment('通知チャネルID');
        table.integer('alert_id').unsigned().nullable().comment('アラートID（NULL=テスト送信）');
        table.string('subject', 500).nullable().comment('件名');
        table.text('message').nullable().comment('メッセージ本文');
        table.string('status', 20).notNullable().comment('送信ステータス');
        table.text('error_message').nullable().comment('エラーメッセージ');
        table.timestamp('sent_at').notNullable().defaultTo(knex.fn.now()).comment('送信日時');

        // インデックス
        table.index('channel_id', 'idx_alert_notification_history_channel');
        table.index('alert_id', 'idx_alert_notification_history_alert');
        table.index('status', 'idx_alert_notification_history_status');
        table.index('sent_at', 'idx_alert_notification_history_sent_at');
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('alert_notification_history')
    .dropTableIfExists('alert_notification_channels')
    .dropTableIfExists('alert_history')
    .dropTableIfExists('alert_rules')
    .dropTableIfExists('metric_history');
};
