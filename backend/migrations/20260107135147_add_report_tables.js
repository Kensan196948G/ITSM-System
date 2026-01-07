/**
 * レポート機能用テーブルマイグレーション
 * scheduled_reports: スケジュールレポート設定
 * report_history: レポート生成履歴
 */

exports.up = function (knex) {
  return knex.schema
    // スケジュールレポート設定テーブル
    .createTable('scheduled_reports', (table) => {
      table.increments('id').primary();
      table.string('report_id', 50).notNullable().unique();
      table.string('name', 255).notNullable();
      table.string('report_type', 50).notNullable(); // incident_summary, sla_compliance, security_overview
      table.string('schedule_type', 50).notNullable(); // daily, weekly, monthly
      table.string('cron_expression', 100);
      table.string('format', 20).defaultTo('pdf'); // pdf, excel, csv
      table.text('recipients'); // JSON配列: メールアドレスリスト
      table.text('filters'); // JSON: フィルタ条件
      table.boolean('is_active').defaultTo(true);
      table.boolean('send_email').defaultTo(true);
      table.integer('created_by').references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.timestamp('last_run_at');
      table.timestamp('next_run_at');

      table.index('report_type');
      table.index('schedule_type');
      table.index('is_active');
    })

    // レポート生成履歴テーブル
    .createTable('report_history', (table) => {
      table.increments('id').primary();
      table.string('history_id', 50).notNullable().unique();
      table
        .integer('scheduled_report_id')
        .references('id')
        .inTable('scheduled_reports')
        .onDelete('SET NULL');
      table.string('report_type', 50).notNullable();
      table.string('report_name', 255);
      table.string('format', 20).notNullable();
      table.string('file_path', 500);
      table.integer('file_size'); // バイト単位
      table.string('status', 50).defaultTo('pending'); // pending, generating, completed, failed
      table.text('error_message');
      table.text('parameters'); // JSON: 生成パラメータ
      table.integer('generated_by').references('id').inTable('users');
      table.timestamp('started_at');
      table.timestamp('completed_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index('report_type');
      table.index('status');
      table.index('created_at');
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('report_history').dropTableIfExists('scheduled_reports');
};
