/**
 * Add resolved_at column to incidents table
 * This column is required for MTTR calculation and dashboard charts
 */

exports.up = async function (knex) {
  // Check if column already exists
  const hasColumn = await knex.schema.hasColumn('incidents', 'resolved_at');
  if (!hasColumn) {
    return knex.schema.alterTable('incidents', (table) => {
      table.timestamp('resolved_at').nullable();
    });
  }
  // Column already exists, nothing to do
  return Promise.resolve();
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('incidents', 'resolved_at');
  if (hasColumn) {
    return knex.schema.alterTable('incidents', (table) => {
      table.dropColumn('resolved_at');
    });
  }
  return Promise.resolve();
};
