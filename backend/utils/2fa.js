/**
 * 2FA Utility Functions
 * バックアップコードのハッシュ化・検証用ヘルパー
 */

const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

/**
 * バックアップコード配列をbcryptでハッシュ化
 * @param {string[]} codes - 平文のバックアップコード配列
 * @returns {Promise<string[]>} ハッシュ化されたコード配列
 */
async function hashBackupCodes(codes) {
  return Promise.all(codes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)));
}

/**
 * 入力コードをハッシュ済みコード配列と照合
 * @param {string} inputCode - ユーザーが入力したコード
 * @param {string[]} hashedCodes - ハッシュ済みバックアップコード配列
 * @returns {Promise<number>} マッチしたインデックス、見つからない場合は -1
 */
async function verifyBackupCode(inputCode, hashedCodes) {
  // eslint-disable-next-line no-await-in-loop
  for (let i = 0; i < hashedCodes.length; i += 1) {
    const match = await bcrypt.compare(inputCode, hashedCodes[i]);
    if (match) return i;
  }
  return -1;
}

/**
 * コード配列がbcryptハッシュ済みかどうかを判定
 * bcryptハッシュは常に "$2a$" または "$2b$" で始まる
 * @param {string[]} codes - コード配列
 * @returns {boolean} ハッシュ済みならtrue
 */
function isHashedCodes(codes) {
  if (!codes || codes.length === 0) return false;
  return codes[0].startsWith('$2');
}

module.exports = {
  hashBackupCodes,
  verifyBackupCode,
  isHashedCodes,
  BCRYPT_ROUNDS
};
