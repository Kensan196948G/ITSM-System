/**
 * Add Service Catalog tables
 * Enables ITIL-aligned service catalog management
 */

exports.up = function (knex) {
  return knex.schema
    // Service Categories table
    .createTable('service_categories', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.text('description');
      table.string('icon', 50); // FontAwesome icon class
      table.string('color', 20); // CSS color identifier
      table.integer('sort_order').defaultTo(0);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    // Service Catalog Items table
    .createTable('service_catalog', (table) => {
      table.increments('id').primary();
      table.integer('category_id').unsigned().references('id').inTable('service_categories').onDelete('SET NULL');
      table.string('name', 200).notNullable();
      table.text('description');
      table.text('details'); // Rich text description
      table.string('icon', 50);
      table.string('color', 20);
      table.enu('status', ['active', 'inactive', 'deprecated', 'planned']).defaultTo('active');
      table.string('service_level', 50); // Gold, Silver, Bronze
      table.decimal('cost_per_unit', 10, 2).nullable();
      table.string('cost_unit', 50).nullable(); // per month, per user, etc.
      table.integer('estimated_hours').nullable(); // Estimated time to fulfill
      table.integer('sort_order').defaultTo(0);
      table.text('requirements'); // Prerequisites or requirements
      table.text('deliverables'); // What the service provides
      table.integer('owner_id').unsigned().references('id').inTable('users');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('category_id', 'idx_svc_cat_category');
      table.index('status', 'idx_svc_cat_status');
    })
    // Service Request Templates (forms for requesting services)
    .createTable('service_request_templates', (table) => {
      table.increments('id').primary();
      table.integer('service_id').unsigned().references('id').inTable('service_catalog').onDelete('CASCADE');
      table.string('name', 200).notNullable();
      table.json('form_schema'); // JSON schema for dynamic form
      table.json('approval_workflow'); // Approval chain definition
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('service_id', 'idx_svc_tpl_service');
    })
    // Insert default service categories
    .then(() => {
      return knex('service_categories').insert([
        { name: 'インシデント管理', description: '障害やサービス中断への対応', icon: 'fa-exclamation-triangle', color: 'warning', sort_order: 1 },
        { name: '問題管理', description: '根本原因の分析と恒久対策', icon: 'fa-search', color: 'info', sort_order: 2 },
        { name: '変更管理', description: 'システム変更の計画と実施', icon: 'fa-exchange-alt', color: 'primary', sort_order: 3 },
        { name: 'リリース管理', description: 'ソフトウェアリリースの管理', icon: 'fa-rocket', color: 'success', sort_order: 4 },
        { name: '資産管理', description: 'IT資産のライフサイクル管理', icon: 'fa-desktop', color: 'secondary', sort_order: 5 },
        { name: 'セキュリティ', description: 'セキュリティ対策と監視', icon: 'fa-shield-alt', color: 'danger', sort_order: 6 },
        { name: 'ユーザーサポート', description: 'ヘルプデスクとサポート', icon: 'fa-headset', color: 'info', sort_order: 7 },
        { name: 'インフラストラクチャ', description: 'インフラ管理とプロビジョニング', icon: 'fa-server', color: 'dark', sort_order: 8 }
      ]);
    })
    // Insert default service catalog items
    .then(() => {
      return knex('service_catalog').insert([
        { category_id: 1, name: 'インシデント報告', description: 'システム障害やサービス中断を報告', icon: 'fa-bug', status: 'active', service_level: 'Gold', estimated_hours: 1, sort_order: 1 },
        { category_id: 2, name: '問題調査依頼', description: '繰り返し発生する問題の根本原因調査', icon: 'fa-search-plus', status: 'active', service_level: 'Silver', estimated_hours: 8, sort_order: 2 },
        { category_id: 3, name: '変更要求 (RFC)', description: 'システム変更の申請と承認', icon: 'fa-file-alt', status: 'active', service_level: 'Silver', estimated_hours: 4, sort_order: 3 },
        { category_id: 4, name: 'リリース申請', description: '新規リリースの計画と展開', icon: 'fa-upload', status: 'active', service_level: 'Gold', estimated_hours: 8, sort_order: 4 },
        { category_id: 5, name: '資産登録申請', description: '新規IT資産の登録', icon: 'fa-plus-circle', status: 'active', service_level: 'Bronze', estimated_hours: 2, sort_order: 5 },
        { category_id: 5, name: '資産廃棄申請', description: 'IT資産の廃棄手続き', icon: 'fa-trash', status: 'active', service_level: 'Bronze', estimated_hours: 2, sort_order: 6 },
        { category_id: 6, name: 'セキュリティ監査依頼', description: 'セキュリティ監査の実施依頼', icon: 'fa-clipboard-check', status: 'active', service_level: 'Gold', estimated_hours: 40, sort_order: 7 },
        { category_id: 6, name: '脆弱性スキャン依頼', description: 'システムの脆弱性スキャン実施', icon: 'fa-radar', status: 'active', service_level: 'Silver', estimated_hours: 4, sort_order: 8 },
        { category_id: 7, name: 'パスワードリセット', description: 'ユーザーパスワードのリセット', icon: 'fa-key', status: 'active', service_level: 'Gold', estimated_hours: 1, sort_order: 9 },
        { category_id: 7, name: 'アクセス権申請', description: 'システムへのアクセス権限申請', icon: 'fa-user-lock', status: 'active', service_level: 'Silver', estimated_hours: 2, sort_order: 10 },
        { category_id: 8, name: 'サーバープロビジョニング', description: '新規サーバーの構築依頼', icon: 'fa-server', status: 'active', service_level: 'Gold', estimated_hours: 16, sort_order: 11 },
        { category_id: 8, name: 'ストレージ拡張', description: 'ストレージ容量の拡張', icon: 'fa-hdd', status: 'active', service_level: 'Silver', estimated_hours: 4, sort_order: 12 }
      ]);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('service_request_templates')
    .dropTableIfExists('service_catalog')
    .dropTableIfExists('service_categories');
};
