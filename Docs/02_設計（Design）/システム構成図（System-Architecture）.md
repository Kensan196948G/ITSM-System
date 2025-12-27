# システム構成図（System-Architecture）

## 1. 全体アーキテクチャ
- **Frontend**: SPA (Single Page Application) - Vanilla JS or React (要検討)
- **Backend**: RESTful API - Node.js (Express) または Python (FastAPI)
- **Database**: Relational Database (SQL) - SQLite (開発用) / PostgreSQL (本番用)
- **Security**: JWT Authentication, HTTPS, RBAC (Role Based Access Control)

## 2. コンポーネント図
- WebUI Container
- API Gateway / Auth Service
- ITSM Core Service (ISO 20000 Logic)
- Security Compliance Service (CSF Logic)
- Database Layer
