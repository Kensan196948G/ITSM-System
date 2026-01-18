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

---
### 更新メモ (2025-12-29)
- 監査ダッシュボード/コンプライアンス管理のUI詳細を反映
- 脆弱性管理の編集・削除を有効化
- ドキュメント参照先をDocs/に統一（docs/フォルダ削除）

