/**
 * Encryption Utility - AES-256-GCM
 * TOTP秘密鍵の暗号化・復号に使用
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

/**
 * 暗号化キーを取得
 * 環境変数 TOTP_ENCRYPTION_KEY (base64) から読み込む
 * @returns {Buffer} 32バイトの暗号化キー
 */
function getEncryptionKey() {
  const keyBase64 = process.env.TOTP_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('TOTP_ENCRYPTION_KEY environment variable is not set');
  }
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('TOTP_ENCRYPTION_KEY must be 32 bytes (256 bits) when decoded from base64');
  }
  return key;
}

/**
 * 平文をAES-256-GCMで暗号化
 * @param {string} plaintext - 暗号化する平文
 * @param {Buffer} [key] - 暗号化キー (省略時は環境変数から取得)
 * @returns {{ encrypted: string, iv: string, authTag: string }} hex形式の暗号化データ
 */
function encrypt(plaintext, key) {
  const encKey = key || getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * AES-256-GCMで暗号化されたデータを復号
 * @param {string} encrypted - hex形式の暗号文
 * @param {string} iv - hex形式のIV
 * @param {string} authTag - hex形式の認証タグ
 * @param {Buffer} [key] - 暗号化キー (省略時は環境変数から取得)
 * @returns {string} 復号された平文
 */
function decrypt(encrypted, iv, authTag, key) {
  const encKey = key || getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, encKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt,
  getEncryptionKey,
  ALGORITHM,
  IV_LENGTH,
  AUTH_TAG_LENGTH
};
