#!/usr/bin/env node
/**
 * Auto Fix Runner for GitHub Actions
 * 15回のエラー検知・修復ループを実行
 */

const autoFixService = require('../services/autoFixService');
const knex = require('../knex');

async function main() {
  const MAX_LOOPS = parseInt(process.env.MAX_LOOPS || '15');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 自動エラー検知・修復ループ開始');
  console.log(`   最大ループ回数: ${MAX_LOOPS}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // autoFixServiceにDB注入
  autoFixService.setDatabase(knex);

  let totalDetected = 0;
  let totalFixed = 0;
  let totalFailed = 0;

  // eslint-disable-next-line no-plusplus
  for (let i = 1; i <= MAX_LOOPS; i++) {
    console.log(`\n┌─────────────────────────────────────────┐`);
    console.log(`│  🔁 ループ ${i}/${MAX_LOOPS}`);
    console.log(`└─────────────────────────────────────────┘`);

    try {
      const result = await autoFixService.runAutoFix();

      totalDetected += result.errors_detected || 0;
      totalFixed += result.errors_fixed || 0;

      console.log(`✅ ループ ${i} 完了`);
      console.log(`   検出: ${result.errors_detected || 0}件`);
      console.log(`   修復: ${result.errors_fixed || 0}件`);
    } catch (err) {
      // eslint-disable-next-line no-plusplus
      totalFailed++;
      console.error(`❌ ループ ${i} エラー: ${err.message}`);
    }

    // 最後のループ以外は2秒待機
    if (i < MAX_LOOPS) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 実行サマリー');
  console.log(`   総検出: ${totalDetected}件`);
  console.log(`   総修復: ${totalFixed}件`);
  console.log(`   失敗: ${totalFailed}件`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await knex.destroy();

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
