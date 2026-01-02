#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * ユーザーデータをデータベースに投入するスクリプト
 *
 * 使用方法:
 *   node backend/scripts/migrate/load-users.js --file=<path> [options]
 *
 * オプション:
 *   --file=<path>    入力ファイル（必須）
 *   --mode=<mode>    投入モード: 'insert' | 'upsert' | 'replace'（デフォルト: upsert）
 *   --dry-run        ドライラン（DBに書き込まない）
 *   --skip-existing  既存ユーザーをスキップ
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// データベース接続
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../itsm_nexus.db');

// コマンドライン引数解析
function parseArgs() {
  const args = {
    file: null,
    mode: 'upsert',
    dryRun: false,
    skipExisting: false
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--file=')) {
      args.file = arg.split('=')[1];
    } else if (arg.startsWith('--mode=')) {
      args.mode = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--skip-existing') {
      args.skipExisting = true;
    }
  });

  return args;
}

// ランダムパスワード生成
function generateTempPassword() {
  return crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, 'x');
}

async function main() {
  const args = parseArgs();

  console.log('======================================');
  console.log('ユーザーデータ投入');
  console.log('======================================\n');

  // 引数チェック
  if (!args.file) {
    console.error('❌ 入力ファイルを指定してください');
    console.error('   使用方法: node load-users.js --file=<path>');
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
  const users = inputData.data || inputData;

  console.log(`\n📊 入力データ: ${users.length}件`);

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

    for (const user of users) {
      stats.processed++;

      // 必須フィールドチェック
      if (!user.username || !user.email) {
        stats.errors.push({
          user: user.username || user.email || 'unknown',
          error: '必須フィールド(username/email)がありません'
        });
        continue;
      }

      try {
        // 既存ユーザーチェック
        const existing = await dbGet(
          'SELECT id, username FROM users WHERE username = ? OR email = ?',
          [user.username, user.email]
        );

        if (existing) {
          if (args.skipExisting || args.mode === 'insert') {
            stats.skipped++;
            continue;
          }

          if (args.mode === 'upsert' && !args.dryRun) {
            // 更新
            await dbRun(
              `UPDATE users SET
                email = ?,
                full_name = ?,
                role = COALESCE(?, role),
                is_active = ?,
                updated_at = datetime('now')
              WHERE id = ?`,
              [
                user.email,
                user.full_name || null,
                user.role,
                user.is_active !== false ? 1 : 0,
                existing.id
              ]
            );
            stats.updated++;
          } else if (!args.dryRun) {
            stats.skipped++;
          }
        } else {
          // 新規挿入
          const tempPassword = generateTempPassword();
          const passwordHash = bcrypt.hashSync(tempPassword, 10);

          if (!args.dryRun) {
            await dbRun(
              `INSERT INTO users (username, email, password_hash, role, full_name, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
              [
                user.username,
                user.email,
                passwordHash,
                user.role || 'viewer',
                user.full_name || null,
                user.is_active !== false ? 1 : 0
              ]
            );
          }
          stats.inserted++;

          // 初期パスワード記録（本番では安全に通知が必要）
          if (stats.inserted <= 3) {
            console.log(`   新規: ${user.username} (初期PW: ${tempPassword})`);
          }
        }
      } catch (err) {
        stats.errors.push({
          user: user.username,
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
        console.log(`   - ${e.user}: ${e.error}`);
      });
      if (stats.errors.length > 5) {
        console.log(`   ... 他 ${stats.errors.length - 5}件`);
      }
    }

    if (args.dryRun) {
      console.log('\n⚠️  ドライランモード: データベースは変更されていません');
    } else {
      console.log('\n✅ データ投入完了');
      console.log('\n⚠️  重要: 新規ユーザーには初期パスワードが設定されています');
      console.log('   本番環境では以下を実行してください:');
      console.log('   node backend/scripts/send-password-reset-emails.js');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
