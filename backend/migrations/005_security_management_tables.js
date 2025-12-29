/**
 * Security Management Tables Migration
 * ITSM-Sec Nexus - Security Policies, Risk Management, Events, Access Control
 *
 * Creates comprehensive security management tables for:
 * - Security policy management
 * - Risk assessment and tracking
 * - Security event monitoring
 * - Access control matrix
 */

exports.up = function (knex) {
  return (
    knex.schema
      // Security Policies Table - Policy lifecycle management
      .createTable('security_policies', (table) => {
        table.increments('id').primary();
        table.string('policy_id', 50).notNullable().unique();
        table.string('policy_name', 255).notNullable();
        table.text('description');
        table
          .enum('policy_type', [
            'access_control',
            'data_protection',
            'incident_response',
            'business_continuity',
            'acceptable_use',
            'password',
            'encryption',
            'network_security',
            'physical_security',
            'compliance'
          ])
          .notNullable();
        table
          .enum('status', ['draft', 'active', 'under_review', 'archived'])
          .notNullable()
          .defaultTo('draft');
        table
          .enum('severity', ['critical', 'high', 'medium', 'low'])
          .notNullable()
          .defaultTo('medium');
        table.text('policy_content'); // Full policy document or reference
        table.string('owner', 255); // Policy owner/responsible person
        table.integer('owner_user_id').unsigned();
        table.date('effective_date');
        table.date('review_date'); // Next scheduled review
        table.date('expiration_date');
        table.integer('version').defaultTo(1);
        table.text('compliance_frameworks'); // JSON array of frameworks (ISO 27001, NIST, etc.)
        table.text('affected_systems'); // JSON array of affected systems/assets
        table.text('enforcement_rules'); // JSON object defining enforcement criteria
        table.boolean('is_mandatory').defaultTo(true);
        table.integer('violation_count').defaultTo(0);
        table.timestamp('last_violation_at');
        table.integer('created_by').unsigned();
        table.integer('approved_by').unsigned();
        table.timestamp('approved_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table.foreign('owner_user_id').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes
        table.index(['policy_type', 'status'], 'idx_sec_policies_type_status');
        table.index(['status', 'effective_date'], 'idx_sec_policies_status_effective');
        table.index(['review_date'], 'idx_sec_policies_review_date');
        table.index(['owner_user_id', 'status'], 'idx_sec_policies_owner_status');
        table.index(['severity', 'status'], 'idx_sec_policies_severity_status');
        table.index('created_at', 'idx_sec_policies_created_at');
      })

      // Risk Assessments Table - Risk identification and tracking
      .createTable('risk_assessments', (table) => {
        table.increments('id').primary();
        table.string('risk_id', 50).notNullable().unique();
        table.string('risk_name', 255).notNullable();
        table.text('description');
        table
          .enum('risk_category', [
            'operational',
            'financial',
            'reputational',
            'compliance',
            'strategic',
            'technological',
            'cyber_security',
            'physical_security',
            'third_party',
            'human_resources'
          ])
          .notNullable();
        table
          .enum('status', [
            'identified',
            'assessed',
            'mitigated',
            'accepted',
            'transferred',
            'closed'
          ])
          .notNullable()
          .defaultTo('identified');

        // Risk scoring components (1-5 scale)
        table.integer('likelihood_score').notNullable().defaultTo(3); // 1=Rare, 5=Almost Certain
        table.integer('impact_score').notNullable().defaultTo(3); // 1=Negligible, 5=Catastrophic
        table.integer('inherent_risk_score'); // Calculated: likelihood × impact (1-25)
        table.integer('residual_risk_score'); // Risk after controls applied

        table.enum('risk_level', ['critical', 'high', 'medium', 'low']).notNullable();
        table.text('threat_description');
        table.text('vulnerability_description');
        table.text('impact_description');
        table.text('existing_controls'); // JSON array of current controls
        table.text('proposed_controls'); // JSON array of mitigation actions
        table.text('affected_assets'); // JSON array of asset IDs/names
        table.text('affected_systems'); // JSON array of system names
        table.string('risk_owner', 255);
        table.integer('risk_owner_user_id').unsigned();
        table.date('assessment_date').notNullable();
        table.date('next_review_date');
        table.date('mitigation_deadline');
        table.string('mitigation_status', 100);
        table.decimal('mitigation_cost', 12, 2); // Estimated cost of mitigation
        table.decimal('potential_loss', 12, 2); // Estimated financial impact
        table.text('compliance_impact'); // Related compliance requirements
        table.text('notes');
        table.integer('assessed_by').unsigned();
        table.integer('approved_by').unsigned();
        table.timestamp('approved_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table.foreign('risk_owner_user_id').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('assessed_by').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes for risk analysis
        table.index(['risk_category', 'status'], 'idx_risks_category_status');
        table.index(['risk_level', 'status'], 'idx_risks_level_status');
        table.index(['inherent_risk_score', 'status'], 'idx_risks_inherent_status');
        table.index(['residual_risk_score', 'status'], 'idx_risks_residual_status');
        table.index(['risk_owner_user_id', 'status'], 'idx_risks_owner_status');
        table.index(['assessment_date'], 'idx_risks_assessment_date');
        table.index(['next_review_date'], 'idx_risks_next_review');
        table.index(['mitigation_deadline', 'status'], 'idx_risks_deadline_status');
        table.index('created_at', 'idx_risks_created_at');
      })

      // Security Events Table - Extended event tracking
      .createTable('security_events', (table) => {
        table.increments('id').primary();
        table.string('event_id', 50).notNullable().unique();
        table
          .enum('event_type', [
            'intrusion_attempt',
            'malware_detection',
            'unauthorized_access',
            'data_breach',
            'ddos_attack',
            'phishing_attempt',
            'policy_violation',
            'configuration_change',
            'privilege_escalation',
            'anomalous_activity',
            'vulnerability_exploit',
            'account_compromise',
            'data_exfiltration',
            'insider_threat',
            'compliance_violation'
          ])
          .notNullable();
        table
          .enum('severity', ['critical', 'high', 'medium', 'low', 'informational'])
          .notNullable();
        table
          .enum('status', [
            'new',
            'investigating',
            'contained',
            'resolved',
            'false_positive',
            'closed'
          ])
          .notNullable()
          .defaultTo('new');
        table.text('description').notNullable();
        table.text('technical_details'); // JSON object with technical data

        // Source information
        table.string('source_ip', 45); // IPv4/IPv6 support
        table.string('source_hostname', 255);
        table.string('source_user', 255);
        table.integer('source_user_id').unsigned();

        // Target information
        table.string('target_ip', 45);
        table.string('target_hostname', 255);
        table.string('target_system', 255);
        table.integer('target_asset_id').unsigned();

        // Event details
        table.string('detection_method', 100); // IDS, SIEM, manual, etc.
        table.text('indicators_of_compromise'); // JSON array of IOCs
        table.text('affected_data'); // Type and volume of affected data
        table.integer('user_count_affected').defaultTo(0);
        table.integer('record_count_affected').defaultTo(0);

        // Response tracking
        table.boolean('is_confirmed').defaultTo(false);
        table.integer('assigned_to').unsigned();
        table.timestamp('assigned_at');
        table.integer('resolved_by').unsigned();
        table.timestamp('resolved_at');
        table.text('resolution_notes');
        table.text('remediation_actions'); // JSON array of actions taken
        table.text('lessons_learned');

        // Related items
        table.integer('related_incident_id').unsigned();
        table.integer('related_policy_id').unsigned();
        table.integer('related_risk_id').unsigned();
        table.text('related_cve_ids'); // JSON array of CVE identifiers

        // Compliance and reporting
        table.boolean('requires_notification').defaultTo(false);
        table.timestamp('notification_sent_at');
        table.text('notification_recipients'); // JSON array
        table.boolean('regulatory_reporting_required').defaultTo(false);
        table.timestamp('regulatory_reported_at');

        // Timestamps
        table.timestamp('detected_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('first_occurred_at');
        table.timestamp('last_occurred_at');
        table.integer('occurrence_count').defaultTo(1);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table.foreign('source_user_id').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('target_asset_id').references('id').inTable('assets').onDelete('SET NULL');
        table.foreign('assigned_to').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('resolved_by').references('id').inTable('users').onDelete('SET NULL');
        table
          .foreign('related_incident_id')
          .references('id')
          .inTable('incidents')
          .onDelete('SET NULL');

        // Optimized indexes for event analysis
        table.index(['event_type', 'severity', 'status'], 'idx_events_type_severity_status');
        table.index(['status', 'detected_at'], 'idx_events_status_detected');
        table.index(['severity', 'detected_at'], 'idx_events_severity_detected');
        table.index(['source_ip', 'detected_at'], 'idx_events_source_ip_detected');
        table.index(['source_user_id', 'detected_at'], 'idx_events_source_user_detected');
        table.index(['target_asset_id', 'detected_at'], 'idx_events_target_asset_detected');
        table.index(['assigned_to', 'status'], 'idx_events_assigned_status');
        table.index(['is_confirmed', 'status'], 'idx_events_confirmed_status');
        table.index(['requires_notification', 'notification_sent_at'], 'idx_events_notification');
        table.index(
          ['regulatory_reporting_required', 'regulatory_reported_at'],
          'idx_events_regulatory'
        );
        table.index('detected_at', 'idx_events_detected_at');
        table.index('created_at', 'idx_events_created_at');
      })

      // Access Control Matrix Table - Role-based access control
      .createTable('access_control_matrix', (table) => {
        table.increments('id').primary();
        table.string('acl_id', 50).notNullable().unique();

        // Subject (who)
        table.string('subject_type', 50).notNullable(); // user, role, group, system
        table.integer('subject_user_id').unsigned();
        table.string('subject_role', 100);
        table.string('subject_group', 100);
        table.string('subject_identifier', 255); // Generic identifier for system/service accounts

        // Object (what)
        table.string('resource_type', 100).notNullable(); // asset, system, data, application, etc.
        table.string('resource_identifier', 255).notNullable(); // Specific resource ID or name
        table.integer('resource_asset_id').unsigned();
        table.string('resource_category', 100); // For grouping similar resources

        // Permission (how)
        table
          .enum('permission_type', [
            'read',
            'write',
            'execute',
            'delete',
            'admin',
            'create',
            'modify',
            'approve',
            'review',
            'full_control',
            'no_access'
          ])
          .notNullable();
        table.text('permission_scope'); // JSON object for granular permissions

        // Access context
        table
          .enum('access_level', ['public', 'internal', 'confidential', 'restricted', 'top_secret'])
          .notNullable()
          .defaultTo('internal');
        table.text('conditions'); // JSON object for conditional access (time, location, MFA, etc.)
        table.boolean('is_temporary').defaultTo(false);
        table.timestamp('valid_from');
        table.timestamp('valid_until');

        // Approval and auditing
        table
          .enum('status', ['active', 'pending_approval', 'expired', 'revoked', 'suspended'])
          .notNullable()
          .defaultTo('active');
        table.string('justification', 500); // Business justification for access
        table.integer('requested_by').unsigned();
        table.integer('approved_by').unsigned();
        table.timestamp('approved_at');
        table.integer('revoked_by').unsigned();
        table.timestamp('revoked_at');
        table.text('revocation_reason');

        // Compliance and review
        table.boolean('requires_review').defaultTo(true);
        table.date('last_review_date');
        table.date('next_review_date');
        table.integer('reviewed_by').unsigned();
        table.text('review_notes');
        table.integer('violation_count').defaultTo(0);
        table.timestamp('last_violation_at');

        // Related security items
        table.integer('related_policy_id').unsigned();
        table.integer('related_risk_id').unsigned();

        // Tracking
        table.integer('usage_count').defaultTo(0);
        table.timestamp('last_used_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Foreign key constraints
        table.foreign('subject_user_id').references('id').inTable('users').onDelete('CASCADE');
        table.foreign('resource_asset_id').references('id').inTable('assets').onDelete('CASCADE');
        table.foreign('requested_by').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('revoked_by').references('id').inTable('users').onDelete('SET NULL');
        table.foreign('reviewed_by').references('id').inTable('users').onDelete('SET NULL');

        // Optimized indexes for access control queries
        table.index(['subject_type', 'subject_user_id', 'status'], 'idx_acl_subject_user_status');
        table.index(['subject_role', 'status'], 'idx_acl_subject_role_status');
        table.index(['resource_type', 'resource_identifier', 'status'], 'idx_acl_resource_status');
        table.index(['resource_asset_id', 'status'], 'idx_acl_resource_asset_status');
        table.index(['permission_type', 'status'], 'idx_acl_permission_status');
        table.index(['access_level', 'status'], 'idx_acl_access_level_status');
        table.index(['status', 'valid_until'], 'idx_acl_status_expiry');
        table.index(['is_temporary', 'valid_until'], 'idx_acl_temporary_expiry');
        table.index(['requires_review', 'next_review_date'], 'idx_acl_review');
        table.index(['approved_by', 'approved_at'], 'idx_acl_approvals');
        table.index('created_at', 'idx_acl_created_at');
        table.index('last_used_at', 'idx_acl_last_used');
      })
  );
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('access_control_matrix')
    .dropTableIfExists('security_events')
    .dropTableIfExists('risk_assessments')
    .dropTableIfExists('security_policies');
};
