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
app.use(
  helmet({
    contentSecurityPolicy: false // フロントエンドはindex.htmlで処理
  })
);

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

// Initialize Database
initDb();

// ===== Authentication Routes =====

// User Registration (Admin only for production)
app.post('/api/v1/auth/register', authValidation.register, validate, async (req, res) => {
  try {
    const {
      username, email, password, role = 'viewer', full_name
    } = req.body;

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

        // Create user
        const sql = 'INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)';
        db.run(sql, [username, email, password_hash, role, full_name], function (err) {
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
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

// User Login
app.post('/api/v1/auth/login', authValidation.login, validate, (req, res) => {
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
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

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
app.get('/api/v1/users', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
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
});

// PUT update user (admin only)
app.put('/api/v1/users/:id', authenticateJWT, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  const {
    username, email, role, full_name
  } = req.body;

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
});

// DELETE user (admin only)
app.delete('/api/v1/users/:id', authenticateJWT, authorize(['admin']), (req, res) => {
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
});

// ===== Dashboard Routes =====

app.get('/api/v1/dashboard/kpi', authenticateJWT, (req, res) => {
  db.get(
    "SELECT count(*) as active_incidents FROM incidents WHERE status != 'Closed'",
    (err, incRow) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: '内部サーバーエラー' });
      }

      db.all('SELECT * FROM compliance', (err, compRows) => {
        if (err) {
          console.error('Database error:', err);
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

// ===== Incident Routes =====

app.get('/api/v1/incidents', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM incidents ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.get('/api/v1/incidents/:id', authenticateJWT, (req, res) => {
  db.get('SELECT * FROM incidents WHERE ticket_id = ?', [req.params.id], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    if (!row) return res.status(404).json({ error: 'インシデントが見つかりません' });
    res.json(row);
  });
});

app.post(
  '/api/v1/incidents',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  incidentValidation.create,
  validate,
  (req, res) => {
    const {
      title, priority, status = 'New', description, is_security_incident = 0
    } = req.body;
    const ticket_id = `INC-${Date.now().toString().slice(-6)}`;
    const sql = 'INSERT INTO incidents (ticket_id, title, priority, status, description, is_security_incident) VALUES (?, ?, ?, ?, ?, ?)';

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

app.put(
  '/api/v1/incidents/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  incidentValidation.update,
  validate,
  (req, res) => {
    const {
      status, priority, title, description
    } = req.body;
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
          (err, row) => {
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

app.delete(
  '/api/v1/incidents/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
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

app.get('/api/v1/assets', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM assets ORDER BY asset_tag ASC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.post('/api/v1/assets', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const {
    asset_tag, name, type, criticality = 3, status = 'Operational'
  } = req.body;

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
});

app.put('/api/v1/assets/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
  const {
    name, type, criticality, status
  } = req.body;
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
});

app.delete('/api/v1/assets/:id', authenticateJWT, authorize(['admin']), (req, res) => {
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
});

// ===== Problem Management Routes =====

app.get('/api/v1/problems', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM problems ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.post(
  '/api/v1/problems',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const {
      title, description, priority = 'Medium', related_incidents = 0, assignee
    } = req.body;

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
  (req, res) => {
    const {
      title, description, status, priority, root_cause, assignee
    } = req.body;
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

app.delete('/api/v1/problems/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
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
});

// ===== Release Management Routes =====

app.get('/api/v1/releases', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM releases ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.post('/api/v1/releases', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
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
});

app.put('/api/v1/releases/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
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
});

app.delete('/api/v1/releases/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
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
});

// ===== Service Request Routes =====

app.get('/api/v1/service-requests', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM service_requests ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.post('/api/v1/service-requests', authenticateJWT, (req, res) => {
  const {
    request_type, title, description, priority = 'Medium', requester
  } = req.body;

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
});

app.put(
  '/api/v1/service-requests/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const {
      request_type, title, description, status, priority
    } = req.body;
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

app.get('/api/v1/sla-agreements', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM sla_agreements ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.put(
  '/api/v1/sla-agreements/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
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

app.delete('/api/v1/sla-agreements/:id', authenticateJWT, authorize(['admin']), (req, res) => {
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
});

// ===== Knowledge Management Routes =====

app.get('/api/v1/knowledge-articles', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM knowledge_articles ORDER BY view_count DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.put(
  '/api/v1/knowledge-articles/:id',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const {
      title, content, category, status, author
    } = req.body;
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

app.get('/api/v1/capacity-metrics', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM capacity_metrics ORDER BY measured_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.put(
  '/api/v1/capacity-metrics/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  (req, res) => {
    const {
      resource_name, resource_type, current_usage, threshold, forecast_3m, unit
    } = req.body;

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

app.delete('/api/v1/capacity-metrics/:id', authenticateJWT, authorize(['admin']), (req, res) => {
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
});

// ===== Vulnerability Management Routes =====

app.get('/api/v1/vulnerabilities', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM vulnerabilities ORDER BY cvss_score DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.post(
  '/api/v1/vulnerabilities',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const {
      title, description, severity = 'Medium', cvss_score = 0, affected_asset
    } = req.body;

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
  (req, res) => {
    const {
      title, description, severity, cvss_score, affected_asset, status
    } = req.body;
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

// ===== Change Management Routes =====

app.get('/api/v1/changes', authenticateJWT, (req, res) => {
  db.all('SELECT * FROM changes ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
    res.json(rows);
  });
});

app.post(
  '/api/v1/changes',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  changeValidation.create,
  validate,
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
    const sql = 'INSERT INTO changes (rfc_id, title, description, asset_tag, status, requester, is_security_change, impact_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

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

app.put(
  '/api/v1/changes/:id',
  authenticateJWT,
  authorize(['admin', 'manager']),
  changeValidation.update,
  validate,
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

app.delete('/api/v1/changes/:id', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
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
});

// ===== SLA Agreements API =====

app.post('/api/v1/sla-agreements', authenticateJWT, authorize(['admin', 'manager']), (req, res) => {
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
});

// ===== Knowledge Articles API =====

app.post(
  '/api/v1/knowledge-articles',
  authenticateJWT,
  authorize(['admin', 'manager', 'analyst']),
  (req, res) => {
    const {
      title, category, content, author
    } = req.body;

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
  (req, res) => {
    const {
      resource_name, resource_type, current_usage, threshold
    } = req.body;

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

// Export app for testing
module.exports = app;

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test' && require.main === module) {
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
