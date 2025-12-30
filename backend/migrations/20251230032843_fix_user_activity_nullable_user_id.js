/**
 * Fix user_activity.user_id to allow NULL values
 * This is necessary for tracking failed login attempts when user doesn't exist
 */

exports.up = function (knex) {
  return knex.schema.alterTable('user_activity', (table) => {
    // SQLiteではALTER COLUMNが制限されているため、
    // 制約を変更するにはテーブルの再作成が必要
    // しかし、knexはこれを自動的に処理してくれます
    table.integer('user_id').unsigned().nullable().alter();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('user_activity', (table) => {
    table.integer('user_id').unsigned().notNullable().alter();
  });
};
