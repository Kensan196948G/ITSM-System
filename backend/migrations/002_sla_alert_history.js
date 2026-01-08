/**
 * SLA Alert History Migration
 * アラート履歴テーブルの追加
 */

exports.up = function (knex) {
  return knex.schema.createTable('sla_alert_history', (table) => {
    table.increments('id').primary();
    table.string('alert_id', 50).notNullable().unique();
    table
      .integer('sla_agreement_id')
      .unsigned()
      .references('id')
      .inTable('sla_agreements')
      .onDelete('CASCADE');
    table.string('sla_id', 50); // SLA契約のsla_id参照用
    table.string('service_name', 255);
    table.string('metric_name', 255);
    table.string('alert_type', 50); // violation, at_risk, threshold_breach, recovery
    table.string('previous_status', 50);
    table.string('new_status', 50);
    table.float('previous_achievement_rate');
    table.float('new_achievement_rate');
    table.string('target_value', 100);
    table.string('actual_value', 100);
    table.text('message');
    table.boolean('email_sent').defaultTo(false);
    table.string('email_recipient', 255);
    table.boolean('acknowledged').defaultTo(false);
    table.string('acknowledged_by', 255);
    table.timestamp('acknowledged_at');
    table.text('acknowledgment_note');
    table.timestamp('triggered_at').defaultTo(knex.fn.now());

    table.index('sla_agreement_id');
    table.index('alert_type');
    table.index('acknowledged');
    table.index('triggered_at');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('sla_alert_history');
};
