/**
 * Compliance Management Migration
 * ITSM-Sec Nexus - Compliance Policies, Audit Schedules, Evidence Tracking
 *
 * Creates tables for comprehensive compliance monitoring and regulatory management
 */

exports.up = function (knex) {
  return (
    knex.schema
      // Compliance Policies Table - Policy management
      .createTable('compliance_policies', (table) => {
        table.increments('id').primary();
        table.string('policy_name', 200).notNullable();
        table.string('policy_code', 50).notNullable().unique();
        table
          .enum('policy_type', [
            'security',
            'privacy',
            'operational',
            'financial',
            'regulatory',
            'other'
          ])
          .notNullable();
        table.text('description').notNullable();
        table.text('requirements'); // JSON string of detailed requirements
        table
          .enum('status', ['draft', 'active', 'deprecated', 'archived'])
          .notNullable()
          .defaultTo('draft');
        table
          .enum('priority', ['critical', 'high', 'medium', 'low'])
          .notNullable()
          .defaultTo('medium');
        table.integer('owner_id').unsigned();
        table.date('effective_date');
        table.date('review_date');
        table.integer('review_frequency_days'); // Review cycle in days
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraint
        table.foreign('owner_id').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['status', 'priority'], 'idx_policies_status_priority');
        table.index(['policy_type', 'status'], 'idx_policies_type_status');
        table.index(['owner_id', 'status'], 'idx_policies_owner_status');
        table.index('review_date', 'idx_policies_review_date');
        table.index('created_at', 'idx_policies_created_at');
      })

      // Compliance Requirements Table - Regulatory requirements management
      .createTable('compliance_requirements', (table) => {
        table.increments('id').primary();
        table.integer('policy_id').unsigned().notNullable();
        table.string('requirement_code', 100).notNullable();
        table.string('framework', 100).notNullable(); // ISO27001, GDPR, SOX, HIPAA, etc.
        table.string('category', 100).notNullable();
        table.text('description').notNullable();
        table.text('implementation_guidance');
        table
          .enum('status', [
            'pending',
            'in_progress',
            'compliant',
            'non_compliant',
            'not_applicable'
          ])
          .notNullable()
          .defaultTo('pending');
        table
          .enum('criticality', ['critical', 'high', 'medium', 'low'])
          .notNullable()
          .defaultTo('medium');
        table.integer('assigned_to').unsigned();
        table.date('target_date');
        table.date('completion_date');
        table.decimal('compliance_score', 5, 2); // 0-100 percentage
        table.text('notes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table
          .foreign('policy_id')
          .references('id')
          .inTable('compliance_policies')
          .onDelete('CASCADE');
        table.foreign('assigned_to').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['policy_id', 'status'], 'idx_requirements_policy_status');
        table.index(['framework', 'status'], 'idx_requirements_framework_status');
        table.index(['status', 'criticality'], 'idx_requirements_status_criticality');
        table.index(['assigned_to', 'status'], 'idx_requirements_assigned_status');
        table.index('target_date', 'idx_requirements_target_date');
        table.index('created_at', 'idx_requirements_created_at');
      })

      // Audit Schedules Table - Audit scheduling and planning
      .createTable('audit_schedules', (table) => {
        table.increments('id').primary();
        table.integer('policy_id').unsigned();
        table.string('audit_name', 200).notNullable();
        table
          .enum('audit_type', ['internal', 'external', 'third_party', 'self_assessment'])
          .notNullable();
        table.text('scope').notNullable();
        table
          .enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'])
          .notNullable()
          .defaultTo('scheduled');
        table.integer('auditor_id').unsigned();
        table.integer('auditee_id').unsigned();
        table.date('scheduled_date').notNullable();
        table.date('start_date');
        table.date('end_date');
        table.date('report_due_date');
        table.text('objectives');
        table.text('methodology');
        table.text('findings_summary');
        table
          .enum('overall_result', ['pass', 'pass_with_conditions', 'fail', 'pending'])
          .defaultTo('pending');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table
          .foreign('policy_id')
          .references('id')
          .inTable('compliance_policies')
          .onDelete('SET NULL');
        table.foreign('auditor_id').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('auditee_id').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['status', 'scheduled_date'], 'idx_audits_status_date');
        table.index(['audit_type', 'status'], 'idx_audits_type_status');
        table.index(['auditor_id', 'status'], 'idx_audits_auditor_status');
        table.index(['policy_id', 'status'], 'idx_audits_policy_status');
        table.index('scheduled_date', 'idx_audits_scheduled_date');
        table.index('created_at', 'idx_audits_created_at');
      })

      // Audit Findings Table - Audit findings and issues
      .createTable('audit_findings', (table) => {
        table.increments('id').primary();
        table.integer('audit_id').unsigned().notNullable();
        table.integer('requirement_id').unsigned();
        table.string('finding_title', 200).notNullable();
        table.text('description').notNullable();
        table.enum('severity', ['critical', 'high', 'medium', 'low']).notNullable();
        table
          .enum('finding_type', ['non_compliance', 'observation', 'best_practice', 'strength'])
          .notNullable();
        table.text('recommendation').notNullable();
        table
          .enum('status', ['open', 'in_remediation', 'resolved', 'accepted_risk', 'closed'])
          .notNullable()
          .defaultTo('open');
        table.integer('assigned_to').unsigned();
        table.date('due_date');
        table.date('resolution_date');
        table.text('remediation_plan');
        table.text('resolution_notes');
        table.decimal('risk_score', 5, 2); // Risk assessment score
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table.foreign('audit_id').references('id').inTable('audit_schedules').onDelete('CASCADE');
        table
          .foreign('requirement_id')
          .references('id')
          .inTable('compliance_requirements')
          .onDelete('SET NULL');
        table.foreign('assigned_to').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['audit_id', 'status'], 'idx_findings_audit_status');
        table.index(['severity', 'status'], 'idx_findings_severity_status');
        table.index(['finding_type', 'status'], 'idx_findings_type_status');
        table.index(['assigned_to', 'status'], 'idx_findings_assigned_status');
        table.index(['status', 'due_date'], 'idx_findings_status_due');
        table.index('created_at', 'idx_findings_created_at');
      })

      // Compliance Evidence Table - Evidence and documentation tracking
      .createTable('compliance_evidence', (table) => {
        table.increments('id').primary();
        table.integer('requirement_id').unsigned();
        table.integer('audit_id').unsigned();
        table.integer('finding_id').unsigned();
        table.string('evidence_type', 100).notNullable(); // document, screenshot, log, certificate, etc.
        table.string('evidence_name', 200).notNullable();
        table.text('description');
        table.string('file_path', 500);
        table.string('file_type', 50);
        table.integer('file_size'); // Size in bytes
        table.string('document_hash', 64); // SHA-256 hash for integrity
        table.date('evidence_date').notNullable();
        table.date('expiry_date');
        table.integer('uploaded_by').unsigned();
        table
          .enum('verification_status', ['pending', 'verified', 'rejected', 'expired'])
          .notNullable()
          .defaultTo('pending');
        table.integer('verified_by').unsigned();
        table.timestamp('verified_at');
        table.text('verification_notes');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table
          .foreign('requirement_id')
          .references('id')
          .inTable('compliance_requirements')
          .onDelete('CASCADE');
        table.foreign('audit_id').references('id').inTable('audit_schedules').onDelete('CASCADE');
        table.foreign('finding_id').references('id').inTable('audit_findings').onDelete('CASCADE');
        table.foreign('uploaded_by').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('verified_by').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['requirement_id', 'verification_status'], 'idx_evidence_req_status');
        table.index(['audit_id', 'verification_status'], 'idx_evidence_audit_status');
        table.index(['evidence_type', 'verification_status'], 'idx_evidence_type_status');
        table.index(['verification_status', 'expiry_date'], 'idx_evidence_status_expiry');
        table.index('evidence_date', 'idx_evidence_date');
        table.index('created_at', 'idx_evidence_created_at');
      })

      // Compliance Reports Table - Compliance reporting and dashboards
      .createTable('compliance_reports', (table) => {
        table.increments('id').primary();
        table.string('report_name', 200).notNullable();
        table
          .enum('report_type', [
            'compliance_status',
            'audit_summary',
            'risk_assessment',
            'gap_analysis',
            'executive_summary',
            'trend_analysis'
          ])
          .notNullable();
        table.string('reporting_period', 100).notNullable(); // Q1 2024, FY2024, Jan 2024, etc.
        table.date('period_start').notNullable();
        table.date('period_end').notNullable();
        table.integer('generated_by').unsigned();
        table
          .enum('status', ['draft', 'review', 'approved', 'published'])
          .notNullable()
          .defaultTo('draft');
        table.text('summary');
        table.text('report_data'); // JSON string of detailed report data
        table.decimal('overall_compliance_score', 5, 2); // 0-100 percentage
        table.integer('total_requirements');
        table.integer('compliant_requirements');
        table.integer('non_compliant_requirements');
        table.integer('open_findings');
        table.integer('critical_findings');
        table.string('file_path', 500); // Path to generated report file
        table.integer('approved_by').unsigned();
        table.timestamp('approved_at');
        table.timestamp('published_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table.foreign('generated_by').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['report_type', 'status'], 'idx_reports_type_status');
        table.index(['status', 'created_at'], 'idx_reports_status_created');
        table.index(['period_start', 'period_end'], 'idx_reports_period');
        table.index(['generated_by', 'created_at'], 'idx_reports_generated_created');
        table.index('published_at', 'idx_reports_published_at');
        table.index('created_at', 'idx_reports_created_at');
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('compliance_reports')
    .dropTableIfExists('compliance_evidence')
    .dropTableIfExists('audit_findings')
    .dropTableIfExists('audit_schedules')
    .dropTableIfExists('compliance_requirements')
    .dropTableIfExists('compliance_policies');
};
