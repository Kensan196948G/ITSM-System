const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

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
app.use('/api/v1/auth', loginRoutes);
app.use('/api/v1/auth', registerRoutes);
app.use('/api/v1/auth/2fa', twoFactorAuthRoutes);
app.use('/api/v1/auth/password-reset', passwordResetRoutes);

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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api-docs`);

  // Initialize scheduler
  initializeScheduler();

  // Setup global error handlers
  setupGlobalErrorHandlers();
});

module.exports = app;
