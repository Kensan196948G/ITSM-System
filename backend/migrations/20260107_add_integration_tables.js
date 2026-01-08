/**
 * Integration Tables Migration
 * Webhookログと統合設定テーブルの追加
 */

exports.up = function (knex) {
  return (
    knex.schema
      // Webhookログテーブル
      .createTable('webhook_logs', (table) => {
        table.increments('id').primary();
        table.string('source', 50).notNullable(); // microsoft365, servicenow
        table.string('event_type', 100);
        table.text('payload'); // JSON形式でペイロードを保存
        table.string('status', 20).notNullable(); // processed, error, rejected
        table.text('error_message');
        table.timestamp('received_at').defaultTo(knex.fn.now());

        table.index('source');
        table.index('event_type');
        table.index('status');
        table.index('received_at');
      })
      // 統合設定テーブル
      .createTable('integration_settings', (table) => {
        table.increments('id').primary();
        table.string('integration_name', 50).notNullable(); // microsoft365, servicenow, etc
        table.string('setting_key', 100).notNullable();
        table.text('setting_value');
        table.boolean('is_secret').defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.unique(['integration_name', 'setting_key']);
        table.index('integration_name');
      })
      // インシデントテーブルに外部連携カラムを追加
      .then(() => {
        return knex.schema.hasColumn('incidents', 'external_id').then((exists) => {
          if (!exists) {
            return knex.schema.alterTable('incidents', (table) => {
              table.string('external_id', 100); // 外部システムのID
              table.string('source', 50); // 連携元システム
              table.index('external_id');
              table.index('source');
            });
          }
          return Promise.resolve();
        });
      })
      // 変更リクエストテーブルに外部連携カラムを追加
      .then(() => {
        return knex.schema.hasColumn('changes', 'external_id').then((exists) => {
          if (!exists) {
            return knex.schema.alterTable('changes', (table) => {
              table.string('external_id', 100);
              table.string('source', 50);
              table.string('calendar_event_id', 255); // M365カレンダーイベントID
              table.index('external_id');
              table.index('source');
            });
          }
          return Promise.resolve();
        });
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('webhook_logs')
    .dropTableIfExists('integration_settings')
    .then(() => {
      return knex.schema.hasColumn('incidents', 'external_id').then((exists) => {
        if (exists) {
          return knex.schema.alterTable('incidents', (table) => {
            table.dropColumn('external_id');
            table.dropColumn('source');
          });
        }
        return Promise.resolve();
      });
    })
    .then(() => {
      return knex.schema.hasColumn('changes', 'external_id').then((exists) => {
        if (exists) {
          return knex.schema.alterTable('changes', (table) => {
            table.dropColumn('external_id');
            table.dropColumn('source');
            table.dropColumn('calendar_event_id');
          });
        }
        return Promise.resolve();
      });
    });
};
