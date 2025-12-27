# データベース設計（Database-Design）

## 1. 概要
本システムでは、ITSMプロセス（ISO 20000）とセキュリティ管理（NIST CSF 2.0）を統合管理するため、リレーショナルデータベースを使用します。開発初期段階では SQLite を採用し、将来的に PostgreSQL への移行を考慮した設計とします。

## 2. エンティティ定義

### 2.1 インシデント管理 (Incidents)
| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| id | INTEGER (PK) | ユニークID |
| ticket_id | TEXT | チケット番号 (e.g., INC-2025-001) |
| title | TEXT | インシデントの件名 |
| description | TEXT | 詳細内容 |
| status | TEXT | ステータス (New, Assigned, In-Progress, Resolved, Closed) |
| priority | TEXT | 優先度 (Critical, High, Medium, Low) |
| reporter_id | INTEGER | 報告者ユーザーID |
| assignee_id | INTEGER | 担当者ユーザーID |
| ci_id | INTEGER | 関連する構成品目ID |
| is_security_incident | BOOLEAN | セキュリティ事象かどうかのフラグ |
| created_at | DATETIME | 作成日時 |
| updated_at | DATETIME | 更新日時 |

### 2.2 構成管理 (Configuration Items - CI/CMDB)
| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| id | INTEGER (PK) | 資産ID |
| asset_tag | TEXT | 資産管理番号 |
| name | TEXT | 資産名称 |
| type | TEXT | 種別 (Server, Network, Endpoint, Cloud) |
| critical度 | INTEGER | ビジネスへの重要度 (1-5) |
| status | TEXT | 状態 (Operational, Maintenance, Retired) |
| owner_dept | TEXT | 所有部署 |

### 2.3 脆弱性管理 (Vulnerabilities)
| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| id | INTEGER (PK) | 脆弱性ID |
| cve_id | TEXT | CVE番号 (e.g., CVE-2024-XXXX) |
| ci_id | INTEGER (FK) | 影響を受ける資産 |
| severity | TEXT | 深刻度 (Critical, High, Medium, Low) |
| status | TEXT | 対応状況 (Open, Remediated, Mitigated, Ignored) |
| detection_date | DATETIME | 検知日 |

### 2.4 NIST CSF 準拠状況 (Compliance-Status)
| カラム名 | 型 | 説明 |
| :--- | :--- | :--- |
| function | TEXT | CSF機能 (GOVERN, IDENTIFY, PROTECT, etc.) |
| progress | INTEGER | 達成率 (%) |
| target_tier | INTEGER | 目標ティア (1-4) |

## 3. ER図イメージ
- `Incidents` --(belongs to)--> `CI/CMDB`
- `Vulnerabilities` --(belongs to)--> `CI/CMDB`
- `Users` --(assigns)--> `Incidents`
