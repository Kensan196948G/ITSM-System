# 2FA (Two-Factor Authentication) 設計ドキュメント

**作成日**: 2026-02-15
**作成者**: sec-auditor (Security Audit Agent)
**ステータス**: レビュー待ち

---

## 1. 現状分析

### 1.1 既存実装の確認

既に以下の2FA関連コードが存在している:

| ファイル | 状態 | 内容 |
|---------|------|------|
| `backend/routes/auth/2fa.js` | 実装済み | setup, verify, disable, status, backup-codes エンドポイント |
| `backend/services/authService.js` | 実装済み | ログインフローでの2FA検証、バックアップコード照合 |
| `backend/migrations/002_add_2fa.js` | 実装済み | `totp_secret`, `totp_enabled`, `backup_codes` カラム追加 |
| `backend/middleware/rateLimiter.js` | 実装済み | `twoFactorLimiter` (5回/5分) |

### 1.2 既存認証フロー

```
[クライアント] --POST /auth/login--> [login.js]
    |                                    |
    |  { username, password, totpToken } |
    |                                    v
    |                          [authService.loginWithRefreshToken()]
    |                                    |
    |                          1. bcrypt.compare(password)
    |                          2. if (totp_enabled && totp_secret):
    |                             - totpToken未提供 -> { requires2FA: true }
    |                             - speakeasy.totp.verify() 検証
    |                             - 失敗時: backup_codes で照合
    |                          3. JWT発行 (JTI付き)
    |                          4. Refresh Token生成・保存
    |                                    |
    |  <-- { token, refreshToken, user } |
```

### 1.3 既存DBスキーマ (usersテーブル 2FA関連カラム)

```sql
totp_secret  TEXT(255)    -- TOTP秘密鍵 (base32エンコード)
totp_enabled BOOLEAN      -- 2FA有効フラグ (DEFAULT 0)
backup_codes TEXT          -- バックアップコード (JSON配列)
```

---

## 2. セキュリティ要件

### 2.1 TOTP (Time-based OTP) 方式の採用理由

| 評価観点 | TOTP | SMS OTP | メールOTP |
|---------|------|---------|----------|
| オフライン利用 | 可能 | 不可 | 不可 |
| SIMスワップ耐性 | 高 | 低 | 中 |
| 導入コスト | 低 (ライブラリのみ) | 高 (SMS API) | 中 (メール基盤) |
| ユーザビリティ | 中 | 高 | 中 |
| RFC準拠 | RFC 6238 | - | - |
| 既存実装との整合性 | speakeasy既に導入済み | 追加パッケージ必要 | 追加パッケージ必要 |

**結論**: TOTP方式は本システムの要件（低コスト・オフライン利用・高セキュリティ）に最も適合する。また、`speakeasy` および `qrcode` パッケージが既に `package.json` に含まれている。

### 2.2 シークレットキーの保存方法

**現状**: `totp_secret` は base32 エンコードのまま平文でDBに保存されている。

**セキュリティ上の懸念**:
- DB漏洩時にシークレットキーがそのまま攻撃者に渡る
- シークレットを知れば任意のTOTPコードを生成可能

**推奨改善策**: アプリケーション層暗号化 (ALE)

```
保存時: totp_secret -> AES-256-GCM暗号化 -> DBに保存
読取時: DB -> AES-256-GCM復号 -> totp_secret
```

- 暗号化キーは環境変数 `TOTP_ENCRYPTION_KEY` で管理
- bcryptハッシュ化は **不可** (検証時に元の値が必要なため)
- AES-256-GCM は認証付き暗号化のため改竄検出も可能

**影響範囲**: 中 (authService.js, routes/auth/2fa.js の読み書き箇所)
**リスク**: 低 (暗号化キー紛失時は全ユーザーの2FA再設定が必要)

### 2.3 リカバリーコード生成・管理方針

**現状の実装**:
- `crypto.randomBytes(4).toString('hex').toUpperCase()` で8文字のコード10個を生成
- JSON配列として平文でDBに保存
- バックアップコードでのログイン時に使用済みコードを配列から削除

**推奨改善策**:

1. **コード形式**: 現行の8文字16進数 (例: `A3F2B9C1`) は十分なエントロピー (32ビット)
   - ブルートフォースに対して 2^32 = 約43億通り
   - レート制限 (5回/5分) と組み合わせれば実質安全

2. **保存方法の改善**: 個別ハッシュ化
   ```
   生成時: codes = [code1, code2, ...code10]
           hashed = codes.map(c => bcrypt.hash(c, 10))
           DB保存: JSON.stringify(hashed)
           ユーザー表示: codes (平文、この時のみ)

   検証時: DB読取 -> hashed_codes
           hashed_codes.some(h => bcrypt.compare(input, h))
           一致したハッシュを配列から削除
   ```

3. **運用ルール**:
   - 再生成時は既存コード全て無効化 (現行通り)
   - 再生成には パスワード + 現在のTOTPトークン の両方が必要 (現行通り)
   - 残り3個以下で警告表示を推奨

### 2.4 セッション管理 (2FA検証後のトークン更新)

**現状のフロー**:
1. ログインAPI で `username + password + totpToken` を一括送信
2. 全て検証成功後に JWT + Refresh Token を発行

**課題**: `totpToken` なしでログインすると `{ requires2FA: true }` が返るが、この時点でパスワード検証は成功している。クライアントが2回目のリクエストで `totpToken` を送信する際、パスワードも再送する必要がある。

**推奨改善策**: 2段階認証フロー

```
Step 1: POST /auth/login { username, password }
  -> パスワード検証成功 + 2FA有効
  -> { requires2FA: true, tempToken: "<短命JWT, 5分>" }

Step 2: POST /auth/login { tempToken, totpToken }
  -> tempToken検証 + TOTP検証
  -> { token, refreshToken, user }
```

**利点**:
- パスワードの再送が不要 (ネットワーク上のリスク軽減)
- `tempToken` は短命 (5分) かつ2FA専用スコープ
- 既存のクライアント実装にも概ね互換性あり (現行の一括送信も引き続きサポート可能)

**影響範囲**: 中 (authService.js のログインフロー、login.js のルート)
**リスク**: 低 (後方互換性を維持する設計)

---

## 3. API設計

### 3.1 既存エンドポイント (実装済み)

以下は既に実装が存在するエンドポイント:

#### POST /api/v1/auth/2fa/setup
- **認証**: 必須 (`authenticateJWT`)
- **リクエスト**: なし (認証済みユーザーのみ)
- **レスポンス**:
  ```json
  {
    "message": "2FA設定用のQRコードを生成しました",
    "qrCode": "data:image/png;base64,...",
    "secret": "JBSWY3DPEHPK3PXP...",
    "otpauthUrl": "otpauth://totp/ITSM-Sec%20Nexus%20(admin)?secret=...",
    "instructions": "Google AuthenticatorまたはAuthyアプリで..."
  }
  ```
- **処理フロー**:
  1. `speakeasy.generateSecret()` でシークレット生成 (length: 32)
  2. `users.totp_secret` にbase32値を保存 (まだ有効化しない)
  3. `QRCode.toDataURL()` でQRコードデータURL生成
  4. クライアントに秘密鍵とQRコードを返却

#### POST /api/v1/auth/2fa/verify
- **認証**: 必須 (`authenticateJWT`)
- **リクエスト**: `{ token: "123456" }` (6桁のTOTPコード)
- **レスポンス**:
  ```json
  {
    "message": "2FAが正常に有効化されました",
    "backupCodes": ["A3F2B9C1", "D7E8F0A2", ...],
    "warning": "バックアップコードを安全な場所に保存してください..."
  }
  ```
- **処理フロー**:
  1. `speakeasy.totp.verify()` でトークン検証 (window: 2)
  2. バックアップコード10個を生成
  3. `users.totp_enabled = 1`, `users.backup_codes = JSON.stringify(codes)` に更新
  4. セキュリティログ記録

#### POST /api/v1/auth/2fa/disable
- **認証**: 必須 (`authenticateJWT`)
- **リクエスト**: `{ password: "...", token: "123456" }` (2FA有効時はtoken必須)
- **レスポンス**: `{ message: "2FAが正常に無効化されました" }`
- **処理フロー**:
  1. `bcrypt.compare()` でパスワード検証
  2. 2FA有効の場合、`speakeasy.totp.verify()` でトークン検証
  3. `totp_enabled = 0, totp_secret = NULL, backup_codes = NULL` にリセット

#### GET /api/v1/auth/2fa/status
- **認証**: 必須 (`authenticateJWT`)
- **レスポンス**:
  ```json
  {
    "enabled": true,
    "configured": true,
    "backupCodesRemaining": 8
  }
  ```

#### POST /api/v1/auth/2fa/backup-codes
- **認証**: 必須 (`authenticateJWT`)
- **リクエスト**: `{ password: "...", token: "123456" }`
- **レスポンス**: `{ backupCodes: [...], warning: "..." }`

### 3.2 追加推奨エンドポイント

#### POST /api/v1/auth/2fa/validate (新規)
- **目的**: ログインフローの2段階目 (パスワード検証済み後のTOTP検証)
- **リクエスト**: `{ tempToken: "...", totpToken: "123456" }`
- **レスポンス**: `{ token, refreshToken, user, expiresAt }`
- **レート制限**: `twoFactorLimiter` (5回/5分)

---

## 4. DBスキーマ

### 4.1 既存マイグレーション (002_add_2fa.js)

```javascript
exports.up = function (knex) {
  return knex.schema.table('users', (table) => {
    table.string('totp_secret', 255);
    table.boolean('totp_enabled').defaultTo(false);
    table.text('backup_codes');
  });
};
```

### 4.2 追加マイグレーション案 (推奨)

暗号化対応とセキュリティ強化のために以下を検討:

```javascript
// 20260215_enhance_2fa_security.js
exports.up = function (knex) {
  return knex.schema.table('users', (table) => {
    // 暗号化されたシークレットの初期化ベクター保存用
    table.string('totp_secret_iv', 32);
    // 2FA設定日時（監査証跡）
    table.timestamp('two_factor_enabled_at');
    // 2FA最終検証日時
    table.timestamp('two_factor_last_verified_at');
    // 2FA失敗回数（アカウントロック用）
    table.integer('two_factor_failed_attempts').defaultTo(0);
  });
};
```

**注意**: 既存カラム名の変更は行わない（後方互換性維持）。提示の `two_factor_secret` / `two_factor_enabled` / `recovery_codes` への改名は **不要** と判断。既に `totp_secret` / `totp_enabled` / `backup_codes` で実装が進んでおり、改名のリスクが利点を上回る。

---

## 5. セキュリティレビュー

### 5.1 脆弱性分析

| ID | 脆弱性 | 深刻度 | 現状 | 推奨対策 |
|----|--------|--------|------|----------|
| V-01 | シークレットキー平文保存 | 高 | `totp_secret` がbase32平文 | AES-256-GCM暗号化 (セクション2.2参照) |
| V-02 | バックアップコード平文保存 | 高 | `backup_codes` がJSON平文 | bcryptハッシュ化 (セクション2.3参照) |
| V-03 | レート制限未適用 (2FA routes) | 中 | `twoFactorLimiter` は定義済みだが2fa.jsで未使用 | 各エンドポイントに `twoFactorLimiter` を適用 |
| V-04 | 2FA setup時のシークレット漏洩 | 低 | QRコード + base32秘密鍵をレスポンスで返却 | HTTPS必須化の確認（現状OK: 6443ポート） |
| V-05 | バックアップコード照合がタイミング攻撃に弱い | 低 | `indexOf()` で比較 | `crypto.timingSafeEqual()` 使用を推奨 |
| V-06 | 2FA無効化の監査証跡不足 | 低 | `logger.info` のみ | 監査ログテーブルへの記録を追加 |
| V-07 | セッションハイジャック時の2FAバイパス | 中 | JWT盗取で2FA不要 | 機密操作時のステップアップ認証を検討 |

### 5.2 修復優先度

```
優先度 高: V-01 (シークレット暗号化), V-02 (バックアップコードハッシュ化)
優先度 中: V-03 (レート制限適用), V-07 (ステップアップ認証)
優先度 低: V-04, V-05, V-06
```

### 5.3 修復オプション

#### オプションA: 最小限修正 (推奨)
- **内容**: V-03 (レート制限適用) のみ即座に実施
- **影響範囲**: 小 (`routes/auth/2fa.js` のルート定義にミドルウェア追加のみ)
- **リスク**: 低
- **工数**: 30分以内

#### オプションB: セキュリティ標準準拠
- **内容**: V-01, V-02, V-03 を実施
- **影響範囲**: 中 (暗号化ユーティリティ新規作成、authService修正、マイグレーション追加)
- **リスク**: 中 (既存ユーザーの2FA再設定が必要になる可能性)
- **工数**: 数時間

#### オプションC: フル強化
- **内容**: V-01〜V-07 すべて実施
- **影響範囲**: 大 (認証フロー全体の変更、フロントエンド改修も必要)
- **リスク**: 高 (広範囲な変更による既存テスト破壊リスク)
- **工数**: 1〜2日

---

## 6. フロントエンド統合

### 6.1 既存フロントエンドとの整合性

`frontend/app.js` のログインフローで `totpToken` が送信される仕組みの確認が必要:
- ログイン画面に2FA入力フィールドが存在するか
- `requires2FA: true` レスポンスに対するハンドリングがあるか
- 2FAセットアップ画面 (QRコード表示) が存在するか

### 6.2 必要なUI要素

1. **ログイン画面**: 2FAコード入力フィールド（`requires2FA` 時に表示）
2. **セキュリティ設定画面**: 2FAの有効化/無効化UI
3. **QRコード表示**: セットアップ時のモーダル
4. **バックアップコード表示**: 初回セットアップ時 + 再生成時

---

## 7. 実装チェックリスト

### 既存実装の検証
- [ ] `routes/auth/2fa.js` の各エンドポイントが正常動作するか
- [ ] ログインフローでの2FA統合が動作するか
- [ ] バックアップコードでのログインが動作するか
- [ ] フロントエンドUI確認

### セキュリティ強化 (修復オプション選択後)
- [ ] V-03: `twoFactorLimiter` を 2fa.js の各POSTルートに適用
- [ ] (オプションB選択時) V-01: シークレット暗号化ユーティリティ作成
- [ ] (オプションB選択時) V-02: バックアップコードのハッシュ化対応
- [ ] (オプションC選択時) V-05〜V-07 の各対策

### テスト
- [ ] 2FA setup/verify/disable の単体テスト
- [ ] ログインフローでの2FA統合テスト
- [ ] レート制限テスト
- [ ] バックアップコードの消費テスト
- [ ] エッジケース (期限切れトークン、無効コード、DBエラー)

---

## 8. 依存パッケージ

既に `package.json` に含まれている:
- `speakeasy`: TOTP生成・検証
- `qrcode`: QRコード生成
- `bcryptjs`: パスワードハッシュ、バックアップコードハッシュ化候補

追加パッケージは **不要**。

---

## 9. まとめ

### 設計判断サマリー

| 項目 | 判断 | 理由 |
|------|------|------|
| 認証方式 | TOTP (RFC 6238) | 低コスト、オフライン利用可、既存ライブラリ活用 |
| DBカラム命名 | 既存維持 (`totp_*`) | 改名リスクが利点を上回る |
| シークレット保存 | 暗号化推奨 | DB漏洩リスクへの対策 |
| バックアップコード | ハッシュ化推奨 | 同上 |
| 認証フロー | 一括送信 + 2段階の両対応 | 後方互換性維持 |
| 追加パッケージ | 不要 | 既存依存で充足 |

### 即時対応推奨事項
1. **V-03**: `twoFactorLimiter` の適用 (既存定義の活用のみ)
2. 既存実装の動作検証テスト作成
3. フロントエンドUIの2FA対応状況確認
