const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const knex = require('./knex');
const logger = require('./utils/logger');

// Use DATABASE_PATH from environment variables if set, otherwise default to itsm_nexus.db
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, 'itsm_nexus.db');

const db = new sqlite3.Database(dbPath);

// busy_timeout: 他の接続がロック中でも待機（SQLITE_BUSY防止）
// テスト環境では30秒、本番では5秒
const busyTimeout = process.env.NODE_ENV === 'test' ? 30000 : 5000;
db.run(`PRAGMA busy_timeout = ${busyTimeout};`);

/**
 * Seed initial data if tables are empty
 */
async function seedInitialData() {
  // Skip seeding in production mode if disabled
  if (process.env.DISABLE_SEED_DATA === 'true') {
    return;
  }

  const checkAndSeed = (table, seedFn) =>
    new Promise((resolve, reject) => {
      db.get(`SELECT count(*) as count FROM ${table}`, (err, row) => {
        if (err) {
          // If table doesn't exist yet (shouldn't happen after migrate), just resolve
          return resolve();
        }
        if (row.count === 0) {
          seedFn().then(resolve).catch(reject);
        } else {
          resolve();
        }
      });
    });

  // Define seed functions
  const seedCompliance = () =>
    new Promise((resolve) => {
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
      stmt.finalize(resolve);
    });

  const seedAssets = () =>
    new Promise((resolve) => {
      const stmt = db.prepare(
        'INSERT INTO assets (asset_tag, name, type, criticality, status) VALUES (?, ?, ?, ?, ?)'
      );
      stmt.run('SRV-001', 'Core Database Server', 'Server', 5, 'Operational');
      stmt.run('SRV-002', 'Web Application Server', 'Server', 4, 'Operational');
      stmt.run('NET-001', 'Main Firewall', 'Network', 5, 'Operational');
      stmt.run('NET-002', 'Core L3 Switch', 'Network', 5, 'Operational');
      stmt.run('CLD-001', 'Microsoft 365 Tenant', 'Cloud', 5, 'Operational');
      stmt.run('PC-101', 'CEO Laptop', 'Endpoint', 3, 'Operational');
      stmt.finalize(resolve);
    });

  const seedChanges = () =>
    new Promise((resolve) => {
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
      stmt.finalize(resolve);
    });

  const seedIncidents = () =>
    new Promise((resolve) => {
      const stmt = db.prepare(
        'INSERT INTO incidents (ticket_id, title, status, priority, is_security_incident) VALUES (?, ?, ?, ?, ?)'
      );
      stmt.run('INC-2025-001', 'VPN Connection Fault', 'Analyzing', 'Critical', 0);
      stmt.run('INC-2025-002', 'Cloud Storage Sync Error', 'In-Progress', 'Medium', 0);
      stmt.run('SEC-INC-001', 'Malware Detected on Endpoint', 'Identified', 'High', 1);
      stmt.finalize(resolve);
    });

  const seedUsers = () =>
    new Promise((resolve) => {
      const stmt = db.prepare(
        'INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)'
      );

      // セキュア: 環境変数からパスワードを取得、未設定時はランダム生成
      const generateSecurePassword = () => crypto.randomBytes(16).toString('hex'); // 32文字のランダムパスワード
      const adminPassword = process.env.ADMIN_PASSWORD || generateSecurePassword();
      const managerPassword = process.env.MANAGER_PASSWORD || generateSecurePassword();
      const analystPassword = process.env.ANALYST_PASSWORD || generateSecurePassword();
      const viewerPassword = process.env.VIEWER_PASSWORD || generateSecurePassword();

      const adminHash = bcrypt.hashSync(adminPassword, 10);
      const managerHash = bcrypt.hashSync(managerPassword, 10);
      const analystHash = bcrypt.hashSync(analystPassword, 10);
      const viewerHash = bcrypt.hashSync(viewerPassword, 10);

      // 初回起動時のみパスワード情報を表示（環境変数未設定時）
      const isTest = process.env.NODE_ENV === 'test';
      if (!isTest && !process.env.ADMIN_PASSWORD) {
        logger.warn(
          '初回セットアップ: デフォルトユーザーが自動生成パスワードで作成されました。環境変数 ADMIN_PASSWORD 等を設定してください。'
        );
        logger.warn(
          '生成されたパスワードはログに出力されません。環境変数で明示的に設定してください: ADMIN_PASSWORD, MANAGER_PASSWORD, ANALYST_PASSWORD, VIEWER_PASSWORD'
        );
      }

      stmt.run('admin', 'admin@itsm.local', adminHash, 'admin', 'System Administrator');
      stmt.run('manager', 'manager@itsm.local', managerHash, 'manager', 'IT Manager');
      stmt.run('analyst', 'analyst@itsm.local', analystHash, 'analyst', 'Security Analyst');
      stmt.run('viewer', 'viewer@itsm.local', viewerHash, 'viewer', 'System Viewer');
      stmt.finalize(resolve);
    });

  const seedProblems = () =>
    new Promise((resolve) => {
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
      stmt.finalize(resolve);
    });

  const seedReleases = () =>
    new Promise((resolve) => {
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
      stmt.finalize(resolve);
    });

  const seedServiceRequests = () =>
    new Promise((resolve) => {
      const stmt = db.prepare(
        'INSERT INTO service_requests (request_id, request_type, title, description, requester, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      stmt.run(
        'SR-2025-001',
        'Access',
        '共有フォルダアクセス申請',
        '営業部共有フォルダへのアクセス権を追加',
        '営業部 山田',
        'Submitted',
        'Medium'
      );
      stmt.run(
        'SR-2025-002',
        'Hardware',
        'ノートPC交換依頼',
        'PC-101のバッテリー劣化対応',
        '経営企画 佐藤',
        'Approved',
        'High'
      );
      stmt.run(
        'SR-2025-003',
        'Software',
        'VPNクライアント再インストール',
        '接続不安定のため再導入',
        '開発部 鈴木',
        'In-Progress',
        'Low'
      );
      stmt.finalize(resolve);
    });

  const seedSla = () =>
    new Promise((resolve) => {
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
      stmt.finalize(resolve);
    });

  const seedKnowledge = () =>
    new Promise((resolve) => {
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
      stmt.finalize(resolve);
    });

  const seedCapacity = () =>
    new Promise((resolve) => {
      const stmt = db.prepare(
        'INSERT INTO capacity_metrics (metric_id, resource_name, resource_type, current_usage, threshold, forecast_3m, status, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      stmt.run('CAP-2025-001', 'ストレージ容量', 'Storage', 72.0, 80.0, 85.0, 'Warning', '%');
      stmt.run('CAP-2025-002', 'ネットワーク帯域', 'Bandwidth', 45.0, 70.0, 52.0, 'Normal', '%');
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
      stmt.run('CAP-2025-005', 'サーバーメモリ使用率', 'Memory', 68.0, 85.0, 75.0, 'Normal', '%');
      stmt.finalize(resolve);
    });

  const seedVulnerabilities = () =>
    new Promise((resolve) => {
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
      stmt.finalize(resolve);
    });

  // Wait for all checks and seeds
  await checkAndSeed('compliance', seedCompliance);
  await checkAndSeed('assets', seedAssets);
  await checkAndSeed('changes', seedChanges);
  await checkAndSeed('incidents', seedIncidents);
  await checkAndSeed('users', seedUsers);
  await checkAndSeed('problems', seedProblems);
  await checkAndSeed('releases', seedReleases);
  await checkAndSeed('service_requests', seedServiceRequests);
  await checkAndSeed('sla_agreements', seedSla);
  await checkAndSeed('knowledge_articles', seedKnowledge);
  await checkAndSeed('capacity_metrics', seedCapacity);
  await checkAndSeed('vulnerabilities', seedVulnerabilities);
}

/**
 * Initialize the database
 * Runs migrations and seeds initial data if necessary
 *
 * テスト環境ではglobalSetup.jsがマイグレーションを担当するため、
 * ここではシードデータの投入のみを行います。
 * これにより、knex migration lockの競合（SQLITE_BUSY）を防止します。
 */
async function initDb() {
  const isTest = process.env.NODE_ENV === 'test';

  if (!isTest) {
    logger.info(`[DB] Initializing database at: ${dbPath}`);
  }

  try {
    // 1. Run migrations using Knex to ensure schema is up to date
    // In test environment, globalSetup.js handles migrations to avoid
    // SQLITE_BUSY errors caused by concurrent lock acquisition.
    if (!isTest) {
      await knex.migrate.latest();
      logger.info('[DB] Migrations applied successfully');
    }

    // 2. In test mode, check if data was already seeded by globalSetup.js
    // using knex (which handles busy_timeout properly) instead of raw sqlite3.
    // This prevents seedInitialData()'s raw db.get() from hanging when
    // multiple test files create competing sqlite3 connections.
    if (isTest) {
      try {
        const row = await knex('users').count('* as count').first();
        if (row && parseInt(row.count, 10) > 0) {
          return; // Data already seeded by globalSetup.js
        }
      } catch (_) {
        // users table might not exist yet - continue with seeding
      }
    }

    // 3. Seed Initial Data if empty
    await seedInitialData();

    if (!isTest) logger.info('[DB] Initialization complete');
  } catch (err) {
    // If it's a "table already exists" error during migration, it might be a race condition
    // or a mismatch between manual schema and migrations.
    if (err.message && err.message.includes('already exists')) {
      logger.warn(
        '[DB] Warning: Some tables already exist. Schema might be partially initialized.'
      );
      return;
    }
    logger.error('[DB] Initialization error:', err);
    throw err;
  }
}

module.exports = { db, initDb };
