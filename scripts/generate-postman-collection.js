#!/usr/bin/env node
/**
 * OpenAPI仕様からPostman Collection v2.1を生成するスクリプト
 *
 * 使用方法:
 *   node scripts/generate-postman-collection.js
 *
 * 出力:
 *   docs/postman-collection.json
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// OpenAPI YAML を読み込み
const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
const openapiSpec = yaml.load(fs.readFileSync(openapiPath, 'utf8'));

// Postman Collection v2.1 の基本構造
const postmanCollection = {
  info: {
    name: openapiSpec.info.title,
    description: openapiSpec.info.description,
    version: openapiSpec.info.version,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  auth: {
    type: 'bearer',
    bearer: [
      {
        key: 'token',
        value: '{{jwt_token}}',
        type: 'string'
      }
    ]
  },
  variable: [
    {
      key: 'baseUrl',
      value: openapiSpec.servers[0].url,
      type: 'string'
    },
    {
      key: 'jwt_token',
      value: '',
      type: 'string'
    }
  ],
  item: []
};

// タグごとにフォルダを作成
const tagFolders = {};

// OpenAPIのpathsをPostmanのrequestsに変換
for (const [pathKey, pathItem] of Object.entries(openapiSpec.paths || {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
      continue;
    }

    // タグを取得（なければ "Other"）
    const tag = operation.tags?.[0] || 'Other';

    // タグフォルダが存在しない場合は作成
    if (!tagFolders[tag]) {
      tagFolders[tag] = {
        name: tag,
        item: []
      };
    }

    // リクエストボディのサンプルを生成
    let body = null;
    if (operation.requestBody?.content?.['application/json']?.schema) {
      const schema = operation.requestBody.content['application/json'].schema;
      body = {
        mode: 'raw',
        raw: JSON.stringify(generateSampleFromSchema(schema, openapiSpec.components?.schemas), null, 2),
        options: {
          raw: {
            language: 'json'
          }
        }
      };
    }

    // パラメータをクエリパラメータとして追加
    const queryParams = [];
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'query') {
          queryParams.push({
            key: param.name,
            value: param.example || (param.schema?.example) || '',
            description: param.description || '',
            disabled: !param.required
          });
        }
      }
    }

    // URLを構築
    let url = `{{baseUrl}}${pathKey}`;
    // パスパラメータを変数に置き換え
    url = url.replace(/{([^}]+)}/g, ':$1');

    // Postmanリクエストを作成
    const request = {
      name: operation.summary || `${method.toUpperCase()} ${pathKey}`,
      request: {
        method: method.toUpperCase(),
        header: [
          {
            key: 'Content-Type',
            value: 'application/json',
            type: 'text'
          }
        ],
        url: {
          raw: url + (queryParams.length > 0 ? '?' + queryParams.map(p => `${p.key}=${p.value}`).join('&') : ''),
          host: ['{{baseUrl}}'],
          path: pathKey.split('/').filter(p => p),
          query: queryParams
        },
        description: operation.description || ''
      }
    };

    // リクエストボディがある場合は追加
    if (body) {
      request.request.body = body;
    }

    // 認証が不要なエンドポイント（/auth/login など）は個別の認証設定
    if (pathKey.includes('/auth/login') || pathKey.includes('/health')) {
      request.request.auth = {
        type: 'noauth'
      };
    }

    // タグフォルダにリクエストを追加
    tagFolders[tag].item.push(request);
  }
}

// タグフォルダをコレクションに追加
postmanCollection.item = Object.values(tagFolders);

// Postman Collection を保存
const outputPath = path.join(__dirname, '..', 'docs', 'postman-collection.json');
fs.writeFileSync(outputPath, JSON.stringify(postmanCollection, null, 2));

console.log(`✅ Postman Collection generated: ${outputPath}`);
console.log(`📁 Folders: ${Object.keys(tagFolders).length}`);
console.log(`📝 Requests: ${postmanCollection.item.reduce((sum, folder) => sum + folder.item.length, 0)}`);

/**
 * OpenAPI スキーマからサンプルデータを生成
 */
function generateSampleFromSchema(schema, components) {
  if (!schema) return {};

  // $ref を解決
  if (schema.$ref) {
    const refPath = schema.$ref.split('/').slice(2); // #/components/schemas/XXX
    let resolved = components;
    for (const part of refPath) {
      resolved = resolved?.[part];
    }
    return generateSampleFromSchema(resolved, components);
  }

  // example があればそれを使用
  if (schema.example) {
    return schema.example;
  }

  // type に応じてサンプルを生成
  switch (schema.type) {
    case 'object':
      const obj = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateSampleFromSchema(prop, components);
        }
      }
      return obj;

    case 'array':
      return [generateSampleFromSchema(schema.items, components)];

    case 'string':
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date') return new Date().toISOString().split('T')[0];
      if (schema.format === 'email') return 'user@example.com';
      if (schema.enum) return schema.enum[0];
      return schema.default || 'string';

    case 'number':
    case 'integer':
      return schema.default || 0;

    case 'boolean':
      return schema.default || false;

    default:
      return null;
  }
}
