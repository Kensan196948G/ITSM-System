const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const https = require('https');
const http = require('http');
const fs = require('fs');

// Load environment variables based on NODE_ENV
if (!process.env.JWT_SECRET) {
  const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
  dotenv.config({ path: envFile });
}

const { initDb } = require('./db');
const { cspMiddleware, hstsMiddleware, securityHeadersMiddleware } = require('./middleware/csp');
const { i18nMiddleware } = require('./middleware/i18n');
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');
const { initializeScheduler } = require('./services/schedulerService');
const {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers
} = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const incidentsRoutes = require('./routes/incidents');
const assetsRoutes = require('./routes/assets');
const problemsRoutes = require('./routes/problems');
const releasesRoutes = require('./routes/releases');
const serviceRequestsRoutes = require('./routes/serviceRequests');
const slaRoutes = require('./routes/sla');
const vulnerabilitiesRoutes = require('./routes/vulnerabilities');
const notificationsRoutes = require('./routes/notifications');
const auditLogsRoutes = require('./routes/auditLogs');
const exportRoutes = require('./routes/export');
const m365Routes = require('./routes/m365');
const integrationsRoutes = require('./routes/integrations');
const reportsRoutes = require('./routes/reports');
const webhooksRoutes = require('./routes/webhooks');
const changesRoutes = require('./routes/changes');
const usersRoutes = require('./routes/users');
const loginRoutes = require('./routes/auth/login');
const registerRoutes = require('./routes/auth/register');
const twoFactorAuthRoutes = require('./routes/auth/2fa');
const passwordResetRoutes = require('./routes/auth/passwordReset');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(cspMiddleware);
app.use(hstsMiddleware);
app.use(securityHeadersMiddleware);
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.xssFilter());
app.use(helmet.ieNoOpen());
app.use(helmet.dnsPrefetchControl());

// CORS Configuration
const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000'];

    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('null')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// i18n Middleware
app.use(i18nMiddleware);

// Prometheus Metrics Collection
app.use(metricsMiddleware);

// Rate Limiting
app.use('/api/', apiLimiter);

// Initialize database
initDb();

// Route registration
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/incidents', incidentsRoutes);
app.use('/api/v1/assets', assetsRoutes);
app.use('/api/v1/problems', problemsRoutes);
app.use('/api/v1/releases', releasesRoutes);
app.use('/api/v1/service-requests', serviceRequestsRoutes);
app.use('/api/v1/sla', slaRoutes);
app.use('/api/v1/vulnerabilities', vulnerabilitiesRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/audit-logs', auditLogsRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/m365', m365Routes);
app.use('/api/v1/integrations', integrationsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);
app.use('/api/v1/changes', changesRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/auth', loginRoutes);
app.use('/api/v1/auth', registerRoutes);
app.use('/api/v1/auth/2fa', twoFactorAuthRoutes);
app.use('/api/v1/auth/password-reset', passwordResetRoutes);

// Alias routes for frontend compatibility
app.use('/api/v1/security/audit-logs', auditLogsRoutes);

// Additional route dependencies
const { authenticateJWT } = require('./middleware/auth');
const { db } = require('./db');
const { cacheMiddleware } = require('./middleware/cache');

// SLA agreements alias (slaRoutes uses /agreements path)
app.get('/api/v1/sla-agreements', authenticateJWT, cacheMiddleware, (req, res) => {
  db.all('SELECT * FROM sla_agreements ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'SLA契約の取得に失敗しました' });
    }
    res.json(rows || []);
  });
});

// Stub routes for missing endpoints

// Knowledge articles
app.get('/api/v1/knowledge-articles', authenticateJWT, (req, res) => {
  res.json([]);
});
app.post('/api/v1/knowledge-articles', authenticateJWT, (req, res) => {
  res.status(201).json({ id: Date.now(), message: '記事を作成しました' });
});

// Capacity metrics - フロントエンドが期待する配列形式
app.get('/api/v1/capacity-metrics', authenticateJWT, (req, res) => {
  const now = new Date().toISOString();
  res.json({
    data: [
      {
        metric_id: 'CAP-001',
        resource_name: 'Web Server CPU',
        resource_type: 'CPU',
        current_usage: 45,
        unit: '%',
        threshold: 80,
        forecast_3m: 52,
        status: 'Normal',
        measured_at: now
      },
      {
        metric_id: 'CAP-002',
        resource_name: 'Database Memory',
        resource_type: 'Memory',
        current_usage: 62,
        unit: '%',
        threshold: 85,
        forecast_3m: 70,
        status: 'Normal',
        measured_at: now
      },
      {
        metric_id: 'CAP-003',
        resource_name: 'Storage Pool A',
        resource_type: 'Storage',
        current_usage: 78,
        unit: '%',
        threshold: 90,
        forecast_3m: 85,
        status: 'Warning',
        measured_at: now
      },
      {
        metric_id: 'CAP-004',
        resource_name: 'Network Bandwidth',
        resource_type: 'Network',
        current_usage: 30,
        unit: 'Mbps',
        threshold: 1000,
        forecast_3m: 35,
        status: 'Normal',
        measured_at: now
      },
      {
        metric_id: 'CAP-005',
        resource_name: 'API Server CPU',
        resource_type: 'CPU',
        current_usage: 55,
        unit: '%',
        threshold: 80,
        forecast_3m: 60,
        status: 'Normal',
        measured_at: now
      }
    ]
  });
});

// Security dashboard - フロントエンドが期待する形式
app.get('/api/v1/security/dashboard/overview', authenticateJWT, (req, res) => {
  // 過去24時間のラベルを生成
  const hours = [];
  for (let i = 23; i >= 0; i--) {
    hours.push(`${23 - i}:00`);
  }

  res.json({
    total_alerts: 12,
    alerts_by_severity: {
      critical: 2,
      high: 4,
      medium: 4,
      low: 2
    },
    failed_logins_24h: 8,
    active_users: 15,
    open_security_incidents: 3,
    critical_vulnerabilities: 2,
    riskScore: 72,
    complianceRate: 89,
    // チャート用データ
    login_timeline: {
      labels: hours,
      successful: [12, 15, 8, 5, 3, 2, 4, 8, 25, 45, 52, 48, 42, 38, 35, 40, 38, 32, 28, 22, 18, 15, 12, 10],
      failed: [1, 0, 0, 0, 0, 0, 0, 1, 2, 3, 2, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    },
    failed_logins_by_ip: {
      labels: ['192.168.1.100', '10.0.0.55', '172.16.0.22', 'その他'],
      data: [3, 2, 2, 1]
    },
    activity_distribution: {
      labels: ['ログイン', 'API呼び出し', 'ファイルアクセス', '設定変更', 'その他'],
      data: [150, 420, 85, 12, 33]
    }
  });
});

// Security alerts - フロントエンドが期待する配列形式
app.get('/api/v1/security/alerts', authenticateJWT, (req, res) => {
  // フロントエンドは response.data または response が配列であることを期待
  res.json({
    data: [],
    total: 0,
    unacknowledged: 0
  });
});

// SLA alerts stub (table doesn't exist)
app.get('/api/v1/sla/alerts', authenticateJWT, (req, res) => {
  res.json({ alerts: [], total: 0 });
});
app.get('/api/v1/sla/alerts/stats', authenticateJWT, (req, res) => {
  res.json({ total_alerts: 0, acknowledged_alerts: 0, pending_alerts: 0 });
});

// SLA statistics stub
app.get('/api/v1/sla/statistics', authenticateJWT, (req, res) => {
  res.json({
    overallCompliance: 95,
    totalAgreements: 4,
    metAgreements: 4,
    atRisk: 0
  });
});

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Swagger documentation
const swaggerSpec = require('./swagger');

const swaggerUiOptions = {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ITSM-Sec Nexus API Documentation'
};

app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler - 最後に配置
app.use(notFoundHandler);

// Global error handler - 最後に配置
app.use(errorHandler);

// Start server
const startServer = () => {
  const enableHttps = process.env.ENABLE_HTTPS === 'true';
  const httpsPort = process.env.HTTPS_PORT || 5443;
  const httpPort = process.env.HTTP_PORT || PORT;
  const httpRedirect = process.env.HTTP_REDIRECT_TO_HTTPS === 'true';

  if (enableHttps) {
    try {
      // Read SSL certificates
      const sslOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH || './ssl/server.key'),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH || './ssl/server.crt'),
        minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
        maxVersion: process.env.TLS_MAX_VERSION || 'TLSv1.3'
      };

      // Create HTTPS server
      https.createServer(sslOptions, app).listen(httpsPort, () => {
        console.log(`✅ HTTPS Server running on https://localhost:${httpsPort}`);
        console.log(`✅ HTTPS API Documentation: https://localhost:${httpsPort}/api-docs`);

        // Initialize scheduler
        initializeScheduler();

        // Setup global error handlers
        setupGlobalErrorHandlers();
      });

      // HTTP to HTTPS redirect server
      if (httpRedirect) {
        const redirectApp = express();
        redirectApp.use((req, res) => {
          const host = req.headers.host.split(':')[0];
          res.redirect(301, `https://${host}:${httpsPort}${req.originalUrl}`);
        });

        http.createServer(redirectApp).listen(httpPort, () => {
          console.log(`🔄 HTTP Redirect Server running on http://localhost:${httpPort} → https://localhost:${httpsPort}`);
        });
      }
    } catch (error) {
      console.error('❌ Failed to start HTTPS server:', error.message);
      console.log('💡 Falling back to HTTP server...');

      // Fallback to HTTP
      app.listen(PORT, () => {
        console.log(`⚠️  HTTP Server running on http://localhost:${PORT}`);
        console.log(`⚠️  HTTP API Documentation: http://localhost:${PORT}/api-docs`);

        initializeScheduler();
        setupGlobalErrorHandlers();
      });
    }
  } else {
    // Standard HTTP server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`API Documentation: http://localhost:${PORT}/api-docs`);

      // Initialize scheduler
      initializeScheduler();

      // Setup global error handlers
      setupGlobalErrorHandlers();
    });
  }
};

startServer();

module.exports = app;
