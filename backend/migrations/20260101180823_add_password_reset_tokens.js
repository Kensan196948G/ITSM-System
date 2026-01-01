/**
 * Add Password Reset Tokens Table
 * パスワードリセット用のトークン管理テーブルを作成
 */

exports.up = function (knex) {
  return knex.schema.createTable('password_reset_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('token', 255).notNullable().unique();
    table.string('email', 255).notNullable();
    table.timestamp('expires_at').notNullable();
    table.boolean('used').defaultTo(false);
    table.timestamp('used_at');
    table.string('ip_address', 45); // IPv6対応
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // インデックス
    table.index('token');
    table.index('user_id');
    table.index('email');
    table.index('expires_at');
    table.index(['token', 'used']); // トークン検証用の複合インデックス

    // 外部キー
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('password_reset_tokens');
};
