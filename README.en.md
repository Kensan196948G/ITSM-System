# ITSM-Sec Nexus: Next-Generation IT Service & Security Management System

A professional IT Service Management system that integrates ISO 20000 (ITSM) with NIST CSF 2.0 (Security) frameworks.

## Overview

This system incorporates the latest cybersecurity framework NIST CSF 2.0 in addition to traditional ITSM capabilities, enabling both offensive and defensive operations on a single platform.

## Key Features

### 1. ITSM (ISO 20000-1:2018 Compliant)
- Service Level Management (SLM/SLA)
- Incident Management
- Problem Management
- Configuration Management (CMDB)
- Change & Release Management

### 2. Security (NIST CSF 2.0 Compliant)
- GOVERN - Policy, accountability, and decision-making framework
- IDENTIFY - Asset/risk/threat visibility
- PROTECT - Preventive control implementation
- DETECT - Early detection of anomalies
- RESPOND - Impact minimization and containment
- RECOVER - Business continuity and recovery planning
- Vulnerability Management (CVSS/affected assets/status)
- Security Dashboard (alerts, audit logs, activity)

### 3. Compliance / GRC
- Audit Dashboard (coverage/schedule/findings/evidence collection)
- Audit Logs (operation tracking and tracing)
- Policy & Procedure Management (maintaining and reviewing rules)
- Compliance Management (evidence/audits/findings/reports)

## Documentation

For detailed information, please refer to the documents in the `Docs/` folder.

## Development Status

- [x] Project initialization
- [x] Requirements definition (Docs 01)
- [x] System design (Docs 02)
- [x] Development planning (Docs 03)
- [x] Prototype implementation (Docs 04)
- [x] Backend/Database construction (SQLite + Express)
- [x] **JWT authentication & RBAC implementation (Completed 2025-12-27)**
- [x] **Input validation implementation (Completed 2025-12-27)**
- [x] **XSS protection completed (Completed 2025-12-27)**
- [x] **Security headers implementation (Completed 2025-12-27)**
- [x] Approval workflow implementation (basic features completed)
- [x] Audit dashboard / compliance management UI setup
- [x] Complete vulnerability management integration
- [x] Integration testing (Jest: 15 suites / 279 tests passed)
- [x] Lint warning resolution (no-shadow 20 items)
- [x] Test coverage 30% achieved (current: lines 47.08%)

## Security Features

### Authentication & Authorization
- **JWT Authentication**: Secure authentication using JSON Web Tokens
- **RBAC**: 4 roles (admin, manager, analyst, viewer)
- **Password Hashing**: bcrypt (10 rounds)
- **Token Expiration**: 24 hours (configurable via environment variables)

### Input Validation
- **express-validator**: Strict validation on all API endpoints
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Using DOM API (complete elimination of innerHTML)

### Security Headers
- **helmet**: Express.js security headers
- **CORS**: Whitelist approach (configured via environment variables)

## Performance Optimization

### Caching Strategy
- **In-Memory Cache**: High-speed caching with node-cache
- **TTL Optimization**: Appropriate TTL settings per endpoint
  - Dashboard charts: 30 seconds (real-time priority)
  - Widget data: 60 seconds
  - SLA statistics: 120 seconds
- **Role-based Caching**: Efficient caching based on user permissions
- **Auto Invalidation**: Automatic deletion of related caches on data updates
- **Memory Management**: Limit settings and LRU-like auto eviction (default 100MB)

### Monitoring & Metrics
- **Prometheus Integration**: Metrics for cache hit rate, memory usage, etc.
- **Response Time Logging**: Logs for performance analysis
- **Statistics Dashboard**: Real-time cache statistics display

For details, refer to [Docs/cache-optimization.md](Docs/cache-optimization.md).

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env file to set JWT_SECRET etc.
```

### 3. Initialize Database
The database will be created automatically on first startup.

### 4. Start Server

**Terminal 1: Start Backend API**
```bash
npm start
# or
node backend/server.js
```

**Terminal 2: Start Frontend HTTP Server**
```bash
# Using Python 3 (listen on all network interfaces)
python3 -m http.server 5050 --bind 0.0.0.0

# or using Node.js http-server
npx http-server -p 5050 -a 0.0.0.0
```

### 5. Access Frontend

Access the following URL in your browser:
```
# Network access (from other devices)
http://192.168.0.187:5050/index.html

# Local access
http://localhost:5050/index.html
```

⚠️ **Important**: Opening index.html directly with file:// protocol will cause CORS errors. Always access via HTTP server.

## Default Users

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| admin | admin123 | admin | Full access |
| analyst | analyst123 | analyst | View, create incidents, create RFCs |

⚠️ **Change passwords in production environment**

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - User registration
- `GET /api/v1/auth/me` - Current user information

### Dashboard
- `GET /api/v1/dashboard/kpi` - KPI statistics (authentication required)

### Incident Management
- `GET /api/v1/incidents` - Get list (authentication required)
- `GET /api/v1/incidents/:id` - Get details (authentication required)
- `POST /api/v1/incidents` - Create new (authentication required, analyst or above)
- `PUT /api/v1/incidents/:id` - Update (authentication required, analyst or above)

### Change Management
- `GET /api/v1/changes` - Get list (authentication required)
- `POST /api/v1/changes` - Create RFC (authentication required, analyst or above)
- `PUT /api/v1/changes/:id` - Update/approve RFC (authentication required, manager or above)

### Configuration Management
- `GET /api/v1/assets` - Asset list (authentication required)

### Health Check
- `GET /api/v1/health` - Server status check (no authentication required)

---

## Production Deployment

### Native Node.js Environment Deployment

#### Prerequisites
- Node.js v20.x LTS
- npm v10.x or higher
- 4GB or more memory
- 50GB or more free disk space

#### Quick Start

```bash
# 1. Configure environment variables
./scripts/setup-env.sh

# 2. Install dependencies
npm install

# 3. Database migration
npm run migrate:latest

# 4. Install as systemd service
sudo ./scripts/install-systemd.sh

# 5. Start service
sudo systemctl start itsm-system

# 6. Verify deployment
curl http://localhost:5000/api/v1/health/ready
```

#### Available Commands

```bash
# Service management
sudo systemctl start itsm-system     # Start service
sudo systemctl stop itsm-system      # Stop service
sudo systemctl restart itsm-system   # Restart service
sudo systemctl status itsm-system    # Check status

# Database migration
npm run migrate:latest    # Run migration
npm run migrate:rollback  # Rollback
npm run migrate:status    # Check status

# Backup & Restore
npm run backup            # Manual backup
npm run restore <file>    # Restore from backup
```

### Detailed Deployment Instructions

For complete deployment procedures, update methods, rollback procedures, and troubleshooting, please refer to the following document:

📖 **[Deployment Guide](Docs/デプロイメントガイド.md)** (Japanese)

---

## Monitoring & Metrics

### Prometheus Metrics

Metrics endpoint: `http://localhost:5000/metrics`

Collected metrics:
- HTTP request count (by method, route, status_code)
- Response time (histogram)
- Active user count
- Database query count
- Authentication error count
- System resources (CPU, memory, GC statistics)

### Health Checks

```bash
# Basic health check
curl http://localhost:5000/api/v1/health

# Liveness Probe (process alive check)
curl http://localhost:5000/api/v1/health/live

# Readiness Probe (traffic acceptance check)
curl http://localhost:5000/api/v1/health/ready
```

---

## Backup & Restore

### Automatic Backups

```bash
# Daily backup (02:00)
# Weekly backup (Sunday 03:00)
# Monthly backup (1st day 04:00)

# cron configuration
sudo cp cron.d/itsm-backup /etc/cron.d/
```

### Manual Backup

```bash
# Execute backup
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh /path/to/backup/itsm_nexus_YYYYMMDD_HHMMSS.db
```

Backups are stored in:
- Daily: `backend/backups/daily/` (7-day retention)
- Weekly: `backend/backups/weekly/` (4-week retention)
- Monthly: `backend/backups/monthly/` (12-month retention)

---

## Security Best Practices

### Production Environment Checklist

- [ ] Change default passwords (admin/admin123, etc.)
- [ ] Set random JWT_SECRET in `.env.production`
- [ ] Use Let's Encrypt certificates (not self-signed)
- [ ] Close unnecessary ports with firewall
- [ ] Regular security updates
- [ ] Regular backup execution and verification
- [ ] Configure monitoring alerts

### SSL/TLS Configuration

- Allow TLS 1.2/1.3 only
- Use modern cipher suites
- Enable HSTS (max-age=1 year)
- Enable OCSP Stapling

### Rate Limiting

- General API: 100 requests/15 minutes/IP
- Authentication API: 5 requests/15 minutes/IP (brute force protection)

---

## Internationalization (i18n)

The system supports multiple languages:
- **Japanese (ja)** - Default
- **English (en)**
- **Chinese Simplified (zh-CN)**

Language can be switched from the language selector in the top right corner of the interface. The browser's language settings are automatically detected.

---

## License

ISC

## Contributing

Issues and Pull Requests are welcome!

## Support

- 📖 [Deployment Guide](Docs/デプロイメントガイド.md)
- 📖 [Developer Guide](Docs/開発者ガイド.md)
- 📖 [Operations Manual](Docs/運用マニュアル.md)
- 📖 [Test Plan](Docs/テスト計画書.md)
- 📖 [Data Migration Plan](Docs/DATA_MIGRATION_PLAN.md)
- 📖 [Migration Tools Implementation Plan](Docs/MIGRATION_TOOLS_IMPLEMENTATION.md)
