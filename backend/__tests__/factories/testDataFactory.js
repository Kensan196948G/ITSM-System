/**
 * Test Data Factory
 * ITSM-Sec Nexus - Standardized test data generation
 *
 * Provides consistent test data creation across all test suites
 */

const bcrypt = require('bcryptjs');

const TEST_TAG = '__TEST__';

class TestDataFactory {
  /**
   * Generate unique test identifier
   */
  static generateId() {
    return `${TEST_TAG}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  /**
   * Create test incident data
   */
  static createIncident(overrides = {}) {
    const uniqueId = this.generateId();
    return {
      title: `${uniqueId}_Test Incident`,
      description: 'Auto-generated test incident for integration testing',
      priority: 'Medium',
      status: 'Open',
      is_security_incident: false,
      ...overrides
    };
  }

  /**
   * Create test RFC/Change request data
   */
  static createRFC(overrides = {}) {
    const uniqueId = this.generateId();
    return {
      title: `${uniqueId}_Test RFC`,
      description: 'Auto-generated test RFC for integration testing',
      type: 'Standard',
      risk_level: 'Medium',
      status: 'Pending',
      implementation_plan: 'Test implementation plan',
      rollback_plan: 'Test rollback plan',
      is_security_change: 0,
      ...overrides
    };
  }

  /**
   * Create test asset data
   */
  static createAsset(overrides = {}) {
    const uniqueId = this.generateId();
    return {
      asset_tag: `${uniqueId}_AST`,
      name: `Test Asset ${Date.now()}`,
      type: 'Server',
      criticality: 3,
      status: 'Active',
      owner: 'IT Department',
      location: 'Test Data Center',
      ...overrides
    };
  }

  /**
   * Create test vulnerability data
   */
  static createVulnerability(overrides = {}) {
    const uniqueId = this.generateId();
    const randomCve = `CVE-2024-${Math.floor(Math.random() * 100000)}`;

    return {
      vulnerability_id: randomCve,
      title: `${uniqueId}_Test Vulnerability`,
      description: 'Auto-generated test vulnerability for integration testing',
      severity: 'Medium',
      cvss_score: 5.5,
      affected_asset: 'Test System',
      status: 'Identified',
      detection_date: new Date().toISOString().split('T')[0],
      ...overrides
    };
  }

  /**
   * Create test user data
   */
  static createUser(overrides = {}) {
    const uniqueId = Date.now();
    const uniqueTag = Math.floor(Math.random() * 10000);

    return {
      username: `testuser_${uniqueId}_${uniqueTag}`,
      password: 'TestPassword123!',
      email: `test_${uniqueId}_${uniqueTag}@example.com`,
      full_name: `Test User ${uniqueId}`,
      role: 'analyst',
      is_active: true,
      ...overrides
    };
  }

  /**
   * Create test user with hashed password (for database insertion)
   */
  static async createUserWithHash(overrides = {}) {
    const userData = this.createUser(overrides);
    const password_hash = await bcrypt.hash(userData.password, 10);

    return {
      ...userData,
      password_hash,
      // Remove plain password for security
      password: undefined
    };
  }

  /**
   * Create test security alert data
   */
  static createSecurityAlert(overrides = {}) {
    const uniqueId = this.generateId();

    return {
      alert_type: 'failed_login',
      severity: 'medium',
      description: `${uniqueId}_Test security alert`,
      affected_user_id: null,
      affected_resource_type: 'user',
      affected_resource_id: '1',
      source_ip: '127.0.0.1',
      is_acknowledged: false,
      ...overrides
    };
  }

  /**
   * Create test audit log data
   */
  static createAuditLog(overrides = {}) {
    const uniqueId = this.generateId();

    return {
      user_id: null,
      action: 'create',
      resource_type: 'test_resource',
      resource_id: uniqueId,
      old_values: null,
      new_values: JSON.stringify({ test: 'data' }),
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      is_security_action: false,
      ...overrides
    };
  }

  /**
   * Create test user activity data
   */
  static createUserActivity(overrides = {}) {
    const uniqueId = this.generateId();

    return {
      user_id: null,
      activity_type: 'test_activity',
      ip_address: '127.0.0.1',
      user_agent: 'Test Agent',
      success: true,
      failure_reason: null,
      session_id: uniqueId,
      ...overrides
    };
  }

  /**
   * Create test problem data
   */
  static createProblem(overrides = {}) {
    const uniqueId = this.generateId();

    return {
      problem_id: `PRB-${Date.now()}`,
      title: `${uniqueId}_Test Problem`,
      description: 'Auto-generated test problem',
      status: 'Identified',
      priority: 'Medium',
      root_cause: null,
      related_incidents: null,
      assignee: null,
      ...overrides
    };
  }

  /**
   * Create test release data
   */
  static createRelease(overrides = {}) {
    const uniqueId = this.generateId();

    return {
      release_id: `REL-${Date.now()}`,
      name: `${uniqueId}_Test Release`,
      description: 'Auto-generated test release',
      version: '1.0.0',
      status: 'Planning',
      release_date: new Date().toISOString().split('T')[0],
      change_count: 0,
      target_environment: 'Test',
      progress: 0,
      ...overrides
    };
  }

  /**
   * Create test SLA agreement data
   */
  static createSLA(overrides = {}) {
    const uniqueId = this.generateId();

    return {
      sla_id: `SLA-${Date.now()}`,
      service_name: `${uniqueId}_Test Service`,
      service_description: 'Auto-generated test SLA',
      service_level: 'Gold',
      availability_target: 99.9,
      response_time_target: 4,
      resolution_time_target: 24,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      compliance_target: 95.0,
      ...overrides
    };
  }

  /**
   * Clean up all test data from database
   * @param {Object} db - Database connection
   * @returns {Promise<void>}
   */
  static async cleanupAll(db) {
    const tables = [
      'incidents',
      'changes',
      'assets',
      'vulnerabilities',
      'problems',
      'releases',
      'service_requests',
      'sla_agreements',
      'knowledge_articles',
      'capacity_metrics',
      'security_alerts',
      'audit_logs',
      'user_activity',
      'users'
    ];

    const cleanupPromises = tables.map(
      (table) =>
        new Promise((resolve) => {
          db.run(
            `DELETE FROM ${table} WHERE (
          title LIKE ? OR
          description LIKE ? OR
          name LIKE ? OR
          username LIKE ?
        )`,
            [`${TEST_TAG}%`, `${TEST_TAG}%`, `${TEST_TAG}%`, 'testuser_%'],
            (err) => {
              if (
                err &&
                !err.message.includes('no such column') &&
                !err.message.includes('no such table')
              ) {
                console.error(`Failed to cleanup ${table}:`, err.message);
              }
              resolve();
            }
          );
        })
    );

    await Promise.all(cleanupPromises);
    console.log(`[TestDataFactory] Cleanup completed for ${tables.length} tables`);
  }
}

module.exports = TestDataFactory;
