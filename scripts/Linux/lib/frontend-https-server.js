#!/usr/bin/env node

/**
 * ITSM-System Frontend HTTPS Server
 *
 * 機能:
 * - 静的ファイル配信（HTTPS）
 * - セキュリティヘッダー送信
 * - HTTPからHTTPSへのリダイレクト
 * - TLS 1.2/1.3対応
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 設定
const PORT = parseInt(process.env.FRONTEND_HTTPS_PORT || '5050', 10);
const HTTP_PORT = parseInt(process.env.FRONTEND_HTTP_PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, '..', 'ssl', 'server.crt');
const KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, '..', 'ssl', 'server.key');
const REDIRECT_TO_HTTPS = process.env.HTTP_REDIRECT_TO_HTTPS === 'true';

// MIMEタイプのマッピング
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// セキュリティヘッダー
const SECURITY_HEADERS = {
  // HSTS: HTTPS強制（1年間）
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // XSS対策
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',

  // リファラー制御
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // CSP（Content Security Policy）
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "connect-src 'self' https://192.168.0.187:5443 https://localhost:5443 https://cdn.jsdelivr.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),

  // 権限ポリシー
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',

  // クロスオリジン設定
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

/**
 * セキュリティヘッダーを設定
 * @param {http.ServerResponse} res - レスポンスオブジェクト
 */
function setSecurityHeaders(res) {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

/**
 * MIMEタイプを取得
 * @param {string} filePath - ファイルパス
 * @returns {string} MIMEタイプ
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * リクエストハンドラ
 * @param {http.IncomingMessage} req - リクエストオブジェクト
 * @param {http.ServerResponse} res - レスポンスオブジェクト
 */
function requestHandler(req, res) {
  // セキュリティヘッダー設定
  setSecurityHeaders(res);

  // URLパース
  const parsedUrl = url.parse(req.url);
  let pathname = `.${parsedUrl.pathname}`;

  // パストラバーサル対策
  const normalizedPath = path.normalize(pathname);
  if (normalizedPath.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>403 Forbidden</h1><p>Path traversal is not allowed.</p>');
    console.warn(`[Security] Path traversal attempt blocked: ${req.url}`);
    return;
  }

  // ディレクトリの場合はindex.htmlを返す
  if (pathname === './' || pathname === '.') {
    pathname = './index.html';
  } else if (fs.existsSync(pathname) && fs.statSync(pathname).isDirectory()) {
    pathname = path.join(pathname, 'index.html');
  }

  // ファイル読み込み
  fs.readFile(pathname, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // 404 Not Found
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>404 Not Found</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #e74c3c; }
            </style>
          </head>
          <body>
            <h1>404 Not Found</h1>
            <p>The requested resource was not found on this server.</p>
            <p><a href="/">Return to Home</a></p>
          </body>
          </html>
        `);
        console.warn(`[404] ${req.method} ${req.url} - Not Found`);
      } else if (err.code === 'EACCES') {
        // 403 Forbidden
        res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>403 Forbidden</h1><p>Access denied.</p>');
        console.error(`[403] ${req.method} ${req.url} - Access Denied`);
      } else {
        // 500 Internal Server Error
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>500 Internal Server Error</h1>');
        console.error(`[500] ${req.method} ${req.url} - ${err.message}`);
      }
    } else {
      // 成功
      const mimeType = getMimeType(pathname);
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);

      // アクセスログ
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.url} - 200 OK (${data.length} bytes)`);
    }
  });
}

/**
 * メイン処理
 */
function main() {
  console.log('=================================================');
  console.log('ITSM-System Frontend HTTPS Server');
  console.log('=================================================');

  // 証明書ファイルの存在確認
  if (!fs.existsSync(CERT_PATH)) {
    console.error(`[ERROR] Certificate not found: ${CERT_PATH}`);
    console.error('[ERROR] Please run: ./scripts/generate-ssl-cert.sh');
    process.exit(1);
  }

  if (!fs.existsSync(KEY_PATH)) {
    console.error(`[ERROR] Private key not found: ${KEY_PATH}`);
    console.error('[ERROR] Please run: ./scripts/generate-ssl-cert.sh');
    process.exit(1);
  }

  // HTTPS設定
  const httpsOptions = {
    cert: fs.readFileSync(CERT_PATH),
    key: fs.readFileSync(KEY_PATH),
    minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
    maxVersion: process.env.TLS_MAX_VERSION || 'TLSv1.3',
    ciphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256'
    ].join(':'),
    honorCipherOrder: true
  };

  console.log(`[HTTPS] Certificate: ${CERT_PATH}`);
  console.log(`[HTTPS] Private Key: ${KEY_PATH}`);
  console.log(`[HTTPS] TLS Version: ${httpsOptions.minVersion} - ${httpsOptions.maxVersion}`);

  // HTTPSサーバー起動
  const httpsServer = https.createServer(httpsOptions, requestHandler);

  httpsServer.listen(PORT, HOST, () => {
    console.log(`[HTTPS] ✓ Server running at https://${HOST}:${PORT}/`);
    console.log(`[HTTPS] Access at: https://192.168.0.187:${PORT}/index.html`);
    console.log(`[HTTPS] Local access: https://localhost:${PORT}/index.html`);
  });

  httpsServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[ERROR] Port ${PORT} is already in use`);
      console.error(`[ERROR] Stop the existing process: sudo lsof -ti:${PORT} | xargs kill -9`);
    } else if (err.code === 'EACCES') {
      console.error(`[ERROR] Permission denied for port ${PORT}`);
    } else {
      console.error('[ERROR]', err);
    }
    process.exit(1);
  });

  // HTTPからHTTPSへのリダイレクト
  if (REDIRECT_TO_HTTPS) {
    console.log(`[HTTP] Starting redirect server on port ${HTTP_PORT}...`);

    const httpServer = http.createServer((req, res) => {
      const hostname = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
      const httpsUrl = `https://${hostname}:${PORT}${req.url}`;

      res.writeHead(301, {
        Location: httpsUrl,
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      });
      res.end();

      console.log(`[HTTP] Redirected: ${req.url} -> ${httpsUrl}`);
    });

    httpServer.listen(HTTP_PORT, HOST, () => {
      console.log(`[HTTP] ✓ Redirect server running on port ${HTTP_PORT} -> HTTPS ${PORT}`);
    });

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[WARNING] Port ${HTTP_PORT} is already in use (redirect disabled)`);
      } else {
        console.error('[HTTP ERROR]', err);
      }
    });
  } else {
    console.log('[HTTP] HTTP to HTTPS redirect is disabled');
  }

  // グレースフルシャットダウン
  process.on('SIGTERM', () => {
    console.log('\n[Server] Received SIGTERM, shutting down gracefully...');
    httpsServer.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('\n[Server] Received SIGINT, shutting down gracefully...');
    httpsServer.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });

  console.log('=================================================');
}

// 起動
main();
