#!/usr/bin/env node
/* eslint-disable no-plusplus, no-await-in-loop, no-restricted-syntax, no-continue, prefer-destructuring, no-return-assign, class-methods-use-this, no-lonely-if, no-unused-vars, max-len */
/**
 * Microsoft 365 Graph API 接続テストスクリプト
 *
 * 使用方法:
 *   node backend/scripts/migrate/test-m365-connection.js
 *
 * 必要な環境変数:
 *   M365_TENANT_ID, M365_CLIENT_ID, M365_CLIENT_SECRET
 */

require('dotenv').config();
const https = require('https');
const querystring = require('querystring');

const CONFIG = {
  tenantId: process.env.M365_TENANT_ID,
  clientId: process.env.M365_CLIENT_ID,
  clientSecret: process.env.M365_CLIENT_SECRET,
  graphEndpoint: process.env.M365_GRAPH_ENDPOINT || 'https://graph.microsoft.com/v1.0'
};

// 設定チェック
function validateConfig() {
  const missing = [];
  if (!CONFIG.tenantId) missing.push('M365_TENANT_ID');
  if (!CONFIG.clientId) missing.push('M365_CLIENT_ID');
  if (!CONFIG.clientSecret) missing.push('M365_CLIENT_SECRET');

  if (missing.length > 0) {
    console.error('❌ 環境変数が設定されていません:', missing.join(', '));
    console.error('\n.envファイルに以下を追加してください:');
    missing.forEach((v) => console.error(`  ${v}=your-value-here`));
    process.exit(1);
  }
  console.log('✅ 環境変数チェック完了');
}

// アクセストークン取得
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const tokenUrl = `https://login.microsoftonline.com/${CONFIG.tenantId}/oauth2/v2.0/token`;

    const postData = querystring.stringify({
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    });

    const url = new URL(tokenUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error(json.error_description || 'トークン取得失敗'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Graph API呼び出し
async function callGraphAPI(token, endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.graphEndpoint}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(json);
          } else {
            reject(new Error(`API Error: ${res.statusCode} - ${json.error?.message || data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// メイン処理
async function main() {
  console.log('======================================');
  console.log('Microsoft 365 Graph API 接続テスト');
  console.log('======================================\n');

  // Step 1: 設定チェック
  validateConfig();

  // Step 2: アクセストークン取得
  console.log('\n📡 アクセストークンを取得中...');
  try {
    const token = await getAccessToken();
    console.log('✅ アクセストークン取得成功');
    console.log(`   トークン長: ${token.length}文字`);

    // Step 3: ユーザー一覧取得テスト
    console.log('\n👥 ユーザー一覧を取得中...');
    try {
      const users = await callGraphAPI(
        token,
        '/users?$top=5&$select=displayName,userPrincipalName,mail'
      );
      console.log('✅ ユーザー一覧取得成功');
      console.log(`   取得件数: ${users.value.length}件（最大5件表示）`);
      users.value.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.displayName} (${u.userPrincipalName})`);
      });
    } catch (e) {
      console.error('❌ ユーザー一覧取得失敗:', e.message);
      console.log('   → User.Read.All 権限が付与されているか確認してください');
    }

    // Step 4: デバイス一覧取得テスト（Intune）
    console.log('\n💻 デバイス一覧を取得中...');
    try {
      const devices = await callGraphAPI(
        token,
        '/devices?$top=5&$select=displayName,operatingSystem'
      );
      console.log('✅ デバイス一覧取得成功');
      console.log(`   取得件数: ${devices.value.length}件（最大5件表示）`);
      devices.value.forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.displayName} (${d.operatingSystem || 'N/A'})`);
      });
    } catch (e) {
      console.error('❌ デバイス一覧取得失敗:', e.message);
      console.log('   → Device.Read.All 権限が付与されているか確認してください');
    }

    console.log('\n======================================');
    console.log('✅ 接続テスト完了');
    console.log('======================================');
    console.log('\n次のステップ:');
    console.log('1. 本番用の移行スクリプトを実行');
    console.log('   node backend/scripts/migrate/extract-users-from-m365.js');
    console.log('2. 抽出データを確認');
    console.log('   cat data/extracted/users.json');
  } catch (e) {
    console.error('❌ アクセストークン取得失敗:', e.message);
    console.log('\n考えられる原因:');
    console.log('1. クライアントシークレットが正しくない');
    console.log('2. テナントIDが正しくない');
    console.log('3. アプリ登録が正しく行われていない');
    process.exit(1);
  }
}

main();
