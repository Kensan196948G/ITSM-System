/**
 * Microsoft Graph API サービス（無効化）
 *
 * このサービスは非対話型認証を使用するため無効化されています。
 * Microsoft 365 Graph API は利用しません。
 *
 * @module services/microsoftGraphService
 */

const logger = require('../utils/logger');

/**
 * Microsoft Graph API クライアント（スタブ）
 * すべてのメソッドは「未設定」として動作します
 */
class MicrosoftGraphService {
  constructor() {
    this.config = {
      tenantId: null,
      clientId: null,
      clientSecret: null,
      graphEndpoint: null
    };
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * 設定の検証（常にfalse）
   * @returns {boolean} 常にfalse
   */
  isConfigured() {
    return false;
  }

  /**
   * アクセストークンの取得（無効化）
   * @returns {Promise<never>} 常にエラー
   */
  async getAccessToken() {
    throw new Error('Microsoft Graph API は無効化されています。非対話型認証を使用してください。');
  }

  /**
   * ユーザー一覧の取得（無効化）
   * @returns {Promise<Array>} 空配列
   */
  async getUsers() {
    logger.warn('[MicrosoftGraphService] 無効化されています。空の配列を返します。');
    return [];
  }

  /**
   * ユーザー詳細の取得（無効化）
   * @param {string} userId ユーザーID
   * @returns {Promise<null>} 常にnull
   */
  async getUserById(userId) {
    logger.warn(`[MicrosoftGraphService] 無効化されています。userId=${userId}`);
    return null;
  }

  /**
   * ユーザー同期（無効化）
   * @returns {Promise<Object>} 同期結果（スキップ）
   */
  async syncUsersToDatabase() {
    logger.warn('[MicrosoftGraphService] 無効化されています。同期をスキップします。');
    return {
      success: true,
      synced: 0,
      skipped: true,
      message: 'Microsoft Graph API は無効化されています'
    };
  }

  /**
   * グループ一覧の取得（無効化）
   * @returns {Promise<Array>} 空配列
   */
  async getGroups() {
    logger.warn('[MicrosoftGraphService] 無効化されています。空の配列を返します。');
    return [];
  }

  /**
   * グループメンバーの取得（無効化）
   * @param {string} groupId グループID
   * @returns {Promise<Array>} 空配列
   */
  async getGroupMembers(groupId) {
    logger.warn(`[MicrosoftGraphService] 無効化されています。groupId=${groupId}`);
    return [];
  }
}

// シングルトンインスタンス
const microsoftGraphService = new MicrosoftGraphService();

module.exports = {
  MicrosoftGraphService,
  microsoftGraphService
};
