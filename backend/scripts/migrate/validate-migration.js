#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * データ移行検証スクリプト
 *
 * 本番データ移行後のデータ整合性を検証します。
 *
 * 使用方法:
 *   node backend/scripts/migrate/validate-migration.js [options]
 *
 * オプション:
 *   --entity=<type>  特定エンティティのみ検証
 *   --verbose        詳細出力
 *   --fix            自動修正を試行
 */

require('dotenv').config();
const path = require('path');

// データベース接続
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../itsm_nexus.db');

// 検証ルール定義
const VALIDATION_RULES = {
  users: {
    required: ['username', 'email', 'password_hash', 'role'],
    unique: ['username', 'email'],
    validValues: {
      role: ['admin', 'manager', 'analyst', 'viewer'],
      is_active: [0, 1, true, false]
    }
  },
  assets: {
    required: ['asset_tag', 'name', 'type'],
    unique: ['asset_tag'],
    validValues: {
      type: ['Server', 'Endpoint', 'Network', 'Cloud', 'Mobile', 'Other'],
      status: ['Operational', 'Warning', 'Critical', 'Maintenance', 'Decommissioned']
    }
  },
  incidents: {
    required: ['ticket_id', 'title', 'status', 'priority'],
    unique: ['ticket_id'],
    validValues: {
      status: ['Identified', 'Analyzing', 'In-Progress', 'Resolved', 'Closed'],
      priority: ['Critical', 'High', 'Medium', 'Low']
    }
  },
  changes: {
    required: ['rfc_id', 'title', 'status'],
    unique: ['rfc_id'],
    validValues: {
      status: [
        'Draft',
        'Submitted',
        'Approved',
        'Scheduled',
        'Implementing',
        'Completed',
        'Rejected'
      ]
    }
  },
  problems: {
    required: ['problem_id', 'title', 'status'],
    unique: ['problem_id'],
    validValues: {
      status: ['Analyzing', 'Solution-Proposed', 'Known-Error', 'Resolved', 'Closed']
    }
  },
  vulnerabilities: {
    required: ['vulnerability_id', 'title', 'severity'],
    unique: ['vulnerability_id'],
    validValues: {
      severity: ['Critical', 'High', 'Medium', 'Low', 'Informational'],
      status: ['Detected', 'Assessing', 'Mitigating', 'Resolved']
    }
  }
};

// コマンドライン引数解析
function parseArgs() {
  const args = {
    entity: null,
    verbose: false,
    fix: false
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--entity=')) {
      args.entity = arg.split('=')[1];
    } else if (arg === '--verbose') {
      args.verbose = true;
    } else if (arg === '--fix') {
      args.fix = true;
    }
  });

  return args;
}

async function main() {
  const args = parseArgs();

  console.log('======================================');
  console.log('データ移行検証');
  console.log('======================================\n');

  console.log(`📁 データベース: ${dbPath}`);

  // データベース接続
  const db = new sqlite3.Database(dbPath);

  // Promise化
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

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: []
  };

  try {
    // 検証対象エンティティ
    const entities = args.entity ? [args.entity] : Object.keys(VALIDATION_RULES);

    for (const entity of entities) {
      const rules = VALIDATION_RULES[entity];
      if (!rules) {
        console.log(`⚠️  ${entity}: 検証ルールが定義されていません`);
        results.warnings++;
        continue;
      }

      console.log(`\n📋 ${entity} を検証中...`);

      // レコード数確認
      const countResult = await dbGet(`SELECT COUNT(*) as count FROM ${entity}`);
      const recordCount = countResult?.count || 0;
      console.log(`   レコード数: ${recordCount}`);

      if (recordCount === 0) {
        console.log('   ⚠️  データがありません（本番データ未投入？）');
        results.warnings++;
        continue;
      }

      // 必須フィールドチェック
      if (rules.required) {
        for (const field of rules.required) {
          const nullCount = await dbGet(
            `SELECT COUNT(*) as count FROM ${entity} WHERE ${field} IS NULL OR ${field} = ''`
          );
          if (nullCount?.count > 0) {
            console.log(`   ❌ ${field}: ${nullCount.count}件のNULL/空値`);
            results.errors.push({ entity, field, type: 'required', count: nullCount.count });
            results.failed++;
          } else {
            if (args.verbose) console.log(`   ✅ ${field}: 必須チェックOK`);
            results.passed++;
          }
        }
      }

      // ユニーク制約チェック
      if (rules.unique) {
        for (const field of rules.unique) {
          const dupes = await dbAll(
            `SELECT ${field}, COUNT(*) as cnt FROM ${entity} GROUP BY ${field} HAVING cnt > 1`
          );
          if (dupes.length > 0) {
            console.log(`   ❌ ${field}: ${dupes.length}件の重複`);
            if (args.verbose) {
              dupes.slice(0, 3).forEach((d) => console.log(`      - ${d[field]}: ${d.cnt}件`));
            }
            results.errors.push({ entity, field, type: 'unique', count: dupes.length });
            results.failed++;
          } else {
            if (args.verbose) console.log(`   ✅ ${field}: ユニークチェックOK`);
            results.passed++;
          }
        }
      }

      // 有効値チェック
      if (rules.validValues) {
        for (const [field, validList] of Object.entries(rules.validValues)) {
          const placeholders = validList.map(() => '?').join(', ');
          const invalidCount = await dbGet(
            `SELECT COUNT(*) as count FROM ${entity} WHERE ${field} NOT IN (${placeholders}) AND ${field} IS NOT NULL`,
            validList
          );
          if (invalidCount?.count > 0) {
            console.log(`   ⚠️  ${field}: ${invalidCount.count}件の無効な値`);
            results.warnings++;
          } else {
            if (args.verbose) console.log(`   ✅ ${field}: 有効値チェックOK`);
            results.passed++;
          }
        }
      }
    }

    // 外部キー整合性チェック
    console.log('\n📋 外部キー整合性を検証中...');

    // incidents -> assets
    const orphanIncidents = await dbGet(
      `SELECT COUNT(*) as count FROM incidents i
       LEFT JOIN assets a ON i.asset_tag = a.asset_tag
       WHERE i.asset_tag IS NOT NULL AND a.id IS NULL`
    );
    if (orphanIncidents?.count > 0) {
      console.log(`   ⚠️  incidents: ${orphanIncidents.count}件の孤立した資産参照`);
      results.warnings++;
    } else {
      console.log('   ✅ incidents -> assets: 整合性OK');
      results.passed++;
    }

    // 結果サマリー
    console.log('\n======================================');
    console.log('📊 検証結果サマリー:');
    console.log('======================================');
    console.log(`   ✅ パス: ${results.passed}`);
    console.log(`   ⚠️  警告: ${results.warnings}`);
    console.log(`   ❌ 失敗: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      results.errors.forEach((e) => {
        console.log(`   - ${e.entity}.${e.field}: ${e.type} (${e.count}件)`);
      });
    }

    if (results.failed === 0 && results.warnings === 0) {
      console.log('\n✅ すべての検証をパスしました！');
    } else if (results.failed > 0) {
      console.log('\n❌ 一部の検証に失敗しました。データを確認してください。');
      process.exit(1);
    } else {
      console.log('\n⚠️  警告がありますが、検証は完了しました。');
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
