/**
 * Add Microsoft 365 synchronization columns to users table
 * Enables integration with Azure AD user management
 */

exports.up = function (knex) {
  return knex.schema.table('users', (table) => {
    // Organization info from Azure AD
    table.string('department', 255).nullable();
    table.string('job_title', 255).nullable();
    table.string('employee_number', 50).nullable();

    // M365 synchronization tracking
    table.string('external_id', 255).nullable(); // Azure AD object ID
    table.string('source', 50).nullable(); // 'local' or 'microsoft365'
    table.timestamp('synced_at').nullable(); // Last sync timestamp

    // Additional indexes
    table.index('external_id');
    table.index('source');
  });
};

exports.down = function (knex) {
  return knex.schema.table('users', (table) => {
    table.dropIndex('external_id');
    table.dropIndex('source');
    table.dropColumn('department');
    table.dropColumn('job_title');
    table.dropColumn('employee_number');
    table.dropColumn('external_id');
    table.dropColumn('source');
    table.dropColumn('synced_at');
  });
};
