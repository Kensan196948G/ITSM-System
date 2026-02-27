/**
 * Webhook受信用の欠損カラム追加
 * - incidents: category, reporter, assigned_to, updated_at
 * - changes: change_id, type, assigned_to, planned_start_date, planned_end_date, priority, updated_at
 */
exports.up = function (knex) {
  return knex.schema
    .table('incidents', (table) => {
      table.string('category').nullable();
      table.string('reporter').nullable();
      table.string('assigned_to').nullable();
      table.datetime('updated_at').nullable();
    })
    .table('changes', (table) => {
      table.string('change_id').nullable();
      table.string('type').nullable();
      table.string('assigned_to').nullable();
      table.datetime('planned_start_date').nullable();
      table.datetime('planned_end_date').nullable();
      table.string('priority').nullable();
      table.datetime('updated_at').nullable();
    });
};

exports.down = function (knex) {
  return knex.schema
    .table('incidents', (table) => {
      table.dropColumn('category');
      table.dropColumn('reporter');
      table.dropColumn('assigned_to');
      table.dropColumn('updated_at');
    })
    .table('changes', (table) => {
      table.dropColumn('change_id');
      table.dropColumn('type');
      table.dropColumn('assigned_to');
      table.dropColumn('planned_start_date');
      table.dropColumn('planned_end_date');
      table.dropColumn('priority');
      table.dropColumn('updated_at');
    });
};
