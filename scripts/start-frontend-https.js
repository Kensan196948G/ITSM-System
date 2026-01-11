#!/usr/bin/env node

/**
 * ITSM-System Frontend HTTPS Server
 * Serves static frontend files over HTTPS
 */

const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Configuration
const HTTPS_PORT = process.env.FRONTEND_HTTPS_PORT || 5050;
const HTTP_PORT = process.env.FRONTEND_HTTP_PORT || 8080;
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';
const HTTP_REDIRECT = process.env.HTTP_REDIRECT_TO_HTTPS === 'true';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || './ssl/server.crt';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || './ssl/server.key';

// Serve static files from project root
const staticPath = path.join(__dirname, '..');
app.use(express.static(staticPath, {
  index: ['index.html', 'app.js'],
  extensions: ['html', 'htm', 'js', 'css'],
  setHeaders: (res, filePath) => {
    // Set proper MIME types
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Start server
const startServer = () => {
  if (ENABLE_HTTPS) {
    try {
      // Read SSL certificates
      const sslOptions = {
        key: fs.readFileSync(SSL_KEY_PATH),
        cert: fs.readFileSync(SSL_CERT_PATH),
        minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
        maxVersion: process.env.TLS_MAX_VERSION || 'TLSv1.3'
      };

      // Create HTTPS server
      https.createServer(sslOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`✅ Frontend HTTPS Server running on https://0.0.0.0:${HTTPS_PORT}`);
        console.log(`✅ Access at: https://192.168.0.187:${HTTPS_PORT}`);
        console.log(`📁 Serving files from: ${staticPath}`);
      });

      // HTTP to HTTPS redirect server
      if (HTTP_REDIRECT) {
        const redirectApp = express();
        redirectApp.use((req, res) => {
          const host = req.headers.host.split(':')[0];
          res.redirect(301, `https://${host}:${HTTPS_PORT}${req.originalUrl}`);
        });

        http.createServer(redirectApp).listen(HTTP_PORT, '0.0.0.0', () => {
          console.log(`🔄 Frontend HTTP Redirect running on http://0.0.0.0:${HTTP_PORT} → https://0.0.0.0:${HTTPS_PORT}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to start HTTPS server:', error.message);
      console.log('💡 Falling back to HTTP server...');

      // Fallback to HTTP
      app.listen(HTTPS_PORT, '0.0.0.0', () => {
        console.log(`⚠️  Frontend HTTP Server running on http://0.0.0.0:${HTTPS_PORT}`);
        console.log(`📁 Serving files from: ${staticPath}`);
      });
    }
  } else {
    // Standard HTTP server
    app.listen(HTTP_PORT, '0.0.0.0', () => {
      console.log(`Frontend HTTP Server running on http://0.0.0.0:${HTTP_PORT}`);
      console.log(`📁 Serving files from: ${staticPath}`);
    });
  }
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down frontend server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down frontend server...');
  process.exit(0);
});

startServer();
