/**
 * Swagger/OpenAPI Configuration
 *
 * OpenAPI 3.0 仕様書を読み込み、Swagger UIで提供します。
 * 仕様書は docs/openapi.yaml に定義されています。
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerJsdoc = require('swagger-jsdoc');

// OpenAPI YAML ファイルのパス
const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');

let swaggerSpec;

// OpenAPI YAML ファイルが存在する場合はそれを使用
if (fs.existsSync(openapiPath)) {
  try {
    const fileContents = fs.readFileSync(openapiPath, 'utf8');
    swaggerSpec = yaml.load(fileContents);
    console.log('[Swagger] Loaded OpenAPI specification from docs/openapi.yaml');
  } catch (err) {
    console.error('[Swagger] Failed to load openapi.yaml:', err.message);
    // フォールバック: JSDocベースの設定を使用
    swaggerSpec = null;
  }
}

// openapi.yaml が読み込めない場合は JSDoc ベースの設定を使用
if (!swaggerSpec) {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'ITSM-Sec Nexus API',
        version: '1.0.0',
        description: 'IT Service Management System API - ITIL準拠の統合ITSM API',
        contact: {
          name: 'ITSM Development Team',
          email: 'dev@itsm.local'
        }
      },
      servers: [
        {
          url: 'http://localhost:5000/api/v1',
          description: '開発環境'
        },
        {
          url: 'http://192.168.0.187:5000/api/v1',
          description: 'ローカルネットワーク'
        },
        {
          url: 'https://192.168.0.187:5050/api/v1',
          description: 'ローカルネットワーク (HTTPS)'
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    apis: ['./backend/server.js', './backend/routes/*.js', './backend/routes/auth/*.js']
  };

  swaggerSpec = swaggerJsdoc(options);
  console.log('[Swagger] Using JSDoc-based OpenAPI specification');
}

module.exports = swaggerSpec;
