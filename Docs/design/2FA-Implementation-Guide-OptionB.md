# 2FA セキュリティ強化 実装ガイド (オプションB)

**作成日**: 2026-02-15
**作成者**: sec-auditor (Security Audit Agent)
**承認者**: team-lead
**対象読者**: code-implementer
**前提ドキュメント**: `Docs/design/2FA-Design.md`

---

## 概要

本ガイドは、既存2FA実装に対して以下3つのセキュリティ修正を適用するための詳細手順書です。

| 対策ID | 脆弱性 | 対策内容 |
|--------|--------|----------|
| V-01 | TOTPシークレット平文保存 | AES-256-GCM暗号化 |
| V-02 | バックアップコード平文保存 | bcryptハッシュ化 |
| V-03 | レート制限未適用 | `twoFactorLimiter` ミドルウェア適用 |

**実装順序**: V-03 -> V-02 -> V-01 (リスクの低い順に着手)

---

## 1. レート制限適用 (V-03)

**対象ファイル**: `backend/routes/auth/2fa.js`
**難易度**: 低
**影響範囲**: 小

### 1.1 変更内容

`twoFactorLimiter` ミドルウェアは既に `backend/middleware/rateLimiter.js` で定義済みです。各POSTルートへの適用のみが必要です。

### 1.2 手順

**Step 1**: import文を追加

```javascript
// backend/routes/auth/2fa.js の先頭 (既存のrequireブロック内に追加)
const { twoFactorLimiter } = require('../../middleware/rateLimiter');
```

**Step 2**: 各POSTルートに `twoFactorLimiter` を挿入

以下の4つのルートに適用:

```javascript
// (1) setup - 既存: router.post('/setup', authenticateJWT, async (req, res) => {
router.post('/setup', authenticateJWT, twoFactorLimiter, async (req, res) => {

// (2) verify - 既存: router.post('/verify', authenticateJWT, (req, res) => {
router.post('/verify', authenticateJWT, twoFactorLimiter, (req, res) => {

// (3) disable - 既存: router.post('/disable', authenticateJWT, (req, res) => {
router.post('/disable', authenticateJWT, twoFactorLimiter, (req, res) => {

// (4) backup-codes - 既存: router.post('/backup-codes', authenticateJWT, async (req, res) => {
router.post('/backup-codes', authenticateJWT, twoFactorLimiter, async (req, res) => {
```

**注意**: `authenticateJWT` の **後** に配置すること。認証を先に確認し、認証済みユーザーに対してのみレート制限を適用する。GETルート (`/status`) にはレート制限は不要。

### 1.3 レート制限の仕様 (参考)

```
本番環境: 5リクエスト / 5分 / IP
テスト環境: 20リクエスト / 1分 / IP
```

---

## 2. バックアップコードハッシュ化 (V-02)

**対象ファイル**:
- `backend/routes/auth/2fa.js` (生成・検証・再生成)
- `backend/services/authService.js` (ログイン時のバックアップコード照合)

**難易度**: 中
**影響範囲**: 中

### 2.1 設計方針

```
[現状]
生成 -> codes = ["A3F2B9C1", ...] -> JSON.stringify(codes) -> DB保存
検証 -> JSON.parse(db.backup_codes) -> indexOf(input)

[変更後]
生成 -> codes = ["A3F2B9C1", ...]
      -> hashedCodes = await Promise.all(codes.map(c => bcrypt.hash(c, 10)))
      -> JSON.stringify(hashedCodes) -> DB保存
      -> ユーザーには平文コードを返却 (この時だけ見える)

検証 -> JSON.parse(db.backup_codes) -> hashedCodes
      -> hashedCodes の各要素に対して bcrypt.compare(input, hash) で照合
      -> 一致したハッシュを配列から削除して更新
```

### 2.2 手順

**Step 1**: `generateBackupCodes()` 関数を修正

`backend/routes/auth/2fa.js` 内の既存関数:

```javascript
// 既存コード (行21-27)
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i += 1) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}
```

この関数自体は **変更不要** です。平文コードの生成ロジックはそのまま維持します。変更が必要なのは「保存時」と「検証時」の処理です。

**Step 2**: ハッシュ化保存ヘルパー関数を追加

`backend/routes/auth/2fa.js` の `generateBackupCodes()` の直後に追加:

```javascript
/**
 * バックアップコードをbcryptでハッシュ化する
 * @param {string[]} codes - 平文のバックアップコード配列
 * @returns {Promise<string[]>} ハッシュ化されたコード配列
 */
async function hashBackupCodes(codes) {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}

/**
 * 入力コードがハッシュ化されたバックアップコード配列に含まれるか検証する
 * @param {string} inputCode - ユーザー入力のコード
 * @param {string[]} hashedCodes - ハッシュ化されたコード配列
 * @returns {Promise<number>} 一致したインデックス。不一致なら -1
 */
async function verifyBackupCode(inputCode, hashedCodes) {
  for (let i = 0; i < hashedCodes.length; i += 1) {
    const match = await bcrypt.compare(inputCode, hashedCodes[i]);
    if (match) return i;
  }
  return -1;
}
```

**Step 3**: `/verify` エンドポイントの保存処理を修正

`backend/routes/auth/2fa.js` 内の `/verify` ルート (行145-167付近) を修正:

```javascript
// 変更前 (行145-152)
const backupCodes = generateBackupCodes();
db.run(
  'UPDATE users SET totp_enabled = 1, backup_codes = ? WHERE username = ?',
  [JSON.stringify(backupCodes), username],
  ...
);

// 変更後
const backupCodes = generateBackupCodes();
const hashedBackupCodes = await hashBackupCodes(backupCodes);
db.run(
  'UPDATE users SET totp_enabled = 1, backup_codes = ? WHERE username = ?',
  [JSON.stringify(hashedBackupCodes), username],
  ...
);
```

**重要**: レスポンスでユーザーに返す `backupCodes` は平文のまま返却すること(ハッシュ値を返してはならない)。ユーザーがコードを確認できるのはこの時だけです。

**注意**: `/verify` ルートのハンドラは現在 `(req, res)` で `async` でないため、`async (req, res)` に変更する必要があります。

**Step 4**: `/backup-codes` エンドポイントの再生成処理を修正

`backend/routes/auth/2fa.js` 内の `/backup-codes` ルート (行382-394付近) を修正:

```javascript
// 変更前 (行382-389)
const backupCodes = generateBackupCodes();
await new Promise((resolve, reject) => {
  db.run(
    'UPDATE users SET backup_codes = ? WHERE username = ?',
    [JSON.stringify(backupCodes), username],
    ...
  );
});

// 変更後
const backupCodes = generateBackupCodes();
const hashedBackupCodes = await hashBackupCodes(backupCodes);
await new Promise((resolve, reject) => {
  db.run(
    'UPDATE users SET backup_codes = ? WHERE username = ?',
    [JSON.stringify(hashedBackupCodes), username],
    ...
  );
});
```

同様に、レスポンスの `backupCodes` は平文を返却。

**Step 5**: `authService.js` のバックアップコード照合を修正

`backend/services/authService.js` の `login()` メソッド (行56-73付近) を修正:

```javascript
// 変更前 (行56-73)
if (user.backup_codes) {
  const backupCodes = JSON.parse(user.backup_codes);
  const codeIndex = backupCodes.indexOf(totpToken);

  if (codeIndex !== -1) {
    backupCodes.splice(codeIndex, 1);
    db.run('UPDATE users SET backup_codes = ? WHERE id = ?', [
      JSON.stringify(backupCodes),
      user.id
    ]);
  } else {
    return reject(new Error('Invalid 2FA token'));
  }
}

// 変更後
if (user.backup_codes) {
  const hashedCodes = JSON.parse(user.backup_codes);

  // 各ハッシュと比較 (bcrypt.compare)
  let matchIndex = -1;
  for (let i = 0; i < hashedCodes.length; i += 1) {
    const match = await bcrypt.compare(totpToken, hashedCodes[i]);
    if (match) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex !== -1) {
    hashedCodes.splice(matchIndex, 1);
    db.run('UPDATE users SET backup_codes = ? WHERE id = ?', [
      JSON.stringify(hashedCodes),
      user.id
    ]);
  } else {
    return reject(new Error('Invalid 2FA token'));
  }
}
```

**注意**: `authService.js` の `login()` 内のコールバックは既に `async` なので、`await bcrypt.compare()` がそのまま使えます。

### 2.3 後方互換性

既存の2FAユーザーのバックアップコードは平文で保存されています。移行期間中は、検証時にまず `bcrypt.compare()` を試み、失敗した場合は平文比較 (`===`) にフォールバックする方式を推奨します。

`authService.js` の照合部分に互換ロジックを追加:

```javascript
if (user.backup_codes) {
  const storedCodes = JSON.parse(user.backup_codes);

  let matchIndex = -1;

  // ハッシュ値かどうかを最初の要素で判定 (bcryptハッシュは $2a$ or $2b$ で始まる)
  const isHashed = storedCodes.length > 0 && storedCodes[0].startsWith('$2');

  if (isHashed) {
    // ハッシュ化済みコードとの照合
    for (let i = 0; i < storedCodes.length; i += 1) {
      const match = await bcrypt.compare(totpToken, storedCodes[i]);
      if (match) {
        matchIndex = i;
        break;
      }
    }
  } else {
    // 平文コードとの照合 (移行期間中の後方互換)
    matchIndex = storedCodes.indexOf(totpToken);
  }

  if (matchIndex !== -1) {
    storedCodes.splice(matchIndex, 1);
    db.run('UPDATE users SET backup_codes = ? WHERE id = ?', [
      JSON.stringify(storedCodes),
      user.id
    ]);
  } else {
    return reject(new Error('Invalid 2FA token'));
  }
}
```

---

## 3. TOTPシークレット暗号化 (V-01)

**新規作成ファイル**: `backend/utils/encryption.js`
**変更ファイル**:
- `backend/routes/auth/2fa.js`
- `backend/services/authService.js`
- `backend/migrations/003_enhance_2fa_security.js` (新規)

**難易度**: 中〜高
**影響範囲**: 中

### 3.1 環境変数の準備

**Step 1**: 暗号化キーを生成

```bash
openssl rand -base64 32
```

出力例: `k3Wj8mN2xR5vQ9yB1hT4fL7pA0sD6gE3cU8iO2wZ1a=`

**Step 2**: `.env` に追加

```
TOTP_ENCRYPTION_KEY=k3Wj8mN2xR5vQ9yB1hT4fL7pA0sD6gE3cU8iO2wZ1a=
```

**警告**: このキーを紛失すると、全ユーザーの2FAシークレットが復号不能になり、全員の2FA再設定が必要になります。安全にバックアップしてください。

### 3.2 暗号化ユーティリティ作成

**新規ファイル**: `backend/utils/encryption.js`

```javascript
/**
 * AES-256-GCM Encryption Utility for TOTP Secrets
 *
 * TOTP秘密鍵の暗号化・復号を担当する。
 * 環境変数 TOTP_ENCRYPTION_KEY が必要。
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;        // AES-GCM推奨のIV長 (128ビット)
const AUTH_TAG_LENGTH = 16;  // 認証タグ長 (128ビット)

/**
 * 環境変数から暗号化キーを取得
 * @returns {Buffer} 32バイトの暗号化キー
 * @throws {Error} 環境変数が未設定の場合
 */
function getEncryptionKey() {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'TOTP_ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: openssl rand -base64 32'
    );
  }
  // Base64デコードして32バイトキーを取得
  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length < 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must be at least 32 bytes when base64-decoded');
  }
  return keyBuffer.slice(0, 32);
}

/**
 * 平文を暗号化する
 * @param {string} plaintext - 暗号化する文字列
 * @returns {{ encrypted: string, iv: string }} 暗号文(hex)とIV(hex)
 */
function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // 暗号文 + 認証タグを結合して保存
  return {
    encrypted: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex')
  };
}

/**
 * 暗号文を復号する
 * @param {string} encryptedWithTag - 暗号文+認証タグ (hex)
 * @param {string} ivHex - IV (hex)
 * @returns {string} 復号された平文
 * @throws {Error} 復号失敗時 (改竄検出含む)
 */
function decrypt(encryptedWithTag, ivHex) {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');

  // 暗号文と認証タグを分離
  const authTagHex = encryptedWithTag.slice(-AUTH_TAG_LENGTH * 2);
  const encryptedHex = encryptedWithTag.slice(0, -AUTH_TAG_LENGTH * 2);

  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = { encrypt, decrypt };
```

### 3.3 DBマイグレーション

**新規ファイル**: `backend/migrations/003_enhance_2fa_security.js`

```javascript
/**
 * Enhance 2FA Security
 * - Add totp_secret_iv column for AES-256-GCM initialization vector storage
 * - Add audit columns for 2FA events
 */

exports.up = function (knex) {
  return knex.schema.table('users', (table) => {
    // AES-256-GCM のIV保存用 (hex文字列: 32文字)
    table.string('totp_secret_iv', 64);
    // 2FA有効化日時（監査証跡）
    table.timestamp('two_factor_enabled_at');
    // 2FA最終検証日時
    table.timestamp('two_factor_last_verified_at');
  });
};

exports.down = function (knex) {
  return knex.schema.table('users', (table) => {
    table.dropColumn('totp_secret_iv');
    table.dropColumn('two_factor_enabled_at');
    table.dropColumn('two_factor_last_verified_at');
  });
};
```

### 3.4 2fa.js の修正

**Step 1**: import 追加

```javascript
// backend/routes/auth/2fa.js の先頭に追加
const { encrypt, decrypt } = require('../../utils/encryption');
```

**Step 2**: `/setup` ルートの修正 (シークレット暗号化保存)

```javascript
// 変更前 (行53-57): 平文で保存
db.run(
  'UPDATE users SET totp_secret = ? WHERE username = ?',
  [secret.base32, username],
  ...
);

// 変更後: 暗号化して保存
const { encrypted, iv } = encrypt(secret.base32);
db.run(
  'UPDATE users SET totp_secret = ?, totp_secret_iv = ? WHERE username = ?',
  [encrypted, iv, username],
  ...
);
```

**Step 3**: `/verify` ルートの修正 (シークレット復号して検証)

```javascript
// 変更前 (行121): 平文で取得
db.get('SELECT totp_secret FROM users WHERE username = ?', [username], (err, row) => {
  ...
  const verified = speakeasy.totp.verify({
    secret: row.totp_secret,
    encoding: 'base32',
    token,
    window: 2
  });

// 変更後: 復号してから検証
db.get(
  'SELECT totp_secret, totp_secret_iv FROM users WHERE username = ?',
  [username],
  (err, row) => {
    ...
    // IVが存在すれば暗号化済み、なければ平文 (後方互換)
    let secret;
    if (row.totp_secret_iv) {
      secret = decrypt(row.totp_secret, row.totp_secret_iv);
    } else {
      secret = row.totp_secret;
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2
    });
```

さらに、2FA有効化成功時に `two_factor_enabled_at` を記録:

```javascript
// 変更前
'UPDATE users SET totp_enabled = 1, backup_codes = ? WHERE username = ?'

// 変更後
'UPDATE users SET totp_enabled = 1, backup_codes = ?, two_factor_enabled_at = CURRENT_TIMESTAMP WHERE username = ?'
```

**Step 4**: `/disable` ルートの修正

復号が必要な箇所を修正:

```javascript
// 変更前 (行225)
if (user.totp_enabled && user.totp_secret) {
  ...
  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    ...
  });

// 変更後
if (user.totp_enabled && user.totp_secret) {
  ...
  let secret;
  if (user.totp_secret_iv) {
    secret = decrypt(user.totp_secret, user.totp_secret_iv);
  } else {
    secret = user.totp_secret;
  }

  const verified = speakeasy.totp.verify({
    secret,
    ...
  });
```

無効化時にIVカラムもクリア:

```javascript
// 変更前
'UPDATE users SET totp_enabled = 0, totp_secret = NULL, backup_codes = NULL WHERE username = ?'

// 変更後
'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_secret_iv = NULL, backup_codes = NULL, two_factor_enabled_at = NULL WHERE username = ?'
```

**Step 5**: `/status` ルートの修正

クエリに `totp_secret_iv` は不要 (ステータス表示のみなので変更なし)。

### 3.5 authService.js の修正

`backend/services/authService.js` の `login()` メソッド内でTOTP検証に使う箇所:

```javascript
// import追加 (ファイル先頭)
const { decrypt } = require('../utils/encryption');

// login() メソッド内 (行42-53付近)

// 変更前
if (user.totp_enabled && user.totp_secret) {
  ...
  const verified = speakeasy.totp.verify({
    secret: user.totp_secret,
    encoding: 'base32',
    token: totpToken,
    window: 2
  });

// 変更後
if (user.totp_enabled && user.totp_secret) {
  ...
  // IVが存在すれば暗号化済み、なければ平文 (後方互換)
  let totpSecret;
  if (user.totp_secret_iv) {
    totpSecret = decrypt(user.totp_secret, user.totp_secret_iv);
  } else {
    totpSecret = user.totp_secret;
  }

  const verified = speakeasy.totp.verify({
    secret: totpSecret,
    encoding: 'base32',
    token: totpToken,
    window: 2
  });
```

### 3.6 復号ヘルパーパターン

全ての復号箇所で使う共通パターン:

```javascript
// IVの有無で暗号化済みか平文かを判別 (後方互換)
let secret;
if (row.totp_secret_iv) {
  secret = decrypt(row.totp_secret, row.totp_secret_iv);
} else {
  secret = row.totp_secret; // 平文 (移行前のデータ)
}
```

このパターンにより、マイグレーション前の既存ユーザーも引き続き動作します。

---

## 4. 既存ユーザー対応 (マイグレーション戦略)

### 4.1 方針

**既存2FAユーザーの再設定は不要**とします。以下の戦略を採用:

1. **新規設定**: 暗号化して保存 (暗号文 + IV)
2. **既存データ**: `totp_secret_iv` が NULL -> 平文と判定し、そのまま使用
3. **自然移行**: ユーザーが2FAを再設定 (disable -> setup -> verify) した時点で暗号化に切り替わる

### 4.2 一括暗号化スクリプト (任意)

既存データを一括で暗号化したい場合の移行スクリプト:

```javascript
// scripts/migrate-2fa-secrets.js (任意実行)
// 注意: 本番実行前にDBバックアップを取ること

const knex = require('../backend/knex');
const { encrypt } = require('../backend/utils/encryption');

async function migrateSecrets() {
  const users = await knex('users')
    .whereNotNull('totp_secret')
    .whereNull('totp_secret_iv');

  console.log(`Found ${users.length} users with plaintext TOTP secrets`);

  for (const user of users) {
    const { encrypted, iv } = encrypt(user.totp_secret);
    await knex('users')
      .where('id', user.id)
      .update({
        totp_secret: encrypted,
        totp_secret_iv: iv
      });
    console.log(`Migrated user: ${user.username}`);
  }

  console.log('Migration complete');
  process.exit(0);
}

migrateSecrets().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

**このスクリプトの実行は任意です。** 実行しなくても、後方互換ロジックにより既存ユーザーは問題なく動作します。

---

## 5. テスト項目

### 5.1 暗号化ユーティリティ テスト

**ファイル**: `backend/__tests__/unit/utils/encryption.test.js` (新規)

```
テストケース:
1. encrypt() で暗号化した値を decrypt() で復号すると元の値に戻る
2. encrypt() を2回呼ぶと異なる暗号文が生成される (IVがランダムなため)
3. 暗号文を改竄すると decrypt() がエラーをスローする (GCM認証タグ検証)
4. IVを改竄すると decrypt() がエラーをスローする
5. TOTP_ENCRYPTION_KEY が未設定の場合 getEncryptionKey() がエラーをスローする
6. TOTP_ENCRYPTION_KEY が短すぎる場合エラーをスローする
7. 日本語や特殊文字を含む文字列も正しく暗号化・復号できる
8. base32形式のTOTPシークレット (実際の使用ケース) が正しく処理される
```

### 5.2 バックアップコード ハッシュ化テスト

**ファイル**: `backend/__tests__/unit/auth/backupCodes.test.js` (新規 or 既存テストに追加)

```
テストケース:
1. hashBackupCodes() が10個のハッシュ値を返す
2. ハッシュ値は $2a$ または $2b$ で始まる (bcrypt形式)
3. verifyBackupCode() で正しいコードが一致する
4. verifyBackupCode() で間違ったコードが -1 を返す
5. 使用済みコード削除後に再度同じコードが不一致になる
6. 後方互換: 平文コードの $2 プレフィックス判定が正しく動作する
```

### 5.3 レート制限テスト

**ファイル**: `backend/__tests__/integration/auth/2fa-rateLimit.test.js` (新規)

```
テストケース:
1. /auth/2fa/verify に規定回数+1回リクエストを送ると 429 が返る
2. /auth/2fa/setup に規定回数+1回リクエストを送ると 429 が返る
3. 429レスポンスに retryAfter フィールドが含まれる
4. GET /auth/2fa/status にはレート制限がかからない
```

### 5.4 統合テスト (既存テストの修正)

既存の2FA関連テストが存在する場合、以下を確認:
- バックアップコードのハッシュ化対応後もログインフローが正常動作する
- 暗号化対応後も2FAのsetup -> verify -> login フローが正常動作する
- 2FA disable後に `totp_secret_iv` が NULL にリセットされる

---

## 6. 変更ファイル一覧

| 操作 | ファイルパス | 変更内容 |
|------|-------------|---------|
| **新規** | `backend/utils/encryption.js` | AES-256-GCM暗号化ユーティリティ |
| **新規** | `backend/migrations/003_enhance_2fa_security.js` | IVカラム・監査カラム追加 |
| **新規** | `scripts/migrate-2fa-secrets.js` | 一括暗号化スクリプト (任意) |
| **修正** | `backend/routes/auth/2fa.js` | レート制限適用 + 暗号化保存/復号読取 + ハッシュ化保存 |
| **修正** | `backend/services/authService.js` | 復号読取 + ハッシュ化バックアップコード照合 |
| **追加** | `.env` | `TOTP_ENCRYPTION_KEY` 環境変数 |
| **新規** | `backend/__tests__/unit/utils/encryption.test.js` | 暗号化ユーティリティのテスト |
| **新規** | `backend/__tests__/unit/auth/backupCodes.test.js` | バックアップコードのテスト |
| **新規** | `backend/__tests__/integration/auth/2fa-rateLimit.test.js` | レート制限のテスト |

---

## 7. 実装チェックリスト

### Phase 1: レート制限 (V-03) -- 最初に着手
- [ ] `twoFactorLimiter` のimport追加
- [ ] 4つのPOSTルートに `twoFactorLimiter` ミドルウェア追加
- [ ] レート制限テスト作成・実行
- [ ] 既存テストがパスすることを確認

### Phase 2: バックアップコードハッシュ化 (V-02)
- [ ] `hashBackupCodes()`, `verifyBackupCode()` ヘルパー関数追加
- [ ] `/verify` の保存処理をハッシュ化対応に修正
- [ ] `/backup-codes` の再生成処理をハッシュ化対応に修正
- [ ] `authService.js` のバックアップコード照合を修正 (後方互換含む)
- [ ] バックアップコードのテスト作成・実行
- [ ] 既存テストがパスすることを確認

### Phase 3: シークレット暗号化 (V-01)
- [ ] `backend/utils/encryption.js` 作成
- [ ] `backend/migrations/003_enhance_2fa_security.js` 作成
- [ ] マイグレーション実行
- [ ] `.env` に `TOTP_ENCRYPTION_KEY` 追加
- [ ] `/setup` を暗号化保存に修正
- [ ] `/verify` を復号検証に修正
- [ ] `/disable` を復号検証 + IVクリアに修正
- [ ] `authService.js` を復号対応に修正
- [ ] 暗号化ユーティリティのテスト作成・実行
- [ ] 統合テスト (全フロー) 実行
- [ ] 既存テストがパスすることを確認

### 最終確認
- [ ] `npm test` で全テストパス
- [ ] `npx eslint backend/` でLintエラー 0件
- [ ] 各Phaseごとにコミット (例: `fix(security): apply rate limiting to 2FA endpoints`)
