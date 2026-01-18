/**
 * Add NIST CSF 2.0 Controls and Categories tables
 * Enables comprehensive CSF compliance tracking
 */

exports.up = function (knex) {
  return (
    knex.schema
      // CSF Functions table (6 core functions)
      .createTable('csf_functions', (table) => {
        table.increments('id').primary();
        table.string('code', 10).notNullable().unique(); // GV, ID, PR, DE, RS, RC
        table.string('name', 50).notNullable();
        table.string('name_en', 50).notNullable();
        table.text('description');
        table.string('color', 20); // CSS color identifier
        table.string('icon', 50); // FontAwesome icon class
        table.integer('sort_order').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
      })
      // CSF Categories table
      .createTable('csf_categories', (table) => {
        table.increments('id').primary();
        table
          .integer('function_id')
          .unsigned()
          .references('id')
          .inTable('csf_functions')
          .onDelete('CASCADE');
        table.string('code', 20).notNullable().unique(); // GV.OC, ID.AM, etc.
        table.string('name', 100).notNullable();
        table.text('description');
        table.integer('sort_order').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index('function_id', 'idx_csf_cat_function');
      })
      // CSF Controls table
      .createTable('csf_controls', (table) => {
        table.increments('id').primary();
        table
          .integer('category_id')
          .unsigned()
          .references('id')
          .inTable('csf_categories')
          .onDelete('CASCADE');
        table.string('control_id', 30).notNullable().unique(); // GV.OC-01, ID.AM-01, etc.
        table.string('name', 200).notNullable();
        table.text('description');
        table
          .enu('status', ['not_started', 'in_progress', 'partial', 'compliant', 'non_compliant'])
          .defaultTo('not_started');
        table.integer('maturity_level').defaultTo(0); // 0-5
        table.float('score').defaultTo(0); // 0-100
        table.text('evidence'); // Implementation evidence
        table.text('notes');
        table.date('last_assessment_date');
        table.date('next_assessment_date');
        table.integer('assigned_to').unsigned().references('id').inTable('users');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index('category_id', 'idx_csf_ctrl_category');
        table.index('status', 'idx_csf_ctrl_status');
        table.index('maturity_level', 'idx_csf_ctrl_maturity');
      })
      // CSF Assessment History
      .createTable('csf_assessments', (table) => {
        table.increments('id').primary();
        table
          .integer('control_id')
          .unsigned()
          .references('id')
          .inTable('csf_controls')
          .onDelete('CASCADE');
        table.integer('assessed_by').unsigned().references('id').inTable('users');
        table.enu('previous_status', [
          'not_started',
          'in_progress',
          'partial',
          'compliant',
          'non_compliant'
        ]);
        table.enu('new_status', [
          'not_started',
          'in_progress',
          'partial',
          'compliant',
          'non_compliant'
        ]);
        table.integer('previous_maturity').defaultTo(0);
        table.integer('new_maturity').defaultTo(0);
        table.float('previous_score').defaultTo(0);
        table.float('new_score').defaultTo(0);
        table.text('comments');
        table.timestamp('assessed_at').defaultTo(knex.fn.now());

        table.index('control_id', 'idx_csf_assess_control');
        table.index('assessed_at', 'idx_csf_assess_date');
      })
      // Insert default CSF functions
      .then(() => {
        return knex('csf_functions').insert([
          {
            code: 'GV',
            name: '統治',
            name_en: 'Govern',
            description: '組織のサイバーセキュリティリスク管理戦略、期待値、ポリシーの確立と監視',
            color: 'govern',
            icon: 'fa-balance-scale',
            sort_order: 1
          },
          {
            code: 'ID',
            name: '識別',
            name_en: 'Identify',
            description: '組織の資産、リスク、脆弱性の識別と理解',
            color: 'identify',
            icon: 'fa-search',
            sort_order: 2
          },
          {
            code: 'PR',
            name: '防御',
            name_en: 'Protect',
            description: '重要なサービスの提供を確保するための適切な保護措置の実装',
            color: 'protect',
            icon: 'fa-shield-alt',
            sort_order: 3
          },
          {
            code: 'DE',
            name: '検知',
            name_en: 'Detect',
            description: 'サイバーセキュリティイベントの発生をタイムリーに検知するための活動',
            color: 'detect',
            icon: 'fa-eye',
            sort_order: 4
          },
          {
            code: 'RS',
            name: '対応',
            name_en: 'Respond',
            description: '検知されたサイバーセキュリティインシデントへの対応',
            color: 'respond',
            icon: 'fa-bolt',
            sort_order: 5
          },
          {
            code: 'RC',
            name: '復旧',
            name_en: 'Recover',
            description: 'サイバーセキュリティインシデントにより損なわれた機能やサービスの復旧',
            color: 'recover',
            icon: 'fa-sync-alt',
            sort_order: 6
          }
        ]);
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('csf_assessments')
    .dropTableIfExists('csf_controls')
    .dropTableIfExists('csf_categories')
    .dropTableIfExists('csf_functions');
};
