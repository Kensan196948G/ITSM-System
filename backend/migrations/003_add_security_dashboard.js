/**
 * Security Dashboard Migration
 * ITSM-Sec Nexus - Audit Logs, Security Alerts, User Activity Tracking
 *
 * Creates tables for comprehensive security monitoring and compliance
 */

exports.up = function (knex) {
  return (
    knex.schema
      // Audit Logs Table - Complete activity tracking
      .createTable('audit_logs', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned();
        table.string('action', 50).notNullable(); // create, read, update, delete
        table.string('resource_type', 100).notNullable(); // incidents, changes, vulnerabilities, etc.
        table.string('resource_id', 100);
        table.text('old_values'); // JSON string of previous values
        table.text('new_values'); // JSON string of new values
        table.string('ip_address', 45); // IPv4/IPv6 support
        table.string('user_agent', 500);
        table.boolean('is_security_action').defaultTo(false);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // Foreign key constraint
        table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes for common queries
        table.index(['user_id', 'created_at'], 'idx_audit_user_time');
        table.index(['resource_type', 'action'], 'idx_audit_resource_action');
        table.index(['is_security_action', 'created_at'], 'idx_audit_security_time');
        table.index('created_at', 'idx_audit_created_at');
      })

      // Security Alerts Table - Real-time threat detection
      .createTable('security_alerts', (table) => {
        table.increments('id').primary();
        table.string('alert_type', 100).notNullable(); // failed_login, privilege_escalation, etc.
        table.enum('severity', ['critical', 'high', 'medium', 'low']).notNullable();
        table.text('description').notNullable();
        table.integer('affected_user_id').unsigned();
        table.string('affected_resource_type', 100);
        table.string('affected_resource_id', 100);
        table.string('source_ip', 45);
        table.boolean('is_acknowledged').defaultTo(false);
        table.integer('acknowledged_by').unsigned();
        table.timestamp('acknowledged_at');
        table.text('remediation_notes');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table.foreign('affected_user_id').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('acknowledged_by').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['severity', 'created_at'], 'idx_alerts_severity_time');
        table.index(['alert_type', 'is_acknowledged'], 'idx_alerts_type_ack');
        table.index(['affected_user_id', 'created_at'], 'idx_alerts_user_time');
        table.index(['is_acknowledged', 'severity'], 'idx_alerts_ack_severity');
        table.index('created_at', 'idx_alerts_created_at');
      })

      // User Activity Table - Session and authentication tracking
      .createTable('user_activity', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable();
        table.string('activity_type', 100).notNullable(); // login, logout, failed_login, etc.
        table.string('ip_address', 45);
        table.string('user_agent', 500);
        table.boolean('success').defaultTo(true);
        table.string('failure_reason', 255);
        table.string('session_id', 255);
        table.timestamp('created_at').defaultTo(knex.fn.now());

        // Foreign key constraint
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

        // Optimized indexes for activity analysis
        table.index(['user_id', 'created_at'], 'idx_activity_user_time');
        table.index(['activity_type', 'created_at'], 'idx_activity_type_time');
        table.index(['ip_address', 'created_at'], 'idx_activity_ip_time');
        table.index(['success', 'activity_type'], 'idx_activity_success_type');
        table.index('created_at', 'idx_activity_created_at');
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('user_activity')
    .dropTableIfExists('security_alerts')
    .dropTableIfExists('audit_logs');
};
