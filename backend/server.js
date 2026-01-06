const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const speakeasy = require('speakeasy');

// Load environment variables based on NODE_ENV
// Only load if JWT_SECRET is not already set (prevents reloading on require)
if (!process.env.JWT_SECRET) {
  const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
  dotenv.config({ path: envFile });
}

const swaggerUi = require('swagger-ui-express');
const { db, initDb } = require('./db');
const { authenticateJWT, authorize } = require('./middleware/auth');
const {
  validate,
  incidentValidation,
  changeValidation,
  authValidation
} = require('./middleware/validation');
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');
const healthRoutes = require('./routes/health');
const { apiLimiter, authLimiter, registerLimiter } = require('./middleware/rateLimiter');
const twoFactorAuthRoutes = require('./routes/auth/2fa');
const { cspMiddleware, hstsMiddleware, securityHeadersMiddleware } = require('./middleware/csp');
const {
  parsePaginationParams,
  buildPaginationSQL,
  createPaginationMeta
} = require('./middleware/pagination');
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
  invalidateCache,
  getCacheStats
} = require('./middleware/cache');
const auditLog = require('./middleware/auditLog');
const { trackLogin } = require('./middleware/userActivity');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(cspMiddleware); // Enhanced CSP
app.use(hstsMiddleware); // HSTS
app.use(securityHeadersMiddleware); // Additional security headers
app.use(helmet.noSniff()); // X-Content-Type-Options
app.use(helmet.frameguard({ action: 'deny' })); // X-Frame-Options
app.use(helmet.xssFilter()); // X-XSS-Protection
app.use(helmet.ieNoOpen()); // X-Download-Options
app.use(helmet.dnsPrefetchControl()); // X-DNS-Prefetch-Control

// CORS Configuration
const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : ['http://localhost:3000'];

    // Allow requests with no origin (like file:// or mobile apps)
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
app.use(morgan('dev'));

// Prometheus Metrics Collection
app.use(metricsMiddleware);

// Rate Limiting - Apply to all API routes
// (テスト環境では緩い制限を使用)
app.use('/api/', apiLimiter);

// Initialize Database (async with Promise)
const dbReady = (async () => {
  try {
    await initDb();
    if (process.env.NODE_ENV === 'test') {
      console.log('[Server] Database initialization complete - ready for testing');
    }
    return true;
  } catch (err) {
    console.error('[Server] Database initialization failed:', err);
    // In production, we might want to exit, but in some environments we might want to retry
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    throw err;
  }
})();

// ===== Authentication Routes =====

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: ユーザー登録
 *     description: 新規ユーザーを登録します（本番環境では管理者のみ）
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: newuser
 *                 description: ユーザー名
 *               employee_number:
 *                 type: string
 *                 example: EMP001
 *                 description: 社員番号
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *                 description: メールアドレス
 *               password:
 *                 type: string
 *                 example: securePassword123
 *                 description: パスワード
 *               role:
 *                 type: string
 *                 enum: [admin, manager, analyst, viewer]
 *                 default: viewer
 *                 example: analyst
 *               full_name:
 *                 type: string
 *                 example: 山田 太郎
 *     responses:
 *       201:
 *         description: ユーザー作成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: ユーザーが正常に作成されました
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     full_name:
 *                       type: string
 *       400:
 *         description: バリデーションエラー
 *       409:
 *         description: ユーザー名またはメールアドレスが既に使用されています
 *       500:
 *         description: 内部サーバーエラー
 */
// User Registration (Admin only for production)
// Rate limiter is always enabled (different limits for test/prod)
const registerMiddleware = [registerLimiter];
app.post(
  '/api/v1/auth/register',
  ...registerMiddleware,
  authValidation.register,
  validate,
  async (req, res) => {
    try {
      const { username, employee_number, email, password, role = 'viewer', full_name } = req.body;

      // Check if user already exists
      db.get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email],
        async (err, existingUser) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: '内部サーバーエラー' });
          }

          if (existingUser) {
            return res.status(409).json({
              error: 'ユーザー名またはメールアドレスが既に使用されています'
            });
          }

          // Hash password
          const password_hash = await bcrypt.hash(password, 10);

          // Create user (employee_number will be added to schema in next phase)
          const sql =
            'INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)';
          db.run(
            sql,
            [username, email, password_hash, role, full_name || employee_number],
            function (dbErr) {
              if (dbErr) {
                console.error('Database error:', dbErr);
                return res.status(500).json({ error: '内部サーバーエラー' });
              }

              invalidateCache('users');

              res.status(201).json({
                message: 'ユーザーが正常に作成されました',
                user: {
                  id: this.lastID,
                  username,
                  email,
                  role,
                  full_name
                }
              });
            }
          );
        }
      );
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: ユーザーログイン
 *     description: ユーザー名とパスワードでログインし、JWT トークンを取得します
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *                 description: ユーザー名
 *               password:
 *                 type: string
 *                 example: password123
 *                 description: パスワード
 *     responses:
 *       200:
 *         description: ログイン成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: ログインに成功しました
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     full_name:
 *                       type: string
 *       401:
 *         description: 認証失敗
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: ユーザー名またはパスワードが間違っています
 *       500:
 *         description: 内部サーバーエラー
 */
// User Login
// Rate limiter is always enabled (different limits for test/prod)
const loginMiddleware = [authLimiter];
app.post('/api/v1/auth/login', ...loginMiddleware, authValidation.login, validate, (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ? AND is_active = 1',
    [username],
    async (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      if (!user) {
        // Track failed login (non-blocking)
        trackLogin(null, req.ip, req.headers['user-agent'], false, 'User not found').catch(
          (trackErr) => {
            console.error('[Login] Failed to track login:', trackErr.message);
          }
        );
        return res.status(401).json({
          error: 'ユーザー名またはパスワードが間違っています'
        });
      }

      // Compare password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        // Track failed login (non-blocking)
        trackLogin(user.id, req.ip, req.headers['user-agent'], false, 'Invalid password').catch(
          (trackErr) => {
            console.error('[Login] Failed to track login:', trackErr.message);
          }
        );
        return res.status(401).json({
          error: 'ユーザー名またはパスワードが間違っています'
        });
      }

      // Check if 2FA is enabled for this user
      if (user.totp_enabled && user.totp_secret) {
        const { totpToken } = req.body;

        if (!totpToken) {
          return res.status(400).json({
            error: '2FAトークンが必要です',
            requires2FA: true
          });
        }

        // Verify TOTP token
        const verified = speakeasy.totp.verify({
          secret: user.totp_secret,
          encoding: 'base32',
          token: totpToken,
          window: 2
        });

        if (!verified) {
          // Check backup codes as fallback
          if (user.backup_codes) {
            const backupCodes = JSON.parse(user.backup_codes);
            const codeIndex = backupCodes.indexOf(totpToken);

            if (codeIndex !== -1) {
              // Remove used backup code
              backupCodes.splice(codeIndex, 1);
              db.run('UPDATE users SET backup_codes = ? WHERE id = ?', [
                JSON.stringify(backupCodes),
                user.id
              ]);
              console.log(`[SECURITY] Backup code used for user: ${user.username}`);
              // Continue to JWT generation
            } else {
              return res.status(401).json({ error: '無効な2FAトークンです' });
            }
          } else {
            return res.status(401).json({ error: '無効な2FAトークンです' });
          }
        }
      }

      // Update last login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      // Track successful login (non-blocking)
      trackLogin(user.id, req.ip, req.headers['user-agent'], true).catch((trackErr) => {
        console.error('[Login] Failed to track login:', trackErr.message);
      });

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        message: 'ログインに成功しました',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          full_name: user.full_name
        }
      });
    }
  );
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: 現在のユーザー情報取得
 *     description: ログイン中のユーザー情報を取得します
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ユーザー情報取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 username:
 *                   type: string
 *                   example: admin
 *                 email:
 *                   type: string
 *                   example: admin@example.com
 *                 role:
 *                   type: string
 *                   example: admin
 *                 full_name:
 *                   type: string
 *                   example: Administrator
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 last_login:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 認証が必要です
 *       404:
 *         description: ユーザーが見つかりません
 *       500:
 *         description: 内部サーバーエラー
 */
// Get Current User Info
app.get('/api/v1/auth/me', authenticateJWT, (req, res) => {
  db.get(
    'SELECT id, username, email, role, full_name, created_at, last_login FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      res.json(user);
    }
  );
});

// ===== User Management Routes =====

// GET all users (admin/manager only)
app.get(
  '/api/v1/users',
  authenticateJWT,
  authorize(['admin', 'manager']),
  cacheMiddleware,
  (req, res) => {
    db.all(
      'SELECT id, username, email, role, full_name, created_at, last_login FROM users ORDER BY created_at DESC',
      [],
      (err, users) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.json(users);
      }
    );
  }
);

// PUT update user (admin only)
app.put(
  '/api/v1/users/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('users'),
  async (req, res) => {
    const { id } = req.params;
    const { username, email, role, full_name } = req.body;
    // employee_number field accepted but not used until schema update

    try {
      // Check if user exists
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM users WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      // Update user (password update requires separate endpoint for security)
      const sql = `UPDATE users
                 SET username = COALESCE(?, username),
                     email = COALESCE(?, email),
                     role = COALESCE(?, role),
                     full_name = COALESCE(?, full_name)
                 WHERE id = ?`;

      db.run(sql, [username, email, role, full_name, id], function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'ユーザー更新に失敗しました' });
        }

        res.json({ message: 'ユーザーが正常に更新されました', changes: this.changes });
      });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

// DELETE user (admin only)
app.delete(
  '/api/v1/users/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('users'),
  (req, res) => {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id, 10) === req.user.id) {
      return res.status(403).json({ error: '自分自身を削除することはできません' });
    }

    db.run('DELETE FROM users WHERE id = ?', [id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'ユーザー削除に失敗しました' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }

      res.json({ message: 'ユーザーが正常に削除されました' });
    });
  }
);

// ===== Dashboard Routes =====

/**
 * @swagger
 * /dashboard/kpi:
 *   get:
 *     summary: ダッシュボードKPI取得
 *     description: ダッシュボードの主要KPI指標を取得します（アクティブインシデント数、SLAコンプライアンス、脆弱性統計、CSF進捗）
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPI取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 active_incidents:
 *                   type: integer
 *                   example: 12
 *                   description: アクティブなインシデント数（Closed以外）
 *                 sla_compliance:
 *                   type: number
 *                   example: 99.8
 *                   description: SLA達成率（%）
 *                 vulnerabilities:
 *                   type: object
 *                   properties:
 *                     critical:
 *                       type: integer
 *                       example: 2
 *                     high:
 *                       type: integer
 *                       example: 5
 *                 csf_progress:
 *                   type: object
 *                   description: NIST CSF 2.0の各機能の進捗率
 *                   properties:
 *                     identify:
 *                       type: integer
 *                       example: 85
 *                     protect:
 *                       type: integer
 *                       example: 78
 *                     detect:
 *                       type: integer
 *                       example: 82
 *                     respond:
 *                       type: integer
 *                       example: 75
 *                     recover:
 *                       type: integer
 *                       example: 70
 *       401:
 *         description: 認証が必要です
 *       500:
 *         description: 内部サーバーエラー
 */
app.get('/api/v1/dashboard/kpi', authenticateJWT, cacheMiddleware, (req, res) => {
  db.get(
    "SELECT count(*) as active_incidents FROM incidents WHERE status != 'Closed'",
    (err, incRow) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      db.all('SELECT * FROM compliance', (dbErr, compRows) => {
        if (dbErr) {
          console.error('Database error:', dbErr);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }

        const csf_progress = {};
        compRows.forEach((row) => {
          csf_progress[row.function.toLowerCase()] = row.progress;
        });

        res.json({
          active_incidents: incRow.active_incidents,
          sla_compliance: 99.8,
          vulnerabilities: { critical: 2, high: 5 },
          csf_progress
        });
      });
    }
  );
});

// ===== Security Dashboard Routes =====

/**
 * GET /api/v1/security/dashboard/overview
 * Security Dashboard KPI Overview
 */
/**
 * @swagger
 * /security/dashboard/overview:
 *   get:
 *     summary: セキュリティダッシュボード概要
 *     description: システム全体のセキュリティ統計（アラート数、監査ログ、ログイン失敗数など）を取得します。
 *     tags: [Security]
 *     responses:
 *       200:
 *         description: ダッシュボード統計データ
 *       403:
 *         description: 権限不足
 */
app.get(
  '/api/v1/security/dashboard/overview',
  authenticateJWT,
  authorize(['admin']), // Note: This line in the replace string might need adjustment if the instruction intended to keep 'admin', 'manager'
  async (req, res) => {
    try {
      // Total alerts
      const totalAlerts = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM security_alerts', (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // Critical alerts
      const criticalAlerts = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM security_alerts WHERE severity = 'Critical'",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // High alerts
      const highAlerts = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM security_alerts WHERE severity = 'High'",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Acknowledged alerts
      const acknowledgedAlerts = await new Promise((resolve, reject) => {
        db.get(
          'SELECT COUNT(*) as count FROM security_alerts WHERE is_acknowledged = 1',
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Total audit logs
      const totalAuditLogs = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM audit_logs', (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // Failed logins in last 24 hours
      const failedLogins24h = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM user_activity WHERE activity_type = 'failed_login' AND created_at >= datetime('now', '-24 hours')",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Active users (logged in within last 24 hours)
      const activeUsers = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(DISTINCT user_id) as count FROM user_activity WHERE activity_type = 'login' AND created_at >= datetime('now', '-24 hours')",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Security incidents open
      const securityIncidentsOpen = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM incidents WHERE is_security_incident = 1 AND status NOT IN ('Closed', 'Resolved')",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Critical vulnerabilities
      const vulnerabilitiesCritical = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM vulnerabilities WHERE severity = 'Critical' AND status NOT IN ('Resolved', 'Mitigated')",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Last 7 days activity
      const loginCount7d = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM user_activity WHERE activity_type = 'login' AND created_at >= datetime('now', '-7 days')",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      const failedLoginCount7d = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM user_activity WHERE activity_type = 'LOGIN_FAILED' AND created_at >= datetime('now', '-7 days')",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      const privilegeChanges7d = await new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM audit_logs WHERE is_security_action = 1 AND action LIKE '%PRIVILEGE%' AND created_at >= datetime('now', '-7 days')",
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      res.json({
        total_alerts: totalAlerts,
        critical_alerts: criticalAlerts,
        high_alerts: highAlerts,
        acknowledged_alerts: acknowledgedAlerts,
        total_audit_logs: totalAuditLogs,
        failed_logins_24h: failedLogins24h,
        active_users: activeUsers,
        security_incidents_open: securityIncidentsOpen,
        vulnerabilities_critical: vulnerabilitiesCritical,
        last_7d_activity: {
          login_count: loginCount7d,
          failed_login_count: failedLoginCount7d,
          privilege_changes: privilegeChanges7d
        }
      });
    } catch (error) {
      console.error('Security dashboard overview error:', error);
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

/**
 * @swagger
 * /security/alerts:
 *   get:
 *     summary: セキュリティアラート一覧
 *     description: フィルタリングとページネーションをサポートしたセキュリティアラート一覧を取得します。
 *     tags: [Security]
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, high, medium, low]
 *       - in: query
 *         name: alert_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_acknowledged
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: アラート一覧とページネーション情報
 */
app.get(
  '/api/v1/security/alerts',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const { page, limit, offset } = parsePaginationParams(req);
    const { severity, alert_type, is_acknowledged } = req.query;

    // Build WHERE clause
    const conditions = [];
    const params = [];

    if (severity) {
      conditions.push('severity = ?');
      params.push(severity);
    }

    if (alert_type) {
      conditions.push('alert_type = ?');
      params.push(alert_type);
    }

    if (is_acknowledged !== undefined) {
      conditions.push('is_acknowledged = ?');
      params.push(is_acknowledged === 'true' || is_acknowledged === '1' ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    db.get(
      `SELECT COUNT(*) as total FROM security_alerts ${whereClause}`,
      params,
      (err, countRow) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }

        // Get paginated data
        const sql = buildPaginationSQL(
          `SELECT
          id, alert_type, severity, description, affected_user_id,
          affected_resource_type, affected_resource_id, source_ip,
          is_acknowledged, acknowledged_by, acknowledged_at, remediation_notes, created_at
        FROM security_alerts ${whereClause}
        ORDER BY created_at DESC`,
          { limit, offset }
        );

        db.all(sql, params, (dbErr, rows) => {
          if (dbErr) {
            console.error('Database error:', dbErr);
            return res.status(500).json({ error: '内部サーバーエラー' });
          }

          res.json({
            data: rows,
            pagination: createPaginationMeta(countRow.total, page, limit)
          });
        });
      }
    );
  }
);

/**
 * @swagger
 * /security/alerts/{id}/acknowledge:
 *   put:
 *     summary: アラートの確認
 *     description: 特定のセキュリティアラートを確認済みにマークし、対応ノートを追加します。
 *     tags: [Security]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: 対応メモ
 *     responses:
 *       200:
 *         description: アラート更新成功
 *       404:
 *         description: アラートが見つかりません
 */
app.put(
  '/api/v1/security/alerts/:id/acknowledge',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const { id } = req.params;
    const { remediation_notes } = req.body || {};

    const sql = `UPDATE security_alerts
               SET is_acknowledged = 1,
                   acknowledged_by = ?,
                   acknowledged_at = CURRENT_TIMESTAMP,
                   remediation_notes = COALESCE(?, remediation_notes)
               WHERE id = ?`;

    db.run(sql, [req.user.username, remediation_notes, id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'アラートが見つかりません' });
      }

      res.json({
        message: 'アラートが確認済みとしてマークされました',
        alert_id: id,
        acknowledged_by: req.user.username
      });
    });
  }
);

/**
 * @swagger
 * /security/audit-logs:
 *   get:
 *     summary: 監査ログ一覧
 *     description: システムの操作履歴（監査ログ）を取得します。高度なフィルタリングをサポートしています。
 *     tags: [Security]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 監査ログ一覧
 */
app.get(
  '/api/v1/security/audit-logs',
  authenticateJWT,
  authorize(['admin']), // Note: This line in the replace string might need adjustment if the instruction intended to keep 'admin', 'manager'
  (req, res) => {
    const { page, limit, offset } = parsePaginationParams(req);
    const {
      user_id,
      user,
      resource_type,
      action,
      is_security_action,
      security_action,
      from_date,
      to_date
    } = req.query;

    // Build WHERE clause
    const conditions = [];
    const params = [];

    if (user_id) {
      conditions.push('audit_logs.user_id = ?');
      params.push(user_id);
    }

    if (user) {
      conditions.push('users.username LIKE ?');
      params.push(`%${user}%`);
    }

    if (resource_type) {
      conditions.push('audit_logs.resource_type = ?');
      params.push(resource_type);
    }

    if (action) {
      conditions.push('audit_logs.action = ?');
      params.push(action);
    }

    const securityParam = is_security_action !== undefined ? is_security_action : security_action;
    if (securityParam !== undefined) {
      conditions.push('audit_logs.is_security_action = ?');
      params.push(securityParam === 'true' || securityParam === '1' ? 1 : 0);
    }

    if (from_date) {
      conditions.push('audit_logs.created_at >= ?');
      params.push(from_date);
    }

    if (to_date) {
      conditions.push('audit_logs.created_at <= ?');
      params.push(to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromClause = 'FROM audit_logs LEFT JOIN users ON audit_logs.user_id = users.id';

    // Get total count
    db.get(`SELECT COUNT(*) as total ${fromClause} ${whereClause}`, params, (err, countRow) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      // Get paginated data
      const sql = buildPaginationSQL(
        `SELECT
            audit_logs.id,
            audit_logs.user_id,
            users.username as user,
            audit_logs.action,
            audit_logs.resource_type,
            audit_logs.resource_id,
            audit_logs.old_values,
            audit_logs.new_values,
            audit_logs.ip_address,
            audit_logs.user_agent,
            audit_logs.is_security_action,
            audit_logs.created_at,
            audit_logs.created_at as timestamp
          ${fromClause} ${whereClause}
          ORDER BY audit_logs.created_at DESC`,
        { limit, offset }
      );

      db.all(sql, params, (dbErr, rows) => {
        if (dbErr) {
          console.error('Database error:', dbErr);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }

        const pagination = createPaginationMeta(countRow.total, page, limit);
        pagination.pages = pagination.totalPages;

        res.json({
          data: rows,
          pagination
        });
      });
    });
  }
);

/**
 * @swagger
 * /security/user-activity/{user_id}:
 *   get:
 *     summary: ユーザーアクティビティログ
 *     description: 特定のユーザーのログイン履歴やアクティビティログを取得します。
 *     tags: [Security]
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: アクティビティ履歴
 */
app.get('/api/v1/security/user-activity/:user_id', authenticateJWT, (req, res) => {
  const { user_id } = req.params;
  const { page, limit, offset } = parsePaginationParams(req);
  const { activity_type, from_date, to_date } = req.query;

  // Check authorization: user can view their own activity, admin/manager can view any
  if (req.user.id !== parseInt(user_id, 10) && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  // Build WHERE clause
  const conditions = ['user_id = ?'];
  const params = [user_id];

  if (activity_type) {
    conditions.push('activity_type = ?');
    params.push(activity_type);
  }

  if (from_date) {
    conditions.push('created_at >= ?');
    params.push(from_date);
  }

  if (to_date) {
    conditions.push('created_at <= ?');
    params.push(to_date);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Get total count
  db.get(`SELECT COUNT(*) as total FROM user_activity ${whereClause}`, params, (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    // Get anomaly count (feature not yet implemented, return 0)
    // const anomalyRow = { count: 0 };

    // Get paginated data
    const sql = buildPaginationSQL(
      `SELECT
          id, user_id, activity_type,
          ip_address, user_agent, success, failure_reason, session_id, created_at
        FROM user_activity ${whereClause}
        ORDER BY created_at DESC`,
      { limit, offset }
    );

    db.all(sql, params, (err2, rows) => {
      if (err2) {
        console.error('Database error:', err2);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit),
        anomalies: [] // 将来的に異常検知機能を実装予定
      });
    });
  });
});

/**
 * @swagger
 * /security/activity-stats:
 *   get:
 *     summary: セキュリティアクティビティ統計
 *     description: ログイン成功/失敗などの傾向を時系列で取得します。
 *     tags: [Security]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 24h
 *     responses:
 *       200:
 *         description: 統計データ
 */
app.get(
  '/api/v1/security/activity-stats',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const { range = '24h', group_by = 'hour' } = req.query;

      // Determine time range
      let timeFilter = "datetime('now', '-24 hours')";
      if (range === '7d') {
        timeFilter = "datetime('now', '-7 days')";
      } else if (range === '30d') {
        timeFilter = "datetime('now', '-30 days')";
      }

      // Login attempts by time
      const loginAttemptsByTime = await new Promise((resolve, reject) => {
        let groupFormat = '%Y-%m-%d %H:00';
        if (group_by === 'day') {
          groupFormat = '%Y-%m-%d';
        }

        db.all(
          `SELECT strftime('${groupFormat}', created_at) as time_bucket, COUNT(*) as count
           FROM user_activity
           WHERE activity_type IN ('login', 'failed_login') AND created_at >= ${timeFilter}
           GROUP BY time_bucket
           ORDER BY time_bucket`,
          (err, rows) => {
            if (err) reject(err);
            else {
              const result = {};
              rows.forEach((row) => {
                result[row.time_bucket] = row.count;
              });
              resolve(result);
            }
          }
        );
      });

      // Failed login attempts
      const failedLoginAttempts = await new Promise((resolve, reject) => {
        let groupFormat = '%Y-%m-%d %H:00';
        if (group_by === 'day') {
          groupFormat = '%Y-%m-%d';
        }

        db.all(
          `SELECT strftime('${groupFormat}', created_at) as time_bucket, COUNT(*) as count
           FROM user_activity
           WHERE activity_type = 'failed_login' AND created_at >= ${timeFilter}
           GROUP BY time_bucket
           ORDER BY time_bucket`,
          (err, rows) => {
            if (err) reject(err);
            else {
              const result = {};
              rows.forEach((row) => {
                result[row.time_bucket] = row.count;
              });
              resolve(result);
            }
          }
        );
      });

      // Top users by activity
      const topUsersByActivity = await new Promise((resolve, reject) => {
        db.all(
          `SELECT u.username, COUNT(*) as activity_count
           FROM user_activity ua
           JOIN users u ON ua.user_id = u.id
           WHERE ua.created_at >= ${timeFilter}
           GROUP BY u.username
           ORDER BY activity_count DESC
           LIMIT 10`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Top IPs
      const topIps = await new Promise((resolve, reject) => {
        db.all(
          `SELECT ip_address, COUNT(*) as request_count
           FROM audit_logs
           WHERE created_at >= ${timeFilter} AND ip_address IS NOT NULL
           GROUP BY ip_address
           ORDER BY request_count DESC
           LIMIT 10`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Privilege changes count
      const privilegeChangesCount = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count
           FROM audit_logs
           WHERE is_security_action = 1 AND action LIKE '%PRIVILEGE%' AND created_at >= ${timeFilter}`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Security changes count
      const securityChangesCount = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count
           FROM audit_logs
           WHERE is_security_action = 1 AND created_at >= ${timeFilter}`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // 統計情報を計算（loginAttemptsByTimeとfailedLoginAttemptsはオブジェクト形式）
      const loginValues = Object.values(loginAttemptsByTime);
      const failedValues = Object.values(failedLoginAttempts);

      const totalActivities = loginValues.reduce((sum, count) => sum + count, 0);
      const totalFailedLogins = failedValues.reduce((sum, count) => sum + count, 0);
      const successfulLogins = Math.max(0, totalActivities - totalFailedLogins);

      // オブジェクトを配列形式に変換
      const loginAttemptsByTimeArray = Object.entries(loginAttemptsByTime).map(([hour, count]) => ({
        hour,
        count
      }));
      const failedLoginAttemptsArray = Object.entries(failedLoginAttempts).map(([hour, count]) => ({
        hour,
        count
      }));

      res.json({
        // テストが期待する形式
        total_activities: totalActivities,
        successful_logins: successfulLogins,
        failed_logins: totalFailedLogins,
        activities_by_type: [
          { type: 'login', count: totalActivities },
          { type: 'failed_login', count: totalFailedLogins }
        ],
        activities_by_user: topUsersByActivity,
        // 既存のフィールドも保持（配列形式に変換）
        login_attempts_by_time: loginAttemptsByTimeArray,
        failed_login_attempts: failedLoginAttemptsArray,
        top_ips: topIps,
        privilege_changes_count: privilegeChangesCount,
        security_changes_count: securityChangesCount
      });
    } catch (error) {
      console.error('Activity stats error:', error);
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

// ===== Incident Routes =====

/**
 * @swagger
 * /incidents:
 *   get:
 *     summary: インシデント一覧取得
 *     description: 全てのインシデントを作成日時の降順で取得します
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: インシデント一覧取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ticket_id:
 *                     type: string
 *                     example: INC-123456
 *                   title:
 *                     type: string
 *                     example: システムログインエラー
 *                   priority:
 *                     type: string
 *                     enum: [Critical, High, Medium, Low]
 *                     example: High
 *                   status:
 *                     type: string
 *                     enum: [New, In Progress, Resolved, Closed]
 *                     example: In Progress
 *                   description:
 *                     type: string
 *                   is_security_incident:
 *                     type: integer
 *                     example: 0
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: 認証が必要です
 *       500:
 *         description: 内部サーバーエラー
 */
app.get('/api/v1/incidents', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  // 総件数取得
  db.get('SELECT COUNT(*) as total FROM incidents', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    // SELECT句最適化 + ページネーション
    const sql = buildPaginationSQL(
      `SELECT
        ticket_id, title, priority, status,
        is_security_incident, created_at
      FROM incidents
      ORDER BY created_at DESC`,
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.get('/api/v1/incidents/:id', authenticateJWT, cacheMiddleware, (req, res) => {
  db.get('SELECT * FROM incidents WHERE ticket_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    if (!row) return res.status(404).json({ error: 'インシデントが見つかりません' });
    res.json(row);
  });
});

/**
 * @swagger
 * /incidents:
 *   post:
 *     summary: インシデント作成
 *     description: 新規インシデントを作成します（admin/manager/analyst権限が必要）
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - priority
 *             properties:
 *               title:
 *                 type: string
 *                 example: システムログインエラー
 *                 description: インシデントのタイトル
 *               priority:
 *                 type: string
 *                 enum: [Critical, High, Medium, Low]
 *                 example: High
 *                 description: 優先度
 *               status:
 *                 type: string
 *                 enum: [New, In Progress, Resolved, Closed]
 *                 default: New
 *                 example: New
 *               description:
 *                 type: string
 *                 example: ユーザーがログインできない問題が発生しています
 *               is_security_incident:
 *                 type: integer
 *                 default: 0
 *                 example: 0
 *                 description: セキュリティインシデントかどうか（0 or 1）
 *     responses:
 *       201:
 *         description: インシデント作成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: インシデントが正常に作成されました
 *                 id:
 *                   type: string
 *                   example: INC-123456
 *                 created_by:
 *                   type: string
 *                   example: admin
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証が必要です
 *       403:
 *         description: 権限がありません
 *       500:
 *         description: 内部サーバーエラー
 */
app.post(
  '/api/v1/incidents',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  incidentValidation.create,
  validate,
  auditLog,
  invalidateCacheMiddleware('incidents'),
  (req, res) => {
    const { title, priority, status = 'New', description, is_security_incident = 0 } = req.body;
    const ticket_id = `INC-${Date.now().toString().slice(-6)}`;
    const sql =
      'INSERT INTO incidents (ticket_id, title, priority, status, description, is_security_incident) VALUES (?, ?, ?, ?, ?, ?)';

    db.run(
      sql,
      [ticket_id, title, priority, status, description, is_security_incident],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: 'インシデントが正常に作成されました',
          id: ticket_id,
          created_by: req.user.username
        });
      }
    );
  }
);

/**
 * @swagger
 * /incidents/{id}:
 *   put:
 *     summary: インシデント更新
 *     description: 既存のインシデントを更新します（admin/manager/analyst権限が必要）
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: インシデントID（ticket_id）
 *         example: INC-123456
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [New, In Progress, Resolved, Closed]
 *                 example: Resolved
 *               priority:
 *                 type: string
 *                 enum: [Critical, High, Medium, Low]
 *                 example: Medium
 *               title:
 *                 type: string
 *                 example: システムログインエラー（修正済み）
 *               description:
 *                 type: string
 *                 example: 問題は解決されました
 *     responses:
 *       200:
 *         description: インシデント更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: インシデントが正常に更新されました
 *                 changes:
 *                   type: integer
 *                   example: 1
 *                 updated_by:
 *                   type: string
 *                   example: admin
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証が必要です
 *       403:
 *         description: 権限がありません
 *       500:
 *         description: 内部サーバーエラー
 */
app.put(
  '/api/v1/incidents/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  incidentValidation.update,
  validate,
  auditLog,
  invalidateCacheMiddleware('incidents'),
  (req, res) => {
    const { status, priority, title, description } = req.body;
    const sql = `UPDATE incidents SET
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        title = COALESCE(?, title),
        description = COALESCE(?, description)
        WHERE ticket_id = ?`;

    db.run(sql, [status, priority, title, description, req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      // Logic: If a security incident is RESOLVED, increase RESPOND and RECOVER progress
      if (status === 'Resolved') {
        db.get(
          'SELECT is_security_incident FROM incidents WHERE ticket_id = ?',
          [req.params.id],
          (lookupErr, row) => {
            if (row && row.is_security_incident) {
              db.run(
                "UPDATE compliance SET progress = MIN(100, progress + 2) WHERE function IN ('RESPOND', 'RECOVER')"
              );
            }
          }
        );
      }

      res.json({
        message: 'インシデントが正常に更新されました',
        changes: this.changes,
        updated_by: req.user.username
      });
    });
  }
);

/**
 * @swagger
 * /incidents/{id}:
 *   delete:
 *     summary: インシデント削除
 *     description: 既存のインシデントを削除します（admin/manager権限が必要）
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: インシデントID（ticket_id）
 *         example: INC-123456
 *     responses:
 *       200:
 *         description: インシデント削除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: インシデントが正常に削除されました
 *                 deleted_by:
 *                   type: string
 *                   example: admin
 *       401:
 *         description: 認証が必要です
 *       403:
 *         description: 権限がありません
 *       404:
 *         description: インシデントが見つかりません
 *       500:
 *         description: 内部サーバーエラー
 */
app.delete(
  '/api/v1/incidents/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('incidents'),
  (req, res) => {
    db.run('DELETE FROM incidents WHERE ticket_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'インシデントが見つかりません' });
      }
      res.json({ message: 'インシデントが正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== Asset Routes =====

app.get('/api/v1/assets', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM assets', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      `SELECT
        asset_tag, name, type, criticality, status
      FROM assets
      ORDER BY asset_tag ASC`,
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.post(
  '/api/v1/assets',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('assets'),
  (req, res) => {
    const { asset_tag, name, type, criticality = 3, status = 'Operational' } = req.body;

    if (!asset_tag || !name) {
      return res.status(400).json({ error: '資産タグと名称は必須です' });
    }

    const sql = `INSERT INTO assets (asset_tag, name, type, criticality, status, last_updated)
               VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

    db.run(sql, [asset_tag, name, type, criticality, status], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      res.status(201).json({
        message: '資産が正常に登録されました',
        asset_tag,
        created_by: req.user.username
      });
    });
  }
);

app.put(
  '/api/v1/assets/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('assets'),
  (req, res) => {
    const { name, type, criticality, status } = req.body;
    const sql = `UPDATE assets SET
    name = COALESCE(?, name),
    type = COALESCE(?, type),
    criticality = COALESCE(?, criticality),
    status = COALESCE(?, status),
    last_updated = CURRENT_TIMESTAMP
    WHERE asset_tag = ?`;

    db.run(sql, [name, type, criticality, status, req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '資産が見つかりません' });
      }
      res.json({
        message: '資産が正常に更新されました',
        changes: this.changes,
        updated_by: req.user.username
      });
    });
  }
);

app.delete(
  '/api/v1/assets/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('assets'),
  (req, res) => {
    db.run('DELETE FROM assets WHERE asset_tag = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '資産が見つかりません' });
      }
      res.json({ message: '資産が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== Problem Management Routes =====

app.get('/api/v1/problems', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM problems', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT problem_id, title, status, priority, related_incidents, assignee, created_at, resolved_at FROM problems ORDER BY created_at DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.post(
  '/api/v1/problems',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('problems'),
  (req, res) => {
    const { title, description, priority = 'Medium', related_incidents = 0, assignee } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'タイトルは必須です' });
    }

    const problem_id = `PRB-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO problems (problem_id, title, description, status, priority, related_incidents, assignee)
               VALUES (?, ?, ?, 'Open', ?, ?, ?)`;

    db.run(
      sql,
      [problem_id, title, description, priority, related_incidents, assignee || req.user.username],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: '問題が正常に作成されました',
          id: problem_id,
          created_by: req.user.username
        });
      }
    );
  }
);

app.put(
  '/api/v1/problems/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('problems'),
  (req, res) => {
    const { title, description, status, priority, root_cause, assignee } = req.body;
    const sql = `UPDATE problems SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    status = COALESCE(?, status),
    priority = COALESCE(?, priority),
    root_cause = COALESCE(?, root_cause),
    assignee = COALESCE(?, assignee),
    resolved_at = CASE WHEN ? = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END
    WHERE problem_id = ?`;

    db.run(
      sql,
      [title, description, status, priority, root_cause, assignee, status, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '問題が見つかりません' });
        }
        res.json({
          message: '問題が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

app.delete(
  '/api/v1/problems/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('problems'),
  (req, res) => {
    db.run('DELETE FROM problems WHERE problem_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '問題が見つかりません' });
      }
      res.json({ message: '問題が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== Release Management Routes =====

app.get('/api/v1/releases', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM releases', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT release_id, name, version, status, release_date, change_count, target_environment, progress, created_at FROM releases ORDER BY created_at DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.post(
  '/api/v1/releases',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('releases'),
  (req, res) => {
    const {
      name,
      version,
      description,
      target_environment,
      release_date,
      change_count = 0
    } = req.body;

    if (!name || !version) {
      return res.status(400).json({ error: 'リリース名とバージョンは必須です' });
    }

    const release_id = `REL-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO releases (release_id, name, version, description, status, release_date, change_count, target_environment, progress, created_at)
               VALUES (?, ?, ?, ?, 'Planned', ?, ?, ?, 0, CURRENT_TIMESTAMP)`;

    db.run(
      sql,
      [release_id, name, version, description, release_date, change_count, target_environment],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: 'リリースが正常に作成されました',
          id: release_id,
          created_by: req.user.username
        });
      }
    );
  }
);

app.put(
  '/api/v1/releases/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('releases'),
  (req, res) => {
    const {
      name,
      version,
      description,
      status,
      release_date,
      target_environment,
      progress,
      change_count
    } = req.body;
    const sql = `UPDATE releases SET
    name = COALESCE(?, name),
    version = COALESCE(?, version),
    description = COALESCE(?, description),
    status = COALESCE(?, status),
    release_date = COALESCE(?, release_date),
    target_environment = COALESCE(?, target_environment),
    progress = COALESCE(?, progress),
    change_count = COALESCE(?, change_count)
    WHERE release_id = ?`;

    db.run(
      sql,
      [
        name,
        version,
        description,
        status,
        release_date,
        target_environment,
        progress,
        change_count,
        req.params.id
      ],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'リリースが見つかりません' });
        }
        res.json({
          message: 'リリースが正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

app.delete(
  '/api/v1/releases/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('releases'),
  (req, res) => {
    db.run('DELETE FROM releases WHERE release_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'リリースが見つかりません' });
      }
      res.json({ message: 'リリースが正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== Service Request Routes =====

app.get('/api/v1/service-requests', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM service_requests', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT request_id, request_type, title, requester, status, priority, created_at FROM service_requests ORDER BY created_at DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.post(
  '/api/v1/service-requests',
  authenticateJWT,
  invalidateCacheMiddleware('service-requests'),
  (req, res) => {
    const { request_type, title, description, priority = 'Medium', requester } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'タイトルと説明は必須です' });
    }

    const request_id = `SR-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO service_requests (request_id, request_type, title, description, requester, status, priority, created_at)
               VALUES (?, ?, ?, ?, ?, 'New', ?, CURRENT_TIMESTAMP)`;

    db.run(
      sql,
      [request_id, request_type, title, description, requester || req.user.username, priority],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: 'サービス要求が正常に作成されました',
          id: request_id,
          created_by: req.user.username
        });
      }
    );
  }
);

app.put(
  '/api/v1/service-requests/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('service-requests'),
  (req, res) => {
    const { request_type, title, description, status, priority } = req.body;
    const sql = `UPDATE service_requests SET
    request_type = COALESCE(?, request_type),
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    status = COALESCE(?, status),
    priority = COALESCE(?, priority),
    completed_at = CASE WHEN ? = 'Completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
    WHERE request_id = ?`;

    db.run(
      sql,
      [request_type, title, description, status, priority, status, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'サービス要求が見つかりません' });
        }
        res.json({
          message: 'サービス要求が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

app.delete(
  '/api/v1/service-requests/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('service-requests'),
  (req, res) => {
    db.run('DELETE FROM service_requests WHERE request_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'サービス要求が見つかりません' });
      }
      res.json({ message: 'サービス要求が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== SLA Management Routes =====

app.get('/api/v1/sla-agreements', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM sla_agreements', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT sla_id, service_name, metric_name, target_value, actual_value, achievement_rate, status, measurement_period FROM sla_agreements ORDER BY created_at DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.put(
  '/api/v1/sla-agreements/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('sla-agreements'),
  (req, res) => {
    const {
      service_name,
      metric_name,
      target_value,
      actual_value,
      achievement_rate,
      status,
      measurement_period
    } = req.body;
    const sql = `UPDATE sla_agreements SET
    service_name = COALESCE(?, service_name),
    metric_name = COALESCE(?, metric_name),
    target_value = COALESCE(?, target_value),
    actual_value = COALESCE(?, actual_value),
    achievement_rate = COALESCE(?, achievement_rate),
    status = COALESCE(?, status),
    measurement_period = COALESCE(?, measurement_period)
    WHERE sla_id = ?`;

    db.run(
      sql,
      [
        service_name,
        metric_name,
        target_value,
        actual_value,
        achievement_rate,
        status,
        measurement_period,
        req.params.id
      ],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'SLA契約が見つかりません' });
        }
        res.json({
          message: 'SLA契約が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

app.delete(
  '/api/v1/sla-agreements/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('sla-agreements'),
  (req, res) => {
    db.run('DELETE FROM sla_agreements WHERE sla_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'SLA契約が見つかりません' });
      }
      res.json({ message: 'SLA契約が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== Knowledge Management Routes =====

app.get('/api/v1/knowledge-articles', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM knowledge_articles', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT article_id, title, category, view_count, rating, author, status, created_at, updated_at FROM knowledge_articles ORDER BY view_count DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.put(
  '/api/v1/knowledge-articles/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('knowledge-articles'),
  (req, res) => {
    const { title, content, category, status, author } = req.body;
    const sql = `UPDATE knowledge_articles SET
    title = COALESCE(?, title),
    content = COALESCE(?, content),
    category = COALESCE(?, category),
    status = COALESCE(?, status),
    author = COALESCE(?, author),
    updated_at = CURRENT_TIMESTAMP
    WHERE article_id = ?`;

    db.run(sql, [title, content, category, status, author, req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'ナレッジ記事が見つかりません' });
      }
      res.json({
        message: 'ナレッジ記事が正常に更新されました',
        changes: this.changes,
        updated_by: req.user.username
      });
    });
  }
);

app.delete(
  '/api/v1/knowledge-articles/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('knowledge-articles'),
  (req, res) => {
    db.run('DELETE FROM knowledge_articles WHERE article_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'ナレッジ記事が見つかりません' });
      }
      res.json({ message: 'ナレッジ記事が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== Capacity Management Routes =====

app.get('/api/v1/capacity-metrics', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM capacity_metrics', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT metric_id, resource_name, resource_type, current_usage, threshold, forecast_3m, status, unit, measured_at FROM capacity_metrics ORDER BY measured_at DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.put(
  '/api/v1/capacity-metrics/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('capacity-metrics'),
  (req, res) => {
    const { resource_name, resource_type, current_usage, threshold, forecast_3m, unit } = req.body;

    // Determine status based on usage and threshold
    let status = null;
    if (current_usage !== undefined && threshold !== undefined) {
      if (current_usage >= threshold) {
        status = 'Critical';
      } else if (current_usage >= threshold * 0.8) {
        status = 'Warning';
      } else {
        status = 'Normal';
      }
    }

    const sql = `UPDATE capacity_metrics SET
    resource_name = COALESCE(?, resource_name),
    resource_type = COALESCE(?, resource_type),
    current_usage = COALESCE(?, current_usage),
    threshold = COALESCE(?, threshold),
    forecast_3m = COALESCE(?, forecast_3m),
    status = COALESCE(?, status),
    unit = COALESCE(?, unit),
    measured_at = CURRENT_TIMESTAMP
    WHERE metric_id = ?`;

    db.run(
      sql,
      [
        resource_name,
        resource_type,
        current_usage,
        threshold,
        forecast_3m,
        status,
        unit,
        req.params.id
      ],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'キャパシティメトリクスが見つかりません' });
        }
        res.json({
          message: 'キャパシティメトリクスが正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

app.delete(
  '/api/v1/capacity-metrics/:id',
  authenticateJWT,
  authorize(['admin']),
  invalidateCacheMiddleware('capacity-metrics'),
  (req, res) => {
    db.run('DELETE FROM capacity_metrics WHERE metric_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'キャパシティメトリクスが見つかりません' });
      }
      res.json({
        message: 'キャパシティメトリクスが正常に削除されました',
        deleted_by: req.user.username
      });
    });
  }
);

// ===== Vulnerability Management Routes =====

app.get('/api/v1/vulnerabilities', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM vulnerabilities', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT vulnerability_id, title, severity, cvss_score, affected_asset, status, detection_date FROM vulnerabilities ORDER BY cvss_score DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.post(
  '/api/v1/vulnerabilities',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { title, description, severity = 'Medium', cvss_score = 0, affected_asset } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'タイトルは必須です' });
    }

    const vulnerability_id = `CVE-${Date.now().toString().slice(-8)}`;
    const sql = `INSERT INTO vulnerabilities (vulnerability_id, title, description, severity, cvss_score, affected_asset, status, detection_date)
               VALUES (?, ?, ?, ?, ?, ?, 'Open', CURRENT_TIMESTAMP)`;

    db.run(
      sql,
      [vulnerability_id, title, description, severity, cvss_score, affected_asset],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: '脆弱性が正常に登録されました',
          id: vulnerability_id,
          created_by: req.user.username
        });
      }
    );
  }
);

app.put(
  '/api/v1/vulnerabilities/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  auditLog,
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    const { title, description, severity, cvss_score, affected_asset, status } = req.body;
    const sql = `UPDATE vulnerabilities SET
    title = COALESCE(?, title),
    description = COALESCE(?, description),
    severity = COALESCE(?, severity),
    cvss_score = COALESCE(?, cvss_score),
    affected_asset = COALESCE(?, affected_asset),
    status = COALESCE(?, status),
    resolution_date = CASE WHEN ? = 'Resolved' THEN CURRENT_TIMESTAMP ELSE resolution_date END
    WHERE vulnerability_id = ?`;

    db.run(
      sql,
      [title, description, severity, cvss_score, affected_asset, status, status, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '脆弱性が見つかりません' });
        }
        res.json({
          message: '脆弱性が正常に更新されました',
          changes: this.changes,
          updated_by: req.user.username
        });
      }
    );
  }
);

app.delete(
  '/api/v1/vulnerabilities/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {
    db.run(
      'DELETE FROM vulnerabilities WHERE vulnerability_id = ?',
      [req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: '脆弱性が見つかりません' });
        }
        res.json({ message: '脆弱性が正常に削除されました', deleted_by: req.user.username });
      }
    );
  }
);

// ===== NIST CSF 2.0 Integration Routes =====

const NistCsfMapper = require('./utils/nistCsfMapper');

/**
 * @swagger
 * /compliance/nist-csf/progress:
 *   get:
 *     summary: NIST CSF 2.0準拠進捗
 *     description: NIST CSFの各コア機能（GOVERN, IDENTIFY等）の現在の進捗状況を取得します。
 *     tags: [Compliance]
 *     responses:
 *       200:
 *         description: 進捗状況データ
 */
app.get(
  '/api/v1/compliance/nist-csf/progress',
  authenticateJWT,
  cacheMiddleware,
  async (req, res) => {
    try {
      const progress = await NistCsfMapper.getCsfProgress();
      res.json(progress);
    } catch (error) {
      console.error('[NIST CSF] Failed to get progress:', error);
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

/**
 * @swagger
 * /vulnerabilities/{id}/nist-csf:
 *   patch:
 *     summary: 脆弱性のNIST CSFマッピング更新
 *     description: 特定の脆弱性をNIST CSFのコア機能やカテゴリにマッピングします。
 *     tags: [Security]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               function:
 *                 type: string
 *                 enum: [GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER]
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: マッピング更新成功
 */
app.patch(
  '/api/v1/vulnerabilities/:id/nist-csf',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('vulnerabilities'),
  async (req, res) => {
    try {
      const { function: csfFunction, category } = req.body;

      // バリデーション
      const validFunctions = ['GOVERN', 'IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'];
      if (csfFunction && !validFunctions.includes(csfFunction)) {
        return res.status(400).json({
          error: '無効なNIST CSF機能',
          valid_values: validFunctions
        });
      }

      // 脆弱性の存在確認
      db.get(
        'SELECT id FROM vulnerabilities WHERE vulnerability_id = ?',
        [req.params.id],
        (err, vuln) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: '内部サーバーエラー' });
          }
          if (!vuln) {
            return res.status(404).json({ error: '脆弱性が見つかりません' });
          }

          // NIST CSFマッピング更新
          db.run(
            `UPDATE vulnerabilities
           SET nist_csf_function = ?, nist_csf_category = ?
           WHERE id = ?`,
            [csfFunction || null, category || null, vuln.id],
            async function (updateErr) {
              if (updateErr) {
                console.error('Database error:', updateErr);
                return res.status(500).json({ error: '内部サーバーエラー' });
              }

              // CSF進捗を再計算
              try {
                const result = await NistCsfMapper.updateCsfProgress(vuln.id);
                res.json({
                  success: true,
                  message: 'NIST CSFマッピングを更新しました',
                  csf_mapping: result.csf_mapping,
                  csf_progress: result.csf_progress
                });
              } catch (progressErr) {
                console.error('[NIST CSF] Failed to update progress:', progressErr);
                // マッピングは成功したが進捗更新が失敗した場合も200を返す
                res.json({
                  success: true,
                  message: 'NIST CSFマッピングを更新しました（進捗計算は保留）',
                  warning: '進捗の再計算に失敗しました'
                });
              }
            }
          );
        }
      );
    } catch (error) {
      console.error('[NIST CSF] Mapping update failed:', error);
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

/**
 * @swagger
 * /compliance/nist-csf/report:
 *   get:
 *     summary: NIST CSF 2.0 準拠レポート取得
 *     description: 全体的なスコアと各機能ごとの詳細なレポートを生成します。
 *     tags: [Compliance]
 *     responses:
 *       200:
 *         description: 詳細レポートデータ
 */
app.get(
  '/api/v1/compliance/nist-csf/report',
  authenticateJWT,
  authorize(['admin', 'manager']),
  async (req, res) => {
    try {
      const report = await NistCsfMapper.generateComplianceReport();
      res.json(report);
    } catch (error) {
      console.error('[NIST CSF] Report generation failed:', error);
      res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

// ===== CVSS 3.1 Calculation API =====

const cvssCalculator = require('./utils/cvssCalculator');

/**
 * @swagger
 * /vulnerabilities/cvss/calculate:
 *   post:
 *     summary: CVSS v3.1 スコア計算
 *     description: 基本評価基準メトリクスからCVSSスコアを計算します。
 *     tags: [Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metrics:
 *                 type: object
 *                 properties:
 *                   attackVector: { type: string, enum: [N, A, L, P] }
 *                   attackComplexity: { type: string, enum: [L, H] }
 *                   privilegesRequired: { type: string, enum: [N, L, H] }
 *                   userInteraction: { type: string, enum: [N, R] }
 *                   scope: { type: string, enum: [U, C] }
 *                   confidentialityImpact: { type: string, enum: [N, L, H] }
 *                   integrityImpact: { type: string, enum: [N, L, H] }
 *                   availabilityImpact: { type: string, enum: [N, L, H] }
 *     responses:
 *       200:
 *         description: 計算結果
 */
app.post('/api/v1/vulnerabilities/cvss/calculate', (req, res) => {
  try {
    const { metrics } = req.body;
    const result = cvssCalculator.calculateCvss(metrics);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /vulnerabilities/{id}/cvss:
 *   patch:
 *     summary: 脆弱性のCVSSスコア更新
 *     description: 特定の脆弱性のCVSSスコアとベクターを更新します。
 *     tags: [Security]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cvss_score: { type: number }
 *               cvss_vector: { type: string }
 *               severity: { type: string }
 *     responses:
 *       200:
 *         description: 更新成功
 */
app.patch(
  '/api/v1/vulnerabilities/:id/cvss',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('vulnerabilities'),
  (req, res) => {

    const { cvss_score, cvss_vector, severity } = req.body;

    if (cvss_score === undefined || !cvss_vector) {
      return res.status(400).json({ error: 'cvss_scoreとcvss_vectorが必要です' });
    }

    // CVSS score validation (0.0 - 10.0)
    if (cvss_score < 0 || cvss_score > 10) {
      return res.status(400).json({ error: 'CVSSスコアは0.0-10.0の範囲である必要があります' });
    }

    db.run(
      `UPDATE vulnerabilities
       SET cvss_score = ?, cvss_vector = ?, severity = ?
       WHERE vulnerability_id = ?`,
      [cvss_score, cvss_vector, severity || null, req.params.id],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }

        if (this.changes === 0) {
          return res.status(404).json({ error: '脆弱性が見つかりません' });
        }

        res.json({
          success: true,
          message: 'CVSSスコアを更新しました',
          vulnerability_id: req.params.id,
          cvss_score,
          cvss_vector,
          severity
        });
      }
    );
  }
);

// ===== Change Management Routes =====

/**
 * @swagger
 * /changes:
 *   get:
 *     summary: 変更要求一覧取得
 *     description: 全ての変更要求（RFC）を作成日時の降順で取得します
 *     tags: [Change Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 変更要求一覧取得成功
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   rfc_id:
 *                     type: string
 *                     example: RFC-A1B2C3D4
 *                   title:
 *                     type: string
 *                     example: データベースサーバーのアップグレード
 *                   description:
 *                     type: string
 *                   asset_tag:
 *                     type: string
 *                     example: SRV-001
 *                   status:
 *                     type: string
 *                     enum: [Pending, Approved, Rejected, Implementing, Completed]
 *                     example: Pending
 *                   requester:
 *                     type: string
 *                     example: admin
 *                   is_security_change:
 *                     type: integer
 *                     example: 1
 *                   impact_level:
 *                     type: string
 *                     example: High
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: 認証が必要です
 *       500:
 *         description: 内部サーバーエラー
 */
app.get('/api/v1/changes', authenticateJWT, cacheMiddleware, (req, res) => {
  const { page, limit, offset } = parsePaginationParams(req);

  db.get('SELECT COUNT(*) as total FROM changes', (err, countRow) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }

    const sql = buildPaginationSQL(
      'SELECT rfc_id, title, asset_tag, status, requester, approver, is_security_change, impact_level, created_at FROM changes ORDER BY created_at DESC',
      { limit, offset }
    );

    db.all(sql, (dbErr, rows) => {
      if (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      res.json({
        data: rows,
        pagination: createPaginationMeta(countRow.total, page, limit)
      });
    });
  });
});

app.post(
  '/api/v1/changes',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  changeValidation.create,
  validate,
  auditLog,
  invalidateCacheMiddleware('changes'),
  (req, res) => {
    const {
      title,
      description,
      asset_tag,
      requester,
      is_security_change = 0,
      impact_level
    } = req.body;
    const rfc_id = `RFC-${uuidv4().split('-')[0].toUpperCase()}`;
    const sql =
      'INSERT INTO changes (rfc_id, title, description, asset_tag, status, requester, is_security_change, impact_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    db.run(
      sql,
      [
        rfc_id,
        title,
        description,
        asset_tag,
        'Pending',
        requester,
        is_security_change,
        impact_level
      ],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: '変更要求が正常に作成されました',
          id: rfc_id,
          created_by: req.user.username
        });
      }
    );
  }
);

/**
 * @swagger
 * /changes/{id}:
 *   put:
 *     summary: RFC承認/更新
 *     description: 変更要求（RFC）を承認または更新します（admin/manager権限が必要）
 *     tags: [Change Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RFC ID
 *         example: RFC-A1B2C3D4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Approved, Rejected, Implementing, Completed]
 *                 example: Approved
 *                 description: 変更ステータス
 *               approver:
 *                 type: string
 *                 example: manager01
 *                 description: 承認者（省略時は現在のユーザー）
 *     responses:
 *       200:
 *         description: RFC更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 変更要求が正常に更新されました
 *                 changes:
 *                   type: integer
 *                   example: 1
 *                 approved_by:
 *                   type: string
 *                   example: manager01
 *       400:
 *         description: バリデーションエラー
 *       401:
 *         description: 認証が必要です
 *       403:
 *         description: 権限がありません
 *       500:
 *         description: 内部サーバーエラー
 */
app.put(
  '/api/v1/changes/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  changeValidation.update,
  validate,
  auditLog,
  invalidateCacheMiddleware('changes'),
  (req, res) => {
    const { status, approver } = req.body;
    const sql = 'UPDATE changes SET status = ?, approver = ? WHERE rfc_id = ?';

    db.run(sql, [status, approver || req.user.username, req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      res.json({
        message: '変更要求が正常に更新されました',
        changes: this.changes,
        approved_by: approver || req.user.username
      });
    });
  }
);

app.delete(
  '/api/v1/changes/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('changes'),
  (req, res) => {
    db.run('DELETE FROM changes WHERE rfc_id = ?', [req.params.id], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '変更要求が見つかりません' });
      }
      res.json({ message: '変更要求が正常に削除されました', deleted_by: req.user.username });
    });
  }
);

// ===== SLA Agreements API =====

app.post(
  '/api/v1/sla-agreements',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('sla-agreements'),
  (req, res) => {
    const { service_name, metric_name, target_value } = req.body;

    if (!service_name || !metric_name || !target_value) {
      return res.status(400).json({ error: '必須フィールドが入力されていません' });
    }

    const sla_id = `SLA-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO sla_agreements (sla_id, service_name, metric_name, target_value, actual_value, achievement_rate, status, measurement_period)
               VALUES (?, ?, ?, ?, '0', 0, 'Met', 'Monthly')`;

    db.run(sql, [sla_id, service_name, metric_name, target_value], function (err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }
      res.status(201).json({
        message: 'SLA契約が正常に作成されました',
        sla_id,
        id: this.lastID
      });
    });
  }
);

// ===== Knowledge Articles API =====

app.post(
  '/api/v1/knowledge-articles',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  invalidateCacheMiddleware('knowledge-articles'),
  (req, res) => {
    const { title, category, content, author } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'タイトルと内容は必須です' });
    }

    const article_id = `KB-${Date.now().toString().slice(-6)}`;
    const sql = `INSERT INTO knowledge_articles (article_id, title, content, category, view_count, rating, author, status)
               VALUES (?, ?, ?, ?, 0, 0, ?, 'Published')`;

    db.run(
      sql,
      [article_id, title, content, category || 'その他', author || 'Unknown'],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: 'ナレッジ記事が正常に作成されました',
          article_id,
          id: this.lastID
        });
      }
    );
  }
);

// ===== Capacity Metrics API =====

app.post(
  '/api/v1/capacity-metrics',
  authenticateJWT,
  authorize(['admin', 'manager']),
  invalidateCacheMiddleware('capacity-metrics'),
  (req, res) => {
    const { resource_name, resource_type, current_usage, threshold } = req.body;

    if (!resource_name) {
      return res.status(400).json({ error: 'リソース名は必須です' });
    }

    const metric_id = `CAP-${Date.now().toString().slice(-6)}`;
    const usage = current_usage !== undefined ? current_usage : 0;
    const thresh = threshold !== undefined ? threshold : 80;

    // Determine status based on usage and threshold
    let status = 'Normal';
    if (usage >= thresh) {
      status = 'Critical';
    } else if (usage >= thresh * 0.8) {
      status = 'Warning';
    }

    const sql = `INSERT INTO capacity_metrics (metric_id, resource_name, resource_type, current_usage, threshold, forecast_3m, status, unit)
               VALUES (?, ?, ?, ?, ?, 0, ?, '%')`;

    db.run(
      sql,
      [metric_id, resource_name, resource_type || 'CPU', usage, thresh, status],
      function (err) {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.status(201).json({
          message: 'キャパシティメトリクスが正常に登録されました',
          metric_id,
          id: this.lastID,
          status
        });
      }
    );
  }
);

// ===== Health Check (No Auth Required) =====

// Basic health check (legacy compatibility)
app.get('/api/v1/health', healthRoutes.basic);

// Liveness probe (Kubernetes-style)
app.get('/api/v1/health/live', healthRoutes.liveness);

// Readiness probe (Kubernetes-style)
app.get('/api/v1/health/ready', healthRoutes.readiness);

// ===== Prometheus Metrics Endpoint (No Auth Required) =====

app.get('/metrics', metricsEndpoint);

// ===== Two-Factor Authentication Routes =====

app.use('/api/v1/auth/2fa', twoFactorAuthRoutes);

// ===== Password Reset Routes =====

const passwordResetRoutes = require('./routes/auth/passwordReset');

app.use('/api/v1/auth', passwordResetRoutes);

// ===== Data Export Routes =====

const exportRoutes = require('./routes/export');

app.use('/api/v1/export', exportRoutes);

// ===== Swagger API Documentation =====
const swaggerSpec = require('./swagger');

// Swagger JSON endpoint
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use('/api-docs', swaggerUi.serve);
app.get(
  '/api-docs',
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ITSM API Documentation'
  })
);

// ===== Cache Statistics Endpoint =====
app.get('/api/v1/cache/stats', authenticateJWT, authorize(['admin']), (req, res) => {
  res.json(getCacheStats());
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'エンドポイントが見つかりません' });
});

// Error Handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '内部サーバーエラー' });
});

// Export app for testing
module.exports = { app, dbReady };

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const enableHttps = process.env.ENABLE_HTTPS === 'true';

  if (enableHttps) {
    // HTTPS Server with server-https module
    // eslint-disable-next-line global-require
    const { startHttpsServer } = require('./server-https');
    // Servers are managed by server-https module
    // eslint-disable-next-line no-unused-vars
    const { httpsServer, httpServer } = startHttpsServer(app);

    console.log('🔒 HTTPS Mode Enabled');
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🔒 Security: helmet enabled, CORS configured, TLS 1.2/1.3 enforced');
  } else {
    // HTTP Server (Development/Testing)
    const HOST = process.env.HOST || '0.0.0.0';

    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server is running on ${HOST}:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('🔒 Security: helmet enabled, CORS configured');
      if (process.env.SYSTEM_IP) {
        console.log(`🌐 Network Access: http://${process.env.SYSTEM_IP}:${PORT}`);
        console.log(`🌐 Frontend URL: http://${process.env.SYSTEM_IP}:8080/index.html`);
      }
      console.log(`💻 Local Access: http://localhost:${PORT}`);
    });
  }
}
