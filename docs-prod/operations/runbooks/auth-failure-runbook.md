# 認証・認可障害対応Runbook

**文書ID**: RB-AUTH-001
**対象システム**: ITSM-Sec Nexus
**最終更新**: 2026-02-14
**レビュー周期**: 四半期ごと

---

## 1. 概要

本Runbookは、ITSM-Sec Nexusの認証（JWT）・認可システムの障害発生時における診断・対応・復旧手順を定義する。

### 対象障害

| 障害種別 | 症状 | 影響度 |
|---------|------|--------|
| ログイン不可 | 401 Unauthorized 返却 | 重大 |
| トークン検証失敗 | JWT署名エラー | 重大 |
| リフレッシュトークン無効 | 自動再認証失敗 | 高 |
| 権限不正 | 403 Forbidden、機能アクセス不可 | 高 |
| ブルートフォース検知 | アカウントロック / レート制限発動 | 中 |
| パスワードリセット失敗 | メール未送信 | 中 |
| セッション管理異常 | 全ユーザー強制ログアウト | 重大 |

### 認証アーキテクチャ

```
[ブラウザ]
    │
    │ POST /api/v1/auth/login {username, password}
    ▼
[Express サーバー (port 6443)]
    │
    ├─ bcrypt パスワード検証
    │
    ├─ JWT トークン生成 (JWT_SECRET)
    │   ├─ アクセストークン（短期）
    │   └─ リフレッシュトークン（長期）
    │
    ▼
[ブラウザ localStorage]
    ├─ itsm_auth_token (アクセストークン)
    └─ itsm_user_info (ユーザー情報)
```

### ロール定義

| ロール | 権限 |
|--------|------|
| `admin` | 全機能アクセス、ユーザー管理 |
| `manager` | 承認、レポート閲覧 |
| `analyst` | インシデント・変更管理の作成・編集 |
| `viewer` | 閲覧のみ |

> **注意**: `operator` ロールは存在しない（VALID_ROLES: `['admin', 'manager', 'analyst', 'viewer']`）

---

## 2. 診断フローチャート

```
[認証障害検知/報告]
       │
       ▼
[1] 影響範囲確認 ─── 特定ユーザーのみ ──→ [A] 個別ユーザー調査
       │
       │ 全ユーザー影響
       ▼
[2] サーバー稼働確認 ─── 停止 ──→ [B] サービス復旧
       │                              → 「DB障害Runbook」参照
       │ 稼働中
       ▼
[3] JWT_SECRET 確認 ─── 変更あり ──→ [C] JWT_SECRET復旧
       │
       │ 変更なし
       ▼
[4] DB接続確認 ─── 失敗 ──→ 「DB障害Runbook」参照
       │
       │ 正常
       ▼
[5] ログ分析 ──→ エラーパターン特定
       │
       ├─ "jwt malformed" → [D] トークン形式エラー
       ├─ "jwt expired" → [E] トークン有効期限切れ
       ├─ "invalid signature" → [C] JWT_SECRET不整合
       ├─ "Too many requests" → [F] レート制限
       └─ "Account locked" → [G] アカウントロック
```

---

## 3. 対応手順（ステップバイステップ）

### 手順 3.1: 初期診断

#### Step 1: サーバー稼働確認

```bash
# ヘルスチェック
curl -k https://localhost:6443/api/v1/health

# サービス状態
sudo systemctl status itsm-nexus-prod
```

#### Step 2: 認証エンドポイント確認

```bash
# ログインテスト（管理者アカウント）
curl -k -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "'"$ADMIN_PASSWORD"'"}'

# 期待されるレスポンス（成功時）
# {"token": "eyJ...", "user": {"id": 1, "username": "admin", "role": "admin"}}

# 期待されるレスポンス（失敗時）
# {"error": "Invalid credentials"} → パスワード不正
# {"error": "Account locked"} → アカウントロック中
# 500 Internal Server Error → サーバー内部エラー
```

#### Step 3: JWT_SECRET確認

```bash
# 環境変数の確認
grep JWT_SECRET /mnt/LinuxHDD/ITSM-System/.env

# プロセスの環境変数確認（実行中サービス）
sudo cat /proc/$(pgrep -f "node.*server")/environ | tr '\0' '\n' | grep JWT_SECRET
```

#### Step 4: ログ分析

```bash
# サービスログ確認（直近30分）
sudo journalctl -u itsm-nexus-prod --since "30 minutes ago" --no-pager

# 認証関連エラーの抽出
sudo journalctl -u itsm-nexus-prod --since "30 minutes ago" | grep -iE "auth|jwt|token|401|403|login"

# アプリケーションログ確認
tail -100 /mnt/LinuxHDD/ITSM-System/backend/logs/*.log 2>/dev/null
```

---

### 手順 3.2: 障害別対応

#### [A] 個別ユーザー調査

```bash
# 1. ユーザー存在確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT id, username, role, is_active FROM users WHERE username = 'TARGET_USER';"

# 2. アカウント有効化（無効化されている場合）
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "UPDATE users SET is_active = 1 WHERE username = 'TARGET_USER';"

# 3. ロール確認（不正なロールが設定されていないか）
# VALID_ROLES: admin, manager, analyst, viewer
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT username, role FROM users WHERE role NOT IN ('admin', 'manager', 'analyst', 'viewer');"

# 4. パスワードリセット（API経由）
curl -k -X POST https://localhost:6443/api/v1/auth/password-reset \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

#### [B] サービス復旧

```bash
# 1. サービス再起動
sudo systemctl restart itsm-nexus-prod

# 2. 起動確認
sleep 5
curl -k https://localhost:6443/api/v1/health

# 3. 認証テスト
curl -k -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "'"$ADMIN_PASSWORD"'"}'
```

#### [C] JWT_SECRET復旧

**原因**: .envファイルの変更、環境変数未設定、サーバー再起動時の設定喪失

```bash
# 1. 現在のJWT_SECRET確認
grep JWT_SECRET /mnt/LinuxHDD/ITSM-System/.env

# 2. JWT_SECRETが空または未設定の場合
#    → .envファイルのバックアップから復旧
#    → または新しいJWT_SECRETを設定（全ユーザー再ログインが必要）

# 3. .envファイルの復旧（バックアップから）
# 注意: JWT_SECRETを変更すると全既存トークンが無効化される
cp /mnt/LinuxHDD/ITSM-System/.env.backup /mnt/LinuxHDD/ITSM-System/.env

# 4. 新しいJWT_SECRETの生成（既存トークン全無効化が許容される場合）
# openssl rand -hex 64

# 5. サービス再起動（環境変数の反映）
sudo systemctl restart itsm-nexus-prod

# 6. 全ユーザーに再ログインを案内
```

> **重要**: JWT_SECRETを変更すると、発行済みの全JWTトークンが無効になる。全ユーザーが再ログインする必要がある。

#### [D] トークン形式エラー

**原因**: クライアント側のlocalStorage破損、不正なトークン送信

```
対応: クライアント側対処
1. ブラウザの開発者ツールを開く
2. Application → Local Storage → 対象ドメイン
3. "itsm_auth_token" と "itsm_user_info" を削除
4. ページリロード後、再ログイン
```

#### [E] トークン有効期限切れ

**原因**: リフレッシュトークンも期限切れ、サーバー時刻ずれ

```bash
# 1. サーバー時刻確認
date
timedatectl status

# 2. NTP同期確認
timedatectl show | grep NTP

# 3. 時刻が大幅にずれている場合
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```

#### [F] レート制限対応

**原因**: 短時間に大量のログイン試行（ブルートフォース検知）

```bash
# 1. レート制限ログの確認
sudo journalctl -u itsm-nexus-prod | grep -i "rate.limit\|too many"

# 2. ブルートフォース検知ログ
sudo journalctl -u itsm-nexus-prod | grep -i "brute.force\|blocked"

# 3. ソースIPの確認
sudo journalctl -u itsm-nexus-prod | grep "429" | awk '{print $NF}' | sort | uniq -c | sort -rn

# 4. 正当なユーザーの場合、レート制限解除のためサービス再起動
#    （メモリ内カウンターがリセットされる）
sudo systemctl restart itsm-nexus-prod
```

#### [G] アカウントロック解除

```bash
# 1. ロック状態の確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT id, username, is_active, failed_login_attempts FROM users WHERE is_active = 0;"

# 2. アカウントロック解除
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "UPDATE users SET is_active = 1, failed_login_attempts = 0 WHERE username = 'TARGET_USER';"

# 3. 全アカウントのロック解除（緊急時）
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "UPDATE users SET is_active = 1, failed_login_attempts = 0 WHERE is_active = 0;"
```

---

### 手順 3.3: ADMIN_PASSWORD環境変数の確認

```bash
# ADMIN_PASSWORDが設定されていない場合、サーバー起動時にランダムパスワードが生成される
# ログで確認
sudo journalctl -u itsm-nexus-prod | grep -i "admin.*password\|generated"

# .envファイルで確認
grep ADMIN_PASSWORD /mnt/LinuxHDD/ITSM-System/.env
```

> **注意**: `ADMIN_PASSWORD`環境変数が未設定の場合、サーバー起動のたびにランダムなパスワードが生成される。必ず.envファイルで明示的に設定すること。

---

## 4. エスカレーション基準

### エスカレーションレベル

| レベル | 条件 | 対応者 | 時間枠 |
|--------|------|--------|--------|
| **L1** | 特定ユーザーのログイン障害 | 運用担当者 | 0〜30分 |
| **L1** | レート制限発動（正当なユーザー） | 運用担当者 | 0〜30分 |
| **L2** | 全ユーザーのログイン不可 | システム管理者 | 即時 |
| **L2** | JWT_SECRET漏洩の疑い | システム管理者 | 即時 |
| **L3** | 不正アクセスの証拠発見 | 管理職 + セキュリティチーム | 即時 |

### セキュリティインシデントへの切り替え基準

以下の場合は「セキュリティインシデント対応Runbook」に切り替える:

- 不正なIPアドレスからの大量ログイン試行
- 管理者アカウントへの不正アクセス成功の痕跡
- JWT_SECRETの漏洩が確認された場合
- 権限昇格の兆候（viewerユーザーがadmin操作を実行）

### エスカレーション連絡テンプレート

```
【認証障害報告】
■ 発生日時: YYYY-MM-DD HH:MM
■ 障害種別: [ログイン不可 / トークン検証失敗 / 権限不正 / ブルートフォース]
■ 影響範囲: [全ユーザー / 特定ユーザー（名前）/ 特定ロール]
■ セキュリティ懸念: [あり / なし]
■ 実施済み対応:
  - [実施した手順を記載]
■ 現在の状態: [復旧済 / 対応中 / エスカレーション待ち]
■ 対応者: [担当者名]
```

---

## 5. 参考コマンド一覧

### 認証テスト

```bash
# ログイン
curl -k -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "PASSWORD"}'

# トークン検証（認証が必要なAPI呼び出し）
TOKEN="eyJ..."
curl -k https://localhost:6443/api/v1/incidents \
  -H "Authorization: Bearer $TOKEN"

# ユーザー情報取得
curl -k https://localhost:6443/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### ユーザー管理（DB直接操作）

```bash
# ユーザー一覧
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT id, username, role, is_active FROM users;"

# ロール確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT username, role FROM users ORDER BY role;"

# 不正ロールのユーザー検出
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT * FROM users WHERE role NOT IN ('admin', 'manager', 'analyst', 'viewer');"
```

### ログ確認

```bash
# 認証関連ログ
sudo journalctl -u itsm-nexus-prod | grep -iE "auth|login|jwt|token|401|403"

# ブルートフォース検知
sudo journalctl -u itsm-nexus-prod | grep -i "brute.force"

# レート制限
sudo journalctl -u itsm-nexus-prod | grep "429"
```

---

## 6. 復旧確認チェックリスト

| # | 確認項目 | コマンド/方法 | 合格基準 |
|---|---------|--------------|---------|
| 1 | ヘルスチェック | `curl -k https://localhost:6443/api/v1/health` | `"status": "healthy"` |
| 2 | ログイン(admin) | POST `/api/v1/auth/login` | 200 + トークン取得 |
| 3 | ログイン(一般) | POST `/api/v1/auth/login` | 200 + トークン取得 |
| 4 | トークン認証 | GET `/api/v1/incidents` with Bearer | 200 OK |
| 5 | 権限確認 | viewer でユーザー管理API呼び出し | 403 Forbidden |
| 6 | ブラウザ | ブラウザでログイン・画面遷移確認 | 正常動作 |

---

## 7. 既知の制限事項

| 項目 | 内容 | リスク | 緩和策 |
|------|------|--------|--------|
| JWT in localStorage | XSS攻撃でトークン窃取の可能性 | 高 | CSPヘッダー強化済、将来HttpOnly Cookie移行予定 |
| タイミング攻撃 | パスワードリセットでユーザー列挙可能 | 中 | 将来の修正予定 |
| ADMIN_PASSWORD | 未設定時にランダム生成 | 中 | .envで必ず設定 |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 | 担当 |
|------|-----------|---------|------|
| 2026-02-14 | 1.0 | 初版作成 | ops-runbook |
