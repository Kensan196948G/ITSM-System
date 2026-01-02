#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * Microsoft Intune/Azure ADからデバイスを抽出するスクリプト
 *
 * 使用方法:
 *   node backend/scripts/migrate/extract-devices-from-intune.js [options]
 *
 * オプション:
 *   --output=<file>  出力ファイル（デフォルト: data/extracted/devices-intune.json）
 *   --max=<number>   最大取得件数（デフォルト: 0=無制限）
 *   --source=<type>  ソース: 'intune' | 'azuread' | 'both'（デフォルト: both）
 *   --dry-run        抽出のみ（ファイル出力なし）
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const microsoftGraphService = require('../../services/microsoftGraphService');

// コマンドライン引数解析
function parseArgs() {
  const args = {
    output: 'data/extracted/devices-intune.json',
    max: 0,
    source: 'both',
    dryRun: false
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--output=')) {
      args.output = arg.split('=')[1];
    } else if (arg.startsWith('--max=')) {
      args.max = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--source=')) {
      args.source = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  });

  return args;
}

async function main() {
  const args = parseArgs();

  console.log('======================================');
  console.log('Microsoft Intune/Azure AD デバイス抽出');
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
  console.log(`   ソース: ${args.source}`);

  try {
    const allDevices = [];

    // Azure AD デバイス取得
    if (args.source === 'azuread' || args.source === 'both') {
      console.log('\n💻 Azure AD デバイス一覧を取得中...');
      try {
        const azureDevices = await microsoftGraphService.getDevices({
          all: true,
          maxRecords: args.max
        });
        console.log(`   取得件数: ${azureDevices.length}`);
        allDevices.push(
          ...azureDevices.map((d) => ({
            ...d,
            _source: 'azuread'
          }))
        );
      } catch (e) {
        console.warn(`⚠️  Azure ADデバイス取得エラー: ${e.message}`);
        console.log('   → Device.Read.All 権限が必要です');
      }
    }

    // Intune マネージドデバイス取得
    if (args.source === 'intune' || args.source === 'both') {
      console.log('\n📱 Intune マネージドデバイス一覧を取得中...');
      try {
        const managedDevices = await microsoftGraphService.getManagedDevices({
          all: true,
          maxRecords: args.max
        });
        console.log(`   取得件数: ${managedDevices.length}`);
        allDevices.push(
          ...managedDevices.map((d) => ({
            ...d,
            _source: 'intune'
          }))
        );
      } catch (e) {
        console.warn(`⚠️  Intuneデバイス取得エラー: ${e.message}`);
        console.log('   → DeviceManagementManagedDevices.Read.All 権限が必要です');
      }
    }

    if (allDevices.length === 0) {
      console.error('❌ デバイスが取得できませんでした');
      process.exit(1);
    }

    console.log(`\n✅ 合計 ${allDevices.length} 件のデバイスを取得しました`);

    // ITSM形式に変換
    console.log('\n🔄 データ変換中...');
    const transformedDevices = allDevices.map((d) =>
      microsoftGraphService.transformDeviceForITSM(d));

    // 重複除去（デバイス名で）
    const uniqueDevices = [];
    const seenNames = new Set();
    for (const device of transformedDevices) {
      if (!seenNames.has(device.name)) {
        seenNames.add(device.name);
        uniqueDevices.push(device);
      }
    }
    console.log(`   重複除去後: ${uniqueDevices.length}件`);

    // 統計表示
    const stats = {
      total: uniqueDevices.length,
      byType: {},
      byStatus: {},
      byOS: {}
    };

    uniqueDevices.forEach((d) => {
      stats.byType[d.type] = (stats.byType[d.type] || 0) + 1;
      stats.byStatus[d.status] = (stats.byStatus[d.status] || 0) + 1;
      const os = d.operating_system || 'Unknown';
      stats.byOS[os] = (stats.byOS[os] || 0) + 1;
    });

    console.log('\n📊 抽出結果:');
    console.log(`   総デバイス数: ${stats.total}`);
    console.log('   タイプ別:');
    Object.entries(stats.byType).forEach(([k, v]) => console.log(`     ${k}: ${v}`));
    console.log('   ステータス別:');
    Object.entries(stats.byStatus).forEach(([k, v]) => console.log(`     ${k}: ${v}`));
    console.log('   OS別:');
    Object.entries(stats.byOS)
      .slice(0, 5)
      .forEach(([k, v]) => console.log(`     ${k}: ${v}`));

    // サンプル表示
    console.log('\n📋 サンプルデータ（最初の3件）:');
    uniqueDevices.slice(0, 3).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.name} (${d.asset_tag})`);
      console.log(`      Type: ${d.type}, OS: ${d.operating_system || 'N/A'}`);
      console.log(`      Status: ${d.status}`);
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
          source: args.source,
          extractedAt: new Date().toISOString(),
          recordCount: uniqueDevices.length,
          statistics: stats
        },
        data: uniqueDevices
      };

      fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
      console.log(`\n✅ 出力ファイル: ${outputPath}`);
    } else {
      console.log('\n⚠️  ドライランモード: ファイル出力をスキップしました');
    }

    console.log('\n======================================');
    console.log('✅ デバイス抽出完了');
    console.log('======================================');

    if (!args.dryRun) {
      console.log('\n次のステップ:');
      console.log('1. 抽出データを確認');
      console.log(`   cat ${args.output} | jq '.data | length'`);
      console.log('2. データベースに投入');
      console.log(`   node backend/scripts/migrate/load-assets.js --file=${args.output}`);
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
