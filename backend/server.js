const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { db, initDb } = require('./db');
const { authenticateJWT, authorize } = require('./middleware/auth');
const {
    validate,
    incidentValidation,
    changeValidation,
    authValidation
} = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false // フロントエンドはindex.htmlで処理
}));

// CORS Configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'];

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

// Initialize Database
initDb();

// ===== Authentication Routes =====

// User Registration (Admin only for production)
app.post('/api/v1/auth/register',
    authValidation.register,
    validate,
    async (req, res) => {
        try {
            const { username, email, password, role = 'viewer', full_name } = req.body;

            // Check if user already exists
            db.get("SELECT id FROM users WHERE username = ? OR email = ?", [username, email], async (err, existingUser) => {
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

                // Create user
                const sql = "INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)";
                db.run(sql, [username, email, password_hash, role, full_name], function(err) {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: '内部サーバーエラー' });
                    }

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
                });
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: '内部サーバーエラー' });
        }
    }
);

// User Login
app.post('/api/v1/auth/login',
    authValidation.login,
    validate,
    (req, res) => {
        const { username, password } = req.body;

        db.get("SELECT * FROM users WHERE username = ? AND is_active = 1", [username], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: '内部サーバーエラー' });
            }

            if (!user) {
                return res.status(401).json({
                    error: 'ユーザー名またはパスワードが間違っています'
                });
            }

            // Compare password
            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) {
                return res.status(401).json({
                    error: 'ユーザー名またはパスワードが間違っています'
                });
            }

            // Update last login
            db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

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
        });
    }
);

// Get Current User Info
app.get('/api/v1/auth/me', authenticateJWT, (req, res) => {
    db.get("SELECT id, username, email, role, full_name, created_at, last_login FROM users WHERE id = ?",
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

// ===== Dashboard Routes =====

app.get('/api/v1/dashboard/kpi', authenticateJWT, (req, res) => {
    db.get("SELECT count(*) as active_incidents FROM incidents WHERE status != 'Closed'", (err, incRow) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: '内部サーバーエラー' });
        }

        db.all("SELECT * FROM compliance", (err, compRows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: '内部サーバーエラー' });
            }

            const csf_progress = {};
            compRows.forEach(row => {
                csf_progress[row.function.toLowerCase()] = row.progress;
            });

            res.json({
                active_incidents: incRow.active_incidents,
                sla_compliance: 99.8,
                vulnerabilities: { critical: 2, high: 5 },
                csf_progress: csf_progress
            });
        });
    });
});

// ===== Incident Routes =====

app.get('/api/v1/incidents', authenticateJWT, (req, res) => {
    db.all("SELECT * FROM incidents ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.json(rows);
    });
});

app.get('/api/v1/incidents/:id', authenticateJWT, (req, res) => {
    db.get("SELECT * FROM incidents WHERE ticket_id = ?", [req.params.id], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: '内部サーバーエラー' });
        }
        if (!row) return res.status(404).json({ error: "インシデントが見つかりません" });
        res.json(row);
    });
});

app.post('/api/v1/incidents',
    authenticateJWT,
    authorize(['admin', 'manager', 'analyst']),
    incidentValidation.create,
    validate,
    (req, res) => {
        const { title, priority, status = 'New', description, is_security_incident = 0 } = req.body;
        const ticket_id = `INC-${Date.now().toString().slice(-6)}`;
        const sql = "INSERT INTO incidents (ticket_id, title, priority, status, description, is_security_incident) VALUES (?, ?, ?, ?, ?, ?)";

        db.run(sql, [ticket_id, title, priority, status, description, is_security_incident], function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: '内部サーバーエラー' });
            }
            res.status(201).json({
                message: "インシデントが正常に作成されました",
                id: ticket_id,
                created_by: req.user.username
            });
        });
    }
);

app.put('/api/v1/incidents/:id',
    authenticateJWT,
    authorize(['admin', 'manager', 'analyst']),
    incidentValidation.update,
    validate,
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
                db.get("SELECT is_security_incident FROM incidents WHERE ticket_id = ?", [req.params.id], (err, row) => {
                    if (row && row.is_security_incident) {
                        db.run("UPDATE compliance SET progress = MIN(100, progress + 2) WHERE function IN ('RESPOND', 'RECOVER')");
                    }
                });
            }

            res.json({
                message: "インシデントが正常に更新されました",
                changes: this.changes,
                updated_by: req.user.username
            });
        });
    }
);

// ===== Asset Routes =====

app.get('/api/v1/assets', authenticateJWT, (req, res) => {
    db.all("SELECT * FROM assets ORDER BY asset_tag ASC", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.json(rows);
    });
});

// ===== Change Management Routes =====

app.get('/api/v1/changes', authenticateJWT, (req, res) => {
    db.all("SELECT * FROM changes ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: '内部サーバーエラー' });
        }
        res.json(rows);
    });
});

app.post('/api/v1/changes',
    authenticateJWT,
    authorize(['admin', 'manager', 'analyst']),
    changeValidation.create,
    validate,
    (req, res) => {
        const { title, description, asset_tag, requester, is_security_change = 0, impact_level } = req.body;
        const rfc_id = `RFC-${uuidv4().split('-')[0].toUpperCase()}`;
        const sql = "INSERT INTO changes (rfc_id, title, description, asset_tag, status, requester, is_security_change, impact_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        db.run(sql, [rfc_id, title, description, asset_tag, 'Pending', requester, is_security_change, impact_level], function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: '内部サーバーエラー' });
            }
            res.status(201).json({
                message: "変更要求が正常に作成されました",
                id: rfc_id,
                created_by: req.user.username
            });
        });
    }
);

app.put('/api/v1/changes/:id',
    authenticateJWT,
    authorize(['admin', 'manager']),
    changeValidation.update,
    validate,
    (req, res) => {
        const { status, approver } = req.body;
        const sql = "UPDATE changes SET status = ?, approver = ? WHERE rfc_id = ?";

        db.run(sql, [status, approver || req.user.username, req.params.id], function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: '内部サーバーエラー' });
            }
            res.json({
                message: "変更要求が正常に更新されました",
                changes: this.changes,
                approved_by: approver || req.user.username
            });
        });
    }
);

// ===== Health Check (No Auth Required) =====

app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'エンドポイントが見つかりません' });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: '内部サーバーエラー' });
});

const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log(`🚀 Server is running on ${HOST}:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 Security: helmet enabled, CORS configured`);
    if (process.env.SYSTEM_IP) {
        console.log(`🌐 Network Access: http://${process.env.SYSTEM_IP}:${PORT}`);
        console.log(`🌐 Frontend URL: http://${process.env.SYSTEM_IP}:8080/index.html`);
    }
    console.log(`💻 Local Access: http://localhost:${PORT}`);
});

module.exports = app;
