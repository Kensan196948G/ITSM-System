#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * ダミーデータ削除スクリプト
 *
 * 本番環境移行時に、開発用のダミーデータを削除します。
 * 削除後、各テーブルのレコード数が0の場合は「データなし」と表示されます。
 *
 * 使用方法:
 *   node backend/scripts/migrate/remove-dummy-data.js [options]
 *
 * オプション:
 *   --confirm        確認なしで実行
 *   --dry-run        ドライラン（実際には削除しない）
 *   --keep-admin     adminユーザーを保持
 *   --backup         削除前にバックアップを作成
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// データベース接続
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../itsm_nexus.db');

// 削除対象テーブル（順序重要：外部キー依存関係を考慮）
const TABLES_TO_CLEAN = [
  // 監査・ログ系（最初に削除）
  'audit_logs',
  'user_activity',
  'security_alerts',

  // トランザクション系
  'incidents',
  'changes',
  'problems',
  'releases',
  'service_requests',
  'vulnerabilities',

  // マスター系
  'assets',
  'sla_agreements',
  'knowledge_articles',
  'capacity_metrics',

  // コンプライアンス系
  'compliance',
  'compliance_policies',
  'compliance_requirements',
  'audit_schedules',
  'audit_findings',
  'compliance_evidence',
  'compliance_reports',

  // セキュリティ管理系
  'security_policies',
  'risk_assessments',
  'security_events',
  'access_control_matrix'

  // ユーザー系（最後に削除、オプション）
  // 'users' -- keep-adminオプションで制御
];

// コマンドライン引数解析
function parseArgs() {
  const args = {
    confirm: false,
    dryRun: false,
    keepAdmin: true,
    backup: true
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg === '--confirm') {
      args.confirm = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--keep-admin') {
      args.keepAdmin = true;
    } else if (arg === '--no-keep-admin') {
      args.keepAdmin = false;
    } else if (arg === '--backup') {
      args.backup = true;
    } else if (arg === '--no-backup') {
      args.backup = false;
    }
  });

  return args;
}

// ユーザー確認
async function confirmAction(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// バックアップ作成
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(path.dirname(dbPath), 'backups', 'pre-migration');
  const backupPath = path.join(backupDir, `itsm_nexus_${timestamp}.db`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}

async function main() {
  const args = parseArgs();

  console.log('======================================');
  console.log('ダミーデータ削除スクリプト');
  console.log('======================================\n');

  console.log(`📁 データベース: ${dbPath}`);
  console.log(`🔧 ドライラン: ${args.dryRun ? 'はい' : 'いいえ'}`);
  console.log(`👤 adminユーザー保持: ${args.keepAdmin ? 'はい' : 'いいえ'}`);
  console.log(`📦 バックアップ: ${args.backup ? 'はい' : 'いいえ'}`);

  // データベース接続
  const db = new sqlite3.Database(dbPath);

  // Promise化
  const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });

  const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

  const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

  try {
    // 現在のデータ件数を表示
    console.log('\n📊 現在のデータ件数:');
    const counts = {};
    for (const table of TABLES_TO_CLEAN) {
      try {
        const result = await dbGet(`SELECT COUNT(*) as count FROM ${table}`);
        counts[table] = result?.count || 0;
        if (counts[table] > 0) {
          console.log(`   ${table}: ${counts[table]}件`);
        }
      } catch (e) {
        // テーブルが存在しない場合はスキップ
      }
    }

    // ユーザー数確認
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
    console.log(`   users: ${userCount?.count || 0}件`);

    // 確認
    if (!args.confirm && !args.dryRun) {
      console.log('\n⚠️  警告: この操作はすべてのダミーデータを削除します。');
      const confirmed = await confirmAction('続行しますか？');
      if (!confirmed) {
        console.log('キャンセルされました。');
        db.close();
        process.exit(0);
      }
    }

    // バックアップ
    if (args.backup && !args.dryRun) {
      console.log('\n📦 バックアップを作成中...');
      const backupPath = createBackup();
      console.log(`   バックアップ先: ${backupPath}`);
    }

    // 削除実行
    console.log('\n🗑️  データ削除中...\n');
    const results = {};

    for (const table of TABLES_TO_CLEAN) {
      try {
        if (args.dryRun) {
          results[table] = { deleted: counts[table] || 0, status: 'dry-run' };
          console.log(`   [DRY-RUN] ${table}: ${counts[table] || 0}件削除予定`);
        } else {
          const result = await dbRun(`DELETE FROM ${table}`);
          results[table] = { deleted: result.changes, status: 'success' };
          if (result.changes > 0) {
            console.log(`   ✅ ${table}: ${result.changes}件削除`);
          }
        }
      } catch (e) {
        results[table] = { deleted: 0, status: 'error', error: e.message };
        console.log(`   ⚠️  ${table}: スキップ (${e.message})`);
      }
    }

    // ユーザー削除（オプション）
    if (!args.keepAdmin) {
      if (args.dryRun) {
        console.log('   [DRY-RUN] users: 全ユーザー削除予定');
      } else {
        const result = await dbRun('DELETE FROM users');
        console.log(`   ✅ users: ${result.changes}件削除`);
      }
    } else {
      // デフォルトユーザー以外を削除するオプション
      if (args.dryRun) {
        const nonAdminCount = await dbGet(
          "SELECT COUNT(*) as count FROM users WHERE username NOT IN ('admin')"
        );
        console.log(`   [DRY-RUN] users: ${nonAdminCount?.count || 0}件削除予定（admin以外）`);
      } else {
        // analyst, viewerなどのデフォルトユーザーも削除
        const result = await dbRun("DELETE FROM users WHERE username NOT IN ('admin')");
        console.log(`   ✅ users: ${result.changes}件削除（admin以外）`);
      }
    }

    // VACUUM（データベース最適化）
    if (!args.dryRun) {
      console.log('\n🔧 データベース最適化中...');
      await dbRun('VACUUM');
      console.log('   ✅ 完了');
    }

    // 結果サマリー
    console.log('\n======================================');
    console.log('📊 削除結果サマリー:');
    console.log('======================================');

    let totalDeleted = 0;
    Object.entries(results).forEach(([table, result]) => {
      totalDeleted += result.deleted;
    });
    console.log(`   削除テーブル数: ${Object.keys(results).length}`);
    console.log(`   削除レコード総数: ${totalDeleted}`);

    if (args.dryRun) {
      console.log('\n⚠️  ドライランモード: 実際のデータは削除されていません');
      console.log('   実行するには: node remove-dummy-data.js --confirm');
    } else {
      console.log('\n✅ ダミーデータ削除完了');
      console.log('\n📝 次のステップ:');
      console.log('   1. 本番データを投入');
      console.log('      node backend/scripts/migrate/extract-users-from-m365.js');
      console.log(
        '      node backend/scripts/migrate/load-users.js --file=data/extracted/users-m365.json'
      );
      console.log('   2. サービスを再起動');
      console.log('      sudo systemctl restart itsm-system-https');
    }

    console.log('\n======================================');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
