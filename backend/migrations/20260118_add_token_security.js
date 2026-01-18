/**
 * Add Token Security Tables
 * トークンブラックリストとリフレッシュトークン管理テーブルを作成
 *
 * セキュリティ強化:
 * - token_blacklist: ログアウト・パスワード変更時にJWTを無効化
 * - refresh_tokens: アクセストークン更新用の長期トークン管理
 */

exports.up = function (knex) {
  return (
    knex.schema
      // トークンブラックリストテーブル
      .createTable('token_blacklist', (table) => {
        table.increments('id').primary();
        table.string('jti', 64).notNullable().unique(); // JWT ID (token identifier)
        table.integer('user_id').unsigned().notNullable();
        table.timestamp('expires_at').notNullable(); // 元トークンの有効期限
        table.timestamp('blacklisted_at').defaultTo(knex.fn.now());
        table
          .enum('reason', [
            'logout',
            'password_change',
            'admin_revoke',
            'security_concern',
            'refresh_rotation'
          ])
          .defaultTo('logout');
        table.string('ip_address', 45); // IPv6対応

        // インデックス
        table.index('jti');
        table.index('user_id');
        table.index('expires_at'); // 期限切れトークンのクリーンアップ用

        // 外部キー
        table.foreign('user_id').references('users.id').onDelete('CASCADE');
      })
      // リフレッシュトークンテーブル
      .createTable('refresh_tokens', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable();
        table.string('token_hash', 64).notNullable().unique(); // SHA-256ハッシュ
        table.string('family_id', 36).notNullable(); // トークンファミリー（ローテーション追跡用）
        table.string('device_info', 255); // デバイス識別情報
        table.string('ip_address', 45); // IPv6対応
        table.timestamp('expires_at').notNullable();
        table.boolean('is_revoked').defaultTo(false);
        table.timestamp('revoked_at');
        table.string('revoke_reason', 50);
        table.timestamp('last_used_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // インデックス
        table.index('token_hash');
        table.index('user_id');
        table.index('family_id');
        table.index('expires_at');
        table.index(['user_id', 'is_revoked']); // アクティブセッション検索用

        // 外部キー
        table.foreign('user_id').references('users.id').onDelete('CASCADE');
      })
  );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('refresh_tokens').dropTableIfExists('token_blacklist');
};
