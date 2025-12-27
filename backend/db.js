const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'itsm_nexus.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
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

        // Seed Initial Data if empty
        db.get("SELECT count(*) as count FROM compliance", (err, row) => {
            if (row.count === 0) {
                const stmt = db.prepare("INSERT INTO compliance (function, progress, target_tier) VALUES (?, ?, ?)");
                const functions = [
                    ['GOVERN', 85, 3],
                    ['IDENTIFY', 90, 4],
                    ['PROTECT', 75, 3],
                    ['DETECT', 60, 3],
                    ['RESPOND', 85, 4],
                    ['RECOVER', 95, 4]
                ];
                functions.forEach(f => stmt.run(f));
                stmt.finalize();
            }
        });

        // Seed Assets if empty
        db.get("SELECT count(*) as count FROM assets", (err, row) => {
            if (row.count === 0) {
                const stmt = db.prepare("INSERT INTO assets (asset_tag, name, type, criticality, status) VALUES (?, ?, ?, ?, ?)");
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
        db.get("SELECT count(*) as count FROM changes", (err, row) => {
            if (row.count === 0) {
                const stmt = db.prepare("INSERT INTO changes (rfc_id, title, description, asset_tag, status, requester, is_security_change, impact_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                stmt.run('RFC-2025-001', 'Apply Critical Security Patches', 'OS security updates for DB server', 'SRV-001', 'Pending', 'System Admin', 1, 'High');
                stmt.run('RFC-2025-002', 'Web App Deployment v2.1', 'Update web app code for new features', 'SRV-002', 'Approved', 'Dev Lead', 0, 'Medium');
                stmt.finalize();
            }
        });

        // Seed Incidents if empty
        db.get("SELECT count(*) as count FROM incidents", (err, row) => {
            if (row.count === 0) {
                const stmt = db.prepare("INSERT INTO incidents (ticket_id, title, status, priority, is_security_incident) VALUES (?, ?, ?, ?, ?)");
                stmt.run('INC-2025-001', 'VPN Connection Fault', 'Analyzing', 'Critical', 0);
                stmt.run('INC-2025-002', 'Cloud Storage Sync Error', 'In-Progress', 'Medium', 0);
                stmt.run('SEC-INC-001', 'Malware Detected on Endpoint', 'Identified', 'High', 1);
                stmt.finalize();
            }
        });

        // Seed Users if empty
        // Note: Default admin password is 'admin123' - MUST be changed in production
        db.get("SELECT count(*) as count FROM users", (err, row) => {
            if (row.count === 0) {
                const bcrypt = require('bcryptjs');
                const stmt = db.prepare("INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)");

                // Create default admin user (password: admin123)
                const adminHash = bcrypt.hashSync('admin123', 10);
                stmt.run('admin', 'admin@itsm.local', adminHash, 'admin', 'System Administrator');

                // Create default analyst user (password: analyst123)
                const analystHash = bcrypt.hashSync('analyst123', 10);
                stmt.run('analyst', 'analyst@itsm.local', analystHash, 'analyst', 'Security Analyst');

                stmt.finalize();
            }
        });
    });
}

module.exports = { db, initDb };
