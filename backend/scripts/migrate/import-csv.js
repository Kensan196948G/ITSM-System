#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * CSVファイルからデータをインポートするスクリプト
 *
 * 使用方法:
 *   node backend/scripts/migrate/import-csv.js --entity=<type> --file=<path> [options]
 *
 * エンティティタイプ:
 *   users, assets, incidents, changes, problems, vulnerabilities,
 *   service_requests, knowledge_articles, sla_agreements
 *
 * オプション:
 *   --entity=<type>  エンティティタイプ（必須）
 *   --file=<path>    入力ファイル（必須）
 *   --output=<path>  JSON出力先（デフォルト: data/transformed/<entity>.json）
 *   --encoding=<enc> 文字コード: utf8 | sjis（デフォルト: utf8）
 *   --delimiter=<d>  区切り文字（デフォルト: ,）
 *   --dry-run        変換のみ（ファイル出力なし）
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// エンティティ定義
const ENTITY_MAPPINGS = {
  users: {
    required: ['username', 'email'],
    defaults: { role: 'viewer', is_active: true },
    transform: (row) => ({
      username: (row.username || row.ユーザー名 || '').toLowerCase().trim(),
      email: row.email || row.メールアドレス || row.メール || '',
      full_name: row.full_name || row.氏名 || row.名前 || null,
      role: row.role || row.ロール || row.権限 || 'viewer',
      is_active: row.is_active !== 'false' && row.is_active !== '0'
    })
  },
  assets: {
    required: ['name'],
    defaults: { type: 'Endpoint', criticality: 3, status: 'Operational' },
    transform: (row) => ({
      asset_tag: row.asset_tag || row.資産タグ || row.管理番号 || `AST-${Date.now()}`,
      name: row.name || row.名前 || row.資産名 || '',
      type: row.type || row.タイプ || row.種別 || 'Endpoint',
      criticality: parseInt(row.criticality || row.重要度 || 3, 10),
      status: row.status || row.ステータス || row.状態 || 'Operational'
    })
  },
  incidents: {
    required: ['title'],
    defaults: { status: 'Identified', priority: 'Medium' },
    transform: (row) => ({
      ticket_id: row.ticket_id || row.チケットID || `INC-${Date.now()}`,
      title: row.title || row.タイトル || row.件名 || '',
      description: row.description || row.説明 || row.内容 || null,
      status: row.status || row.ステータス || 'Identified',
      priority: row.priority || row.優先度 || 'Medium',
      is_security_incident: row.is_security_incident === 'true' || row.is_security_incident === '1'
    })
  },
  changes: {
    required: ['title'],
    defaults: { status: 'Draft', impact_level: 'Medium' },
    transform: (row) => ({
      rfc_id: row.rfc_id || row.RFC_ID || `RFC-${Date.now()}`,
      title: row.title || row.タイトル || '',
      description: row.description || row.説明 || null,
      status: row.status || row.ステータス || 'Draft',
      requester: row.requester || row.申請者 || null,
      impact_level: row.impact_level || row.影響度 || 'Medium',
      is_security_change: row.is_security_change === 'true' || row.is_security_change === '1'
    })
  },
  problems: {
    required: ['title'],
    defaults: { status: 'Analyzing', priority: 'Medium' },
    transform: (row) => ({
      problem_id: row.problem_id || row.問題ID || `PRB-${Date.now()}`,
      title: row.title || row.タイトル || '',
      description: row.description || row.説明 || null,
      status: row.status || row.ステータス || 'Analyzing',
      priority: row.priority || row.優先度 || 'Medium',
      root_cause: row.root_cause || row.根本原因 || null
    })
  },
  vulnerabilities: {
    required: ['title'],
    defaults: { severity: 'Medium', status: 'Detected' },
    transform: (row) => ({
      vulnerability_id: row.vulnerability_id || row.脆弱性ID || row.CVE || `VULN-${Date.now()}`,
      title: row.title || row.タイトル || '',
      description: row.description || row.説明 || null,
      severity: row.severity || row.深刻度 || 'Medium',
      cvss_score: parseFloat(row.cvss_score || row.CVSSスコア || 0),
      status: row.status || row.ステータス || 'Detected',
      affected_asset: row.affected_asset || row.影響資産 || null
    })
  },
  service_requests: {
    required: ['title'],
    defaults: { status: 'Pending', priority: 'Medium' },
    transform: (row) => ({
      request_id: row.request_id || row.リクエストID || `REQ-${Date.now()}`,
      request_type: row.request_type || row.リクエストタイプ || 'Other',
      title: row.title || row.タイトル || '',
      description: row.description || row.説明 || null,
      requester: row.requester || row.申請者 || null,
      status: row.status || row.ステータス || 'Pending',
      priority: row.priority || row.優先度 || 'Medium'
    })
  },
  knowledge_articles: {
    required: ['title', 'content'],
    defaults: { status: 'Draft', category: 'General' },
    transform: (row) => ({
      article_id: row.article_id || row.記事ID || `KB-${Date.now()}`,
      title: row.title || row.タイトル || '',
      content: row.content || row.内容 || '',
      category: row.category || row.カテゴリ || 'General',
      author: row.author || row.作成者 || null,
      status: row.status || row.ステータス || 'Draft'
    })
  }
};

// コマンドライン引数解析
function parseArgs() {
  const args = {
    entity: null,
    file: null,
    output: null,
    encoding: 'utf8',
    delimiter: ',',
    dryRun: false
  };

  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--entity=')) {
      args.entity = arg.split('=')[1];
    } else if (arg.startsWith('--file=')) {
      args.file = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      args.output = arg.split('=')[1];
    } else if (arg.startsWith('--encoding=')) {
      args.encoding = arg.split('=')[1];
    } else if (arg.startsWith('--delimiter=')) {
      args.delimiter = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    }
  });

  return args;
}

async function main() {
  const args = parseArgs();

  console.log('======================================');
  console.log('CSVデータインポート');
  console.log('======================================\n');

  // 引数チェック
  if (!args.entity || !args.file) {
    console.error('❌ 必須引数が不足しています');
    console.error('   使用方法: node import-csv.js --entity=<type> --file=<path>');
    console.error('\n   利用可能なエンティティ:');
    Object.keys(ENTITY_MAPPINGS).forEach((e) => console.error(`     - ${e}`));
    process.exit(1);
  }

  if (!ENTITY_MAPPINGS[args.entity]) {
    console.error(`❌ 不明なエンティティタイプ: ${args.entity}`);
    console.error('   利用可能なタイプ:', Object.keys(ENTITY_MAPPINGS).join(', '));
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  console.log(`📁 入力ファイル: ${filePath}`);
  console.log(`📝 エンティティ: ${args.entity}`);
  console.log(`📄 文字コード: ${args.encoding}`);

  try {
    // ファイル読み込み（xlsxライブラリはCSVも読める）
    const workbook = xlsx.readFile(filePath, {
      type: 'file',
      codepage: args.encoding === 'sjis' ? 932 : 65001
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet);

    console.log(`\n📊 読み込み件数: ${rawData.length}行`);

    // データ変換
    const mapping = ENTITY_MAPPINGS[args.entity];
    const transformedData = [];
    const errors = [];

    rawData.forEach((row, index) => {
      try {
        const transformed = mapping.transform(row);

        // 必須フィールドチェック
        const missingFields = mapping.required.filter((f) => !transformed[f]);
        if (missingFields.length > 0) {
          errors.push({
            row: index + 2,
            error: `必須フィールド不足: ${missingFields.join(', ')}`
          });
          return;
        }

        // デフォルト値適用
        Object.entries(mapping.defaults).forEach(([key, value]) => {
          if (
            transformed[key] === undefined ||
            transformed[key] === null ||
            transformed[key] === ''
          ) {
            transformed[key] = value;
          }
        });

        transformedData.push(transformed);
      } catch (e) {
        errors.push({ row: index + 2, error: e.message });
      }
    });

    console.log(`✅ 変換成功: ${transformedData.length}件`);
    if (errors.length > 0) {
      console.log(`⚠️  変換エラー: ${errors.length}件`);
    }

    // サンプル表示
    console.log('\n📋 サンプルデータ（最初の3件）:');
    transformedData.slice(0, 3).forEach((d, i) => {
      console.log(`   ${i + 1}. ${JSON.stringify(d).substring(0, 80)}...`);
    });

    // ファイル出力
    if (!args.dryRun) {
      const outputPath = args.output || `data/transformed/${args.entity}.json`;
      const fullOutputPath = path.resolve(process.cwd(), outputPath);
      const outputDir = path.dirname(fullOutputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const output = {
        metadata: {
          source: path.basename(filePath),
          entity: args.entity,
          transformedAt: new Date().toISOString(),
          recordCount: transformedData.length,
          errorCount: errors.length
        },
        data: transformedData,
        errors: errors.length > 0 ? errors : undefined
      };

      fs.writeFileSync(fullOutputPath, JSON.stringify(output, null, 2));
      console.log(`\n✅ 出力ファイル: ${fullOutputPath}`);

      console.log('\n次のステップ:');
      console.log(`   node backend/scripts/migrate/load-${args.entity}.js --file=${outputPath}`);
    } else {
      console.log('\n⚠️  ドライランモード: ファイル出力をスキップしました');
    }

    console.log('\n======================================');
    console.log('✅ CSVインポート完了');
    console.log('======================================');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();
