#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * Microsoft 365からユーザーを抽出するスクリプト
 *
 * 使用方法:
 *   node backend/scripts/migrate/extract-users-from-m365.js [options]
 *
 * オプション:
 *   --output=<file>  出力ファイル（デフォルト: data/extracted/users-m365.json）
 *   --max=<number>   最大取得件数（デフォルト: 0=無制限）
 *   --active-only    有効なユーザーのみ抽出
 *   --dry-run        抽出のみ（ファイル出力なし）
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const microsoftGraphService = require('../../services/microsoftGraphService');

// コマンドライン引数解析
function parseArgs() {
  const args = {
    output: 'data/extracted/users-m365.json',
    max: 0,
    activeOnly: false,
    dryRun: false
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--output=')) {
      args.output = arg.split('=')[1];
    } else if (arg.startsWith('--max=')) {
      args.max = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--active-only') {
      args.activeOnly = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  });

  return args;
}

async function main() {
  const args = parseArgs();

  console.log('======================================');
  console.log('Microsoft 365 ユーザー抽出');
  console.log('======================================\n');

  // 設定チェック
  if (!microsoftGraphService.isConfigured()) {
    console.error('❌ Microsoft 365の認証設定が不完全です');
    console.error('   .envファイルに以下を設定してください:');
    console.error('   - M365_TENANT_ID');
    console.error('   - M365_CLIENT_ID');
    console.error('   - M365_CLIENT_SECRET');
    process.exit(1);
  }

  console.log('📡 Microsoft 365に接続中...');

  try {
    // ユーザー取得オプション
    const options = {
      all: true,
      maxRecords: args.max,
      select:
        'id,displayName,userPrincipalName,mail,accountEnabled,department,jobTitle,createdDateTime,lastSignInDateTime'
    };

    if (args.activeOnly) {
      options.filter = 'accountEnabled eq true';
    }

    console.log('👥 ユーザー一覧を取得中...');
    const users = await microsoftGraphService.getUsers(options);

    console.log(`✅ ${users.length}件のユーザーを取得しました`);

    // ITSM形式に変換
    console.log('\n🔄 データ変換中...');
    const transformedUsers = users.map((u) => microsoftGraphService.transformUserForITSM(u));

    // 統計表示
    const stats = {
      total: transformedUsers.length,
      active: transformedUsers.filter((u) => u.is_active).length,
      inactive: transformedUsers.filter((u) => !u.is_active).length,
      withEmail: transformedUsers.filter((u) => u.email).length,
      withDepartment: transformedUsers.filter((u) => u.department).length
    };

    console.log('\n📊 抽出結果:');
    console.log(`   総ユーザー数: ${stats.total}`);
    console.log(`   有効ユーザー: ${stats.active}`);
    console.log(`   無効ユーザー: ${stats.inactive}`);
    console.log(`   メールあり: ${stats.withEmail}`);
    console.log(`   部署情報あり: ${stats.withDepartment}`);

    // サンプル表示
    console.log('\n📋 サンプルデータ（最初の3件）:');
    transformedUsers.slice(0, 3).forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.full_name} (${u.username})`);
      console.log(`      Email: ${u.email}`);
      console.log(`      Active: ${u.is_active}`);
    });

    // ファイル出力
    if (!args.dryRun) {
      const outputPath = path.resolve(process.cwd(), args.output);
      const outputDir = path.dirname(outputPath);

      // ディレクトリ作成
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // JSON出力
      const output = {
        metadata: {
          source: 'microsoft365',
          extractedAt: new Date().toISOString(),
          recordCount: transformedUsers.length,
          options: {
            activeOnly: args.activeOnly,
            maxRecords: args.max
          }
        },
        data: transformedUsers
      };

      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`\n✅ 出力ファイル: ${outputPath}`);
    } else {
      console.log('\n⚠️  ドライランモード: ファイル出力をスキップしました');
    }

    console.log('\n======================================');
    console.log('✅ ユーザー抽出完了');
    console.log('======================================');

    if (!args.dryRun) {
      console.log('\n次のステップ:');
      console.log('1. 抽出データを確認');
      console.log(`   cat ${args.output} | jq '.data | length'`);
      console.log('2. データベースに投入');
      console.log(`   node backend/scripts/migrate/load-users.js --file=${args.output}`);
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
