const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use DATABASE_PATH from environment variables if set, otherwise default to itsm_nexus.db
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, 'itsm_nexus.db');

const db = new sqlite3.Database(dbPath);

function initDb() {
  return new Promise((resolve) => {
    db.serialize(() => {
      // Incidents Table
      db.run(`CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT UNIQUE,
      title TEXT,
      description TEXT,
      status TEXT,
      priority TEXT,
      is_security_incident BOOLEAN,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Assets Table
      db.run(`CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_tag TEXT UNIQUE,
      name TEXT,
      type TEXT,
      criticality INTEGER,
      status TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      db.run(`CREATE TABLE IF NOT EXISTS changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc_id TEXT UNIQUE,
      title TEXT,
      description TEXT,
      asset_tag TEXT,
      status TEXT, -- Pending, Approved, Rejected, Implemented
      requester TEXT,
      approver TEXT,
      is_security_change INTEGER DEFAULT 0,
      impact_level TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Problems Table
      db.run(`CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id TEXT UNIQUE,
      title TEXT,
      description TEXT,
      status TEXT, -- Identified, Analyzing, Resolved, Closed
      priority TEXT,
      root_cause TEXT,
      related_incidents TEXT,
      assignee TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    )`);

      // Releases Table
      db.run(`CREATE TABLE IF NOT EXISTS releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      release_id TEXT UNIQUE,
      name TEXT,
      description TEXT,
      version TEXT,
      status TEXT, -- Planning, Development, Testing, Deployed, Cancelled
      release_date DATE,
      change_count INTEGER DEFAULT 0,
      target_environment TEXT,
      progress INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Service Requests Table
      db.run(`CREATE TABLE IF NOT EXISTS service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT UNIQUE,
      request_type TEXT,
      title TEXT,
      description TEXT,
      requester TEXT,
      status TEXT, -- Submitted, Approved, In-Progress, Completed, Rejected
      priority TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )`);

      // SLA Agreements Table
      db.run(`CREATE TABLE IF NOT EXISTS sla_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sla_id TEXT UNIQUE,
      service_name TEXT,
      metric_name TEXT,
      target_value TEXT,
      actual_value TEXT,
      achievement_rate REAL,
      measurement_period TEXT,
      status TEXT, -- Met, At-Risk, Violated
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Knowledge Articles Table
      db.run(`CREATE TABLE IF NOT EXISTS knowledge_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT UNIQUE,
      title TEXT,
      content TEXT,
      category TEXT,
      view_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      author TEXT,
      status TEXT, -- Draft, Published, Archived
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Capacity Metrics Table
      db.run(`CREATE TABLE IF NOT EXISTS capacity_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_id TEXT UNIQUE,
      resource_name TEXT,
      resource_type TEXT, -- Storage, CPU, Memory, Bandwidth, License
      current_usage REAL,
      threshold REAL,
      forecast_3m REAL,
      status TEXT, -- Normal, Warning, Critical
      unit TEXT,
      measured_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Vulnerabilities Table
      db.run(`CREATE TABLE IF NOT EXISTS vulnerabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vulnerability_id TEXT UNIQUE,
      title TEXT,
      description TEXT,
      severity TEXT, -- Critical, High, Medium, Low
      cvss_score REAL,
      affected_asset TEXT,
      status TEXT, -- Identified, In-Progress, Mitigated, Resolved
      detection_date DATE,
      resolution_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Compliance Table
      db.run(`CREATE TABLE IF NOT EXISTS compliance (
      function TEXT PRIMARY KEY,
      progress INTEGER,
      target_tier INTEGER
    )`);

      // Users Table
      db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'analyst', 'viewer')),
      full_name TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`);

      // Security Alerts Table
      db.run(`CREATE TABLE IF NOT EXISTS security_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_id TEXT UNIQUE NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
      alert_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT,
      is_acknowledged INTEGER DEFAULT 0,
      acknowledged_by TEXT,
      acknowledged_at DATETIME,
      remediation_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

      // Audit Logs Table
      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      is_security_action INTEGER DEFAULT 0,
      status TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

      // User Activities Table
      db.run(`CREATE TABLE IF NOT EXISTS user_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      description TEXT,
      ip_address TEXT,
      user_agent TEXT,
      is_anomaly INTEGER DEFAULT 0,
      session_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

      // Seed Initial Data if empty
      db.get('SELECT count(*) as count FROM compliance', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO compliance (function, progress, target_tier) VALUES (?, ?, ?)'
          );
          const functions = [
            ['GOVERN', 85, 3],
            ['IDENTIFY', 90, 4],
            ['PROTECT', 75, 3],
            ['DETECT', 60, 3],
            ['RESPOND', 85, 4],
            ['RECOVER', 95, 4]
          ];
          functions.forEach((f) => stmt.run(f));
          stmt.finalize();
        }
      });

      // Seed Assets if empty
      db.get('SELECT count(*) as count FROM assets', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO assets (asset_tag, name, type, criticality, status) VALUES (?, ?, ?, ?, ?)'
          );
          stmt.run('SRV-001', 'Core Database Server', 'Server', 5, 'Operational');
          stmt.run('SRV-002', 'Web Application Server', 'Server', 4, 'Operational');
          stmt.run('NET-001', 'Main Firewall', 'Network', 5, 'Operational');
          stmt.run('NET-002', 'Core L3 Switch', 'Network', 5, 'Operational');
          stmt.run('CLD-001', 'Microsoft 365 Tenant', 'Cloud', 5, 'Operational');
          stmt.run('PC-101', 'CEO Laptop', 'Endpoint', 3, 'Operational');
          stmt.finalize();
        }
      });

      // Seed Changes if empty
      db.get('SELECT count(*) as count FROM changes', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO changes (rfc_id, title, description, asset_tag, status, requester, is_security_change, impact_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'RFC-2025-001',
            'Apply Critical Security Patches',
            'OS security updates for DB server',
            'SRV-001',
            'Pending',
            'System Admin',
            1,
            'High'
          );
          stmt.run(
            'RFC-2025-002',
            'Web App Deployment v2.1',
            'Update web app code for new features',
            'SRV-002',
            'Approved',
            'Dev Lead',
            0,
            'Medium'
          );
          stmt.finalize();
        }
      });

      // Seed Incidents if empty
      db.get('SELECT count(*) as count FROM incidents', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO incidents (ticket_id, title, status, priority, is_security_incident) VALUES (?, ?, ?, ?, ?)'
          );
          stmt.run('INC-2025-001', 'VPN Connection Fault', 'Analyzing', 'Critical', 0);
          stmt.run('INC-2025-002', 'Cloud Storage Sync Error', 'In-Progress', 'Medium', 0);
          stmt.run('SEC-INC-001', 'Malware Detected on Endpoint', 'Identified', 'High', 1);
          stmt.finalize();
        }
      });

      // Seed Users if empty
      // Note: Default admin password is 'admin123' - MUST be changed in production
      db.get('SELECT count(*) as count FROM users', (err, row) => {
        if (row.count === 0) {
          const bcrypt = require('bcryptjs');
          const stmt = db.prepare(
            'INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)'
          );

          // Create default admin user (password: admin123)
          const adminHash = bcrypt.hashSync('admin123', 10);
          stmt.run('admin', 'admin@itsm.local', adminHash, 'admin', 'System Administrator');

          // Create default analyst user (password: analyst123)
          const analystHash = bcrypt.hashSync('analyst123', 10);
          stmt.run('analyst', 'analyst@itsm.local', analystHash, 'analyst', 'Security Analyst');

          stmt.finalize();
        }
      });

      // Seed Problems if empty
      db.get('SELECT count(*) as count FROM problems', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO problems (problem_id, title, description, status, priority, related_incidents, assignee) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'PRB-2025-001',
            'OneDrive同期不具合の再発',
            'OneDrive同期がランダムに停止する問題。複数のクライアントで発生',
            'Analyzing',
            'High',
            '12件',
            'クライアントチーム'
          );
          stmt.run(
            'PRB-2025-002',
            'VPN接続タイムアウト頻発',
            'リモートワーク時にVPN接続がタイムアウトする',
            'Analyzing',
            'Medium',
            '8件',
            'ネットワークチーム'
          );
          stmt.run(
            'PRB-2025-003',
            'メール遅延（特定ドメイン）',
            '特定ドメインからのメール受信が遅延する',
            'Resolved',
            'Medium',
            '5件',
            'メールチーム'
          );
          stmt.run(
            'PRB-2025-004',
            'プリンターオフライン問題',
            '3Fプリンターが定期的にオフラインになる',
            'Identified',
            'Low',
            '3件',
            'オフィスITチーム'
          );
          stmt.finalize();
        }
      });

      // Seed Releases if empty
      db.get('SELECT count(*) as count FROM releases', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO releases (release_id, name, description, version, status, release_date, change_count, target_environment, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'REL-2025-001',
            'OneDrive設定標準化',
            'OneDrive同期設定の全社統一化パッケージ',
            'v1.0',
            'In-Progress',
            '2025-12-28',
            5,
            '全社',
            45
          );
          stmt.run(
            'REL-2025-002',
            'セキュリティ強化パッケージ Q4',
            'Q4セキュリティアップデート統合パッケージ',
            'v2.0',
            'Planning',
            '2026-01-10',
            8,
            '全社',
            15
          );
          stmt.run(
            'REL-2025-003',
            'Windows 11 展開フェーズ2',
            'Windows 11への段階的移行（営業部）',
            'v11.0',
            'Testing',
            '2025-12-30',
            3,
            '営業部',
            70
          );
          stmt.finalize();
        }
      });

      // Seed Service Requests if empty
      db.get('SELECT count(*) as count FROM service_requests', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO service_requests (request_id, request_type, title, description, requester, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'REQ-2025-001',
            'アカウント作成',
            '新入社員PCセットアップ',
            '新入社員用のADアカウントとPC初期設定',
            '人事部',
            'In-Progress',
            'Medium'
          );
          stmt.run(
            'REQ-2025-002',
            'アクセス権限',
            '共有フォルダ権限追加',
            '営業共有フォルダへの読み取り権限付与',
            '営業部',
            'Approved',
            'Low'
          );
          stmt.run(
            'REQ-2025-003',
            'パスワードリセット',
            'メールパスワード失念',
            'メールアカウントのパスワードリセット依頼',
            '総務部',
            'Completed',
            'High'
          );
          stmt.run(
            'REQ-2025-004',
            'ソフトウェアインストール',
            'Adobe Acrobat Pro追加',
            '契約書作成用にAdobe Acrobat Pro必要',
            '法務部',
            'Submitted',
            'Medium'
          );
          stmt.finalize();
        }
      });

      // Seed SLA Agreements if empty
      db.get('SELECT count(*) as count FROM sla_agreements', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO sla_agreements (sla_id, service_name, metric_name, target_value, actual_value, achievement_rate, measurement_period, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'SLA-2025-001',
            'インシデント対応',
            '平均解決時間',
            '30分以内',
            '28分',
            93.3,
            '2025年12月',
            'Met'
          );
          stmt.run(
            'SLA-2025-002',
            'システム稼働率',
            '月次稼働率',
            '99.9%',
            '99.95%',
            100.0,
            '2025年12月',
            'Met'
          );
          stmt.run(
            'SLA-2025-003',
            'サービス要求',
            '処理完了時間',
            '4時間以内',
            '3.5時間',
            87.5,
            '2025年12月',
            'Met'
          );
          stmt.run(
            'SLA-2025-004',
            'メール配信',
            '配信遅延率',
            '0.1%以下',
            '0.08%',
            125.0,
            '2025年12月',
            'Met'
          );
          stmt.finalize();
        }
      });

      // Seed Knowledge Articles if empty
      db.get('SELECT count(*) as count FROM knowledge_articles', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO knowledge_articles (article_id, title, content, category, view_count, rating, author, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'KB-2025-001',
            'OneDrive同期トラブルシューティング',
            'OneDrive同期問題の一般的な解決方法：1. 同期クライアントの再起動 2. キャッシュクリア 3. 再認証',
            'クライアント',
            245,
            4.5,
            'IT Support Team',
            'Published'
          );
          stmt.run(
            'KB-2025-002',
            'VPN接続手順（リモートワーク）',
            'リモートワークのためのVPN接続手順：1. VPNクライアント起動 2. 認証情報入力 3. 接続確認',
            'ネットワーク',
            189,
            4.0,
            'Network Team',
            'Published'
          );
          stmt.run(
            'KB-2025-003',
            'パスワードポリシー',
            '会社パスワードポリシー：最小12文字、大小英数字記号を含む、90日ごとに変更',
            'セキュリティ',
            156,
            4.8,
            'Security Team',
            'Published'
          );
          stmt.run(
            'KB-2025-004',
            'プリンタートラブル対応',
            'プリンター一般的なトラブルと解決方法：紙詰まり、ドライバー問題、ネットワーク接続',
            'オフィスIT',
            98,
            3.9,
            'Office IT Team',
            'Published'
          );
          stmt.run(
            'KB-2025-005',
            'Microsoft Teams使用ガイド',
            'Teams基本機能：チャット、ビデオ会議、ファイル共有、チャネル管理',
            'コラボレーション',
            312,
            4.7,
            'IT Support Team',
            'Published'
          );
          stmt.finalize();
        }
      });

      // Seed Capacity Metrics if empty
      db.get('SELECT count(*) as count FROM capacity_metrics', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO capacity_metrics (metric_id, resource_name, resource_type, current_usage, threshold, forecast_3m, status, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run('CAP-2025-001', 'ストレージ容量', 'Storage', 72.0, 80.0, 85.0, 'Warning', '%');
          stmt.run(
            'CAP-2025-002',
            'ネットワーク帯域',
            'Bandwidth',
            45.0,
            70.0,
            52.0,
            'Normal',
            '%'
          );
          stmt.run(
            'CAP-2025-003',
            'Microsoft 365ライセンス',
            'License',
            95.0,
            90.0,
            98.0,
            'Critical',
            '%'
          );
          stmt.run('CAP-2025-004', 'サーバーCPU使用率', 'CPU', 58.0, 80.0, 65.0, 'Normal', '%');
          stmt.run(
            'CAP-2025-005',
            'サーバーメモリ使用率',
            'Memory',
            68.0,
            85.0,
            75.0,
            'Normal',
            '%'
          );
          stmt.finalize();
        }
      });

      // Seed Vulnerabilities if empty
      db.get('SELECT count(*) as count FROM vulnerabilities', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO vulnerabilities (vulnerability_id, title, description, severity, cvss_score, affected_asset, status, detection_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'CVE-2025-0001',
            'Apache Log4j RCE脆弱性',
            'Apache Log4jライブラリにリモートコード実行の脆弱性',
            'Critical',
            10.0,
            'SRV-002',
            'Mitigated',
            '2025-12-20'
          );
          stmt.run(
            'CVE-2025-0002',
            'Windows特権昇格脆弱性',
            'Windows OSにローカル特権昇格の脆弱性',
            'High',
            7.8,
            'PC-101',
            'In-Progress',
            '2025-12-22'
          );
          stmt.run(
            'VULN-2025-001',
            'SSL証明書期限切れ',
            'Webサーバーの証明書が30日以内に期限切れ',
            'Medium',
            5.3,
            'SRV-002',
            'Identified',
            '2025-12-25'
          );
          stmt.run(
            'VULN-2025-002',
            '古いファームウェア（FW）',
            'ファイアウォールのファームウェアが古く既知の脆弱性あり',
            'High',
            8.1,
            'NET-001',
            'In-Progress',
            '2025-12-23'
          );
          stmt.finalize();
        }
      });

      // Seed Security Alerts if empty
      db.get('SELECT count(*) as count FROM security_alerts', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO security_alerts (alert_id, severity, alert_type, title, description, source, is_acknowledged) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(
            'ALT-2025-001',
            'Critical',
            'Malware Detection',
            'Malware detected on endpoint PC-101',
            'Trojan.Generic detected by antivirus on CEO laptop',
            'Endpoint Protection',
            0
          );
          stmt.run(
            'ALT-2025-002',
            'High',
            'Failed Login',
            'Multiple failed login attempts detected',
            'User account admin has 10 failed login attempts in 5 minutes',
            'Authentication System',
            0
          );
          stmt.run(
            'ALT-2025-003',
            'Medium',
            'Policy Violation',
            'USB device policy violation',
            'Unauthorized USB device connected to workstation',
            'Endpoint Protection',
            1
          );
          stmt.run(
            'ALT-2025-004',
            'High',
            'Network Anomaly',
            'Unusual outbound traffic detected',
            'Server SRV-002 communicating with suspicious IP addresses',
            'Firewall',
            0
          );
          stmt.run(
            'ALT-2025-005',
            'Low',
            'Configuration Change',
            'Firewall rule modified',
            'Firewall rule NET-001 modified without approval',
            'Configuration Management',
            1
          );
          stmt.finalize();
        }
      });

      // Seed Audit Logs if empty
      db.get('SELECT count(*) as count FROM audit_logs', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, ip_address, is_security_action, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          );
          stmt.run(1, 'admin', 'LOGIN', 'user', '1', '192.168.1.100', 0, 'success');
          stmt.run(1, 'admin', 'CREATE', 'incident', 'INC-2025-001', '192.168.1.100', 0, 'success');
          stmt.run(1, 'admin', 'UPDATE', 'user_role', '2', '192.168.1.100', 1, 'success');
          stmt.run(2, 'analyst', 'LOGIN_FAILED', 'user', '2', '192.168.1.105', 1, 'failed');
          stmt.run(
            1,
            'admin',
            'DELETE',
            'vulnerability',
            'CVE-2025-0001',
            '192.168.1.100',
            1,
            'success'
          );
          stmt.run(
            2,
            'analyst',
            'VIEW',
            'security_alert',
            'ALT-2025-001',
            '192.168.1.105',
            0,
            'success'
          );
          stmt.finalize();
        }
      });

      // Seed User Activities if empty
      db.get('SELECT count(*) as count FROM user_activities', (err, row) => {
        if (row.count === 0) {
          const stmt = db.prepare(
            'INSERT INTO user_activities (user_id, username, activity_type, description, ip_address, is_anomaly) VALUES (?, ?, ?, ?, ?, ?)'
          );
          stmt.run(1, 'admin', 'LOGIN', 'Successful login from office network', '192.168.1.100', 0);
          stmt.run(1, 'admin', 'VIEW_DASHBOARD', 'Accessed security dashboard', '192.168.1.100', 0);
          stmt.run(
            2,
            'analyst',
            'LOGIN_FAILED',
            'Failed login attempt - wrong password',
            '192.168.1.105',
            1
          );
          stmt.run(
            1,
            'admin',
            'PRIVILEGE_CHANGE',
            'Changed user role from viewer to analyst',
            '192.168.1.100',
            0
          );
          stmt.run(
            2,
            'analyst',
            'LOGIN',
            'Successful login after password reset',
            '192.168.1.105',
            0
          );
          stmt.run(1, 'admin', 'LOGIN', 'Login from unusual location', '203.0.113.45', 1);
          stmt.finalize(() => {
            console.log('[DB] Initialization complete (with seed data)');
            resolve();
          });
        } else {
          console.log('[DB] Initialization complete (existing data)');
          resolve();
        }
      });
    });
  });
}

module.exports = { db, initDb };
