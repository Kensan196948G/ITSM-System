/**
 * Initial Database Schema Migration
 * ITSM-Sec Nexus - ISO 20000 + NIST CSF 2.0
 *
 * Creates all tables for the ITSM system
 */

exports.up = function (knex) {
  return (
    knex.schema
      // Users Table - Authentication and RBAC
      .createTable('users', (table) => {
        table.increments('id').primary();
        table.string('username', 255).notNullable().unique();
        table.string('email', 255).notNullable().unique();
        table.string('password_hash', 255).notNullable();
        table.enum('role', ['admin', 'manager', 'analyst', 'viewer']).notNullable();
        table.string('full_name', 255);
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('last_login');

        table.index('username');
        table.index('email');
        table.index('role');
      })

      // Incidents Table - ITSM Incident Management
      .createTable('incidents', (table) => {
        table.increments('id').primary();
        table.string('ticket_id', 50).notNullable().unique();
        table.text('title');
        table.text('description');
        table.string('status', 50);
        table.string('priority', 50);
        table.boolean('is_security_incident').defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('ticket_id');
        table.index('status');
        table.index('priority');
      })

      // Assets Table - Configuration Management Database (CMDB)
      .createTable('assets', (table) => {
        table.increments('id').primary();
        table.string('asset_tag', 50).notNullable().unique();
        table.string('name', 255);
        table.string('type', 100);
        table.integer('criticality');
        table.string('status', 50);
        table.timestamp('last_updated').defaultTo(knex.fn.now());

        table.index('asset_tag');
        table.index('type');
        table.index('criticality');
      })

      // Changes Table - RFC Management
      .createTable('changes', (table) => {
        table.increments('id').primary();
        table.string('rfc_id', 50).notNullable().unique();
        table.text('title');
        table.text('description');
        table.string('asset_tag', 50);
        table.string('status', 50); // Pending, Approved, Rejected, Implemented
        table.string('requester', 255);
        table.string('approver', 255);
        table.integer('is_security_change').defaultTo(0);
        table.string('impact_level', 50);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('rfc_id');
        table.index('status');
      })

      // Problems Table - Problem Management
      .createTable('problems', (table) => {
        table.increments('id').primary();
        table.string('problem_id', 50).notNullable().unique();
        table.text('title');
        table.text('description');
        table.string('status', 50); // Identified, Analyzing, Resolved, Closed
        table.string('priority', 50);
        table.text('root_cause');
        table.text('related_incidents');
        table.string('assignee', 255);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('resolved_at');

        table.index('problem_id');
        table.index('status');
      })

      // Releases Table - Release Management
      .createTable('releases', (table) => {
        table.increments('id').primary();
        table.string('release_id', 50).notNullable().unique();
        table.string('name', 255);
        table.text('description');
        table.string('version', 50);
        table.string('status', 50); // Planning, Development, Testing, Deployed, Cancelled
        table.date('release_date');
        table.integer('change_count').defaultTo(0);
        table.string('target_environment', 100);
        table.integer('progress').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('release_id');
        table.index('status');
      })

      // Service Requests Table
      .createTable('service_requests', (table) => {
        table.increments('id').primary();
        table.string('request_id', 50).notNullable().unique();
        table.string('request_type', 100);
        table.text('title');
        table.text('description');
        table.string('requester', 255);
        table.string('status', 50); // Submitted, Approved, In-Progress, Completed, Rejected
        table.string('priority', 50);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('completed_at');

        table.index('request_id');
        table.index('status');
      })

      // SLA Agreements Table
      .createTable('sla_agreements', (table) => {
        table.increments('id').primary();
        table.string('sla_id', 50).notNullable().unique();
        table.string('service_name', 255);
        table.string('metric_name', 255);
        table.string('target_value', 100);
        table.string('actual_value', 100);
        table.float('achievement_rate');
        table.string('measurement_period', 100);
        table.string('status', 50); // Met, At-Risk, Violated
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('sla_id');
        table.index('status');
      })

      // Knowledge Articles Table
      .createTable('knowledge_articles', (table) => {
        table.increments('id').primary();
        table.string('article_id', 50).notNullable().unique();
        table.text('title');
        table.text('content');
        table.string('category', 100);
        table.integer('view_count').defaultTo(0);
        table.float('rating').defaultTo(0);
        table.string('author', 255);
        table.string('status', 50); // Draft, Published, Archived
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index('article_id');
        table.index('category');
        table.index('status');
      })

      // Capacity Metrics Table
      .createTable('capacity_metrics', (table) => {
        table.increments('id').primary();
        table.string('metric_id', 50).notNullable().unique();
        table.string('resource_name', 255);
        table.string('resource_type', 100); // Storage, CPU, Memory, Bandwidth, License
        table.float('current_usage');
        table.float('threshold');
        table.float('forecast_3m');
        table.string('status', 50); // Normal, Warning, Critical
        table.string('unit', 50);
        table.timestamp('measured_at').defaultTo(knex.fn.now());

        table.index('metric_id');
        table.index('resource_type');
        table.index('status');
      })

      // Vulnerabilities Table - Security Management
      .createTable('vulnerabilities', (table) => {
        table.increments('id').primary();
        table.string('vulnerability_id', 50).notNullable().unique();
        table.text('title');
        table.text('description');
        table.string('severity', 50); // Critical, High, Medium, Low
        table.float('cvss_score');
        table.string('affected_asset', 255);
        table.string('status', 50); // Identified, In-Progress, Mitigated, Resolved
        table.date('detection_date');
        table.date('resolution_date');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('vulnerability_id');
        table.index('severity');
        table.index('status');
      })

      // Compliance Table - NIST CSF 2.0 Functions
      .createTable('compliance', (table) => {
        table.string('function', 50).primary(); // GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER
        table.integer('progress');
        table.integer('target_tier');
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('compliance')
    .dropTableIfExists('vulnerabilities')
    .dropTableIfExists('capacity_metrics')
    .dropTableIfExists('knowledge_articles')
    .dropTableIfExists('sla_agreements')
    .dropTableIfExists('service_requests')
    .dropTableIfExists('releases')
    .dropTableIfExists('problems')
    .dropTableIfExists('changes')
    .dropTableIfExists('assets')
    .dropTableIfExists('incidents')
    .dropTableIfExists('users');
};
