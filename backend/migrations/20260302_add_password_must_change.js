/**
 * Migration: Add password_must_change column to users table
 * Issue #14: デフォルトパスワードのハードコードを修正
 */
exports.up = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.integer('password_must_change').defaultTo(0);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('password_must_change');
  });
};
