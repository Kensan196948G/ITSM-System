/**
 * Notification Tables Migration
 * 通知チャネルと通知ログテーブルの追加
 */

exports.up = function (knex) {
  return (
    knex.schema
      // 通知チャネル設定テーブル
      .createTable('notification_channels', (table) => {
        table.increments('id').primary();
        table.string('name', 100).notNullable(); // チャネル名（例: "本番Slack", "開発Teams"）
        table.string('channel_type', 50).notNullable(); // email, slack, teams
        table.string('webhook_url', 500); // Slack/Teams Webhook URL
        table.text('config'); // JSON形式の追加設定（email設定など）
        table.text('notification_types'); // 対象通知タイプ（カンマ区切り）
        table.boolean('is_active').defaultTo(true);
        table.string('created_by', 255);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index('channel_type');
        table.index('is_active');
      })

      // 通知ログテーブル
      .createTable('notification_logs', (table) => {
        table.increments('id').primary();
        table.string('notification_type', 50).notNullable(); // incident_created, sla_violation等
        table.string('channel', 50).notNullable(); // email, slack, teams
        table.string('recipient', 255); // メールアドレスまたはチャネル名
        table.string('subject', 500); // 通知件名
        table.text('message'); // 通知メッセージ（JSON可）
        table.string('status', 50).notNullable(); // sent, failed, pending
        table.text('error_message'); // エラーメッセージ（失敗時）
        table.string('related_entity_type', 50); // incident, sla, vulnerability等
        table.integer('related_entity_id'); // 関連エンティティのID
        table.timestamp('sent_at').defaultTo(knex.fn.now());
        table.integer('retry_count').defaultTo(0);
        table.timestamp('last_retry_at');

        table.index('notification_type');
        table.index('channel');
        table.index('status');
        table.index('sent_at');
        table.index(['related_entity_type', 'related_entity_id']);
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('notification_logs')
    .dropTableIfExists('notification_channels');
};
