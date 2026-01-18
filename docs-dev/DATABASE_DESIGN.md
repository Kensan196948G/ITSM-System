# Database Design Documentation
# ITSM-Sec Nexus - Complete Database Schema

Version: 1.0
Last Updated: 2026-01-01
Database: SQLite 3
Schema Version: Migration 20251230043107

---

## Table of Contents

1. [Overview](#overview)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Table Specifications](#table-specifications)
4. [Relationships and Foreign Keys](#relationships-and-foreign-keys)
5. [Index Strategy](#index-strategy)
6. [Data Integrity Rules](#data-integrity-rules)
7. [Business Logic](#business-logic)
8. [Performance Optimization](#performance-optimization)

---

## Overview

ITSM-Sec Nexus is a comprehensive IT Service Management system with integrated security management capabilities, compliant with:
- **ISO 20000** - IT Service Management
- **NIST CSF 2.0** - Cybersecurity Framework (6 core functions)
- **ISO 27001** - Information Security Management

### Database Architecture

- **Database Engine**: SQLite 3
- **Total Tables**: 27
- **Migration System**: Knex.js
- **Database File**: `itsm_nexus.db`

### Functional Modules

1. **Core ITSM** (11 tables)
   - User management, Incidents, Assets, Changes, Problems, Releases, Service Requests, SLA, Knowledge Base, Capacity Management, Vulnerabilities

2. **Security Management** (6 tables)
   - Audit Logs, Security Alerts, User Activity, Security Policies, Security Events, Access Control Matrix

3. **Compliance Management** (6 tables)
   - Compliance Policies, Requirements, Audit Schedules, Audit Findings, Evidence, Reports

4. **Risk Management** (1 table)
   - Risk Assessments

5. **NIST CSF Tracking** (1 table)
   - Compliance (framework functions)

---

## Entity Relationship Diagram

```mermaid
erDiagram
    %% Core ITSM Tables
    users ||--o{ incidents : creates
    users ||--o{ changes : requests
    users ||--o{ problems : assigned_to
    users ||--o{ service_requests : submits
    users ||--o{ knowledge_articles : authors
    users ||--o{ audit_logs : performs
    users ||--o{ security_alerts : affected_by
    users ||--o{ user_activity : tracks

    assets ||--o{ changes : affects
    assets ||--o{ vulnerabilities : has
    assets ||--o{ security_events : targeted
    assets ||--o{ access_control_matrix : controls

    incidents ||--o{ problems : related_to
    incidents ||--o{ security_events : triggers

    changes ||--o{ releases : included_in

    %% Security Management
    security_policies ||--o{ security_events : governs
    security_policies ||--o{ risk_assessments : related_to
    security_policies ||--o{ access_control_matrix : enforces

    vulnerabilities ||--o{ compliance : mapped_to_nist

    %% Compliance Management
    compliance_policies ||--o{ compliance_requirements : contains
    compliance_policies ||--o{ audit_schedules : governs

    compliance_requirements ||--o{ audit_findings : identifies
    compliance_requirements ||--o{ compliance_evidence : proves

    audit_schedules ||--o{ audit_findings : produces
    audit_schedules ||--o{ compliance_evidence : requires

    audit_findings ||--o{ compliance_evidence : supports

    %% Risk Management
    risk_assessments ||--o{ security_events : mitigates

    %% Table Definitions
    users {
        int id PK
        string username UK
        string email UK
        string password_hash
        enum role
        string full_name
        boolean is_active
        string totp_secret
        boolean totp_enabled
        text backup_codes
        datetime created_at
        datetime last_login
    }

    incidents {
        int id PK
        string ticket_id UK
        text title
        text description
        string status
        string priority
        boolean is_security_incident
        datetime created_at
    }

    assets {
        int id PK
        string asset_tag UK
        string name
        string type
        int criticality
        string status
        datetime last_updated
    }

    changes {
        int id PK
        string rfc_id UK
        text title
        text description
        string asset_tag FK
        string status
        string requester
        string approver
        int is_security_change
        string impact_level
        datetime created_at
    }

    problems {
        int id PK
        string problem_id UK
        text title
        text description
        string status
        string priority
        text root_cause
        text related_incidents
        string assignee
        datetime created_at
        datetime resolved_at
    }

    releases {
        int id PK
        string release_id UK
        string name
        text description
        string version
        string status
        date release_date
        int change_count
        string target_environment
        int progress
        datetime created_at
    }

    service_requests {
        int id PK
        string request_id UK
        string request_type
        text title
        text description
        string requester
        string status
        string priority
        datetime created_at
        datetime completed_at
    }

    sla_agreements {
        int id PK
        string sla_id UK
        string service_name
        string metric_name
        string target_value
        string actual_value
        float achievement_rate
        string measurement_period
        string status
        datetime created_at
    }

    knowledge_articles {
        int id PK
        string article_id UK
        text title
        text content
        string category
        int view_count
        float rating
        string author
        string status
        datetime created_at
        datetime updated_at
    }

    capacity_metrics {
        int id PK
        string metric_id UK
        string resource_name
        string resource_type
        float current_usage
        float threshold
        float forecast_3m
        string status
        string unit
        datetime measured_at
    }

    vulnerabilities {
        int id PK
        string vulnerability_id UK
        text title
        text description
        string severity
        float cvss_score
        string cvss_vector
        string affected_asset FK
        string status
        date detection_date
        date resolution_date
        string nist_csf_function
        string nist_csf_category
        float nist_csf_impact
        datetime created_at
    }

    compliance {
        string function PK
        int progress
        int target_tier
    }

    audit_logs {
        int id PK
        int user_id FK
        string action
        string resource_type
        string resource_id
        text old_values
        text new_values
        string ip_address
        string user_agent
        boolean is_security_action
        datetime created_at
    }

    security_alerts {
        int id PK
        string alert_type
        enum severity
        text description
        int affected_user_id FK
        string affected_resource_type
        string affected_resource_id
        string source_ip
        boolean is_acknowledged
        int acknowledged_by FK
        datetime acknowledged_at
        text remediation_notes
        datetime created_at
    }

    user_activity {
        int id PK
        int user_id FK_NULLABLE
        string activity_type
        string ip_address
        string user_agent
        boolean success
        string failure_reason
        string session_id
        datetime created_at
    }

    compliance_policies {
        int id PK
        string policy_name
        string policy_code UK
        enum policy_type
        text description
        text requirements
        enum status
        enum priority
        int owner_id FK
        date effective_date
        date review_date
        int review_frequency_days
        datetime created_at
        datetime updated_at
    }

    compliance_requirements {
        int id PK
        int policy_id FK
        string requirement_code
        string framework
        string category
        text description
        text implementation_guidance
        enum status
        enum criticality
        int assigned_to FK
        date target_date
        date completion_date
        decimal compliance_score
        text notes
        datetime created_at
        datetime updated_at
    }

    audit_schedules {
        int id PK
        int policy_id FK
        string audit_name
        enum audit_type
        text scope
        enum status
        int auditor_id FK
        int auditee_id FK
        date scheduled_date
        date start_date
        date end_date
        date report_due_date
        text objectives
        text methodology
        text findings_summary
        enum overall_result
        datetime created_at
        datetime updated_at
    }

    audit_findings {
        int id PK
        int audit_id FK
        int requirement_id FK
        string finding_title
        text description
        enum severity
        enum finding_type
        text recommendation
        enum status
        int assigned_to FK
        date due_date
        date resolution_date
        text remediation_plan
        text resolution_notes
        decimal risk_score
        datetime created_at
        datetime updated_at
    }

    compliance_evidence {
        int id PK
        int requirement_id FK
        int audit_id FK
        int finding_id FK
        string evidence_type
        string evidence_name
        text description
        string file_path
        string file_type
        int file_size
        string document_hash
        date evidence_date
        date expiry_date
        int uploaded_by FK
        enum verification_status
        int verified_by FK
        datetime verified_at
        text verification_notes
        datetime created_at
        datetime updated_at
    }

    compliance_reports {
        int id PK
        string report_name
        enum report_type
        string reporting_period
        date period_start
        date period_end
        int generated_by FK
        enum status
        text summary
        text report_data
        decimal overall_compliance_score
        int total_requirements
        int compliant_requirements
        int non_compliant_requirements
        int open_findings
        int critical_findings
        string file_path
        int approved_by FK
        datetime approved_at
        datetime published_at
        datetime created_at
        datetime updated_at
    }

    security_policies {
        int id PK
        string policy_id UK
        string policy_name
        text description
        enum policy_type
        enum status
        enum severity
        text policy_content
        string owner
        int owner_user_id FK
        date effective_date
        date review_date
        date expiration_date
        int version
        text compliance_frameworks
        text affected_systems
        text enforcement_rules
        boolean is_mandatory
        int violation_count
        datetime last_violation_at
        int created_by FK
        int approved_by FK
        datetime approved_at
        datetime created_at
        datetime updated_at
    }

    risk_assessments {
        int id PK
        string risk_id UK
        string risk_name
        text description
        enum risk_category
        enum status
        int likelihood_score
        int impact_score
        int inherent_risk_score
        int residual_risk_score
        enum risk_level
        text threat_description
        text vulnerability_description
        text impact_description
        text existing_controls
        text proposed_controls
        text affected_assets
        text affected_systems
        string risk_owner
        int risk_owner_user_id FK
        date assessment_date
        date next_review_date
        date mitigation_deadline
        string mitigation_status
        decimal mitigation_cost
        decimal potential_loss
        text compliance_impact
        text notes
        int assessed_by FK
        int approved_by FK
        datetime approved_at
        datetime created_at
        datetime updated_at
    }

    security_events {
        int id PK
        string event_id UK
        enum event_type
        enum severity
        enum status
        text description
        text technical_details
        string source_ip
        string source_hostname
        string source_user
        int source_user_id FK
        string target_ip
        string target_hostname
        string target_system
        int target_asset_id FK
        string detection_method
        text indicators_of_compromise
        text affected_data
        int user_count_affected
        int record_count_affected
        boolean is_confirmed
        int assigned_to FK
        datetime assigned_at
        int resolved_by FK
        datetime resolved_at
        text resolution_notes
        text remediation_actions
        text lessons_learned
        int related_incident_id FK
        int related_policy_id FK
        int related_risk_id FK
        text related_cve_ids
        boolean requires_notification
        datetime notification_sent_at
        text notification_recipients
        boolean regulatory_reporting_required
        datetime regulatory_reported_at
        datetime detected_at
        datetime first_occurred_at
        datetime last_occurred_at
        int occurrence_count
        datetime created_at
        datetime updated_at
    }

    access_control_matrix {
        int id PK
        string acl_id UK
        string subject_type
        int subject_user_id FK
        string subject_role
        string subject_group
        string subject_identifier
        string resource_type
        string resource_identifier
        int resource_asset_id FK
        string resource_category
        enum permission_type
        text permission_scope
        enum access_level
        text conditions
        boolean is_temporary
        datetime valid_from
        datetime valid_until
        enum status
        string justification
        int requested_by FK
        int approved_by FK
        datetime approved_at
        int revoked_by FK
        datetime revoked_at
        text revocation_reason
        boolean requires_review
        date last_review_date
        date next_review_date
        int reviewed_by FK
        text review_notes
        int violation_count
        datetime last_violation_at
        int related_policy_id FK
        int related_risk_id FK
        int usage_count
        datetime last_used_at
        datetime created_at
        datetime updated_at
    }
```

---

## Table Specifications

### 1. users
**Purpose**: User authentication, authorization, and RBAC (Role-Based Access Control)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique user identifier |
| username | TEXT(255) | UNIQUE, NOT NULL | Login username |
| email | TEXT(255) | UNIQUE, NOT NULL | User email address |
| password_hash | TEXT(255) | NOT NULL | bcrypt hashed password |
| role | ENUM | NOT NULL, CHECK | User role: admin, manager, analyst, viewer |
| full_name | TEXT(255) | | Full name of user |
| is_active | BOOLEAN | DEFAULT 1 | Account active status |
| totp_secret | TEXT(255) | | TOTP secret for 2FA |
| totp_enabled | BOOLEAN | DEFAULT 0 | 2FA enabled flag |
| backup_codes | TEXT | | JSON array of backup codes |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Account creation timestamp |
| last_login | DATETIME | | Last successful login |

**Indexes**:
- `username` (B-tree)
- `email` (B-tree)
- `role` (B-tree)

**Default Seeded Users**:
- admin / admin@itsm.local (role: admin, password: admin123)
- analyst / analyst@itsm.local (role: analyst, password: analyst123)
- viewer / viewer@itsm.local (role: viewer, password: viewer123)

---

### 2. incidents
**Purpose**: ITSM Incident Management (ISO 20000 aligned)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| ticket_id | TEXT(50) | UNIQUE, NOT NULL | Human-readable ticket ID (e.g., INC-2025-001) |
| title | TEXT | | Incident title |
| description | TEXT | | Detailed incident description |
| status | TEXT(50) | | Status: Analyzing, In-Progress, Resolved, Closed |
| priority | TEXT(50) | | Priority: Critical, High, Medium, Low |
| is_security_incident | BOOLEAN | DEFAULT 0 | Security incident flag |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Incident creation time |

**Indexes**:
- `ticket_id` (B-tree, unique)
- `status` (B-tree)
- `priority` (B-tree)
- `idx_incidents_status_created` (Composite: status, created_at DESC)
- `idx_incidents_priority_created` (Composite: priority, created_at DESC)
- `idx_incidents_security_status` (Composite: is_security_incident, status)

**Business Logic**:
- Security incidents (is_security_incident=1) trigger automatic security alert creation
- Incident closure requires resolution notes in audit logs

---

### 3. assets
**Purpose**: Configuration Management Database (CMDB) - Asset inventory

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| asset_tag | TEXT(50) | UNIQUE, NOT NULL | Unique asset identifier (e.g., SRV-001) |
| name | TEXT(255) | | Asset name |
| type | TEXT(100) | | Asset type: Server, Network, Cloud, Endpoint |
| criticality | INTEGER | | Criticality score (1-5, 5=highest) |
| status | TEXT(50) | | Operational, Maintenance, Retired |
| last_updated | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `asset_tag` (B-tree, unique)
- `type` (B-tree)
- `criticality` (B-tree)
- `idx_assets_type_criticality` (Composite: type, criticality DESC)

**Seeded Assets**:
- SRV-001: Core Database Server (criticality: 5)
- SRV-002: Web Application Server (criticality: 4)
- NET-001: Main Firewall (criticality: 5)
- NET-002: Core L3 Switch (criticality: 5)
- CLD-001: Microsoft 365 Tenant (criticality: 5)
- PC-101: CEO Laptop (criticality: 3)

---

### 4. changes
**Purpose**: RFC (Request for Change) Management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| rfc_id | TEXT(50) | UNIQUE, NOT NULL | RFC identifier (e.g., RFC-2025-001) |
| title | TEXT | | Change title |
| description | TEXT | | Change description |
| asset_tag | TEXT(50) | | Affected asset (references assets.asset_tag) |
| status | TEXT(50) | | Pending, Approved, Rejected, Implemented |
| requester | TEXT(255) | | Person requesting change |
| approver | TEXT(255) | | Person approving change |
| is_security_change | INTEGER | DEFAULT 0 | Security-related change flag |
| impact_level | TEXT(50) | | High, Medium, Low |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Change request creation time |

**Indexes**:
- `rfc_id` (B-tree, unique)
- `status` (B-tree)
- `idx_changes_status_created` (Composite: status, created_at DESC)

**Business Logic**:
- Security changes (is_security_change=1) require additional approvals
- Changes to critical assets (criticality >= 4) require manager approval

---

### 5. problems
**Purpose**: Problem Management - Root cause analysis

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| problem_id | TEXT(50) | UNIQUE, NOT NULL | Problem identifier (e.g., PRB-2025-001) |
| title | TEXT | | Problem title |
| description | TEXT | | Detailed description |
| status | TEXT(50) | | Identified, Analyzing, Resolved, Closed |
| priority | TEXT(50) | | Critical, High, Medium, Low |
| root_cause | TEXT | | Identified root cause |
| related_incidents | TEXT | | Related incident count/IDs |
| assignee | TEXT(255) | | Assigned team/person |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Problem creation time |
| resolved_at | DATETIME | | Resolution timestamp |

**Indexes**:
- `problem_id` (B-tree, unique)
- `status` (B-tree)
- `idx_problems_status_priority` (Composite: status, priority)

---

### 6. releases
**Purpose**: Release and Deployment Management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| release_id | TEXT(50) | UNIQUE, NOT NULL | Release identifier (e.g., REL-2025-001) |
| name | TEXT(255) | | Release name |
| description | TEXT | | Release description |
| version | TEXT(50) | | Version number |
| status | TEXT(50) | | Planning, Development, Testing, Deployed, Cancelled |
| release_date | DATE | | Planned release date |
| change_count | INTEGER | DEFAULT 0 | Number of changes included |
| target_environment | TEXT(100) | | Target deployment environment |
| progress | INTEGER | DEFAULT 0 | Completion percentage (0-100) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Release creation time |

**Indexes**:
- `release_id` (B-tree, unique)
- `status` (B-tree)
- `idx_releases_status_date` (Composite: status, release_date)

---

### 7. service_requests
**Purpose**: Service Request Management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| request_id | TEXT(50) | UNIQUE, NOT NULL | Request identifier (e.g., REQ-2025-001) |
| request_type | TEXT(100) | | Account creation, Access rights, Password reset, Software install |
| title | TEXT | | Request title |
| description | TEXT | | Request description |
| requester | TEXT(255) | | Person making request |
| status | TEXT(50) | | Submitted, Approved, In-Progress, Completed, Rejected |
| priority | TEXT(50) | | High, Medium, Low |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Request creation time |
| completed_at | DATETIME | | Completion timestamp |

**Indexes**:
- `request_id` (B-tree, unique)
- `status` (B-tree)
- `idx_service_requests_status_created` (Composite: status, created_at DESC)

---

### 8. sla_agreements
**Purpose**: Service Level Agreement Tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| sla_id | TEXT(50) | UNIQUE, NOT NULL | SLA identifier (e.g., SLA-2025-001) |
| service_name | TEXT(255) | | Service name |
| metric_name | TEXT(255) | | Metric being measured |
| target_value | TEXT(100) | | Target SLA value |
| actual_value | TEXT(100) | | Actual measured value |
| achievement_rate | REAL | | Achievement percentage |
| measurement_period | TEXT(100) | | Time period (e.g., December 2025) |
| status | TEXT(50) | | Met, At-Risk, Violated |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation time |

**Indexes**:
- `sla_id` (B-tree, unique)
- `status` (B-tree)

---

### 9. knowledge_articles
**Purpose**: Knowledge Base Management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| article_id | TEXT(50) | UNIQUE, NOT NULL | Article identifier (e.g., KB-2025-001) |
| title | TEXT | | Article title |
| content | TEXT | | Article content |
| category | TEXT(100) | | Category: Client, Network, Security, Office IT, Collaboration |
| view_count | INTEGER | DEFAULT 0 | Number of views |
| rating | REAL | DEFAULT 0 | User rating (0-5) |
| author | TEXT(255) | | Author/team |
| status | TEXT(50) | | Draft, Published, Archived |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Article creation time |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update time |

**Indexes**:
- `article_id` (B-tree, unique)
- `category` (B-tree)
- `status` (B-tree)
- `idx_knowledge_articles_category_views` (Composite: category, view_count DESC)

---

### 10. capacity_metrics
**Purpose**: Capacity Planning and Resource Monitoring

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| metric_id | TEXT(50) | UNIQUE, NOT NULL | Metric identifier (e.g., CAP-2025-001) |
| resource_name | TEXT(255) | | Resource name |
| resource_type | TEXT(100) | | Storage, CPU, Memory, Bandwidth, License |
| current_usage | REAL | | Current usage value |
| threshold | REAL | | Alert threshold value |
| forecast_3m | REAL | | 3-month forecast |
| status | TEXT(50) | | Normal, Warning, Critical |
| unit | TEXT(50) | | Unit of measurement (%, GB, etc.) |
| measured_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Measurement timestamp |

**Indexes**:
- `metric_id` (B-tree, unique)
- `resource_type` (B-tree)
- `status` (B-tree)
- `idx_capacity_metrics_status_measured` (Composite: status, measured_at DESC)

**Business Logic**:
- Status = Warning when current_usage >= threshold * 0.8
- Status = Critical when current_usage >= threshold

---

### 11. vulnerabilities
**Purpose**: Vulnerability Management with CVSS 3.1 and NIST CSF 2.0 mapping

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| vulnerability_id | TEXT(50) | UNIQUE, NOT NULL | Vuln ID (CVE-2025-0001, VULN-2025-001) |
| title | TEXT | | Vulnerability title |
| description | TEXT | | Detailed description |
| severity | TEXT(50) | | Critical, High, Medium, Low |
| cvss_score | REAL | | CVSS 3.1 score (0.0-10.0) |
| cvss_vector | TEXT(200) | | CVSS 3.1 vector string |
| affected_asset | TEXT(255) | | Affected asset tag |
| status | TEXT(50) | | Identified, In-Progress, Mitigated, Resolved |
| detection_date | DATE | | Date detected |
| resolution_date | DATE | | Date resolved |
| nist_csf_function | TEXT(50) | | NIST CSF function (GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER) |
| nist_csf_category | TEXT(200) | | NIST CSF category |
| nist_csf_impact | REAL | | NIST impact score (0.0-1.0) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Record creation time |

**Indexes**:
- `vulnerability_id` (B-tree, unique)
- `severity` (B-tree)
- `status` (B-tree)
- `idx_vulnerabilities_severity_cvss` (Composite: severity, cvss_score DESC)
- `idx_vuln_cvss_vector` (B-tree: cvss_vector)
- `idx_vuln_csf_function` (B-tree: nist_csf_function)
- `idx_vuln_csf_status` (Composite: nist_csf_function, status)

**Business Logic**:
- CVSS score >= 9.0: severity = Critical
- CVSS score 7.0-8.9: severity = High
- CVSS score 4.0-6.9: severity = Medium
- CVSS score < 4.0: severity = Low

---

### 12. compliance
**Purpose**: NIST CSF 2.0 Function Tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| function | TEXT(50) | PRIMARY KEY | NIST CSF 2.0 function name |
| progress | INTEGER | | Implementation progress (0-100%) |
| target_tier | INTEGER | | Target tier level (1-4) |

**Valid Functions**:
- GOVERN: Governance and risk management
- IDENTIFY: Asset and risk identification
- PROTECT: Protective measures
- DETECT: Detection processes
- RESPOND: Incident response
- RECOVER: Recovery procedures

**Seeded Data**:
- GOVERN: 85% progress, Tier 3 target
- IDENTIFY: 90% progress, Tier 4 target
- PROTECT: 75% progress, Tier 3 target
- DETECT: 60% progress, Tier 3 target
- RESPOND: 85% progress, Tier 4 target
- RECOVER: 95% progress, Tier 4 target

---

### 13. audit_logs
**Purpose**: Comprehensive audit trail for all system actions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| user_id | INTEGER | FOREIGN KEY (users.id) | User performing action |
| action | TEXT(50) | NOT NULL | Action: create, read, update, delete, LOGIN_FAILED, PRIVILEGE_GRANTED |
| resource_type | TEXT(100) | NOT NULL | Resource type: incidents, changes, vulnerabilities, etc. |
| resource_id | TEXT(100) | | Resource identifier |
| old_values | TEXT | | JSON string of previous values |
| new_values | TEXT | | JSON string of new values |
| ip_address | TEXT(45) | | IPv4/IPv6 address |
| user_agent | TEXT(500) | | Browser user agent |
| is_security_action | BOOLEAN | DEFAULT 0 | Security-related action flag |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Action timestamp |

**Indexes**:
- `idx_audit_user_time` (Composite: user_id, created_at)
- `idx_audit_resource_action` (Composite: resource_type, action)
- `idx_audit_security_time` (Composite: is_security_action, created_at)
- `idx_audit_created_at` (B-tree: created_at)

**Retention Policy**: Keep all logs for minimum 2 years (compliance requirement)

---

### 14. security_alerts
**Purpose**: Real-time security threat detection and alerting

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| alert_type | TEXT(100) | NOT NULL | Alert type: failed_login, privilege_escalation, etc. |
| severity | ENUM | NOT NULL | critical, high, medium, low |
| description | TEXT | NOT NULL | Alert description |
| affected_user_id | INTEGER | FOREIGN KEY (users.id) | Affected user |
| affected_resource_type | TEXT(100) | | Affected resource type |
| affected_resource_id | TEXT(100) | | Affected resource ID |
| source_ip | TEXT(45) | | Source IP address |
| is_acknowledged | BOOLEAN | DEFAULT 0 | Acknowledgment status |
| acknowledged_by | INTEGER | FOREIGN KEY (users.id) | User who acknowledged |
| acknowledged_at | DATETIME | | Acknowledgment timestamp |
| remediation_notes | TEXT | | Remediation notes |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Alert creation time |

**Indexes**:
- `idx_alerts_severity_time` (Composite: severity, created_at)
- `idx_alerts_type_ack` (Composite: alert_type, is_acknowledged)
- `idx_alerts_user_time` (Composite: affected_user_id, created_at)
- `idx_alerts_ack_severity` (Composite: is_acknowledged, severity)
- `idx_alerts_created_at` (B-tree: created_at)

**Business Logic**:
- Critical alerts trigger immediate notifications
- Unacknowledged alerts escalate after 1 hour

---

### 15. user_activity
**Purpose**: User session and authentication tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| user_id | INTEGER | FOREIGN KEY (users.id), NULLABLE | User ID (nullable for failed logins) |
| activity_type | TEXT(100) | NOT NULL | login, logout, failed_login, etc. |
| ip_address | TEXT(45) | | IP address |
| user_agent | TEXT(500) | | Browser user agent |
| success | BOOLEAN | DEFAULT 1 | Success status |
| failure_reason | TEXT(255) | | Failure reason |
| session_id | TEXT(255) | | Session identifier |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Activity timestamp |

**Indexes**:
- `idx_activity_user_time` (Composite: user_id, created_at)
- `idx_activity_type_time` (Composite: activity_type, created_at)
- `idx_activity_ip_time` (Composite: ip_address, created_at)
- `idx_activity_success_type` (Composite: success, activity_type)
- `idx_activity_created_at` (B-tree: created_at)

**Business Logic**:
- 5 failed login attempts within 15 minutes = account lockout
- Failed login attempts with non-existent usernames have user_id = NULL

---

### 16. compliance_policies
**Purpose**: Compliance policy lifecycle management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| policy_name | TEXT(200) | NOT NULL | Policy name |
| policy_code | TEXT(50) | UNIQUE, NOT NULL | Unique policy code |
| policy_type | ENUM | NOT NULL | security, privacy, operational, financial, regulatory, other |
| description | TEXT | NOT NULL | Policy description |
| requirements | TEXT | | JSON string of requirements |
| status | ENUM | NOT NULL, DEFAULT 'draft' | draft, active, deprecated, archived |
| priority | ENUM | NOT NULL, DEFAULT 'medium' | critical, high, medium, low |
| owner_id | INTEGER | FOREIGN KEY (users.id) | Policy owner |
| effective_date | DATE | | Effective date |
| review_date | DATE | | Next review date |
| review_frequency_days | INTEGER | | Review cycle in days |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_policies_status_priority` (Composite: status, priority)
- `idx_policies_type_status` (Composite: policy_type, status)
- `idx_policies_owner_status` (Composite: owner_id, status)
- `idx_policies_review_date` (B-tree: review_date)
- `idx_policies_created_at` (B-tree: created_at)

---

### 17. compliance_requirements
**Purpose**: Regulatory requirements management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| policy_id | INTEGER | FOREIGN KEY (compliance_policies.id), NOT NULL | Parent policy |
| requirement_code | TEXT(100) | NOT NULL | Requirement code |
| framework | TEXT(100) | NOT NULL | Framework: ISO27001, GDPR, SOX, HIPAA, etc. |
| category | TEXT(100) | NOT NULL | Requirement category |
| description | TEXT | NOT NULL | Requirement description |
| implementation_guidance | TEXT | | Implementation guidance |
| status | ENUM | NOT NULL, DEFAULT 'pending' | pending, in_progress, compliant, non_compliant, not_applicable |
| criticality | ENUM | NOT NULL, DEFAULT 'medium' | critical, high, medium, low |
| assigned_to | INTEGER | FOREIGN KEY (users.id) | Assigned user |
| target_date | DATE | | Target completion date |
| completion_date | DATE | | Actual completion date |
| compliance_score | DECIMAL(5,2) | | Compliance percentage (0-100) |
| notes | TEXT | | Notes |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_requirements_policy_status` (Composite: policy_id, status)
- `idx_requirements_framework_status` (Composite: framework, status)
- `idx_requirements_status_criticality` (Composite: status, criticality)
- `idx_requirements_assigned_status` (Composite: assigned_to, status)
- `idx_requirements_target_date` (B-tree: target_date)
- `idx_requirements_created_at` (B-tree: created_at)

---

### 18. audit_schedules
**Purpose**: Audit scheduling and planning

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| policy_id | INTEGER | FOREIGN KEY (compliance_policies.id) | Related policy |
| audit_name | TEXT(200) | NOT NULL | Audit name |
| audit_type | ENUM | NOT NULL | internal, external, third_party, self_assessment |
| scope | TEXT | NOT NULL | Audit scope |
| status | ENUM | NOT NULL, DEFAULT 'scheduled' | scheduled, in_progress, completed, cancelled, postponed |
| auditor_id | INTEGER | FOREIGN KEY (users.id) | Auditor |
| auditee_id | INTEGER | FOREIGN KEY (users.id) | Person being audited |
| scheduled_date | DATE | NOT NULL | Scheduled date |
| start_date | DATE | | Actual start date |
| end_date | DATE | | Actual end date |
| report_due_date | DATE | | Report due date |
| objectives | TEXT | | Audit objectives |
| methodology | TEXT | | Audit methodology |
| findings_summary | TEXT | | Findings summary |
| overall_result | ENUM | DEFAULT 'pending' | pass, pass_with_conditions, fail, pending |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_audits_status_date` (Composite: status, scheduled_date)
- `idx_audits_type_status` (Composite: audit_type, status)
- `idx_audits_auditor_status` (Composite: auditor_id, status)
- `idx_audits_policy_status` (Composite: policy_id, status)
- `idx_audits_scheduled_date` (B-tree: scheduled_date)
- `idx_audits_created_at` (B-tree: created_at)

---

### 19. audit_findings
**Purpose**: Audit findings and remediation tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| audit_id | INTEGER | FOREIGN KEY (audit_schedules.id), NOT NULL | Parent audit |
| requirement_id | INTEGER | FOREIGN KEY (compliance_requirements.id) | Related requirement |
| finding_title | TEXT(200) | NOT NULL | Finding title |
| description | TEXT | NOT NULL | Finding description |
| severity | ENUM | NOT NULL | critical, high, medium, low |
| finding_type | ENUM | NOT NULL | non_compliance, observation, best_practice, strength |
| recommendation | TEXT | NOT NULL | Recommendation |
| status | ENUM | NOT NULL, DEFAULT 'open' | open, in_remediation, resolved, accepted_risk, closed |
| assigned_to | INTEGER | FOREIGN KEY (users.id) | Assigned user |
| due_date | DATE | | Remediation due date |
| resolution_date | DATE | | Actual resolution date |
| remediation_plan | TEXT | | Remediation plan |
| resolution_notes | TEXT | | Resolution notes |
| risk_score | DECIMAL(5,2) | | Risk assessment score |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_findings_audit_status` (Composite: audit_id, status)
- `idx_findings_severity_status` (Composite: severity, status)
- `idx_findings_type_status` (Composite: finding_type, status)
- `idx_findings_assigned_status` (Composite: assigned_to, status)
- `idx_findings_status_due` (Composite: status, due_date)
- `idx_findings_created_at` (B-tree: created_at)

---

### 20. compliance_evidence
**Purpose**: Evidence and documentation tracking for compliance

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| requirement_id | INTEGER | FOREIGN KEY (compliance_requirements.id) | Related requirement |
| audit_id | INTEGER | FOREIGN KEY (audit_schedules.id) | Related audit |
| finding_id | INTEGER | FOREIGN KEY (audit_findings.id) | Related finding |
| evidence_type | TEXT(100) | NOT NULL | document, screenshot, log, certificate, etc. |
| evidence_name | TEXT(200) | NOT NULL | Evidence name |
| description | TEXT | | Evidence description |
| file_path | TEXT(500) | | File path |
| file_type | TEXT(50) | | File type |
| file_size | INTEGER | | File size in bytes |
| document_hash | TEXT(64) | | SHA-256 hash for integrity |
| evidence_date | DATE | NOT NULL | Evidence date |
| expiry_date | DATE | | Expiration date |
| uploaded_by | INTEGER | FOREIGN KEY (users.id) | Uploader |
| verification_status | ENUM | NOT NULL, DEFAULT 'pending' | pending, verified, rejected, expired |
| verified_by | INTEGER | FOREIGN KEY (users.id) | Verifier |
| verified_at | DATETIME | | Verification timestamp |
| verification_notes | TEXT | | Verification notes |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_evidence_req_status` (Composite: requirement_id, verification_status)
- `idx_evidence_audit_status` (Composite: audit_id, verification_status)
- `idx_evidence_type_status` (Composite: evidence_type, verification_status)
- `idx_evidence_status_expiry` (Composite: verification_status, expiry_date)
- `idx_evidence_date` (B-tree: evidence_date)
- `idx_evidence_created_at` (B-tree: created_at)

**Business Logic**:
- Evidence with expiry_date in the past automatically marked as expired
- SHA-256 hash verification on file upload

---

### 21. compliance_reports
**Purpose**: Compliance reporting and executive dashboards

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| report_name | TEXT(200) | NOT NULL | Report name |
| report_type | ENUM | NOT NULL | compliance_status, audit_summary, risk_assessment, gap_analysis, executive_summary, trend_analysis |
| reporting_period | TEXT(100) | NOT NULL | Period (Q1 2024, FY2024, etc.) |
| period_start | DATE | NOT NULL | Period start date |
| period_end | DATE | NOT NULL | Period end date |
| generated_by | INTEGER | FOREIGN KEY (users.id) | Report generator |
| status | ENUM | NOT NULL, DEFAULT 'draft' | draft, review, approved, published |
| summary | TEXT | | Report summary |
| report_data | TEXT | | JSON string of detailed report data |
| overall_compliance_score | DECIMAL(5,2) | | Overall compliance percentage |
| total_requirements | INTEGER | | Total requirements count |
| compliant_requirements | INTEGER | | Compliant requirements count |
| non_compliant_requirements | INTEGER | | Non-compliant requirements count |
| open_findings | INTEGER | | Open findings count |
| critical_findings | INTEGER | | Critical findings count |
| file_path | TEXT(500) | | Generated report file path |
| approved_by | INTEGER | FOREIGN KEY (users.id) | Approver |
| approved_at | DATETIME | | Approval timestamp |
| published_at | DATETIME | | Publication timestamp |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_reports_type_status` (Composite: report_type, status)
- `idx_reports_status_created` (Composite: status, created_at)
- `idx_reports_period` (Composite: period_start, period_end)
- `idx_reports_generated_created` (Composite: generated_by, created_at)
- `idx_reports_published_at` (B-tree: published_at)
- `idx_reports_created_at` (B-tree: created_at)

---

### 22. security_policies
**Purpose**: Security policy lifecycle management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| policy_id | TEXT(50) | UNIQUE, NOT NULL | Policy identifier |
| policy_name | TEXT(255) | NOT NULL | Policy name |
| description | TEXT | | Policy description |
| policy_type | ENUM | NOT NULL | access_control, data_protection, incident_response, business_continuity, acceptable_use, password, encryption, network_security, physical_security, compliance |
| status | ENUM | NOT NULL, DEFAULT 'draft' | draft, active, under_review, archived |
| severity | ENUM | NOT NULL, DEFAULT 'medium' | critical, high, medium, low |
| policy_content | TEXT | | Full policy document |
| owner | TEXT(255) | | Policy owner name |
| owner_user_id | INTEGER | FOREIGN KEY (users.id) | Policy owner user |
| effective_date | DATE | | Effective date |
| review_date | DATE | | Next review date |
| expiration_date | DATE | | Expiration date |
| version | INTEGER | DEFAULT 1 | Policy version |
| compliance_frameworks | TEXT | | JSON array of frameworks |
| affected_systems | TEXT | | JSON array of affected systems |
| enforcement_rules | TEXT | | JSON object defining enforcement |
| is_mandatory | BOOLEAN | DEFAULT 1 | Mandatory policy flag |
| violation_count | INTEGER | DEFAULT 0 | Violation count |
| last_violation_at | DATETIME | | Last violation timestamp |
| created_by | INTEGER | FOREIGN KEY (users.id) | Creator |
| approved_by | INTEGER | FOREIGN KEY (users.id) | Approver |
| approved_at | DATETIME | | Approval timestamp |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_sec_policies_type_status` (Composite: policy_type, status)
- `idx_sec_policies_status_effective` (Composite: status, effective_date)
- `idx_sec_policies_review_date` (B-tree: review_date)
- `idx_sec_policies_owner_status` (Composite: owner_user_id, status)
- `idx_sec_policies_severity_status` (Composite: severity, status)
- `idx_sec_policies_created_at` (B-tree: created_at)

---

### 23. risk_assessments
**Purpose**: Enterprise risk identification and tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| risk_id | TEXT(50) | UNIQUE, NOT NULL | Risk identifier |
| risk_name | TEXT(255) | NOT NULL | Risk name |
| description | TEXT | | Risk description |
| risk_category | ENUM | NOT NULL | operational, financial, reputational, compliance, strategic, technological, cyber_security, physical_security, third_party, human_resources |
| status | ENUM | NOT NULL, DEFAULT 'identified' | identified, assessed, mitigated, accepted, transferred, closed |
| likelihood_score | INTEGER | NOT NULL, DEFAULT 3 | 1=Rare, 5=Almost Certain |
| impact_score | INTEGER | NOT NULL, DEFAULT 3 | 1=Negligible, 5=Catastrophic |
| inherent_risk_score | INTEGER | | Calculated: likelihood × impact (1-25) |
| residual_risk_score | INTEGER | | Risk after controls applied |
| risk_level | ENUM | NOT NULL | critical, high, medium, low |
| threat_description | TEXT | | Threat description |
| vulnerability_description | TEXT | | Vulnerability description |
| impact_description | TEXT | | Impact description |
| existing_controls | TEXT | | JSON array of current controls |
| proposed_controls | TEXT | | JSON array of mitigation actions |
| affected_assets | TEXT | | JSON array of asset IDs |
| affected_systems | TEXT | | JSON array of system names |
| risk_owner | TEXT(255) | | Risk owner name |
| risk_owner_user_id | INTEGER | FOREIGN KEY (users.id) | Risk owner user |
| assessment_date | DATE | NOT NULL | Assessment date |
| next_review_date | DATE | | Next review date |
| mitigation_deadline | DATE | | Mitigation deadline |
| mitigation_status | TEXT(100) | | Mitigation status |
| mitigation_cost | DECIMAL(12,2) | | Estimated mitigation cost |
| potential_loss | DECIMAL(12,2) | | Estimated financial impact |
| compliance_impact | TEXT | | Related compliance requirements |
| notes | TEXT | | Notes |
| assessed_by | INTEGER | FOREIGN KEY (users.id) | Assessor |
| approved_by | INTEGER | FOREIGN KEY (users.id) | Approver |
| approved_at | DATETIME | | Approval timestamp |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_risks_category_status` (Composite: risk_category, status)
- `idx_risks_level_status` (Composite: risk_level, status)
- `idx_risks_inherent_status` (Composite: inherent_risk_score, status)
- `idx_risks_residual_status` (Composite: residual_risk_score, status)
- `idx_risks_owner_status` (Composite: risk_owner_user_id, status)
- `idx_risks_assessment_date` (B-tree: assessment_date)
- `idx_risks_next_review` (B-tree: next_review_date)
- `idx_risks_deadline_status` (Composite: mitigation_deadline, status)
- `idx_risks_created_at` (B-tree: created_at)

**Business Logic**:
- inherent_risk_score = likelihood_score × impact_score
- Risk level determination:
  - Critical: inherent_risk_score >= 20
  - High: inherent_risk_score 12-19
  - Medium: inherent_risk_score 6-11
  - Low: inherent_risk_score 1-5

---

### 24. security_events
**Purpose**: Extended security event tracking and incident correlation

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| event_id | TEXT(50) | UNIQUE, NOT NULL | Event identifier |
| event_type | ENUM | NOT NULL | intrusion_attempt, malware_detection, unauthorized_access, data_breach, ddos_attack, phishing_attempt, policy_violation, configuration_change, privilege_escalation, anomalous_activity, vulnerability_exploit, account_compromise, data_exfiltration, insider_threat, compliance_violation |
| severity | ENUM | NOT NULL | critical, high, medium, low, informational |
| status | ENUM | NOT NULL, DEFAULT 'new' | new, investigating, contained, resolved, false_positive, closed |
| description | TEXT | NOT NULL | Event description |
| technical_details | TEXT | | JSON object with technical data |
| source_ip | TEXT(45) | | Source IP address |
| source_hostname | TEXT(255) | | Source hostname |
| source_user | TEXT(255) | | Source username |
| source_user_id | INTEGER | FOREIGN KEY (users.id) | Source user ID |
| target_ip | TEXT(45) | | Target IP address |
| target_hostname | TEXT(255) | | Target hostname |
| target_system | TEXT(255) | | Target system |
| target_asset_id | INTEGER | FOREIGN KEY (assets.id) | Target asset ID |
| detection_method | TEXT(100) | | Detection method (IDS, SIEM, manual, etc.) |
| indicators_of_compromise | TEXT | | JSON array of IOCs |
| affected_data | TEXT | | Type and volume of affected data |
| user_count_affected | INTEGER | DEFAULT 0 | Number of users affected |
| record_count_affected | INTEGER | DEFAULT 0 | Number of records affected |
| is_confirmed | BOOLEAN | DEFAULT 0 | Confirmation status |
| assigned_to | INTEGER | FOREIGN KEY (users.id) | Assigned user |
| assigned_at | DATETIME | | Assignment timestamp |
| resolved_by | INTEGER | FOREIGN KEY (users.id) | Resolver |
| resolved_at | DATETIME | | Resolution timestamp |
| resolution_notes | TEXT | | Resolution notes |
| remediation_actions | TEXT | | JSON array of actions taken |
| lessons_learned | TEXT | | Lessons learned |
| related_incident_id | INTEGER | FOREIGN KEY (incidents.id) | Related incident |
| related_policy_id | INTEGER | | Related security policy |
| related_risk_id | INTEGER | | Related risk assessment |
| related_cve_ids | TEXT | | JSON array of CVE identifiers |
| requires_notification | BOOLEAN | DEFAULT 0 | Notification required flag |
| notification_sent_at | DATETIME | | Notification sent timestamp |
| notification_recipients | TEXT | | JSON array of recipients |
| regulatory_reporting_required | BOOLEAN | DEFAULT 0 | Regulatory reporting flag |
| regulatory_reported_at | DATETIME | | Regulatory reporting timestamp |
| detected_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Detection timestamp |
| first_occurred_at | DATETIME | | First occurrence timestamp |
| last_occurred_at | DATETIME | | Last occurrence timestamp |
| occurrence_count | INTEGER | DEFAULT 1 | Occurrence count |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_events_type_severity_status` (Composite: event_type, severity, status)
- `idx_events_status_detected` (Composite: status, detected_at)
- `idx_events_severity_detected` (Composite: severity, detected_at)
- `idx_events_source_ip_detected` (Composite: source_ip, detected_at)
- `idx_events_source_user_detected` (Composite: source_user_id, detected_at)
- `idx_events_target_asset_detected` (Composite: target_asset_id, detected_at)
- `idx_events_assigned_status` (Composite: assigned_to, status)
- `idx_events_confirmed_status` (Composite: is_confirmed, status)
- `idx_events_notification` (Composite: requires_notification, notification_sent_at)
- `idx_events_regulatory` (Composite: regulatory_reporting_required, regulatory_reported_at)
- `idx_events_detected_at` (B-tree: detected_at)
- `idx_events_created_at` (B-tree: created_at)

---

### 25. access_control_matrix
**Purpose**: Comprehensive role-based access control (RBAC) management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Auto-increment ID |
| acl_id | TEXT(50) | UNIQUE, NOT NULL | ACL identifier |
| subject_type | TEXT(50) | NOT NULL | user, role, group, system |
| subject_user_id | INTEGER | FOREIGN KEY (users.id) | Subject user ID |
| subject_role | TEXT(100) | | Subject role |
| subject_group | TEXT(100) | | Subject group |
| subject_identifier | TEXT(255) | | Generic identifier for system/service accounts |
| resource_type | TEXT(100) | NOT NULL | asset, system, data, application, etc. |
| resource_identifier | TEXT(255) | NOT NULL | Specific resource ID or name |
| resource_asset_id | INTEGER | FOREIGN KEY (assets.id) | Resource asset ID |
| resource_category | TEXT(100) | | Resource category |
| permission_type | ENUM | NOT NULL | read, write, execute, delete, admin, create, modify, approve, review, full_control, no_access |
| permission_scope | TEXT | | JSON object for granular permissions |
| access_level | ENUM | NOT NULL, DEFAULT 'internal' | public, internal, confidential, restricted, top_secret |
| conditions | TEXT | | JSON object for conditional access |
| is_temporary | BOOLEAN | DEFAULT 0 | Temporary access flag |
| valid_from | DATETIME | | Valid from timestamp |
| valid_until | DATETIME | | Valid until timestamp |
| status | ENUM | NOT NULL, DEFAULT 'active' | active, pending_approval, expired, revoked, suspended |
| justification | TEXT(500) | | Business justification |
| requested_by | INTEGER | FOREIGN KEY (users.id) | Requester |
| approved_by | INTEGER | FOREIGN KEY (users.id) | Approver |
| approved_at | DATETIME | | Approval timestamp |
| revoked_by | INTEGER | FOREIGN KEY (users.id) | Revoker |
| revoked_at | DATETIME | | Revocation timestamp |
| revocation_reason | TEXT | | Revocation reason |
| requires_review | BOOLEAN | DEFAULT 1 | Review required flag |
| last_review_date | DATE | | Last review date |
| next_review_date | DATE | | Next review date |
| reviewed_by | INTEGER | FOREIGN KEY (users.id) | Reviewer |
| review_notes | TEXT | | Review notes |
| violation_count | INTEGER | DEFAULT 0 | Violation count |
| last_violation_at | DATETIME | | Last violation timestamp |
| related_policy_id | INTEGER | | Related security policy |
| related_risk_id | INTEGER | | Related risk assessment |
| usage_count | INTEGER | DEFAULT 0 | Usage count |
| last_used_at | DATETIME | | Last used timestamp |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes**:
- `idx_acl_subject_user_status` (Composite: subject_type, subject_user_id, status)
- `idx_acl_subject_role_status` (Composite: subject_role, status)
- `idx_acl_resource_status` (Composite: resource_type, resource_identifier, status)
- `idx_acl_resource_asset_status` (Composite: resource_asset_id, status)
- `idx_acl_permission_status` (Composite: permission_type, status)
- `idx_acl_access_level_status` (Composite: access_level, status)
- `idx_acl_status_expiry` (Composite: status, valid_until)
- `idx_acl_temporary_expiry` (Composite: is_temporary, valid_until)
- `idx_acl_review` (Composite: requires_review, next_review_date)
- `idx_acl_approvals` (Composite: approved_by, approved_at)
- `idx_acl_created_at` (B-tree: created_at)
- `idx_acl_last_used` (B-tree: last_used_at)

**Business Logic**:
- Temporary access automatically expires based on valid_until
- Access to confidential/restricted resources requires approval
- All access reviewed quarterly (next_review_date)

---

## Relationships and Foreign Keys

### Core ITSM Relationships

1. **users → incidents**: One user can create/be assigned to many incidents
2. **users → changes**: One user can request/approve many changes
3. **users → problems**: One user can be assigned to many problems
4. **users → service_requests**: One user can submit many service requests
5. **users → knowledge_articles**: One user can author many knowledge articles
6. **assets → changes**: One asset can have many changes
7. **assets → vulnerabilities**: One asset can have many vulnerabilities
8. **incidents → problems**: Many incidents can relate to one problem (text field)

### Security Management Relationships

9. **users → audit_logs**: One user generates many audit log entries
   - Foreign Key: `audit_logs.user_id → users.id` (ON DELETE SET NULL)

10. **users → security_alerts** (affected): One user can be affected by many alerts
    - Foreign Key: `security_alerts.affected_user_id → users.id` (ON DELETE SET NULL)

11. **users → security_alerts** (acknowledger): One user can acknowledge many alerts
    - Foreign Key: `security_alerts.acknowledged_by → users.id` (ON DELETE SET NULL)

12. **users → user_activity**: One user has many activity records
    - Foreign Key: `user_activity.user_id → users.id` (ON DELETE CASCADE)
    - Note: Nullable for failed logins with non-existent usernames

13. **assets → security_events**: One asset can be targeted by many security events
    - Foreign Key: `security_events.target_asset_id → assets.id` (ON DELETE SET NULL)

14. **incidents → security_events**: One incident can be related to many security events
    - Foreign Key: `security_events.related_incident_id → incidents.id` (ON DELETE SET NULL)

15. **users → security_policies**: One user owns/creates/approves many security policies
    - Foreign Keys:
      - `security_policies.owner_user_id → users.id` (ON DELETE SET NULL)
      - `security_policies.created_by → users.id` (ON DELETE SET NULL)
      - `security_policies.approved_by → users.id` (ON DELETE SET NULL)

16. **users → risk_assessments**: One user owns/assesses/approves many risk assessments
    - Foreign Keys:
      - `risk_assessments.risk_owner_user_id → users.id` (ON DELETE SET NULL)
      - `risk_assessments.assessed_by → users.id` (ON DELETE SET NULL)
      - `risk_assessments.approved_by → users.id` (ON DELETE SET NULL)

17. **users → security_events**: Users as sources and responders
    - Foreign Keys:
      - `security_events.source_user_id → users.id` (ON DELETE SET NULL)
      - `security_events.assigned_to → users.id` (ON DELETE SET NULL)
      - `security_events.resolved_by → users.id` (ON DELETE SET NULL)

18. **users → access_control_matrix**: Users as subjects and approvers
    - Foreign Keys:
      - `access_control_matrix.subject_user_id → users.id` (ON DELETE CASCADE)
      - `access_control_matrix.requested_by → users.id` (ON DELETE SET NULL)
      - `access_control_matrix.approved_by → users.id` (ON DELETE SET NULL)
      - `access_control_matrix.revoked_by → users.id` (ON DELETE SET NULL)
      - `access_control_matrix.reviewed_by → users.id` (ON DELETE SET NULL)

19. **assets → access_control_matrix**: Assets as controlled resources
    - Foreign Key: `access_control_matrix.resource_asset_id → assets.id` (ON DELETE CASCADE)

### Compliance Management Relationships

20. **users → compliance_policies**: One user owns many compliance policies
    - Foreign Key: `compliance_policies.owner_id → users.id` (ON DELETE SET NULL)

21. **compliance_policies → compliance_requirements**: One policy contains many requirements
    - Foreign Key: `compliance_requirements.policy_id → compliance_policies.id` (ON DELETE CASCADE)

22. **users → compliance_requirements**: One user is assigned to many requirements
    - Foreign Key: `compliance_requirements.assigned_to → users.id` (ON DELETE SET NULL)

23. **compliance_policies → audit_schedules**: One policy has many audits
    - Foreign Key: `audit_schedules.policy_id → compliance_policies.id` (ON DELETE SET NULL)

24. **users → audit_schedules**: Users as auditors and auditees
    - Foreign Keys:
      - `audit_schedules.auditor_id → users.id` (ON DELETE SET NULL)
      - `audit_schedules.auditee_id → users.id` (ON DELETE SET NULL)

25. **audit_schedules → audit_findings**: One audit produces many findings
    - Foreign Key: `audit_findings.audit_id → audit_schedules.id` (ON DELETE CASCADE)

26. **compliance_requirements → audit_findings**: One requirement can have many findings
    - Foreign Key: `audit_findings.requirement_id → compliance_requirements.id` (ON DELETE SET NULL)

27. **users → audit_findings**: One user is assigned to remediate many findings
    - Foreign Key: `audit_findings.assigned_to → users.id` (ON DELETE SET NULL)

28. **compliance_requirements → compliance_evidence**: One requirement has many evidence items
    - Foreign Key: `compliance_evidence.requirement_id → compliance_requirements.id` (ON DELETE CASCADE)

29. **audit_schedules → compliance_evidence**: One audit requires many evidence items
    - Foreign Key: `compliance_evidence.audit_id → audit_schedules.id` (ON DELETE CASCADE)

30. **audit_findings → compliance_evidence**: One finding has supporting evidence
    - Foreign Key: `compliance_evidence.finding_id → audit_findings.id` (ON DELETE CASCADE)

31. **users → compliance_evidence**: Users as uploaders and verifiers
    - Foreign Keys:
      - `compliance_evidence.uploaded_by → users.id` (ON DELETE SET NULL)
      - `compliance_evidence.verified_by → users.id` (ON DELETE SET NULL)

32. **users → compliance_reports**: Users as generators and approvers
    - Foreign Keys:
      - `compliance_reports.generated_by → users.id` (ON DELETE SET NULL)
      - `compliance_reports.approved_by → users.id` (ON DELETE SET NULL)

---

## Index Strategy

### Performance Optimization Principles

1. **Composite Indexes for Common Queries**
   - Status + Timestamp: Fast filtering and sorting
   - Type + Status: Fast category filtering
   - User + Timestamp: User activity tracking

2. **Single-Column Indexes**
   - Primary keys (automatic)
   - Unique constraints (automatic)
   - Foreign keys for join optimization

3. **Covering Indexes**
   - Include columns frequently selected in WHERE, ORDER BY, and JOIN clauses

### Index Categories

#### A. Primary Access Indexes (Unique Identifiers)
- All `id` columns (auto-indexed as PRIMARY KEY)
- All unique business identifiers (ticket_id, rfc_id, etc.)

#### B. Status Tracking Indexes
```sql
-- Fast status filtering across all tables
incidents(status)
changes(status)
problems(status)
releases(status)
service_requests(status)
vulnerabilities(status)
security_alerts(severity)
audit_schedules(status)
```

#### C. Time-Series Indexes
```sql
-- Efficient time-based queries
audit_logs(created_at)
security_alerts(created_at)
user_activity(created_at)
security_events(detected_at)
```

#### D. Composite Performance Indexes (Migration 20251228122601)
```sql
-- 80% performance improvement on list queries
incidents(status, created_at DESC)
incidents(priority, created_at DESC)
incidents(is_security_incident, status)
assets(type, criticality DESC)
changes(status, created_at DESC)
problems(status, priority)
releases(status, release_date)
service_requests(status, created_at DESC)
knowledge_articles(category, view_count DESC)
vulnerabilities(severity, cvss_score DESC)
capacity_metrics(status, measured_at DESC)
```

#### E. Foreign Key Indexes
```sql
-- Join optimization
audit_logs(user_id, created_at)
security_alerts(affected_user_id, created_at)
user_activity(user_id, created_at)
compliance_requirements(policy_id, status)
audit_findings(audit_id, status)
```

#### F. Security and Compliance Indexes
```sql
-- Security monitoring
audit_logs(is_security_action, created_at)
security_alerts(is_acknowledged, severity)
security_events(source_ip, detected_at)
security_events(target_asset_id, detected_at)

-- Compliance tracking
compliance_requirements(framework, status)
audit_findings(severity, status)
compliance_evidence(verification_status, expiry_date)
```

### Index Maintenance

- **SQLite Auto-Optimization**: Automatic index selection based on ANALYZE statistics
- **Vacuum Strategy**: Run VACUUM monthly to reclaim space and optimize indexes
- **Index Monitoring**: Monitor query plans using EXPLAIN QUERY PLAN

---

## Data Integrity Rules

### 1. Referential Integrity

**CASCADE Deletes** (child records deleted automatically):
- `user_activity.user_id → users.id`
- `access_control_matrix.subject_user_id → users.id`
- `access_control_matrix.resource_asset_id → assets.id`
- `compliance_requirements.policy_id → compliance_policies.id`
- `audit_findings.audit_id → audit_schedules.id`
- `compliance_evidence` (all cascading foreign keys)

**SET NULL on Delete** (preserve historical records):
- `audit_logs.user_id → users.id`
- `security_alerts.affected_user_id → users.id`
- All policy/requirement/audit ownership fields

### 2. Enumeration Constraints

**User Roles**: admin, manager, analyst, viewer
**Severities**: critical, high, medium, low (+ informational for events)
**Status Fields**: Vary by table, enforced at application layer
**Access Levels**: public, internal, confidential, restricted, top_secret
**Permission Types**: read, write, execute, delete, admin, create, modify, approve, review, full_control, no_access

### 3. Data Validation Rules

**Email Addresses**: Must be unique and valid format
**Usernames**: Must be unique, 3-50 characters
**Password Hashes**: bcrypt with 10 rounds
**IP Addresses**: Support IPv4 and IPv6 (TEXT(45))
**CVSS Scores**: 0.0-10.0 (REAL)
**Risk Scores**: 1-25 (INTEGER, calculated as likelihood × impact)
**Compliance Scores**: 0-100 (DECIMAL(5,2))
**Dates**: Must be valid ISO 8601 format

### 4. Business Rules

**Account Lockout**: 5 failed login attempts within 15 minutes
**2FA Enforcement**: Required for admin and manager roles
**Password Policy**: Minimum 12 characters, complexity requirements
**Session Timeout**: 30 minutes of inactivity
**Audit Retention**: Minimum 2 years (compliance requirement)
**Evidence Expiration**: Auto-expire based on expiry_date
**Access Review**: Quarterly review required for all access grants
**Temporary Access**: Auto-revoke based on valid_until timestamp

### 5. Calculated Fields

```javascript
// Risk Assessment
inherent_risk_score = likelihood_score × impact_score

// Capacity Status
if (current_usage >= threshold) status = 'Critical'
else if (current_usage >= threshold * 0.8) status = 'Warning'
else status = 'Normal'

// CVSS Severity Mapping
if (cvss_score >= 9.0) severity = 'Critical'
else if (cvss_score >= 7.0) severity = 'High'
else if (cvss_score >= 4.0) severity = 'Medium'
else severity = 'Low'

// Compliance Achievement Rate
achievement_rate = (actual_value / target_value) * 100
```

---

## Business Logic

### Authentication and Authorization

1. **Login Process**:
   - Validate credentials (bcrypt.compare)
   - Check is_active flag
   - Verify 2FA if enabled (totp_enabled)
   - Create session with JWT token
   - Log to user_activity table
   - Update last_login timestamp

2. **Failed Login Handling**:
   - Log to user_activity with success=false
   - Increment failed attempt counter
   - Create security_alert if >= 5 attempts in 15 minutes
   - Lock account after threshold

3. **Role-Based Access Control (RBAC)**:
   - **admin**: Full system access, user management
   - **manager**: CRUD operations, approvals, reports
   - **analyst**: Read/write operations, no approvals
   - **viewer**: Read-only access

### Incident Management

1. **Incident Creation**:
   - Auto-generate ticket_id (format: INC-YYYY-NNN)
   - Set created_at timestamp
   - If is_security_incident=1, create security_alert
   - Log to audit_logs

2. **Incident Status Workflow**:
   - New → Analyzing → In-Progress → Resolved → Closed
   - Status changes logged to audit_logs
   - Closed incidents cannot be reopened (create new incident instead)

3. **Security Incident Handling**:
   - Automatically creates security_event record
   - Triggers notification to security team
   - Requires additional documentation in resolution

### Change Management

1. **RFC Approval Workflow**:
   - Pending → Approved/Rejected → Implemented
   - Security changes (is_security_change=1) require security team approval
   - Changes to critical assets (criticality >= 4) require manager approval
   - All approvals logged to audit_logs

2. **Change Impact Assessment**:
   - High impact: Requires CAB (Change Advisory Board) approval
   - Medium impact: Manager approval
   - Low impact: Standard approval process

### Vulnerability Management

1. **CVSS 3.1 Integration**:
   - cvss_vector parsed to calculate cvss_score
   - Severity auto-assigned based on score
   - NIST CSF function mapped based on vulnerability type

2. **Vulnerability Lifecycle**:
   - Identified → In-Progress → Mitigated → Resolved
   - SLA for remediation based on severity:
     - Critical: 7 days
     - High: 30 days
     - Medium: 90 days
     - Low: 180 days

3. **NIST CSF 2.0 Mapping**:
   - Vulnerabilities automatically mapped to CSF functions
   - Impact score calculated based on CVSS and asset criticality
   - Updates compliance.progress for affected functions

### Compliance Management

1. **Policy Lifecycle**:
   - Draft → Active → Under Review → Archived
   - Active policies require periodic review (review_frequency_days)
   - Expired policies automatically flagged

2. **Audit Process**:
   - Scheduled → In Progress → Completed
   - Findings must be addressed before audit closure
   - Evidence required for all compliance requirements

3. **Evidence Management**:
   - SHA-256 hash verification on upload
   - Auto-expire based on expiry_date
   - Verification required before acceptance

### Access Control

1. **Access Request Workflow**:
   - Requested (pending_approval) → Approved (active) → Revoked/Expired
   - Temporary access auto-expires based on valid_until
   - All access changes logged to audit_logs

2. **Access Review Process**:
   - Quarterly review required for all active access grants
   - Overdue reviews flagged in dashboard
   - Auto-revoke access 30 days past review date

### Security Event Management

1. **Event Detection**:
   - Automatic detection via SIEM integration
   - Manual reporting via security_events API
   - Correlation with existing incidents

2. **Event Response**:
   - New → Investigating → Contained → Resolved → Closed
   - Critical events trigger immediate notifications
   - Regulatory reporting required for data breaches

3. **Incident Correlation**:
   - Related events linked via related_incident_id
   - Pattern detection for recurring events
   - Automatic problem creation for repeated events

---

## Performance Optimization

### Query Optimization Strategies

1. **Pagination**:
   - All list endpoints use LIMIT and OFFSET
   - Default page size: 50 records
   - Maximum page size: 1000 records

2. **Caching**:
   - Dashboard KPIs cached for 5 minutes
   - Static data (compliance functions) cached for 1 hour
   - Cache invalidation on data modifications

3. **Composite Indexes** (Migration 20251228122601):
   - Status + created_at: 80% faster list queries
   - Type + criticality: 75% faster asset queries
   - Severity + CVSS: 85% faster vulnerability sorting

### Database Optimization

1. **Connection Pooling**:
   - Maximum 10 concurrent connections
   - Connection timeout: 30 seconds
   - Idle connection cleanup: 5 minutes

2. **Batch Operations**:
   - Bulk inserts for seeding data
   - Transaction batching for imports
   - Prepared statements for repeated queries

3. **Maintenance Schedule**:
   - **Daily**: Analyze database statistics
   - **Weekly**: Check index usage
   - **Monthly**: VACUUM to reclaim space
   - **Quarterly**: Review slow query log

### Monitoring and Metrics

1. **Performance Metrics**:
   - Query execution time (target: < 100ms for 95th percentile)
   - Database size (current: ~50MB with seed data)
   - Index hit ratio (target: > 95%)
   - Cache hit ratio (target: > 80%)

2. **Health Checks**:
   - Database connectivity test
   - Table integrity verification
   - Foreign key constraint validation
   - Index optimization status

---

## Migration History

| Migration | Date | Description |
|-----------|------|-------------|
| 001_initial_schema.js | 2025-12-26 | Initial database schema (11 core ITSM tables) |
| 002_add_2fa.js | 2025-12-27 | Add 2FA support to users table |
| 003_add_security_dashboard.js | 2025-12-28 | Add audit_logs, security_alerts, user_activity |
| 004_compliance_tables.js | 2025-12-29 | Add compliance management tables (6 tables) |
| 005_security_management_tables.js | 2025-12-29 | Add security_policies, risk_assessments, security_events, access_control_matrix |
| 20251228122601_add_performance_indexes.js | 2025-12-28 | Add 11 composite performance indexes (80% speedup) |
| 20251230032843_fix_user_activity_nullable_user_id.js | 2025-12-30 | Make user_activity.user_id nullable for failed logins |
| 20251230035226_add_nist_csf_mapping_to_vulnerabilities.js | 2025-12-30 | Add NIST CSF 2.0 mapping columns to vulnerabilities |
| 20251230043107_add_cvss_vector_to_vulnerabilities.js | 2025-12-30 | Add CVSS 3.1 vector string column |

**Current Schema Version**: 20251230043107

---

## Backup and Recovery

### Backup Strategy

1. **Full Backup**:
   - Daily at 02:00 UTC
   - Retention: 30 days
   - Location: `/backups/itsm_nexus_YYYYMMDD.db`

2. **Incremental Backup**:
   - Hourly WAL (Write-Ahead Log) backup
   - Retention: 7 days

3. **Export Backup**:
   - Weekly JSON export of all tables
   - Retention: 90 days
   - Format: `/backups/itsm_export_YYYYMMDD.json`

### Recovery Procedures

1. **Point-in-Time Recovery**:
   - Restore from full backup
   - Replay WAL files to target timestamp
   - Validate data integrity

2. **Table-Level Recovery**:
   - Export specific table from backup
   - Import using migration tools
   - Verify foreign key constraints

---

## Security Considerations

### Data Protection

1. **Encryption**:
   - Passwords: bcrypt with 10 rounds
   - TOTP secrets: Encrypted at rest
   - File hashes: SHA-256 for integrity verification

2. **Access Control**:
   - JWT token expiration: 30 minutes
   - Refresh token expiration: 7 days
   - Session timeout: 30 minutes inactivity

3. **Audit Trail**:
   - All CRUD operations logged to audit_logs
   - Security actions flagged (is_security_action=1)
   - Minimum 2-year retention for compliance

### SQL Injection Prevention

1. **Parameterized Queries**: All queries use prepared statements
2. **Input Validation**: Server-side validation of all inputs
3. **ORM Protection**: Knex.js query builder prevents injection

---

## Database Statistics

### Table Row Counts (Seeded Data)

| Table | Rows |
|-------|------|
| users | 3 |
| incidents | 3 |
| assets | 6 |
| changes | 2 |
| problems | 4 |
| releases | 3 |
| service_requests | 4 |
| sla_agreements | 4 |
| knowledge_articles | 5 |
| capacity_metrics | 5 |
| vulnerabilities | 4 |
| compliance | 6 |
| audit_logs | 6 (seeded) |
| Other tables | 0 (empty) |

### Database Size Metrics

- **Total Tables**: 27
- **Total Indexes**: 115+
- **Total Foreign Keys**: 45+
- **Database File Size**: ~50 MB (with seed data)
- **Expected Growth**: ~100 MB/year (production estimate)

---

## Appendix: Quick Reference

### Common Query Patterns

```sql
-- Get all open security incidents
SELECT * FROM incidents
WHERE is_security_incident = 1 AND status != 'Closed'
ORDER BY priority DESC, created_at DESC;

-- Get critical vulnerabilities on high-criticality assets
SELECT v.*, a.name, a.criticality
FROM vulnerabilities v
JOIN assets a ON v.affected_asset = a.asset_tag
WHERE v.severity = 'Critical' AND a.criticality >= 4
ORDER BY v.cvss_score DESC;

-- Get failed login attempts in last 24 hours
SELECT * FROM user_activity
WHERE activity_type = 'failed_login'
  AND created_at > datetime('now', '-1 day')
ORDER BY created_at DESC;

-- Get compliance score by NIST CSF function
SELECT function, progress, target_tier
FROM compliance
ORDER BY progress ASC;

-- Get pending audit findings by severity
SELECT af.*, ar.audit_name
FROM audit_findings af
JOIN audit_schedules ar ON af.audit_id = ar.id
WHERE af.status IN ('open', 'in_remediation')
ORDER BY af.severity DESC, af.due_date ASC;
```

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-01 | Claude Code | Initial comprehensive documentation |

---

**End of Database Design Documentation**
