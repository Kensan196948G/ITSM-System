# Runbook: 認証障害時対応

## 概要

ITSM-Sec Nexus の認証システム（JWT + HttpOnly Cookie + TOTP 2FA）に障害が発生した場合の
対応手順書です。

### 認証アーキテクチャ

```
クライアント
  |
  ├─ Authorization: Bearer <JWT>  (ヘッダー)
  ├─ Cookie: token=<JWT>          (HttpOnly, SameSite=Strict)
  └─ Cookie: refreshToken=<RT>    (HttpOnly, path=/auth)
  |
  v
Express ミドルウェア (auth.js)
  |
  ├─ JWT検証 (アクセストークン, 有効期限: 1h)
  ├─ Refresh Token ローテーション (有効期限: 7日)
  ├─ Token Blacklist (JTIベース)
  └─ TOTP 2FA 検証 (AES-256-GCM暗号化)
```

---

## 1. 検知方法

### 1.1 症状と原因の対応表

| 症状 | 考えられる原因 | 重大度 |
|------|---------------|--------|
| 全ユーザーがログインできない | JWT_SECRET 問題、サーバー障害 | 緊急 |
| 特定ユーザーのみログイン不可 | アカウント無効化、パスワード問題 | 中 |
| トークンリフレッシュ失敗 | Refresh Token 期限切れ、DB問題 | 中 |
| 2FA認証コードが通らない | TOTP_ENCRYPTION_KEY 問題、時刻ズレ | 中 |
| 401エラーが頻発 | トークン期限切れ、ブラックリスト問題 | 中 |
| Cookie が設定されない | SameSite/Secure設定、CORS問題 | 低 |

### 1.2 ログによる確認

```bash
# 認証関連エラーの確認
grep -E "auth|jwt|token|login|401|403" /var/log/itsm/server.log | tail -50

# 認証失敗の集計
sqlite3 backend/itsm.db "
SELECT action, COUNT(*) as cnt
FROM audit_logs
WHERE action IN ('LOGIN_FAILURE', 'TOKEN_REFRESH_FAILURE', 'TOKEN_INVALID')
  AND created_at > datetime('now', '-1 hour')
GROUP BY action
ORDER BY cnt DESC;
"
```

### 1.3 アラート条件

| 条件 | アクション |
|------|-----------|
| 全ユーザー認証不可（5分以上） | 即時対応 |
| 認証失敗率50%超過 | 調査開始 |
| 同一IPから10回以上の認証失敗 | ブルートフォース疑い → セキュリティRunbook参照 |

---

## 2. JWT/Cookie 障害対応

### 2.1 JWT_SECRET の確認

```bash
# 環境変数が設定されているか確認
echo $JWT_SECRET | wc -c
# 長さが1（空）の場合は未設定

# サーバープロセスの環境変数確認
cat /proc/$(pgrep -f "node backend/server.js")/environ 2>/dev/null | tr '\0' '\n' | grep JWT_SECRET
```

**JWT_SECRET が未設定の場合**:

```bash
# 1. サービス停止
sudo systemctl stop itsm-system

# 2. JWT_SECRET を設定
export JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=${JWT_SECRET}" >> /etc/itsm/env  # 永続化

# 3. 既存トークンは全て無効になるため、リフレッシュトークンをクリア
sqlite3 backend/itsm.db "DELETE FROM refresh_tokens;"

# 4. サービス再起動
sudo systemctl start itsm-system
echo "全ユーザーの再ログインが必要です"
```

### 2.2 Cookie 設定の問題

ブラウザでCookieが設定されない場合の確認事項:

```bash
# サーバー側のCookie設定を確認
grep -rn "cookie\|Cookie\|setCookie\|httpOnly\|sameSite" backend/middleware/auth.js backend/routes/auth.js

# CORS設定確認
grep -rn "cors\|CORS\|credentials\|origin" backend/server.js
```

**よくある問題と対処**:

| 問題 | 原因 | 対処 |
|------|------|------|
| Cookie が送信されない | `credentials: 'include'` 未設定 | フロントエンドの fetch 設定を確認 |
| Cookie が保存されない | SameSite=Strict + 異なるオリジン | CORS の origin 設定を確認 |
| HTTPS 環境で Cookie 未送信 | `secure: true` だがHTTP | HTTPS を使用するか secure=false に変更 |

### 2.3 Refresh Token の問題

```bash
# リフレッシュトークンの状態確認
sqlite3 backend/itsm.db "
SELECT user_id,
       COUNT(*) as token_count,
       MIN(created_at) as oldest,
       MAX(expires_at) as latest_expiry
FROM refresh_tokens
GROUP BY user_id;
"

# 期限切れトークンのクリーンアップ
sqlite3 backend/itsm.db "
DELETE FROM refresh_tokens WHERE expires_at < datetime('now');
"
echo "期限切れリフレッシュトークンを削除しました"
```

---

## 3. セッション全クリア

全ユーザーのセッションを強制無効化する必要がある場合（セキュリティインシデント等）。

### 3.1 リフレッシュトークン全削除

```bash
# 全リフレッシュトークンを削除
sqlite3 backend/itsm.db "DELETE FROM refresh_tokens;"
echo "全リフレッシュトークン削除完了"

# トークンブラックリストもクリア（任意）
sqlite3 backend/itsm.db "DELETE FROM token_blacklist;" 2>/dev/null
echo "ブラックリストクリア完了"
```

### 3.2 JWT_SECRET ローテーション（全トークン即時無効化）

```bash
# 1. サービス停止
sudo systemctl stop itsm-system

# 2. 新しい JWT_SECRET を生成
NEW_JWT_SECRET=$(openssl rand -hex 32)
echo "新JWT_SECRET: ${NEW_JWT_SECRET}"

# 3. 環境変数を更新
# .envファイルまたは環境設定に反映
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${NEW_JWT_SECRET}/" /etc/itsm/env 2>/dev/null

# 4. 全リフレッシュトークンを削除
sqlite3 backend/itsm.db "DELETE FROM refresh_tokens;"

# 5. サービス再起動
export JWT_SECRET="${NEW_JWT_SECRET}"
sudo systemctl start itsm-system

echo "JWT_SECRET ローテーション完了 - 全ユーザーの再ログインが必要です"
```

---

## 4. TOTP 2FA 障害対応

### 4.1 TOTP_ENCRYPTION_KEY の確認

```bash
# 環境変数確認
echo $TOTP_ENCRYPTION_KEY | wc -c
# 44文字(base64の32バイト)が期待値
```

### 4.2 特定ユーザーの2FA リセット

```bash
# ユーザーの2FA状態確認
sqlite3 backend/itsm.db "
SELECT id, username, totp_enabled, totp_secret IS NOT NULL as has_secret
FROM users
WHERE username = '<ユーザー名>';
"

# 2FAを無効化（緊急時）
sqlite3 backend/itsm.db "
UPDATE users
SET totp_enabled = 0, totp_secret = NULL
WHERE username = '<ユーザー名>';
"
echo "2FA無効化完了: <ユーザー名>"
```

### 4.3 時刻ズレの確認

TOTPは時刻ベースのため、サーバーの時刻が正確である必要があります。

```bash
# サーバー時刻確認
date
timedatectl

# NTP同期状態確認
timedatectl show --property=NTPSynchronized
# 期待: NTPSynchronized=yes

# NTP同期が外れている場合
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```

---

## 5. 緊急アクセス手順

通常の認証が完全に機能しない場合の緊急アクセス方法です。

### 5.1 管理者パスワードリセット

```bash
# 1. bcryptハッシュを生成
NEW_HASH=$(node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('<新しいパスワード>', 10);
console.log(hash);
")

# 2. 管理者パスワードを直接更新
sqlite3 backend/itsm.db "
UPDATE users SET password_hash = '${NEW_HASH}' WHERE username = 'admin';
"
echo "管理者パスワードリセット完了"
```

### 5.2 緊急アカウント作成

```bash
# 緊急用管理者アカウントの作成
EMERGENCY_HASH=$(node -e "
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('EmergencyP@ss123!', 10));
")

sqlite3 backend/itsm.db "
INSERT INTO users (username, email, password_hash, role, is_active)
VALUES ('emergency_admin', 'emergency@localhost', '${EMERGENCY_HASH}', 'admin', 1);
"
echo "緊急管理者アカウント作成完了"
echo "警告: 復旧後に必ずこのアカウントを削除してください"
```

### 5.3 復旧後のクリーンアップ

```bash
# 緊急アカウントの削除
sqlite3 backend/itsm.db "DELETE FROM users WHERE username = 'emergency_admin';"

# 監査ログの確認（緊急アカウントの操作履歴）
sqlite3 backend/itsm.db "
SELECT * FROM audit_logs WHERE username = 'emergency_admin' ORDER BY created_at;
"
echo "緊急アカウント削除完了"
```

---

## 6. 確認方法

### 6.1 認証システム正常性確認

```bash
# 1. ヘルスチェック
curl -sk https://localhost:6443/api/v1/health

# 2. ログインテスト
TOKEN=$(curl -sk -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}' \
  | node -e "process.stdin.on('data', d => { try { console.log(JSON.parse(d).token) } catch(e) { console.log('PARSE_ERROR') } })")

echo "取得トークン: ${TOKEN:0:20}..."

# 3. トークン認証テスト
curl -sk https://localhost:6443/api/v1/users/me \
  -H "Authorization: Bearer ${TOKEN}"

# 4. トークンリフレッシュテスト
curl -sk -X POST https://localhost:6443/api/v1/auth/refresh \
  -H "Cookie: refreshToken=<REFRESH_TOKEN>"
```

---

## 7. エスカレーション

| 状況 | エスカレーション先 | 対応 |
|------|-------------------|------|
| 全ユーザー認証不可 | プロジェクトリーダー | JWT_SECRET確認 + 緊急アクセス |
| JWT_SECRET漏洩疑い | セキュリティ担当 | 即時ローテーション |
| TOTP暗号鍵漏洩疑い | セキュリティ担当 | 全ユーザー2FA再設定 |
| ブルートフォース攻撃 | セキュリティ担当 | セキュリティRunbook参照 |

---

## 8. 事後対応

### 8.1 ポストモーテム

- 認証障害の根本原因を特定
- 影響を受けたユーザー数と時間を記録
- 対応タイムラインを記録

### 8.2 改善項目

- [ ] 認証システムのヘルスチェック強化
- [ ] JWT_SECRET のローテーション手順の自動化
- [ ] レートリミットの導入・調整
- [ ] 認証失敗の自動アラート設定
- [ ] バックアップ認証手段（OIDC等）の導入検討

---

## 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-03-02 | 初版作成 | 運用チーム |
