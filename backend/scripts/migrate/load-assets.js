#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * 資産データをデータベースに投入するスクリプト
 *
 * 使用方法:
 *   node backend/scripts/migrate/load-assets.js --file=<path> [options]
 *
 * オプション:
 *   --file=<path>    入力ファイル（必須）
 *   --mode=<mode>    投入モード: 'insert' | 'upsert' | 'replace'（デフォルト: upsert）
 *   --dry-run        ドライラン（DBに書き込まない）
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// データベース接続
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../itsm_nexus.db');

// コマンドライン引数解析
function parseArgs() {
  const args = {
    file: null,
    mode: 'upsert',
    dryRun: false
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--file=')) {
      args.file = arg.split('=')[1];
    } else if (arg.startsWith('--mode=')) {
      args.mode = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  });

  return args;
}

async function main() {
  const args = parseArgs();

  console.log('======================================');
  console.log('資産データ投入');
  console.log('======================================\n');

  // 引数チェック
  if (!args.file) {
    console.error('❌ 入力ファイルを指定してください');
    console.error('   使用方法: node load-assets.js --file=<path>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  console.log(`📁 入力ファイル: ${filePath}`);
  console.log(`📝 投入モード: ${args.mode}`);
  console.log(`🔧 ドライラン: ${args.dryRun ? 'はい' : 'いいえ'}`);

  // ファイル読み込み
  const inputData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const assets = inputData.data || inputData;

  console.log(`\n📊 入力データ: ${assets.length}件`);

  // データベース接続
  const db = new sqlite3.Database(dbPath);

  // Promise化
  const dbRun = (sql, params) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });

  const dbGet = (sql, params) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

  const stats = {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: []
  };

  try {
    console.log('\n🔄 データ投入中...\n');

    for (const asset of assets) {
      stats.processed++;

      // 必須フィールドチェック
      if (!asset.asset_tag || !asset.name) {
        stats.errors.push({
          asset: asset.asset_tag || asset.name || 'unknown',
          error: '必須フィールド(asset_tag/name)がありません'
        });
        continue;
      }

      try {
        // 既存資産チェック
        const existing = await dbGet('SELECT id, asset_tag FROM assets WHERE asset_tag = ?', [
          asset.asset_tag
        ]);

        if (existing) {
          if (args.mode === 'insert') {
            stats.skipped++;
            continue;
          }

          if (args.mode === 'upsert' && !args.dryRun) {
            // 更新
            await dbRun(
              `UPDATE assets SET
                name = ?,
                type = ?,
                criticality = ?,
                status = ?,
                last_updated = datetime('now')
              WHERE id = ?`,
              [
                asset.name,
                asset.type || 'Endpoint',
                asset.criticality || 3,
                asset.status || 'Operational',
                existing.id
              ]
            );
            stats.updated++;
          } else if (!args.dryRun) {
            stats.skipped++;
          }
        } else {
          // 新規挿入
          if (!args.dryRun) {
            await dbRun(
              `INSERT INTO assets (asset_tag, name, type, criticality, status, last_updated)
               VALUES (?, ?, ?, ?, ?, datetime('now'))`,
              [
                asset.asset_tag,
                asset.name,
                asset.type || 'Endpoint',
                asset.criticality || 3,
                asset.status || 'Operational'
              ]
            );
          }
          stats.inserted++;

          if (stats.inserted <= 3) {
            console.log(`   新規: ${asset.asset_tag} - ${asset.name}`);
          }
        }
      } catch (err) {
        stats.errors.push({
          asset: asset.asset_tag,
          error: err.message
        });
      }
    }

    console.log('\n======================================');
    console.log('📊 投入結果:');
    console.log('======================================');
    console.log(`   処理件数: ${stats.processed}`);
    console.log(`   新規挿入: ${stats.inserted}`);
    console.log(`   更新: ${stats.updated}`);
    console.log(`   スキップ: ${stats.skipped}`);
    console.log(`   エラー: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  エラー詳細:');
      stats.errors.slice(0, 5).forEach((e) => {
        console.log(`   - ${e.asset}: ${e.error}`);
      });
    }

    if (args.dryRun) {
      console.log('\n⚠️  ドライランモード: データベースは変更されていません');
    } else {
      console.log('\n✅ データ投入完了');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
