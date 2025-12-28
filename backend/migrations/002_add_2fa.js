/**
 * Add 2FA Support to Users Table
 * Adds TOTP secret, enabled flag, and backup codes
 */

exports.up = function (knex) {
  return knex.schema.table('users', table => {
    table.string('totp_secret', 255);
    table.boolean('totp_enabled').defaultTo(false);
    table.text('backup_codes'); // JSON array of backup codes
  });
};

exports.down = function (knex) {
  return knex.schema.table('users', table => {
    table.dropColumn('totp_secret');
    table.dropColumn('totp_enabled');
    table.dropColumn('backup_codes');
  });
};
