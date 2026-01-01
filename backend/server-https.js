/**
 * HTTPS対応サーバー設定モジュール
 *
 * 機能:
 * - HTTPSサーバーの起動
 * - HTTPからHTTPSへのリダイレクト
 * - TLS 1.2/1.3のみ許可
 * - 強力な暗号スイート設定
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * HTTPSサーバーを起動
 * @param {Express} app - Expressアプリケーション
 * @returns {Object} { httpsServer, httpServer }
 */
function startHttpsServer(app) {
  const enableHttps = process.env.ENABLE_HTTPS === 'true';
  const httpsPort = parseInt(process.env.HTTPS_PORT || '5443', 10);
  const httpPort = parseInt(process.env.HTTP_PORT || '5000', 10);
  const host = process.env.HOST || '0.0.0.0';
  const redirectToHttps = process.env.HTTP_REDIRECT_TO_HTTPS === 'true';

  if (!enableHttps) {
    console.log('[HTTPS] HTTPS is disabled. Starting HTTP server only.');
    const httpServer = app.listen(httpPort, host, () => {
      console.log(
        `[HTTP] Server running on http://${process.env.SYSTEM_IP || 'localhost'}:${httpPort}`
      );
      console.log(`[HTTP] Health check: http://localhost:${httpPort}/api/v1/health`);
    });
    return { httpServer, httpsServer: null };
  }

  // SSL証明書のパス
  const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, '..', 'ssl', 'server.crt');
  const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, '..', 'ssl', 'server.key');

  // 証明書ファイルの存在確認
  if (!fs.existsSync(certPath)) {
    console.error(`[HTTPS ERROR] Certificate not found: ${certPath}`);
    console.error('[HTTPS ERROR] Please run: ./scripts/generate-ssl-cert.sh');
    process.exit(1);
  }

  if (!fs.existsSync(keyPath)) {
    console.error(`[HTTPS ERROR] Private key not found: ${keyPath}`);
    console.error('[HTTPS ERROR] Please run: ./scripts/generate-ssl-cert.sh');
    process.exit(1);
  }

  // HTTPS設定
  const httpsOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),

    // TLSバージョン設定
    minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
    maxVersion: process.env.TLS_MAX_VERSION || 'TLSv1.3',

    // 強力な暗号スイート（Perfect Forward Secrecy対応）
    ciphers: [
      // TLS 1.3暗号スイート（優先）
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',

      // TLS 1.2暗号スイート（ECDHE - 楕円曲線ディフィー・ヘルマン）
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',

      // DHE暗号スイート（後方互換性）
      'DHE-RSA-AES256-GCM-SHA384',
      'DHE-RSA-AES128-GCM-SHA256'
    ].join(':'),

    // サーバー側の暗号スイート優先
    honorCipherOrder: true,

    // セッション再利用の設定
    sessionTimeout: 300, // 5分

    // ECDHカーブの指定
    ecdhCurve: 'auto'
  };

  console.log('[HTTPS] Starting HTTPS server...');
  console.log(`[HTTPS] Certificate: ${certPath}`);
  console.log(`[HTTPS] Private Key: ${keyPath}`);
  console.log(`[HTTPS] TLS Version: ${httpsOptions.minVersion} - ${httpsOptions.maxVersion}`);

  // HTTPSサーバー起動
  const httpsServer = https.createServer(httpsOptions, app);

  httpsServer.listen(httpsPort, host, () => {
    console.log(
      `[HTTPS] ✓ Server running on https://${process.env.SYSTEM_IP || 'localhost'}:${httpsPort}`
    );
    console.log(`[HTTPS] Health check: https://localhost:${httpsPort}/api/v1/health`);
    console.log(`[HTTPS] Metrics: https://localhost:${httpsPort}/metrics`);
    console.log(`[HTTPS] Swagger UI: https://localhost:${httpsPort}/api-docs`);
  });

  // HTTPSサーバーエラーハンドリング
  httpsServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[HTTPS ERROR] Port ${httpsPort} is already in use`);
    } else if (err.code === 'EACCES') {
      console.error(`[HTTPS ERROR] Permission denied for port ${httpsPort}`);
      console.error('[HTTPS ERROR] Ports below 1024 require root privileges');
    } else {
      console.error('[HTTPS ERROR]', err);
    }
    process.exit(1);
  });

  // HTTPからHTTPSへのリダイレクトサーバー
  let httpServer = null;

  if (redirectToHttps) {
    console.log(`[HTTP] Starting HTTP redirect server on port ${httpPort}...`);

    httpServer = http.createServer((req, res) => {
      // リダイレクト先URL構築
      const hostname = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
      const httpsUrl = `https://${hostname}:${httpsPort}${req.url}`;

      // 301 Permanent Redirectでリダイレクト
      res.writeHead(301, {
        Location: httpsUrl,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      });
      res.end();
    });

    httpServer.listen(httpPort, host, () => {
      console.log(`[HTTP] ✓ Redirect server running on port ${httpPort} -> HTTPS ${httpsPort}`);
    });

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[HTTP WARNING] Port ${httpPort} is already in use (redirect disabled)`);
      } else {
        console.error('[HTTP ERROR]', err);
      }
    });
  } else {
    console.log('[HTTP] HTTP to HTTPS redirect is disabled');
  }

  // グレースフルシャットダウン
  const shutdown = (signal) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

    const shutdownTimeout = setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 30000); // 30秒タイムアウト

    httpsServer.close(() => {
      console.log('[HTTPS] Server closed');
      if (httpServer) {
        httpServer.close(() => {
          console.log('[HTTP] Redirect server closed');
          clearTimeout(shutdownTimeout);
          process.exit(0);
        });
      } else {
        clearTimeout(shutdownTimeout);
        process.exit(0);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { httpsServer, httpServer };
}

/**
 * SSL証明書の情報を表示
 * @param {string} certPath - 証明書ファイルのパス
 * @returns {boolean} 証明書が正常に読み込まれたかどうか
 */
function displayCertificateInfo(certPath) {
  try {
    const certContent = fs.readFileSync(certPath, 'utf8');
    // 証明書の詳細情報はOpenSSLコマンドで確認することを推奨
    console.log('[HTTPS] Certificate loaded successfully');
    console.log(`[HTTPS] Certificate size: ${certContent.length} bytes`);
    return true;
  } catch (err) {
    console.warn('[HTTPS WARNING] Could not read certificate:', err.message);
    return false;
  }
}

module.exports = {
  startHttpsServer,
  displayCertificateInfo
};
