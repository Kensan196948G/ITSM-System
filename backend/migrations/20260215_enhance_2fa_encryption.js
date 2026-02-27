/**
 * Enhance 2FA Security - Add encryption columns for TOTP secrets
 * totp_secret カラムに暗号化されたデータを保存するための
 * IV (初期化ベクトル) と AuthTag (認証タグ) カラムを追加
 */

exports.up = function (knex) {
  return knex.schema.table('users', (table) => {
    table.string('totp_secret_iv', 64); // AES-256-GCM IV (hex encoded)
    table.string('totp_secret_auth_tag', 64); // AES-256-GCM auth tag (hex encoded)
  });
};

exports.down = function (knex) {
  return knex.schema.table('users', (table) => {
    table.dropColumn('totp_secret_iv');
    table.dropColumn('totp_secret_auth_tag');
  });
};
